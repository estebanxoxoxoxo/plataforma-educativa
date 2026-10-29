import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MedalFacts } from '../medalRules';
import {
  ensureMedals, markMedalsSeen, medalFactsOf, medalsOf, medalsResponse, medalsRoutes, registerMedalFacts, registerMedalGate,
  registerMedalNews, resetMedals, syncMedals,
} from '../medals';
import { currentUser, runAsUser } from '../requestContext';

/* U5-B (docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §5.3-§5.5): el ESTADO de las medallas (medals.ts, hoja) con hechos, sumidero y
   candados FALSOS registrados acá (los de verdad los registran los módulos dueños al cargar). Siembra desde los hechos (todo
   visto), sync idempotente que agrega y nunca saca, la noticia SIEMPRE en el feed del dueño (aunque el contexto sea otro),
   los candados (se esconden, no se borran; medals.ts aplica el gate que le registran, también a un adulto: el predicado
   REAL —"un adulto siempre ve lo suyo"— se prueba contra parent.ts de verdad en parentGate.test.ts), "ya las vi", el reset
   y las rutas. Solo lee la config (users.ts → config.ts), como perUser.test.ts. */

const F: Record<string, Partial<MedalFacts>> = {};
const NEWS: { ctx: string | undefined; id: string }[] = [];
const OFF: Record<string, Set<string>> = { ian: new Set(), luna: new Set(), andres: new Set() }; // dominios apagados
const THROWS = new Set<string>(); // de quién tira la fuente rota
const LATE = new Set<string>(); // a quién le aporta la fuente registrada DESPUÉS de la que tira
registerMedalFacts((uid) => F[uid] ?? {}, 'test');
registerMedalFacts((uid) => { if (THROWS.has(uid)) throw new Error('fuente rota'); return {}; }, 'una fuente que tira');
registerMedalFacts((uid) => (LATE.has(uid) ? { recall: true, recallAt: 4242 } : {}), 'otra fuente (después)');
/** el sumidero falso anota en el contexto de QUIÉN corre (el de verdad escribe en lo vivo del usuario del contexto) */
registerMedalNews((m) => { NEWS.push({ ctx: currentUser()?.id, id: m.id }); });
// el gate falso: lo que diga OFF, para cualquiera (sin la regla del adulto: esa vive en el gate REAL de parent.ts)
registerMedalGate((uid, d) => !OFF[uid]?.has(d));

const ian0 = (): Partial<MedalFacts> => ({ completedTargets: 1, firstCompletedAt: 1000, perfect: true, perfectAt: 1000, savedEver: 1, firstSavedAt: 2000, friends: 6, bestStreak: 5 });
const luna0 = (): Partial<MedalFacts> => ({ friends: 4, bestStreak: 9, fullWeeks: 1, crowns: 1 });
const andres0 = (): Partial<MedalFacts> => ({ bestStreak: 2 });
const ids = (uid: string, forParent = false) => medalsOf(uid, { forParent }).map(m => m.id);

beforeEach(() => {
  F.ian = ian0(); F.luna = luna0(); F.andres = andres0();
  OFF.ian.clear(); OFF.luna.clear(); OFF.andres.clear(); THROWS.clear(); LATE.clear();
  resetMedals();
  NEWS.length = 0;
});

describe('siembra desde los hechos (D3: RAM, sin archivo)', () => {
  it('las pilas del seed: Ian 5 · Luna 4 · Andrés 0, todas vistas (unseen 0)', () => {
    expect(medalsResponse('ian')).toMatchObject({ unseen: 0 });
    expect(ids('ian')).toEqual(['primer-guardado', 'primera-posta', 'posta-perfecta', 'primer-amigo', 'tres-dias']);
    expect(ids('luna')).toEqual(['primer-amigo', 'tres-dias', 'semana-completa', 'semana-familia']);
    expect(medalsResponse('andres')).toEqual({ medals: [], unseen: 0 });
    expect(NEWS).toEqual([]); // sembrar no es "ganar": ninguna noticia
  });
  it('la fecha es la del hecho (o null del seed sin fecha) y nada trae `fresh`', () => {
    const m = medalsOf('ian');
    expect(m.find(x => x.id === 'primera-posta')).toEqual({ id: 'primera-posta', emoji: '🎯', title: 'Primera posta', text: 'Completaste tu primera posta en Aprender.', at: 1000 });
    expect(m.find(x => x.id === 'tres-dias')?.at).toBeNull();
    expect(m.some(x => x.fresh)).toBe(false);
  });
  it('el catálogo NO viaja: solo las ganadas, sin totales ni "faltan"', () => {
    const r = medalsResponse('andres');
    expect(Object.keys(r).sort()).toEqual(['medals', 'unseen']);
    expect(JSON.stringify(medalsResponse('ian'))).not.toMatch(/diez-objetivos|ruta-creada|de-vuelta/);
  });
  it('una fuente de hechos que tira no tumba nada: sus hechos valen cero y las demás (antes y después) siguen contando', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      THROWS.add('luna'); LATE.add('luna');
      expect(() => medalFactsOf('luna')).not.toThrow();
      // la de antes (friends, racha, copa) y la de después (el repaso) cuentan; la rota vale cero
      expect(medalFactsOf('luna')).toMatchObject({ friends: 4, bestStreak: 9, crowns: 1, recall: true, recallAt: 4242 });
      // el sync de un pedido de verdad (Learn, un cierre) no se cae: la medalla nueva llega igual
      expect(runAsUser('luna', () => syncMedals('luna')).map(m => m.id)).toEqual(['primer-repaso']);
      expect(() => resetMedals('luna')).not.toThrow();
      expect(ids('luna')).toContain('primer-repaso');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('«una fuente que tira» de luna'), expect.any(Error));
    } finally { warn.mockRestore(); }
  });
});

describe('syncMedals: agrega, nunca saca, idempotente', () => {
  it('una medalla nueva: queda `fresh`, con la fecha de ahora si el hecho no trae, y UNA noticia en el feed de su dueño', () => {
    const before = Date.now();
    F.andres = { ...andres0(), pbWeeks: 1 };
    const added = runAsUser('andres', () => syncMedals('andres'));
    expect(added.map(m => m.id)).toEqual(['mejor-semana']);
    const r = medalsResponse('andres');
    expect(r.unseen).toBe(1);
    expect(r.medals[0]).toMatchObject({ id: 'mejor-semana', emoji: '📈', title: 'Superaste tu semana', fresh: true });
    expect(r.medals[0].at).toBeGreaterThanOrEqual(before);
    expect(NEWS).toEqual([{ ctx: 'andres', id: 'mejor-semana' }]);
  });
  it('re-sincronizar NO duplica (ni la medalla ni la noticia)', () => {
    F.ian = { ...ian0(), comebacks: 1 };
    runAsUser('ian', () => { syncMedals('ian'); syncMedals('ian'); });
    expect(syncMedals('ian')).toEqual([]);
    expect(ids('ian').filter(id => id === 'de-vuelta')).toHaveLength(1);
    expect(NEWS.filter(n => n.id === 'de-vuelta')).toHaveLength(1);
  });
  it('⚠ sync de X con el contexto de Y: la noticia queda en el feed de X (runAsUser del dueño)', () => {
    F.luna = { ...luna0(), completedTargets: 1, firstCompletedAt: 5000 };
    runAsUser('andres', () => syncMedals('luna'));
    expect(NEWS).toEqual([{ ctx: 'luna', id: 'primera-posta' }]);
    // fuera de un pedido (un timer suelto) también
    F.luna = { ...F.luna, perfect: true, perfectAt: 5000 };
    syncMedals('luna');
    expect(NEWS.at(-1)).toEqual({ ctx: 'luna', id: 'posta-perfecta' });
  });
  it('si un hecho desaparece (purgar el único guardado), la medalla QUEDA dentro de la sesión', () => {
    F.ian = { ...ian0(), savedEver: 0, firstSavedAt: null };
    syncMedals('ian');
    expect(ids('ian')).toContain('primer-guardado');
    // …y vuelve al seed re-derivado recién con el reset de ese usuario (borde §5.6: "la demo nueva")
    resetMedals('ian');
    expect(ids('ian')).not.toContain('primer-guardado');
  });
  it('las repetibles suben `times` (max) sin noticia nueva; nunca bajan', () => {
    F.luna = { ...luna0(), crowns: 2 };
    syncMedals('luna');
    expect(medalsOf('luna').find(m => m.id === 'semana-familia')).toMatchObject({ times: 2 });
    expect(NEWS).toEqual([]);
    F.luna = { ...luna0(), crowns: 1 };
    syncMedals('luna');
    expect(medalsOf('luna').find(m => m.id === 'semana-familia')?.times).toBe(2);
    // con 1 no viaja `times` (solo con 2 o más)
    expect(medalsOf('luna').find(m => m.id === 'semana-completa')).not.toHaveProperty('times');
  });
  it('ensureMedals ANTES de mover el hecho es lo que la hace NUEVA: sin slice previo (un server recién prendido), si el slice naciera DESPUÉS del hecho, la medalla entraría al seed como vista (sin "Nueva" ni noticia)', async () => {
    // resetMedals() (el de este archivo y el del reset de demo) siembra a los tres EN EL ACTO: para ver el caso sin slice,
    // un módulo de medallas NUEVO, como al prender el server
    vi.resetModules();
    const M2 = await import('../medals');
    const rc = await import('../requestContext');
    const facts: Record<string, Partial<MedalFacts>> = { ian: ian0(), luna: luna0() };
    const news: string[] = [];
    M2.registerMedalFacts((uid) => facts[uid] ?? {});
    M2.registerMedalNews((m) => { news.push(`${rc.currentUser()?.id}:${m.id}`); });
    M2.registerMedalGate(() => true);
    // Ian: ensure ANTES de mover el hecho (lo que hacen Learn, Mi espacio, Amigos, Crear y los cortes de semana)
    M2.ensureMedals('ian');
    facts.ian = { ...ian0(), completedTargets: 10, tenthTargetAt: 9000 };
    expect(rc.runAsUser('ian', () => M2.syncMedals('ian')).map(m => m.id)).toEqual(['diez-objetivos']);
    expect(M2.medalsOf('ian').find(m => m.id === 'diez-objetivos')).toMatchObject({ at: 9000, fresh: true });
    // Luna: el hecho se mueve ANTES de que exista su slice → nace con él adentro, como visto
    facts.luna = { ...luna0(), completedTargets: 10, tenthTargetAt: 9000 };
    expect(rc.runAsUser('luna', () => M2.syncMedals('luna'))).toEqual([]);
    expect(M2.medalsOf('luna').find(m => m.id === 'diez-objetivos')).toEqual(expect.not.objectContaining({ fresh: true }));
    expect(news).toEqual(['ian:diez-objetivos']);
  });
  it('un id que no es del seed: nada (ni tira)', () => {
    expect(syncMedals('nadie')).toEqual([]);
    expect(medalsOf('nadie')).toEqual([]);
    expect(() => ensureMedals('nadie')).not.toThrow();
  });
});

describe('los candados: se esconden al servir, no se borran (§5.1 regla 5)', () => {
  it('Ligas apagadas para Luna: su copa no está en SU pila; Familia la ve con hidden; al prender, vuelve', () => {
    OFF.luna.add('ligas');
    expect(ids('luna')).not.toContain('semana-familia');
    expect(medalsOf('luna', { forParent: true }).find(m => m.id === 'semana-familia')).toMatchObject({ hidden: 'ligas' });
    expect(medalsOf('luna', { forParent: true }).some(m => 'fresh' in m)).toBe(false);
    OFF.luna.delete('ligas');
    expect(ids('luna')).toContain('semana-familia');
    expect(medalsOf('luna', { forParent: true }).find(m => m.id === 'semana-familia')).not.toHaveProperty('hidden');
  });
  it('Amigos apagado para Ian: sin primer-amigo en su pila', () => {
    OFF.ian.add('amigos');
    expect(ids('ian')).not.toContain('primer-amigo');
    expect(ids('ian', true)).toContain('primer-amigo');
  });
  it('el gate manda para todos, también para un adulto: medals.ts no decide por el tipo de usuario (la regla "un adulto siempre ve lo suyo" es del gate REAL de parent.ts: parentGate.test.ts)', () => {
    F.andres = { ...andres0(), crowns: 1 };
    syncMedals('andres');
    expect(ids('andres')).toEqual(['semana-familia']);
    OFF.andres.add('ligas');
    expect(ids('andres')).toEqual([]);
    expect(medalsOf('andres', { forParent: true })).toEqual([expect.objectContaining({ id: 'semana-familia', hidden: 'ligas' })]);
  });
});

describe('"ya las vi" (POST /api/medals/seen)', () => {
  it('marca vistas las que VE; una escondida y nueva sigue sin ver hasta que se prenda el candado', () => {
    OFF.luna.add('ligas');
    F.luna = { friends: 4, bestStreak: 9, fullWeeks: 1, crowns: 0, comebacks: 1 };
    resetMedals('luna');
    F.luna = { ...F.luna, crowns: 1 };
    expect(syncMedals('luna').map(m => m.id)).toEqual(['semana-familia']); // copa nueva… pero escondida
    expect(medalsResponse('luna').unseen).toBe(0); // lo que no ve no cuenta como "sin ver"
    markMedalsSeen('luna');
    expect(medalsResponse('luna').unseen).toBe(0);
    OFF.luna.delete('ligas');
    expect(medalsResponse('luna')).toMatchObject({ unseen: 1 });
    expect(medalsOf('luna').find(m => m.id === 'semana-familia')?.fresh).toBe(true);
  });
  it('reset de un usuario: su pila vuelve al seed y NADA queda fresh', () => {
    F.andres = { ...andres0(), pbWeeks: 1 };
    syncMedals('andres');
    expect(medalsResponse('andres').unseen).toBe(1);
    resetMedals('andres');
    expect(medalsResponse('andres')).toMatchObject({ unseen: 0 }); // pbWeeks sigue en 1 en este hecho falso: queda vista
    F.andres = andres0();
    resetMedals('andres');
    expect(medalsResponse('andres')).toEqual({ medals: [], unseen: 0 });
  });
});

/* ---------- rutas ---------- */
function call(method: string, path: string, user = 'ian'): { status: number; body: unknown } {
  const req = Readable.from([]) as unknown as IncomingMessage;
  Object.assign(req, { method, url: path, headers: { 'x-innerith-user': user } });
  let status = 0, raw = '';
  const res = { writeHead: (s: number) => { status = s; return res; }, end: (b: string) => { raw = b; } } as unknown as ServerResponse;
  runAsUser(user, () => medalsRoutes(req, res, new URL(path, 'http://localhost')));
  return { status, body: JSON.parse(raw) };
}

describe('GET /api/medals · POST /api/medals/seen', () => {
  it('GET sincroniza (red de seguridad) y devuelve la pila del ACTIVO; POST seen → unseen 0', () => {
    F.ian = { ...ian0(), routesCompleted: 1 };
    const g = call('GET', '/api/medals', 'ian');
    expect(g.status).toBe(200);
    expect(g.body).toMatchObject({ unseen: 1 });
    expect((g.body as { medals: { id: string }[] }).medals.map(m => m.id)).toContain('ruta-completa');
    expect(NEWS).toEqual([{ ctx: 'ian', id: 'ruta-completa' }]);
    const s = call('POST', '/api/medals/seen', 'ian');
    expect(s).toMatchObject({ status: 200, body: { unseen: 0 } });
    expect(call('GET', '/api/medals/', 'ian').body).toMatchObject({ unseen: 0 }); // barra final tolerada
    expect(NEWS).toHaveLength(1);
  });
  it('cada uno ve lo suyo: la del hermano no aparece', () => {
    F.luna = { ...luna0(), routesCompleted: 1 };
    expect((call('GET', '/api/medals', 'ian').body as { medals: { id: string }[] }).medals.map(m => m.id)).not.toContain('ruta-completa');
  });
  it('405 con el método equivocado; 404 fuera de la familia de rutas', () => {
    expect(call('POST', '/api/medals')).toMatchObject({ status: 405, body: { error: 'Método no permitido: usá GET.' } });
    expect(call('GET', '/api/medals/seen')).toMatchObject({ status: 405, body: { error: 'Método no permitido: usá POST.' } });
    expect(call('GET', '/api/medals/otra').status).toBe(404);
  });
});
