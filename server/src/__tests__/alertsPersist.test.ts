import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterAll, describe, expect, it, vi } from 'vitest';

/* Los AVISOS al padre PERSISTEN (FS-BASE-A; hallazgos parent.ts:613 y :614 del workflow base-review-2): parent.ts DE VERDAD
   con SERVER_ROOT en una carpeta TEMPORAL (server/data no se toca) y un "reinicio" = vi.resetModules + volver a importar.
   Se prueba: un aviso de crisis sobrevive al reinicio (antes vivía en RAM y tsx watch lo borraba sin que el padre lo viera),
   los ids NO se reusan tras el reinicio (una pestaña vieja marcaba como vista una crisis NUEVA), el "visto" también
   persiste, alerts.json es 0600, el tope nunca desaloja una crisis sin ver, el aviso "sin clasificar" agrupado y un archivo
   ilegible no tumba nada. Mocks: los mismos dominios que parentGate.test (parent los importa y acá no importan). */

const T = vi.hoisted(() => ({ dir: '' }));
vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  const { mkdtempSync, mkdirSync, writeFileSync: w } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');
  T.dir = mkdtempSync(j(tmpdir(), 'innerith-alerts-'));
  mkdirSync(j(T.dir, 'data'));
  const member = () => ({ features: { tienda: true, ligas: true, amigos: true, chat: true }, items: [], topics: { white: [], black: [] }, extraWords: [], volume: { maxMusic: 100, maxNoise: 100 }, preset: null, feedMotion: 'normal' });
  w(j(T.dir, 'data', 'parent.json'), JSON.stringify({ version: 3, seq: 20, tz: 'UTC', pinHash: '0'.repeat(64), members: { ian: member(), luna: member() } }));
  return { ...actual, SERVER_ROOT: T.dir };
});
vi.mock('../afterday', () => ({ addTrack: () => null, allTracks: () => [], removeTrack: () => false }));
vi.mock('../market', () => ({ deliverRedemption: () => false, listRedemptions: () => [], redeemedCount: () => 0, stockLeft: () => null }));
vi.mock('../schedule', () => ({ checkCycle: () => null, cycleView: () => ({}), saveCycle: () => ({ ok: true }), setFamilyTzSource: () => {} }));
vi.mock('../space', () => ({ allSavedForParent: () => [] }));
vi.mock('../videos', () => ({ catalogSize: () => 0 }));
vi.mock('../identity', () => ({ lookOf: () => null }));
vi.mock('../feedFake', () => ({ injectLeagueClose: () => 0 }));

const FILE = () => join(T.dir, 'data', 'alerts.json');
afterAll(() => { rmSync(T.dir, { recursive: true, force: true }); });

/** Un server recién prendido: el módulo se vuelve a cargar y lee alerts.json de nuevo. */
async function boot() {
  vi.resetModules();
  const P = await import('../parent');
  const { runAsUser } = await import('../requestContext');
  const call = (method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> => {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;
    Object.assign(req, { method, url: path, headers: { 'x-innerith-user': 'andres' } });
    return new Promise(resolve => {
      let status = 0;
      const res = { writeHead: (s: number) => { status = s; }, end: (raw: string) => resolve({ status, body: JSON.parse(raw) }) } as unknown as ServerResponse;
      void runAsUser('andres', () => P.parentRoutes(req, res, new URL(path, 'http://localhost')));
    });
  };
  const alerts = async (member?: string) => (await call('GET', `/api/parent/alerts${member ? `?member=${member}` : ''}`)).body.alerts as any[];
  return { P, runAsUser, call, alerts };
}

describe('avisos al padre persistidos (alerts.json)', () => {
  it('una crisis SOBREVIVE al reinicio, sin texto en el log, con el archivo en 0600', async () => {
    rmSync(FILE(), { force: true });
    const b = await boot();
    const t0 = Math.floor(Date.now() / 1000);
    b.runAsUser('luna', () => b.P.notifyParent('crisis', 'me quiero morir', 'el chat con el asistente'));
    expect(existsSync(FILE())).toBe(true);
    expect(statSync(FILE()).mode & 0o777).toBe(0o600);
    const [a] = await b.alerts();
    expect(a).toMatchObject({ kind: 'crisis', seen: false, childId: 'luna', childName: 'Luna', source: 'el chat con el asistente' });
    expect(a.text).toContain('«me quiero morir»');
    // sin archivo, los ids arrancan en los segundos del reloj (no retroceden entre procesos)
    expect(a.id).toBeGreaterThanOrEqual(t0);
    expect(Object.keys(a).sort()).toEqual(['childId', 'childName', 'id', 'kind', 'seen', 'source', 'text', 'ts']); // la forma ParentAlert, sin internos

    const b2 = await boot(); // ← reinicio (tsx watch)
    expect(await b2.alerts()).toEqual([a]);
  });

  it('tras el reinicio los ids NO se reusan: el "visto" de una pestaña vieja no marca una crisis NUEVA', async () => {
    rmSync(FILE(), { force: true });
    const b = await boot();
    b.runAsUser('ian', () => b.P.notifyParent('contacto', 'mi número es…', 'la conversación con Tomi (Amigos)'));
    const viejo = (await b.alerts())[0];
    const b2 = await boot(); // reinicio
    b2.runAsUser('luna', () => b2.P.notifyParent('crisis', 'me pegan en casa', 'el chat con el asistente'));
    const nueva = (await b2.alerts()).find(x => x.kind === 'crisis');
    expect(nueva.id).toBeGreaterThan(viejo.id);
    // la pestaña vieja marca como visto el aviso que tenía: es ESE, no la crisis nueva
    expect((await b2.call('POST', '/api/parent/alerts/seen', { id: viejo.id })).body).toEqual({ ok: true });
    const after = await b2.alerts();
    expect(after.find(x => x.id === nueva.id).seen).toBe(false);
    expect(after.find(x => x.id === viejo.id).seen).toBe(true);
    // un id que no existe (borrado, inventado) no toca nada
    expect((await b2.call('POST', '/api/parent/alerts/seen', { id: nueva.id + 1000 })).body).toEqual({ ok: false });
    // el "visto" también persiste
    const b3 = await boot();
    expect((await b3.alerts()).find(x => x.id === viejo.id).seen).toBe(true);
    expect((await b3.alerts()).find(x => x.id === nueva.id).seen).toBe(false);
    // y el seq sigue creciendo
    b3.runAsUser('ian', () => b3.P.notifyParent('contacto', 'x', 'y'));
    expect(Math.max(...(await b3.alerts()).map(x => x.id))).toBeGreaterThan(nueva.id);
  });

  it('el tope nunca desaloja una crisis SIN VER (antes: FIFO global de 100)', async () => {
    rmSync(FILE(), { force: true });
    const b = await boot();
    b.runAsUser('luna', () => b.P.notifyParent('crisis', 'quiero desaparecer', 'el chat con el asistente'));
    const crisis = (await b.alerts())[0];
    for (let i = 0; i < 260; i++) b.runAsUser('ian', () => b.P.notifyParent('contacto', `dato ${i}`, 'Amigos'));
    const list = await b.alerts();
    expect(list.length).toBeLessThanOrEqual(200);
    expect(list.some(x => x.id === crisis.id && !x.seen)).toBe(true);
    // los que salieron son los no-crisis más viejos
    expect(list.filter(x => x.kind === 'contacto').map(x => x.text).at(-1)).toMatch(/dato \d+/);
    const b2 = await boot();
    expect((await b2.alerts()).some(x => x.id === crisis.id)).toBe(true);
  });

  it('el aviso SIN CLASIFICAR (juez caído) se agrupa por chico y fuente mientras no se vea, con id NUEVO en cada reemplazo', async () => {
    rmSync(FILE(), { force: true });
    const b = await boot();
    b.runAsUser('ian', () => b.P.notifyUnreviewed('hola', 'el chat con el asistente'));
    const uno = (await b.alerts())[0];
    expect(uno).toMatchObject({ kind: 'crisis', seen: false, childId: 'ian' });
    expect(uno.text).toMatch(/^Sin clasificar: el revisor automático no pudo revisar un mensaje de Ian/);
    b.runAsUser('ian', () => b.P.notifyUnreviewed('estoy triste', 'el chat con el asistente'));
    let list = await b.alerts();
    expect(list.length).toBe(1);
    expect(list[0].id).toBeGreaterThan(uno.id);
    expect(list[0].text).toMatch(/2 mensajes de Ian/);
    expect(list[0].text).toContain('«hola» · «estoy triste»');
    // otro chico u otra fuente: aviso aparte
    b.runAsUser('luna', () => b.P.notifyUnreviewed('hola', 'el chat con el asistente'));
    b.runAsUser('ian', () => b.P.notifyUnreviewed('hola', 'el buscador'));
    expect((await b.alerts()).length).toBe(3);
    // visto → el próximo arranca uno nuevo (no se le agrega a lo que el padre ya leyó)
    await b.call('POST', '/api/parent/alerts/seen', { id: list[0].id });
    b.runAsUser('ian', () => b.P.notifyUnreviewed('otra', 'el chat con el asistente'));
    list = await b.alerts();
    expect(list.filter(x => x.childId === 'ian' && x.source === 'el chat con el asistente').map(x => x.seen)).toEqual([false, true]);
    // con un adulto activo, nada
    const n = list.length;
    b.runAsUser('andres', () => b.P.notifyUnreviewed('x', 'el chat con el asistente'));
    expect((await b.alerts()).length).toBe(n);
  });

  it('la crisis "sin clasificar" de la red de frases lo dice en el aviso', async () => {
    rmSync(FILE(), { force: true });
    const b = await boot();
    b.runAsUser('luna', () => b.P.notifyParent('crisis', 'me quiero morir', 'el buscador', { unclassified: true }));
    const [a] = await b.alerts();
    expect(a.text).toMatch(/^Posible mensaje de crisis en el buscador, sin clasificar: el revisor automático no respondió/);
    expect(a.text).toContain('Luna escribió: «me quiero morir»');
  });

  it('un alerts.json ilegible se aparta (.roto-*) y arranca vacío; filas rotas se descartan', async () => {
    writeFileSync(FILE(), '{ esto no es json');
    const b = await boot();
    expect(await b.alerts()).toEqual([]);
    expect(readdirSync(join(T.dir, 'data')).some(f => f.startsWith('alerts.json.roto-'))).toBe(true);
    writeFileSync(FILE(), JSON.stringify({ version: 1, seq: 5, alerts: [
      { id: 3, ts: 1, kind: 'crisis', text: 'ok', source: 'chat', seen: false, childId: 'ian' },
      { id: 3, ts: 1, kind: 'crisis', text: 'repetido', source: 'chat', seen: false },
      { id: 4, ts: 1, kind: 'raro', text: 'kind desconocido', source: 'chat', seen: false },
      { id: -1, ts: 1, kind: 'crisis', text: 'id malo', source: 'chat', seen: false },
      { id: 9, ts: 1, kind: 'contacto', text: 'sin seen: queda SIN VER', source: 'chat', childId: '__proto__' },
    ] }));
    const b2 = await boot();
    const list = await b2.alerts();
    expect(list.map(x => [x.id, x.seen, x.childId])).toEqual([[9, false, undefined], [3, false, 'ian']]);
    b2.runAsUser('ian', () => b2.P.notifyParent('contacto', 'x', 'y'));
    expect(Math.max(...(await b2.alerts()).map(x => x.id))).toBe(10); // seq = máx(seq, máx id + 1)
    expect(JSON.parse(readFileSync(FILE(), 'utf8')).seq).toBe(11);
  });
});
