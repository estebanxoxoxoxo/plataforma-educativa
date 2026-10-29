import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* Los PUNTOS DE SYNC de las medallas fuera de las ligas y los HECHOS que registran sus dueños (revisión de U5: ninguno tenía
   test), con los módulos DE VERDAD —learnResults (POST /api/learn/results), learnRoutes (importar en Crear), space (guardar
   en Mi espacio), friendsFake (aceptar un amigo y el auto-aceptar del NPC)— y medals/progress de verdad. Lo persistido va a
   una carpeta TEMPORAL ('../config' con SERVER_ROOT en un tmp nuevo por arranque; server/data NO se toca). Cada caso arranca
   un grafo de módulos NUEVO (vi.resetModules: un server recién prendido, sin ningún slice de medallas), así el ensureMedals
   ANTES de mover el hecho es decisivo: si el slice naciera después, lo nuevo entraría al seed como "ya visto" (sin "Nueva"
   ni noticia). Se mockea lo que no se prueba y saldría del proceso o leería server/data: el filtro de palabras y la lista
   blanca ('../filters'), el catálogo de videos ('../videos'), la config del padre ('../parent') y el chat y los jueces con
   modelo ('../chat', '../judge', '../llm'). */

const T = vi.hoisted(() => ({ dirs: [] as string[] }));
vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  const { mkdtempSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');
  const dir = mkdtempSync(j(tmpdir(), 'innerith-medalsync-'));
  mkdirSync(j(dir, 'data'));
  T.dirs.push(dir);
  return { ...actual, SERVER_ROOT: dir };
});
vi.mock('../filters', () => ({ matchBlockedWord: () => null, isAllowedArticleSite: () => true }));
vi.mock('../videos', () => ({ getCatalogVideo: () => undefined, toVideoResult: (v: unknown) => v }));
vi.mock('../parent', () => ({
  featureOn: (_k: string, id: string) => id === 'ian' || id === 'luna', // fail-closed para el adulto, como el de verdad
  featureOnNow: () => true, blackTopicsAll: () => [], familyTopics: () => ({ white: [], black: [] }),
  notifyParent: () => {}, topicHit: () => null,
}));
vi.mock('../chat', () => ({ guionCrisis: () => '' }));
vi.mock('../judge', () => ({ judgeOutput: async () => ({ verdict: 'ok' }) }));
vi.mock('../llm', () => ({ complete: async () => '', parseJudgeJson: () => null, spotlight: (s: string) => s }));

/** Un server recién prendido (módulos nuevos, ningún slice de medallas). Las noticias de medalla anotan el CONTEXTO en que
 *  llegan (la de verdad escribe en lo vivo del usuario del contexto). */
async function boot() {
  // El mock de '../config' queda en caché entre arranques (vi.resetModules no lo re-crea): la carpeta temporal es la misma,
  // así que cada arranque la vacía —lo persistido del caso anterior no existe para éste—.
  for (const d of T.dirs) for (const f of readdirSync(join(d, 'data'))) rmSync(join(d, 'data', f), { recursive: true, force: true });
  vi.resetModules();
  const M = await import('../medals');
  const LR = await import('../learnResults');
  const RT = await import('../learnRoutes');
  const S = await import('../space');
  const Fr = await import('../friendsFake');
  const { routeRuns } = await import('../learnProgress');
  const { currentUser, runAsUser } = await import('../requestContext');
  const news: string[] = [];
  M.registerMedalNews((m) => { news.push(`${currentUser()?.id}:${m.id}`); });
  M.registerMedalGate(() => true);
  const pila = (uid: string) => M.medalsOf(uid).map(m => m.id + (m.fresh ? '*' : ''));
  const medal = (uid: string, id: string) => M.medalsOf(uid).find(m => m.id === id);
  return { M, LR, RT, S, Fr, routeRuns, runAsUser, news, pila, medal, dir: T.dirs[T.dirs.length - 1] };
}
type Boot = Awaited<ReturnType<typeof boot>>;

function call(b: Boot, route: (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void>, user: string, method: string, path: string, body?: unknown):
  Promise<{ status: number; body: any }> {
  // Buffers, como los de un pedido de verdad (el lector de learnResults los concatena con Buffer.concat)
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;
  Object.assign(req, { method, url: path, headers: { 'x-innerith-user': user } });
  return new Promise(resolve => {
    let status = 0;
    const res = { writeHead: (s: number) => { status = s; }, end: (raw: string) => resolve({ status, body: JSON.parse(raw) }) } as unknown as ServerResponse;
    void b.runAsUser(user, () => route(req, res, new URL(path, 'http://localhost')));
  });
}
const at = (iso: string) => { vi.setSystemTime(new Date(iso)); return Date.parse(iso); };
const result = (target: string, p: { outcome?: string; pct?: number; source?: string; rollup?: boolean } = {}) =>
  ({ target, source: p.source ?? 'ruta:ruta.fix/posta:p1', typeId: 'flashcards', outcome: p.outcome ?? 'completed', score: 4, maxScore: 5, pct: p.pct ?? 0.8, ...(p.rollup ? { rollup: true } : {}) });
/** Un bundle mínimo que pasa el importador del porte (sin definiciones: el acuñado seco no tiene nada que acuñar). */
const bundle = (id: string, title = 'Ruta de prueba') => ({
  kind: 'smarty-route-bundle', schemaVersion: 1,
  route: { id, title, emoji: '🧪', postas: [{ id: 'p1', kind: 'activity', target: `${id}.t1` }, { id: 'p2', kind: 'activity', target: `${id}.t2` }, { id: 'r1', kind: 'recall', target: `${id}.recall` }] },
  definitions: [],
});

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });
afterAll(async () => {
  const { rmSync } = await import('node:fs');
  for (const d of T.dirs) if (d.includes('innerith-medalsync-')) rmSync(d, { recursive: true, force: true });
});

describe('Learn: POST /api/learn/results sincroniza en las DOS ramas (la que paga y la que no)', () => {
  it('la primera partida completada de un objetivo (paga): «Primera posta» NUEVA con la fecha de la fila y su noticia en el feed de quien jugó', async () => {
    const b = await boot();
    at('2026-10-20T10:00:00Z');
    const r = await call(b, b.LR.learnResultsRoutes, 'luna', 'POST', '/api/learn/results', result('fix.a1', { pct: 0.6 }));
    expect(r.status).toBe(200);
    expect(r.body.awarded).toEqual({ ec: 30, xp: 30 });
    expect(b.medal('luna', 'primera-posta')).toMatchObject({ at: r.body.row.finishedAt, fresh: true });
    expect(b.news).toEqual(['luna:primera-posta']);
  });
  it('una partida que NO paga (repetir el objetivo, ahora sin errores) también sincroniza: «Sin un error» NUEVA', async () => {
    const b = await boot();
    at('2026-10-20T10:00:00Z');
    await call(b, b.LR.learnResultsRoutes, 'luna', 'POST', '/api/learn/results', result('fix.b1', { pct: 0.6 }));
    at('2026-10-21T10:00:00Z');
    const r = await call(b, b.LR.learnResultsRoutes, 'luna', 'POST', '/api/learn/results', result('fix.b1', { pct: 1 }));
    expect(r.body).not.toHaveProperty('awarded'); // el replay no paga
    expect(b.medal('luna', 'posta-perfecta')).toMatchObject({ at: r.body.row.finishedAt, fresh: true });
    expect(b.news).toEqual(['luna:primera-posta', 'luna:posta-perfecta']);
  });
  it('«Ruta completa»: rendirse (o quedarse sin tiempo) en todas las postas NO la da —el camino sí las marca: su quirk—; completarlas sí, con la fecha de la fila que completó la ruta', async () => {
    const b = await boot();
    at('2026-10-20T09:00:00Z');
    expect((await call(b, b.RT.learnRoutesRoutes, 'andres', 'POST', '/api/learn-routes/import', { bundle: bundle('ruta.fix-rc') })).body.ok).toBe(true);
    at('2026-10-20T10:00:00Z');
    await call(b, b.LR.learnResultsRoutes, 'ian', 'POST', '/api/learn/results', result('ruta.fix-rc.t1', { outcome: 'aborted', pct: 0 }));
    await call(b, b.LR.learnResultsRoutes, 'ian', 'POST', '/api/learn/results', result('ruta.fix-rc.t2', { outcome: 'timeout', pct: 0.2 }));
    const camino = () => b.routeRuns(b.RT.catalogRoutes(), b.LR.resultRowsOf('ian')).find(x => x.id === 'ruta.fix-rc');
    expect(camino()).toMatchObject({ done: 2, total: 2 }); // el camino del POC: "rendirse también logra" (quirk 1, intacto)
    expect(b.medal('ian', 'ruta-completa')).toBeUndefined();
    expect(b.medal('ian', 'primera-posta')).toBeUndefined();
    at('2026-10-21T10:00:00Z');
    await call(b, b.LR.learnResultsRoutes, 'ian', 'POST', '/api/learn/results', result('ruta.fix-rc.t1'));
    expect(b.medal('ian', 'ruta-completa')).toBeUndefined();
    const t = at('2026-10-22T10:00:00Z');
    await call(b, b.LR.learnResultsRoutes, 'ian', 'POST', '/api/learn/results', result('ruta.fix-rc.t2'));
    expect(b.medal('ian', 'ruta-completa')).toEqual({ id: 'ruta-completa', emoji: '🗺️', title: 'Ruta completa', text: 'Completaste todas las postas de una ruta.', at: t, fresh: true });
    // tras el F5 (re-siembra desde los hechos persistidos) la fecha es la misma: sale del hecho, no de "cuando se sincronizó"
    b.M.resetMedals('ian');
    expect(b.medal('ian', 'ruta-completa')?.at).toBe(t);
  });
});

describe('Crear: importar una ruta («Tu primera ruta»); una reimportación conserva el autor Y la fecha', () => {
  it('el autor es quien la importó primero, con su fecha; reimportarla (editarla en /crear, o que la importe otro) no los pisa; nada de eso se sirve', async () => {
    const b = await boot();
    const t1 = at('2026-10-20T10:00:00Z');
    const imp = await call(b, b.RT.learnRoutesRoutes, 'ian', 'POST', '/api/learn-routes/import', { bundle: bundle('ruta.fix-crear') });
    // el resultado del importador del porte, EXACTO (sin campos nuevos)
    expect(imp).toEqual({ status: 200, body: { ok: true, routeId: 'ruta.fix-crear', title: 'Ruta de prueba', definitions: 0, postas: 3 } });
    expect(b.medal('ian', 'ruta-creada')).toMatchObject({ at: t1, fresh: true });
    expect(b.news).toEqual(['ian:ruta-creada']);
    const t2 = at('2026-10-25T10:00:00Z');
    expect((await call(b, b.RT.learnRoutesRoutes, 'luna', 'POST', '/api/learn-routes/import', { bundle: bundle('ruta.fix-crear', 'Ruta editada') })).body.ok).toBe(true);
    expect(b.medal('luna', 'ruta-creada')).toBeUndefined(); // el autor sigue siendo Ian
    expect(b.RT.routesCreatedBy('ian')).toBe(1);
    // en disco: el autor y la fecha de la PRIMERA importación; importedAt es la de la última (como siempre)
    const row = JSON.parse(readFileSync(join(b.dir, 'data', 'learn-routes.json'), 'utf8')).routes.find((x: { id: string }) => x.id === 'ruta.fix-crear');
    expect(row).toMatchObject({ createdBy: 'ian', createdAt: t1, importedAt: t2 });
    expect(row.route.title).toBe('Ruta editada');
    // el F5 de Ian (re-siembra desde los hechos): «Desde el…» sigue siendo el día que la armó, no el de la edición
    b.M.resetMedals('ian');
    expect(b.medal('ian', 'ruta-creada')?.at).toBe(t1);
    // no se sirven: ni la lista ni la ruta entera dicen quién ni cuándo la armó
    const list = await call(b, b.RT.learnRoutesRoutes, 'luna', 'GET', '/api/learn-routes');
    expect(list.body.routes.find((x: { id: string }) => x.id === 'ruta.fix-crear')).toMatchObject({ importedAt: t2 });
    const one = await call(b, b.RT.learnRoutesRoutes, 'luna', 'GET', '/api/learn-routes/one?id=ruta.fix-crear');
    expect(one.status).toBe(200);
    expect(JSON.stringify(list.body) + JSON.stringify(one.body)).not.toMatch(/createdBy|createdAt/);
    // borrada: ya no cuenta (y tras el F5 la medalla se va con su hecho: borde §5.6)
    expect((await call(b, b.RT.learnRoutesRoutes, 'ian', 'POST', '/api/learn-routes/delete', { id: 'ruta.fix-crear' })).body).toEqual({ ok: true });
    expect(b.RT.routesCreatedBy('ian')).toBe(0);
    b.M.resetMedals('ian');
    expect(b.medal('ian', 'ruta-creada')).toBeUndefined();
  });
});

describe('Mi espacio: guardar («Tu primer guardado») y su hecho —la papelera cuenta, lo purgado no—', () => {
  it('el primer guardado de Andrés: medalla NUEVA con la fecha del guardado y su noticia; papelera y purga', async () => {
    const b = await boot();
    const t = at('2026-10-20T10:00:00Z');
    // FS-BASE-A: solo se guardan imágenes de los orígenes de Buscar (Pixabay / Wikimedia Commons)
    const r = b.runAsUser('andres', () => b.S.saveItem({ image: { url: 'https://upload.wikimedia.org/dibujo.png', caption: 'Un dibujo' } }));
    expect(r.error).toBeUndefined();
    expect(b.medal('andres', 'primer-guardado')).toMatchObject({ at: t, fresh: true });
    expect(b.news).toEqual(['andres:primer-guardado']);
    expect(b.S.savedFactsOf('andres')).toEqual({ savedEver: 1, firstSavedAt: t });
    b.runAsUser('andres', () => b.S.trashItem(r.item!.id));
    expect(b.S.savedFactsOf('andres')).toEqual({ savedEver: 1, firstSavedAt: t }); // mandar a la papelera no deshace el guardado
    b.runAsUser('andres', () => b.S.purgeItem(r.item!.id));
    expect(b.S.savedFactsOf('andres')).toEqual({ savedEver: 0, firstSavedAt: null }); // lo purgado ya no existe
  });
});

describe('Amigos: aceptar y el auto-aceptar del NPC sincronizan («Primer amigo»)', () => {
  /** Ningún chico del seed arranca sin amigos (Ian 6, Luna 4; el adulto no tiene nunca), así que «Primer amigo» no puede
   *  llegar como nueva con el seed: la sonda cuenta los amigos DESDE el seed (el friendCountOf real menos los de arranque),
   *  como si arrancaran con 0. Prueba lo que importa del punto de sync: ensure ANTES del amigo nuevo y sync DESPUÉS. */
  const sonda = (b: Boot) => {
    const base: Record<string, number> = { ian: b.Fr.friendCountOf('ian'), luna: b.Fr.friendCountOf('luna') };
    b.M.registerMedalFacts((uid) => (uid in base ? { friends: b.Fr.friendCountOf(uid) - base[uid] } : {}), 'sonda: amigos desde el seed');
  };
  it('el hecho registrado es el grafo de cada uno (friendCountOf): Ian 6 · Luna 4 · Andrés 0', async () => {
    const b = await boot();
    expect(['ian', 'luna', 'andres'].map(u => b.M.medalFactsOf(u).friends)).toEqual([6, 4, 0]);
  });
  it('Luna acepta la solicitud de FedeAjedrez: su amigo nuevo cuenta y la medalla llega NUEVA a SU feed', async () => {
    const b = await boot();
    sonda(b);
    at('2026-10-20T10:00:00Z');
    const r = await call(b, b.Fr.friendsRoutes, 'luna', 'POST', '/api/friends/requests/accept', { id: 'f9' });
    expect(r.status).toBe(200);
    expect(b.Fr.friendCountOf('luna')).toBe(5);
    expect(b.pila('luna')).toContain('primer-amigo*');
    expect(b.news).toEqual(['luna:primer-amigo']);
  });
  it('Ian le pide contacto a MicaPincel: el NPC acepta solo (a los 4-8 s, al LEER) y ahí se sincroniza', async () => {
    const b = await boot();
    sonda(b);
    at('2026-10-20T10:00:00Z');
    expect((await call(b, b.Fr.friendsRoutes, 'ian', 'POST', '/api/friends/requests/send', { id: 'f10' })).body).toEqual({ ok: true, relation: 'sent' });
    expect(b.Fr.friendCountOf('ian')).toBe(6); // todavía no (y sin mirar su pila: eso crearía su slice antes de tiempo)
    at('2026-10-20T10:00:09Z');
    const r = await call(b, b.Fr.friendsRoutes, 'ian', 'GET', '/api/friends');
    expect(r.body.friends[0].id).toBe('f10'); // el recién aceptado queda primero
    expect(b.Fr.friendCountOf('ian')).toBe(7);
    expect(b.pila('ian')).toContain('primer-amigo*');
    expect(b.news).toEqual(['ian:primer-amigo']);
  });
});
