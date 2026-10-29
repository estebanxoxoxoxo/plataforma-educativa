import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* U5-B (docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §2.2 paso 5, §2.3, §2.4 paso 6, §5.3-§5.4, §5.6): las medallas que mueven los
   CORTES DE SEMANA, con progress.ts, leaguesFake.ts, familyWeek.ts y medals.ts DE VERDAD (los hechos de progreso y de las
   copas se registran solos al cargar). Mocks como familyLeague.test.ts: lo que lee o escribe server/data ('../parent',
   '../identity') y los efectos de otros dominios ('../market', '../feedFake'). El sumidero de noticias y el gate de los
   candados se registran acá (anotan el CONTEXTO en que corren: la noticia tiene que caer en el feed del dueño). Zona
   'UTC'; semana de referencia: lunes 26-oct-2026. */

vi.mock('../parent', () => ({
  familyTz: () => 'UTC',
  // fail-closed como el de verdad: los chicos con todo prendido; un ADULTO (sin config de integrante) da false
  featureOn: (_k: string, id: string) => id === 'ian' || id === 'luna',
  memberItemsOf: () => [],
  checkPrizeFields: () => ({ ok: false, error: 'x' }),
}));
vi.mock('../identity', () => ({ lookOf: () => null }));
vi.mock('../market', () => ({ grantFamilyPrize: () => ({}) }));
vi.mock('../feedFake', () => ({ injectLeagueClose: () => 2 }));

const L = await import('../leaguesFake');
const P = await import('../progress');
const M = await import('../medals');
const { currentUser, runAsUser } = await import('../requestContext');
const { userById } = await import('../users');

const NEWS: { ctx: string | undefined; id: string }[] = [];
M.registerMedalNews((m) => { NEWS.push({ ctx: currentUser()?.id, id: m.id }); });
// stand-in permisivo del gate (acá no se prueban los candados): el predicado REAL se prueba en parentGate.test.ts
M.registerMedalGate(() => true);

const andres = userById('andres')!;
const at = (iso: string) => vi.setSystemTime(new Date(iso));
const pila = (uid: string) => M.medalsOf(uid).map(m => m.id + (m.times ? `×${m.times}` : '') + (m.fresh ? '*' : ''));
/** Como al arrancar el server en ESTE instante: progreso, ligas, semana de la familia y medallas en el seed (las medallas
 *  AL FINAL, como en el reset de index.ts). */
function fresh(iso = '2026-10-28T12:00:00Z') {
  at(iso);
  P.resetProgress(); L.resetLeagues(); L.resetFamilyWeeks();
  for (const u of ['ian', 'luna', 'andres']) P.summaryOf(u); // los slices de progreso nacen YA (como el seed de la familia)
  M.resetMedals();
  NEWS.length = 0;
}

beforeEach(() => { vi.useFakeTimers(); P.setProgressTzSource(() => 'UTC'); });
afterEach(() => { vi.useRealTimers(); P.setProgressTzSource(() => null); P.resetProgress(); L.resetLeagues(); L.resetFamilyWeeks(); M.resetMedals(); });

describe('el seed: los hechos fijos de progreso y la copa sembrada (§5.4)', () => {
  it('Ian 🗓️ (racha 5) · Luna 🗓️ ✨ 🏆 (racha 9, una semana completa de antes, la copa del historial) · Andrés nada', () => {
    fresh();
    // (sin Learn, Mi espacio ni Amigos cargados en este test: esas partes valen cero)
    expect(pila('ian')).toEqual(['tres-dias']);
    expect(pila('luna')).toEqual(['tres-dias', 'semana-completa', 'semana-familia']);
    expect(pila('andres')).toEqual([]);
    expect(NEWS).toEqual([]);
  });
});

describe('cierre SIMULADO de la familia (§2.4 paso 6)', () => {
  it('"Superaste tu semana" NUEVA para Ian (1.240 > 1.180) y Andrés (450 > 300: su primera); Luna suma su 2.ª copa sin noticia', () => {
    fresh();
    const r = runAsUser('andres', () => L.closeFamilyWeekNow(andres));
    expect(r.ok).toBe(true);
    expect(pila('ian')).toEqual(['mejor-semana*', 'tres-dias']);
    expect(pila('andres')).toEqual(['mejor-semana*']);
    expect(pila('luna')).toEqual(['tres-dias', 'semana-completa', 'semana-familia×2']);
    // cada noticia en el feed de SU dueño (el pedido es del adulto); ninguna para Luna (la copa repetida no es "nueva")
    expect(NEWS.sort((a, b) => a.ctx!.localeCompare(b.ctx!))).toEqual([{ ctx: 'andres', id: 'mejor-semana' }, { ctx: 'ian', id: 'mejor-semana' }]);
    expect(M.medalsResponse('andres').unseen).toBe(1);
  });
  it('re-sincronizar después no duplica nada', () => {
    fresh();
    runAsUser('andres', () => L.closeFamilyWeekNow(andres));
    const n = NEWS.length;
    for (const u of ['ian', 'luna', 'andres']) runAsUser(u, () => M.syncMedals(u));
    expect(NEWS).toHaveLength(n);
    expect(pila('ian')).toEqual(['mejor-semana*', 'tres-dias']);
  });
  it('un domingo Luna llega a los 7 días: "Semana completa" ×2 al cerrar (repetible, sin noticia)', () => {
    fresh('2026-11-01T12:00:00Z'); // domingo: racha 9 → 7 días de esta semana
    runAsUser('andres', () => L.closeFamilyWeekNow(andres));
    expect(pila('luna')).toContain('semana-completa×2');
    expect(NEWS.some(n => n.ctx === 'luna')).toBe(false);
  });
  it('un segundo cierre seguido (todos en 0): nadie supera su semana, nada nuevo', () => {
    fresh();
    runAsUser('andres', () => L.closeFamilyWeekNow(andres));
    NEWS.length = 0;
    runAsUser('andres', () => L.closeFamilyWeekNow(andres));
    expect(NEWS).toEqual([]);
    expect(pila('ian')).toEqual(['mejor-semana*', 'tres-dias']);
  });
});

describe('cierre individual de "Mi liga" (closeWeek → syncMedals tras startNewWeek)', () => {
  it('Ian cierra SU liga: su "Superaste tu semana" llega a SU feed; la de nadie más', () => {
    fresh();
    runAsUser('ian', () => L.closeWeek());
    expect(pila('ian')).toEqual(['mejor-semana*', 'tres-dias']);
    expect(pila('andres')).toEqual([]);
    expect(NEWS).toEqual([{ ctx: 'ian', id: 'mejor-semana' }]);
  });
});

describe('el F5 de Luna después de un cierre (§5.6)', () => {
  it('su pila vuelve al seed y su copa se RE-DERIVA de las copas de la familia (×2): la conserva, sin nada fresh', () => {
    fresh();
    runAsUser('andres', () => L.closeFamilyWeekNow(andres));
    P.resetProgress('luna'); L.resetLeagues('luna'); M.resetMedals('luna');
    expect(pila('luna')).toEqual(['tres-dias', 'semana-completa', 'semana-familia×2']);
    expect(M.medalsResponse('luna').unseen).toBe(0);
  });
  it('el F5 de Ian se lleva su "Superaste tu semana" de esa sesión (sale de su progreso en RAM)', () => {
    fresh();
    runAsUser('andres', () => L.closeFamilyWeekNow(andres));
    P.resetProgress('ian'); L.resetLeagues('ian'); M.resetMedals('ian');
    expect(pila('ian')).toEqual(['tres-dias']);
  });
});

describe('cierre REAL de la familia, perezoso (§2.3)', () => {
  // Esto es el camino SIN reset: una pestaña que quedó abierta a la medianoche (el sondeo de la barra lee /api/leagues/mine)
  // o el switch de usuario (no resetea). ABRIR la app hace primero el reset del que abre: ese camino está en
  // familyMonday.test.ts (demoReset → el cierre pendiente con la semana REAL de cada uno, antes de re-sembrarlo).
  it('el lunes siguiente, sin reset de por medio (el sondeo de una pestaña abierta, como Ian): cada uno recibe lo suyo en SU feed', () => {
    fresh(); // miércoles 28-oct
    at('2026-11-02T12:00:00Z'); // lunes 2-nov
    expect(runAsUser('ian', () => L.familyCloseIfDue('ian'))).toBe(true);
    expect(pila('ian')).toEqual(['mejor-semana*', 'tres-dias']);
    expect(pila('andres')).toEqual(['mejor-semana*']);
    expect(pila('luna')).toEqual(['tres-dias', 'semana-completa', 'semana-familia×2']);
    expect(NEWS.map(n => `${n.ctx}:${n.id}`).sort()).toEqual(['andres:mejor-semana', 'ian:mejor-semana']);
    // otro lector del mismo lunes: ya cerró, nada nuevo
    NEWS.length = 0;
    expect(runAsUser('luna', () => L.familyCloseIfDue('luna'))).toBe(false);
    for (const u of ['ian', 'luna', 'andres']) runAsUser(u, () => M.syncMedals(u));
    expect(NEWS).toEqual([]);
  });
  it('leer los hechos NO corta la semana: sembrar las medallas antes del lunes no se come el "Superaste tu semana"', () => {
    fresh();
    at('2026-11-02T12:00:00Z');
    M.resetMedals(); // re-siembra a los tres YA, con el lunes pendiente sin cortar
    expect(pila('ian')).toEqual(['tres-dias']); // todavía no: el corte no pasó
    runAsUser('ian', () => L.familyCloseIfDue('ian'));
    expect(pila('ian')).toEqual(['mejor-semana*', 'tres-dias']); // llega como NUEVA
  });
});

/* ---------- en frío: el que gana algo todavía no tenía slice de medallas (revisión de U5) ---------- */
/** Un server recién prendido en ESTE instante: módulos nuevos (vi.resetModules) y NINGÚN slice de medallas (fresh() y el
 *  reset de demo los siembran a todos en el acto; acá no corren). Así el ensureMedals de cada punto de corte de
 *  leaguesFake es decisivo: si el slice naciera después del corte o de la copa, lo nuevo entraría al seed como "visto". */
async function cold(iso: string) {
  vi.resetModules();
  at(iso);
  const L2 = await import('../leaguesFake');
  const P2 = await import('../progress');
  const M2 = await import('../medals');
  const rc = await import('../requestContext');
  const u = await import('../users');
  P2.setProgressTzSource(() => 'UTC');
  const news: string[] = [];
  M2.registerMedalNews((m) => { news.push(`${rc.currentUser()?.id}:${m.id}`); });
  M2.registerMedalGate(() => true);
  const pila2 = (uid: string) => M2.medalsOf(uid).map(m => m.id + (m.times ? `×${m.times}` : '') + (m.fresh ? '*' : ''));
  return { L: L2, P: P2, runAsUser: rc.runAsUser, andres: u.userById('andres')!, news, pila: pila2 };
}

describe('en frío: el integrante que gana algo todavía no tenía slice de medallas (ensureMedals ANTES de cortar y de la copa)', () => {
  it('cierre SIMULADO de la familia: Ian, sin slice, gana su primera copa y supera su semana → las dos NUEVAS, con noticia en SU feed', async () => {
    const c = await cold('2026-10-28T12:00:00Z');
    c.runAsUser('ian', () => c.P.addXp(100, 'Ruta')); // 1.340 > Luna 1.290
    const r = c.runAsUser('andres', () => c.L.closeFamilyWeekNow(c.andres));
    expect(r.ok && r.result.closed.rows[0]).toMatchObject({ id: 'ian', marks: ['gano', 'supero'] });
    expect(c.pila('ian')).toEqual(['mejor-semana*', 'semana-familia*', 'tres-dias']);
    expect(c.news.filter(n => n.startsWith('ian:')).sort()).toEqual(['ian:mejor-semana', 'ian:semana-familia']);
  });
  it('cierre REAL del lunes: Ian, sin slice, gana su primera copa y supera su semana → las dos NUEVAS', async () => {
    const c = await cold('2026-10-28T12:00:00Z');
    c.runAsUser('ian', () => c.P.addXp(100, 'Ruta'));
    c.L.familyLeague(c.andres); // nace la semana de la familia (la del 26-oct)
    at('2026-11-02T12:00:00Z');
    expect(c.runAsUser('ian', () => c.L.familyCloseIfDue('ian'))).toBe(true);
    expect(c.pila('ian')).toEqual(['mejor-semana*', 'semana-familia*', 'tres-dias']);
    expect(c.news.filter(n => n.startsWith('ian:')).sort()).toEqual(['ian:mejor-semana', 'ian:semana-familia']);
  });
  it('cierre individual de "Mi liga": Ian, sin slice, supera su semana → NUEVA y con su noticia', async () => {
    const c = await cold('2026-10-28T12:00:00Z');
    c.runAsUser('ian', () => c.L.closeWeek());
    expect(c.pila('ian')).toEqual(['mejor-semana*', 'tres-dias']);
    expect(c.news).toEqual(['ian:mejor-semana']);
  });
});
