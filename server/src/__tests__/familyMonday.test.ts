import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* El LUNES de verdad, como pasa en la app (fix de la revisión de U5): abrir la app es una carga de página y cada carga hace
   PRIMERO POST /api/demo/reset del activo (src/hooks/user.tsx, antes de montar nada); recién después la barra pide
   /api/leagues/mine, uno de los cuatro lectores que disparan el cierre real perezoso de la semana de la familia. Antes del
   fix el reset re-sembraba al que abría ANTES de la foto, y su "semana pasada" del SEED (weekStart = lunes − 7: cae por
   construcción justo en la semana abierta de la familia) entraba como si fuera la real: Ian, con 1.240 contra 1.180, quedaba
   con 1.180, sin ↑ y sin el premio. Acá corre el camino REAL —demoReset (lo que hace index.ts en POST /api/demo/reset) y
   closeFamilyWeekIfRead (lo que hace antes de rutear)— con leaguesFake, progress, market, medals y familyWeek DE VERDAD.
   Se mockea lo que lee o escribe server/data ('../parent', '../identity', la wishlist vía node:fs) y los resets de los
   dominios que acá no importan ('../feedFake', '../friendsFake', '../schedule'), que anotan que los llamaron. El feed falso
   guarda las noticias de medalla con el CONTEXTO en que llegan y su reset se lleva las de ese usuario, como el de verdad.
   Zona 'UTC'; la semana de referencia es la del lunes 26-oct-2026 y el lunes siguiente, el 2-nov. */

const H = vi.hoisted(() => ({
  ligas: { ian: true, luna: true } as Record<string, boolean>,
  calls: [] as string[],
  news: [] as { ctx: string | undefined; id: string }[],
}));

vi.mock('node:fs', async (orig) => {
  const fs = await orig<typeof import('node:fs')>();
  return { ...fs, existsSync: (p: string) => (String(p).includes('wishlist') ? false : fs.existsSync(p)) };
});
vi.mock('../parent', () => ({
  familyTz: () => 'UTC',
  // fail-closed como el de verdad: un ADULTO no tiene config de integrante → false (leaguesFake lo deja jugar igual)
  featureOn: (k: string, id: string) => (id in H.ligas ? (k === 'ligas' ? H.ligas[id] : true) : false),
  memberItemsOf: () => [],
  checkPrizeFields: (b: Record<string, unknown>) => ({ ok: true, value: { emoji: String(b.emoji), title: String(b.title) } }),
  resetUnlockAttempts: () => { H.calls.push('unlock'); },
  // lo que market.ts lee de parent (acá no hay canjes comunes: solo el de la liga)
  anyParentItem: () => undefined, itemOwner: () => undefined, policyItem: () => undefined, policyItems: () => [], policyMemberId: () => null,
}));
vi.mock('../identity', () => ({ lookOf: () => null, ACCESSORY_IDS: ['gorra', 'vincha', 'lazo', 'anteojos', 'auriculares', 'corona'] }));
vi.mock('../feedFake', () => ({
  injectLeagueClose: () => 2,
  resetFeed: (id?: string) => { H.calls.push(`feed:${id ?? 'todos'}`); H.news = id === undefined ? [] : H.news.filter(n => n.ctx !== id); },
}));
vi.mock('../friendsFake', () => ({ resetFriends: (id?: string) => { H.calls.push(`friends:${id ?? 'todos'}`); } }));
vi.mock('../schedule', () => ({ resetCycleDemo: (id?: string) => { H.calls.push(`cycle:${id ?? 'todos'}`); } }));

const R = await import('../demoReset');
const L = await import('../leaguesFake');
const P = await import('../progress');
const M = await import('../medals');
const Mk = await import('../market');
const { currentUser, runAsUser } = await import('../requestContext');
const { userById } = await import('../users');

M.registerMedalNews((m) => { H.news.push({ ctx: currentUser()?.id, id: m.id }); });
// Stand-in del gate de los candados: los chicos según H.ligas. El predicado REAL (con "un adulto siempre ve lo suyo") se
// prueba contra parent.ts de verdad en parentGate.test.ts; acá ningún adulto gana la copa.
M.registerMedalGate((uid, d) => (d === 'ligas' ? H.ligas[uid] === true : true));

const andres = userById('andres')!;
const LUNES = '2026-11-02T12:00:00Z';
const at = (iso: string) => vi.setSystemTime(new Date(iso));
const pila = (uid: string) => M.medalsOf(uid).map(m => m.id + (m.times ? `×${m.times}` : '') + (m.fresh ? '*' : ''));
const rowsOf = (h: { rows: { id: string; xp: number; marks: string[] }[] }) => h.rows.map(r => [r.id, r.xp, r.marks.join(',')]);
const ligaCanjes = (uid: string) => Mk.listRedemptions(uid).filter(r => r.origin === 'liga-familia');
/** Como un server que arrancó el miércoles 28-oct: todo en el seed, los slices de progreso y de medallas de los tres ya
 *  nacidos y la semana de la familia abierta (la del 26-oct). */
function semana() {
  at('2026-10-28T12:00:00Z');
  P.resetProgress(); L.resetLeagues(); L.resetFamilyWeeks(); Mk.resetMarket();
  for (const u of ['ian', 'luna', 'andres']) P.summaryOf(u);
  M.resetMedals();
  L.familyLeague(andres);
  H.calls.length = 0; H.news = [];
}
const premio = (condition: 'supera-su-semana' | 'gana-la-semana') => {
  const r = L.setFamilyPrize(andres, { condition, emoji: '🚲', title: 'Bici' });
  if (!r.ok) throw new Error(r.error);
};

beforeEach(() => { vi.useFakeTimers(); P.setProgressTzSource(() => 'UTC'); H.ligas.ian = true; H.ligas.luna = true; });
afterEach(() => {
  vi.useRealTimers(); P.setProgressTzSource(() => null);
  P.resetProgress(); L.resetLeagues(); L.resetFamilyWeeks(); Mk.resetMarket(); M.resetMedals();
});

describe('abrir la app el lunes: primero el reset del que abre, después la barra lee /api/leagues/mine', () => {
  it('Ian abre: la foto toma SU semana real (1.240 con ↑, contra 1.180) y el premio es suyo; el canje lo encuentra después de su F5', () => {
    semana(); premio('supera-su-semana');
    at(LUNES);
    expect(R.demoReset('ian', false)).toEqual({ closedFamilyWeek: true });
    expect(R.closeFamilyWeekIfRead('/api/leagues/mine', 'ian')).toBe(false); // la barra: ya estaba cerrada
    const h = L.familyLeague(andres).history[0];
    expect(h).toMatchObject({ week: 1, simulated: false, total: 2980, closedAt: Date.parse('2026-11-02T00:00:00Z') });
    expect(rowsOf(h)).toEqual([['luna', 1290, 'gano'], ['ian', 1240, 'supero'], ['andres', 450, 'supero']]);
    expect(h.prize?.winners).toEqual(['ian']);
    expect(h.rows.filter(r => r.prize).map(r => r.id)).toEqual(['ian']);
    // el canje "de la liga" nace DESPUÉS de su re-siembra: está en Tus canjes y Familia lo puede entregar
    expect(ligaCanjes('ian')).toEqual([expect.objectContaining({ title: 'Bici', status: 'pendiente', closedAt: h.closedAt })]);
    // lo demás de Ian volvió a SU seed ("tu F5 es tu demo nueva"): la XP de la semana y la pila (su "Superaste tu semana"
    // de ese corte sale de su progreso en RAM, que el F5 re-siembra: borde §5.6 de la spec)
    expect(P.summaryOf('ian').xpWeek).toBe(1240);
    expect(pila('ian')).toEqual(['tres-dias']);
    // los demás reciben lo suyo en SU feed: Andrés su primera medalla; la copa repetida de Luna no es noticia
    expect(pila('andres')).toEqual(['mejor-semana*']);
    expect(pila('luna')).toEqual(['tres-dias', 'semana-completa', 'semana-familia×2']);
    expect(H.news).toEqual([{ ctx: 'andres', id: 'mejor-semana' }]);
  });
  it('el que abre gana su PRIMERA copa: le llega después de su re-siembra, como Nueva y con su noticia (su F5 no se la come)', () => {
    semana(); premio('gana-la-semana');
    runAsUser('ian', () => P.addXp(100, 'Ruta')); // 1.340 > Luna 1.290
    at(LUNES);
    expect(R.demoReset('ian', false)).toEqual({ closedFamilyWeek: true });
    const h = L.familyLeague(andres).history[0];
    expect(rowsOf(h)).toEqual([['ian', 1340, 'gano,supero'], ['luna', 1290, ''], ['andres', 450, 'supero']]);
    expect(h.prize?.winners).toEqual(['ian']);
    expect(L.crownsOf('ian')).toBe(1);
    expect(ligaCanjes('ian')).toHaveLength(1);
    expect(pila('ian')).toEqual(['semana-familia*', 'tres-dias']);
    expect(H.news).toContainEqual({ ctx: 'ian', id: 'semana-familia' });
  });
  it('Luna abre y NO entra con los números de su seed (1.350): Ian, que sumó más de verdad, se lleva la copa y el premio', () => {
    semana(); premio('gana-la-semana');
    runAsUser('ian', () => P.addXp(60, 'Ruta')); // 1.300 > Luna 1.290 (la real; su seed dice 1.350)
    at(LUNES);
    expect(R.demoReset('luna', false)).toEqual({ closedFamilyWeek: true });
    const h = L.familyLeague(andres).history[0];
    expect(rowsOf(h)).toEqual([['ian', 1300, 'gano,supero'], ['luna', 1290, ''], ['andres', 450, 'supero']]);
    expect(h.prize?.winners).toEqual(['ian']);
    expect([L.crownsOf('ian'), L.crownsOf('luna')]).toEqual([1, 1]);
    expect(ligaCanjes('ian')).toHaveLength(1);
    expect(ligaCanjes('luna')).toEqual([]);
  });
  it('sin cierre pendiente, el F5 de uno NO toca la semana de la familia y re-siembra SOLO lo suyo, con las medallas AL FINAL', () => {
    semana(); premio('supera-su-semana');
    const r = L.closeFamilyWeekNow(andres); // a mitad de semana: Ian se lleva el premio y su "Superaste tu semana"
    if (!r.ok) throw new Error(r.error);
    expect(pila('ian')).toEqual(['mejor-semana*', 'tres-dias']);
    premio('gana-la-semana');
    runAsUser('luna', () => P.addXp(90, 'Ruta'));
    H.calls.length = 0;
    expect(R.demoReset('ian', false)).toEqual({ closedFamilyWeek: false });
    const lg = L.familyLeague(andres);
    expect(lg.history.map(h => h.week)).toEqual([1, 0]);
    expect(lg.prize?.condition).toBe('gana-la-semana');
    expect([L.crownsOf('luna'), L.crownsOf('ian')]).toEqual([2, 0]);
    expect(lg.rows.find(x => x.id === 'luna')?.xp).toBe(90); // lo de los demás sigue donde estaba
    expect(P.summaryOf('ian').xpWeek).toBe(1240); // Ian volvió a SU seed
    expect(ligaCanjes('ian')).toEqual([]); // borde §2.7: el canje pendiente se fue con su F5
    // las medallas se re-siembran DESPUÉS del progreso: sin su pbWeeks del cierre, no hay "Superaste tu semana" (si se
    // re-sembraran antes, entraría al seed como vista)
    expect(pila('ian')).toEqual(['tres-dias']);
    expect(H.calls).toEqual(['friends:ian', 'feed:ian', 'cycle:ian', 'unlock']);
  });
  it('{scope:"all"}: TODO vuelve al seed —también la semana de la familia— y no se cierra nada aunque el lunes ya pasó', () => {
    semana(); premio('supera-su-semana');
    runAsUser('ian', () => P.addXp(30, 'Ruta'));
    at(LUNES);
    expect(R.demoReset('ian', true)).toEqual({ closedFamilyWeek: false });
    const lg = L.familyLeague(andres);
    expect(lg).toMatchObject({ week: 0, prize: null });
    expect(lg.history.map(h => h.week)).toEqual([0]);
    expect(L.familyCloseIfDue('andres')).toBe(false); // la semana de la familia volvió a nacer en ESTA semana
    expect(Mk.listRedemptions('ian')).toEqual([]);
    expect(H.calls).toEqual(['friends:todos', 'feed:todos', 'cycle:todos', 'unlock']);
  });
});

/* ---------- el disparo antes de rutear (closeFamilyWeekIfRead, lo que corre index.ts) ---------- */
function call(user: string, method: string, path: string): Promise<{ status: number; body: unknown }> {
  const req = Readable.from([]) as unknown as IncomingMessage;
  Object.assign(req, { method, url: path, headers: { 'x-innerith-user': user } });
  return new Promise(resolve => {
    let status = 0;
    const res = { writeHead: (s: number) => { status = s; }, end: (b: string) => resolve({ status, body: JSON.parse(b) }) } as unknown as ServerResponse;
    void runAsUser(user, () => L.leaguesRoutes(req, res, new URL(path, 'http://localhost')));
  });
}

describe('el cierre perezoso se dispara en los cuatro lectores de lo que produce, antes de rutear', () => {
  it('solo esos pedidos lo disparan: /api/leagues/*, /api/parent/activity, /api/market/redemptions y /api/medals*', () => {
    const lectores = ['/api/leagues/mine', '/api/leagues/family', '/api/leagues/standing', '/api/leagues/close-week',
      '/api/leagues/family/close-week', '/api/parent/activity', '/api/market/redemptions', '/api/medals', '/api/medals/seen'];
    const otros = ['/api/leagues', '/api/feed', '/api/progress/summary', '/api/market', '/api/market/items', '/api/parent/deliver',
      '/api/parent/features', '/api/medalsx', '/api/demo/reset', '/api/learn/results'];
    expect(lectores.filter(p => !R.readsFamilyWeek(p))).toEqual([]);
    expect(otros.filter(p => R.readsFamilyWeek(p))).toEqual([]);
    semana(); at(LUNES);
    expect(R.closeFamilyWeekIfRead('/api/feed', 'ian')).toBe(false);
    expect(L.familyLeague(andres).history).toHaveLength(1); // un pedido que no es lector no cerró nada
  });
  it('un chico con Ligas apagadas igual lo dispara (cerrar no le muestra nada) y después recibe su 403 de siempre', async () => {
    semana();
    H.ligas.luna = false;
    at(LUNES);
    expect(R.closeFamilyWeekIfRead('/api/leagues/family', 'luna')).toBe(true);
    expect(L.familyLeague(andres).history[0].rows.map(r => r.id)).toEqual(['ian', 'andres']); // ella no juega la tabla
    expect(await call('luna', 'GET', '/api/leagues/family')).toEqual({ status: 403, body: { error: 'Las ligas están apagadas por tu familia' } });
  });
  it('el cierre individual de "Mi liga" un lunes: el disparo cierra ANTES la semana de la familia con la semana real (si el closeWeek corriera primero, su corte pisaría la semana de Ian y entraría con 0)', () => {
    semana(); at(LUNES);
    expect(R.closeFamilyWeekIfRead('/api/leagues/close-week', 'ian')).toBe(true);
    expect(runAsUser('ian', () => L.closeWeek()).closed.xp).toBe(0); // la semana nueva: la real ya quedó en la foto
    expect(rowsOf(L.familyLeague(andres).history[0]).find(r => r[0] === 'ian')).toEqual(['ian', 1240, 'supero']);
    // el control, con el orden al revés: el startNewWeek del cierre individual guarda la semana NUEVA (vacía) como la última
    semana(); at(LUNES);
    runAsUser('ian', () => L.closeWeek());
    expect(L.familyCloseIfDue('ian')).toBe(true);
    expect(rowsOf(L.familyLeague(andres).history[0]).find(r => r[0] === 'ian')).toEqual(['ian', 0, '']);
  });
});
