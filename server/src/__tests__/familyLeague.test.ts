import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* U5-A (docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §2-§4, §6.2): la liga de la familia de punta a punta en el server — el seed de la
   familia, el cierre SIMULADO (orden de §2.4), el premio del adulto (condiciones, copia de la Tienda, sigue en juego), el
   cierre REAL perezoso del lunes y las rutas (403/405/400 con sus textos). Quedan de verdad leaguesFake.ts, familyWeek.ts,
   progress.ts, leaguePools.ts, perUser/requestContext/users (solo leen la config, como en perUser.test.ts). Se mockea lo que
   lee o escribe server/data (parent.json → '../parent', el look → '../identity') y los efectos de otros dominios (el canje
   del premio → '../market', las noticias del cierre → '../feedFake'). Zona 'UTC'; semana de referencia: lunes 26-oct-2026. */

/** Lo que DEVUELVE parent.memberItemsOf de cada chico: sus premios NO archivados (el filtro es de parent y se prueba contra
 *  parent.ts de verdad en parentGate.test.ts). "Archivar" acá = que memberItemsOf ya no lo devuelva. */
const itemsSeed = () => ({
  ian: [{ id: 4, emoji: '🚲', title: '1 hora de bici en la plaza', desc: 'Salimos a andar juntos.' }],
  luna: [
    { id: 12, emoji: '🚲', title: '1 hora de bici en la plaza', desc: 'Salimos a andar juntos. ¡Llevá el casco!' },
    { id: 13, emoji: '📚', title: 'Un libro nuevo que elijas' },
  ],
} as Record<string, { id: number; emoji: string; title: string; desc?: string }[]>);
const H = vi.hoisted(() => ({
  ligas: { ian: true, luna: true } as Record<string, boolean>,
  items: {} as Record<string, { id: number; emoji: string; title: string; desc?: string }[]>,
  grants: [] as { uid: string; emoji: string; title: string; closedAt: number }[],
  news: [] as string[],
}));

vi.mock('../parent', () => ({
  familyTz: () => 'UTC',
  // fail-closed como el de verdad: un ADULTO no tiene config de integrante → false (las guardas `kind === 'adult'` de
  // leaguesFake lo dejan jugar igual: si alguien las saca, Andrés desaparece de la tabla y recibe 403 en estos tests)
  featureOn: (k: string, id: string) => (id in H.ligas ? (k === 'ligas' ? H.ligas[id] : true) : false),
  memberItemsOf: (id: string) => (H.items[id] ?? []).map(i => ({ ...i, price: 100, stock: null, archived: false, createdAt: 0 })),
  // stand-in: leaguesFake PROPAGA el motivo que dé parent.checkPrizeFields tal cual (los textos literales y su orden se
  // prueban contra parent.ts de verdad en parentGate.test.ts)
  checkPrizeFields: (b: Record<string, unknown>) => (typeof b.title === 'string' && b.title.trim().length >= 2 && typeof b.emoji === 'string' && b.emoji
    ? { ok: true, value: { emoji: b.emoji, title: b.title.trim(), ...(typeof b.desc === 'string' && b.desc ? { desc: b.desc } : {}) } }
    : { ok: false, error: 'motivo de checkPrizeFields' }),
}));
vi.mock('../identity', () => ({ lookOf: () => null }));
vi.mock('../market', () => ({
  grantFamilyPrize: (uid: string, p: { emoji: string; title: string }, closedAt: number) => {
    H.grants.push({ uid, emoji: p.emoji, title: p.title, closedAt });
    return { id: H.grants.length, itemId: 0, title: p.title, emoji: p.emoji, price: 0, ts: closedAt, status: 'pendiente', origin: 'liga-familia', closedAt };
  },
}));
vi.mock('../feedFake', async () => {
  const { currentUser } = await import('../requestContext');
  return { injectLeagueClose: () => { H.news.push(currentUser()?.id ?? '?'); return 2; } };
});

const L = await import('../leaguesFake');
const P = await import('../progress');
const { runAsUser } = await import('../requestContext');
const { userById } = await import('../users');

const andres = userById('andres')!, ian = userById('ian')!, luna = userById('luna')!;
const at = (iso: string) => vi.setSystemTime(new Date(iso));
const xpOf = (lg: ReturnType<typeof L.familyLeague>) => Object.fromEntries(lg.rows.map(r => [r.id, r.xp]));
const marks = (c: { rows: { id: string; marks: string[] }[] }) => Object.fromEntries(c.rows.map(r => [r.id, r.marks]));
/** Como al arrancar el server: progreso, ligas públicas y la semana de la familia en el seed, en ESTE instante. */
function fresh(iso = '2026-10-28T12:00:00Z') {
  at(iso);
  P.resetProgress(); L.resetLeagues(); L.resetFamilyWeeks();
  H.grants.length = 0; H.news.length = 0;
}
const setPrize = (b: Record<string, unknown>) => {
  const r = L.setFamilyPrize(andres, b);
  if (!r.ok) throw new Error(r.error);
  return r.league;
};

beforeEach(() => { vi.useFakeTimers(); P.setProgressTzSource(() => 'UTC'); H.ligas.ian = true; H.ligas.luna = true; H.items = itemsSeed(); });
afterEach(() => { vi.useRealTimers(); P.setProgressTzSource(() => null); P.resetProgress(); L.resetLeagues(); L.resetFamilyWeeks(); });

describe('el seed de la familia (§2.6)', () => {
  it('la semana pasada sembrada: 🏆 Luna 1.350 · Ian 1.180 · Andrés 300, total 2.830, sin ↑ de nadie', () => {
    fresh();
    const lg = L.familyLeague(andres);
    expect(lg.history).toHaveLength(1);
    const h = lg.history[0];
    expect(h).toMatchObject({ week: 0, simulated: false, total: 2830, prize: null, label: 'la semana pasada' });
    expect(h.rows.map(r => [r.id, r.xp])).toEqual([['luna', 1350], ['ian', 1180], ['andres', 300]]);
    expect(marks(h)).toEqual({ luna: ['gano'], ian: [], andres: [] }); // un miércoles Luna tiene 6 de 7 la pasada: sin ✨
    expect(L.crownsOf('luna')).toBe(1);
    expect(L.crownsOf('ian')).toBe(0);
  });
  it('un lunes, la semana pasada de Luna es de 7 días: ✨ además de la copa', () => {
    fresh('2026-10-26T12:00:00Z');
    expect(marks(L.familyLeague(andres).history[0])).toEqual({ luna: ['gano', 'siete'], ian: [], andres: [] });
  });
  it('la tabla en vivo: prevXp 1.180 / 1.350 / 300, la 🏆 chiquita de Luna, elegibles los chicos, canManage solo el adulto', () => {
    fresh();
    const lg = L.familyLeague(andres);
    expect(lg.rows.map(r => [r.id, r.xp, r.prevXp, r.days])).toEqual([['luna', 1290, 1350, 3], ['ian', 1240, 1180, 3], ['andres', 450, 300, 2]]);
    expect(lg.rows.find(r => r.id === 'luna')?.wonLastWeek).toBe(true);
    expect(lg.rows.filter(r => r.wonLastWeek).length).toBe(1);
    expect(lg.rows.filter(r => r.prizeEligible).map(r => r.id)).toEqual(['luna', 'ian']);
    expect(lg).toMatchObject({ canManage: true, week: 0, prize: null, closesInDays: 4 }); // miércoles → al domingo
    expect(L.familyLeague(ian).canManage).toBe(false);
    expect(L.familyLeague(ian).rows.find(r => r.me)?.id).toBe('ian');
  });
  it('es UNA por familia (clave andres): lo que pone el adulto lo ven los chicos', () => {
    fresh();
    setPrize({ condition: 'supera-su-semana', emoji: '🍕', title: 'Pizza casera' });
    expect(L.familyLeague(luna).prize).toMatchObject({ title: 'Pizza casera', by: { id: 'andres', name: 'Andrés' } });
    expect(L.familyLeague(ian).prize?.title).toBe('Pizza casera');
  });
});

describe('el premio del adulto (§3)', () => {
  it('copiado de la Tienda de Luna: copia emoji/título/descripción; archivar el original no cambia lo prometido', () => {
    fresh();
    const lg = setPrize({ condition: 'supera-su-semana', from: { member: 'luna', itemId: 12 } });
    expect(lg.prize).toMatchObject({ emoji: '🚲', title: '1 hora de bici en la plaza', desc: 'Salimos a andar juntos. ¡Llevá el casco!', condition: 'supera-su-semana', from: { member: 'luna', itemId: 12 } });
    H.items.luna.splice(0, 1); // Andrés lo archiva: memberItemsOf ya no lo devuelve
    expect(L.familyLeague(andres).prize?.title).toBe('1 hora de bici en la plaza');
    // …pero ya no se puede ELEGIR de nuevo
    expect(L.setFamilyPrize(andres, { condition: 'gana-la-semana', from: { member: 'luna', itemId: 12 } })).toEqual({ ok: false, error: 'Ese premio ya no está en la Tienda de Luna.' });
  });
  it('los 400 con sus textos literales (los de leaguesFake) y el motivo de checkPrizeFields tal cual', () => {
    fresh();
    const err = (b: Record<string, unknown>) => { const r = L.setFamilyPrize(andres, b); return r.ok ? null : r.error; };
    expect(err({ emoji: '🚲', title: 'Bici' })).toBe('Elegí para quién es el premio.');
    expect(err({ condition: 'el-mejor', emoji: '🚲', title: 'Bici' })).toBe('Elegí para quién es el premio.');
    expect(err({ condition: 'gana-la-semana', from: { member: 'andres', itemId: 1 } })).toBe('Ese integrante no es de tu familia.');
    expect(err({ condition: 'gana-la-semana', from: { member: 'pepe', itemId: 1 } })).toBe('Ese integrante no es de tu familia.');
    expect(err({ condition: 'gana-la-semana', from: { member: 'luna', itemId: 4 } })).toBe('Ese premio ya no está en la Tienda de Luna.'); // es de Ian
    expect(err({ condition: 'gana-la-semana', from: { member: 'luna', itemId: 999 } })).toBe('Ese premio ya no está en la Tienda de Luna.');
    expect(err({ condition: 'gana-la-semana', title: 'B', emoji: '🚲' })).toBe('motivo de checkPrizeFields'); // sin reescribirlo
    expect(err({ title: 'B', emoji: '🚲' })).toBe('Elegí para quién es el premio.'); // la condición va antes que los campos
    H.ligas.ian = false; H.ligas.luna = false;
    expect(err({ condition: 'gana-la-semana', title: 'Bici', emoji: '🚲' })).toBe('Ninguno de tus chicos está jugando la liga de la familia (tienen Ligas apagadas).');
  });
  it('opciones: lo que devuelve memberItemsOf de cada dependiente (sin archivados), en el orden de dependents', () => {
    fresh();
    H.items.luna.splice(1, 1); // el libro, archivado: memberItemsOf ya no lo devuelve
    expect(L.familyPrizeOptions(andres)).toEqual({ groups: [
      { member: 'ian', name: ian.name, items: [{ itemId: 4, emoji: '🚲', title: '1 hora de bici en la plaza', desc: 'Salimos a andar juntos.' }] },
      { member: 'luna', name: luna.name, items: [{ itemId: 12, emoji: '🚲', title: '1 hora de bici en la plaza', desc: 'Salimos a andar juntos. ¡Llevá el casco!' }] },
    ] });
  });
  it('quitar: prize null para todos', () => {
    fresh();
    setPrize({ condition: 'gana-la-semana', emoji: '🍦', title: 'Helado' });
    expect(L.clearFamilyPrize(andres).prize).toBeNull();
    expect(L.familyLeague(ian).prize).toBeNull();
  });
});

describe('cierre SIMULADO de la familia (§2.4)', () => {
  it('"supera su semana": copa a Luna, ↑ Ian y Andrés, el premio SOLO a Ian, historial de 2 y las tres ligas públicas cerradas', () => {
    fresh();
    setPrize({ condition: 'supera-su-semana', from: { member: 'luna', itemId: 12 } });
    const ecBefore = ['ian', 'luna', 'andres'].map(id => P.summaryOf(id).ec);
    const r = L.closeFamilyWeekNow(andres);
    if (!r.ok) throw new Error(r.error);
    const { closed, mine } = r.result;
    expect(closed).toMatchObject({ week: 1, simulated: true, total: 2980, label: 'la semana pasada' });
    expect(marks(closed)).toEqual({ luna: ['gano'], ian: ['supero'], andres: ['supero'] });
    expect(closed.prize?.winners).toEqual(['ian']);
    expect(closed.rows.filter(x => x.prize).map(x => x.id)).toEqual(['ian']);
    expect(H.grants).toEqual([{ uid: 'ian', emoji: '🚲', title: '1 hora de bici en la plaza', closedAt: closed.closedAt }]);
    // ⚡ de todos IGUALES (el premio no mueve la billetera; el cierre tampoco)
    expect(['ian', 'luna', 'andres'].map(id => P.summaryOf(id).ec)).toEqual(ecBefore);
    // las ligas públicas de los TRES cerraron (cada uno en SU contexto: su noticia en SU feed) y su XP volvió a 0
    expect(H.news).toEqual(['ian', 'luna', 'andres']);
    expect(['ian', 'luna', 'andres'].map(id => P.summaryOf(id).xpWeek)).toEqual([0, 0, 0]);
    expect(['ian', 'luna', 'andres'].map(id => P.weekFactsOf(id).lastWeek?.xp)).toEqual([1240, 1290, 450]);
    // …y cada liga pública cerró de VERDAD: su ciclo pasó a la semana 1 y su último cierre es ESTE, en la liga de cada uno
    // (sin cierre, lastClose() es null: la "semana pasada" sería la del seed)
    expect(['ian', 'luna', 'andres'].map(id => runAsUser(id, () => L.cycleWeek()))).toEqual([1, 1, 1]);
    expect(['ian', 'luna', 'andres'].map(id => runAsUser(id, () => L.lastClose()?.from))).toEqual(['Liga Cometa', 'Liga Estrella', 'Liga Chispa']);
    expect(mine.closed.league.name).toBe('Liga Chispa'); // la de Andrés
    expect(mine.closed.xp).toBe(450);
    // después: el premio se consumió, la copa de Luna sumó, el calendario corre del cierre
    const lg = L.familyLeague(andres);
    expect(lg).toMatchObject({ prize: null, week: 1, closesInDays: 7 });
    expect(lg.history.map(h => [h.week, h.label])).toEqual([[1, 'la semana pasada'], [0, 'hace 2 semanas']]);
    expect(L.crownsOf('luna')).toBe(2);
    // todos en 0: desempata la racha (Luna 9 > Ian 5 > Andrés 2)
    expect(lg.rows.map(x => [x.id, x.xp, x.prevXp, x.days])).toEqual([['luna', 0, 1290, 0], ['ian', 0, 1240, 0], ['andres', 0, 450, 0]]);
    // los contadores de las medallas se movieron en el corte de cada uno (↑ de Ian y Andrés)
    expect(['ian', 'luna', 'andres'].map(id => P.medalCountersOf(id).pbWeeks)).toEqual([1, 0, 1]);
  });
  it('"gana la semana": se lo lleva Luna (1.290, la mayor XP entre los chicos)', () => {
    fresh();
    setPrize({ condition: 'gana-la-semana', from: { member: 'luna', itemId: 12 } });
    const r = L.closeFamilyWeekNow(andres);
    expect(r.ok && r.result.closed.prize?.winners).toEqual(['luna']);
    expect(H.grants.map(g => g.uid)).toEqual(['luna']);
  });
  it('sin ganadores el premio SIGUE EN JUEGO (y si nadie sumó, no hay copa)', () => {
    fresh();
    L.closeFamilyWeekNow(andres); // todos a 0
    setPrize({ condition: 'supera-su-semana', emoji: '🍿', title: 'Elegís la peli' });
    const r = L.closeFamilyWeekNow(andres);
    if (!r.ok) throw new Error(r.error);
    expect(r.result.closed.prize).toMatchObject({ title: 'Elegís la peli', winners: [] });
    expect(marks(r.result.closed)).toEqual({ ian: [], luna: [], andres: [] });
    expect(H.grants).toEqual([]);
    expect(L.familyLeague(andres).prize?.title).toBe('Elegís la peli');
    expect(L.crownsOf('luna')).toBe(2); // la del seed + la del primer cierre; la segunda semana no tuvo copa
  });
  it('«sigue en juego» lo dice el server (prizeInPlay): winners [] solo dice que nadie lo ganó AL CERRAR', () => {
    fresh();
    expect(L.familyLeague(andres).history[0].prizeInPlay).toBe(false); // el seed: sin premio
    L.closeFamilyWeekNow(andres); // todos a 0
    at('2026-10-28T13:00:00Z');
    setPrize({ condition: 'supera-su-semana', emoji: '🍿', title: 'Elegís la peli' });
    at('2026-10-28T14:00:00Z');
    const r = L.closeFamilyWeekNow(andres); // nadie supera su semana: sigue en juego
    if (!r.ok) throw new Error(r.error);
    expect(r.result.closed).toMatchObject({ prize: { winners: [] }, prizeInPlay: true });
    expect(L.familyLeague(ian).history[0].prizeInPlay).toBe(true);
    at('2026-10-28T15:00:00Z');
    L.closeFamilyWeekNow(andres); // otra semana sin ganadores: las DOS lo dicen (es la misma promesa)
    expect(L.familyLeague(ian).history.slice(0, 2).map(h => h.prizeInPlay)).toEqual([true, true]);
    at('2026-10-28T16:00:00Z');
    setPrize({ condition: 'gana-la-semana', emoji: '🍦', title: 'Helado' }); // el adulto lo CAMBIA: ninguna semana vieja promete nada
    expect(L.familyLeague(ian).history.some(h => h.prizeInPlay)).toBe(false);
  });
  it('prizeInPlay: quitar el premio arrastrado, o que alguien lo gane después, lo apaga en la semana vieja', () => {
    fresh();
    L.closeFamilyWeekNow(andres);
    at('2026-10-28T13:00:00Z');
    setPrize({ condition: 'supera-su-semana', emoji: '🍿', title: 'Peli' });
    at('2026-10-28T14:00:00Z');
    L.closeFamilyWeekNow(andres); // sin ganadores
    expect(L.familyLeague(andres).history[0].prizeInPlay).toBe(true);
    L.clearFamilyPrize(andres);
    expect(L.familyLeague(andres).history[0].prizeInPlay).toBe(false);
    at('2026-10-28T15:00:00Z');
    setPrize({ condition: 'supera-su-semana', emoji: '🍿', title: 'Peli' });
    at('2026-10-28T16:00:00Z');
    L.closeFamilyWeekNow(andres); // sin ganadores otra vez…
    runAsUser('ian', () => P.addXp(30, 'Ruta')); // …y ahora Ian suma (30 > 0 de su semana anterior)
    at('2026-10-28T17:00:00Z');
    const r = L.closeFamilyWeekNow(andres);
    if (!r.ok) throw new Error(r.error);
    expect(r.result.closed.prize?.winners).toEqual(['ian']);
    expect(L.familyLeague(andres).history.slice(0, 2).map(h => [h.prize?.winners.length, h.prizeInPlay])).toEqual([[1, false], [0, false]]);
  });
  it('el adulto 1.º con "gana la semana": la copa es suya, el premio del chico mejor ubicado', () => {
    fresh();
    runAsUser('andres', () => P.addXp(1000, 'Aprender')); // 1.450
    setPrize({ condition: 'gana-la-semana', emoji: '🚲', title: 'Bici' });
    const r = L.closeFamilyWeekNow(andres);
    if (!r.ok) throw new Error(r.error);
    expect(r.result.closed.rows[0]).toMatchObject({ id: 'andres', marks: ['gano', 'supero'] });
    expect(r.result.closed.prize?.winners).toEqual(['luna']);
  });
  it('un chico con Ligas apagadas sale de la tabla y del premio, pero su liga pública cierra igual', () => {
    fresh();
    H.ligas.luna = false;
    setPrize({ condition: 'gana-la-semana', emoji: '🚲', title: 'Bici' });
    const r = L.closeFamilyWeekNow(andres);
    if (!r.ok) throw new Error(r.error);
    expect(r.result.closed.rows.map(x => x.id)).toEqual(['ian', 'andres']);
    expect(r.result.closed.prize?.winners).toEqual(['ian']);
    expect(H.news).toEqual(['ian', 'luna', 'andres']);
    expect(P.summaryOf('luna').xpWeek).toBe(0);
    // la historia de la familia la sigue nombrando (el seed)
    expect(L.familyLeague(andres).history[1].rows.map(x => x.id)).toContain('luna');
  });
  it('con menos de dos integrantes en la tabla: 400 y no toca nada', () => {
    fresh();
    H.ligas.ian = false; H.ligas.luna = false;
    expect(L.closeFamilyWeekNow(andres)).toEqual({ ok: false, status: 400, error: 'La liga de la familia necesita al menos dos integrantes.' });
    expect(H.news).toEqual([]);
    expect(P.summaryOf('ian').xpWeek).toBe(1240);
  });
  it('el historial tiene tope 8 (las copas no se recortan)', () => {
    fresh();
    for (let i = 0; i < 10; i++) { runAsUser('luna', () => P.addXp(30, 'Ruta')); L.closeFamilyWeekNow(andres); }
    const lg = L.familyLeague(andres);
    expect(lg.history).toHaveLength(8);
    expect(lg.history[0].week).toBe(10);
    expect(lg.history[7]).toMatchObject({ week: 3, label: 'hace 8 semanas' });
    expect(L.crownsOf('luna')).toBe(11);
  });
  it('tras el cierre, lo de hoy cuenta en la semana nueva (el reto arranca de cero)', () => {
    fresh();
    L.closeFamilyWeekNow(andres);
    runAsUser('ian', () => P.addXp(30, 'Ruta'));
    const row = L.familyLeague(andres).rows.find(x => x.id === 'ian')!;
    expect([row.xp, row.days, row.bestRun]).toEqual([30, 1, 1]);
  });
});

describe('cierre REAL perezoso (§2.3)', () => {
  // familyCloseIfDue directo = el camino de un LECTOR sin reset (una pestaña abierta a la medianoche, el switch de usuario).
  // ABRIR la app resetea primero al que abre: ese camino, con demoReset, está en familyMonday.test.ts.
  it('el lunes de la familia cierra la semana abierta con la XP de cada uno y reparte el premio; una sola vez', () => {
    fresh('2026-10-28T12:00:00Z');
    L.familyLeague(andres); // nace el estado de la familia (semana del 26-oct)
    setPrize({ condition: 'supera-su-semana', emoji: '🚲', title: 'Bici' });
    runAsUser('luna', () => P.addXp(90, 'Ruta')); // 1.380 > 1.350
    expect(L.familyCloseIfDue('ian')).toBe(false); // todavía es la misma semana
    at('2026-11-02T00:30:00Z'); // lunes 00:30 de la familia
    expect(L.familyCloseIfDue('ian')).toBe(true);
    expect(L.familyCloseIfDue('andres')).toBe(false);
    const lg = L.familyLeague(andres);
    const h = lg.history[0];
    expect(h).toMatchObject({ week: 1, simulated: false, total: 1240 + 1380 + 450, closedAt: Date.parse('2026-11-02T00:00:00Z') });
    expect(marks(h)).toEqual({ luna: ['gano', 'supero'], ian: ['supero'], andres: ['supero'] });
    expect(h.prize?.winners).toEqual(['luna', 'ian']);
    expect(H.grants.map(g => g.uid)).toEqual(['luna', 'ian']);
    expect(lg.prize).toBeNull();
    expect(xpOf(lg)).toEqual({ luna: 0, ian: 0, andres: 0 });
    expect(lg.closesInDays).toBe(6); // calendario real: del lunes al domingo
    expect(H.news).toEqual([]); // las ligas públicas no cierran solas
  });
  it('si pasaron varias semanas se cierra UNA (la que estaba abierta), fechada el lunes que de verdad la cerró', () => {
    fresh('2026-10-28T12:00:00Z');
    L.familyLeague(andres);
    runAsUser('ian', () => P.startNewWeek()); // Ian cerró SU liga el miércoles: su semana sigue siendo la del 26-oct…
    runAsUser('ian', () => P.addXp(60, 'Ruta')); // …y entra con lo que sumó desde ese cierre
    at('2026-11-18T12:00:00Z'); // tres semanas después
    expect(L.familyCloseIfDue('luna')).toBe(true);
    const h = L.familyLeague(andres).history[0];
    expect(h.rows.map(r => [r.id, r.xp])).toEqual([['luna', 1290], ['andres', 450], ['ian', 60]]);
    expect(h.closedAt).toBe(Date.parse('2026-11-02T00:00:00Z')); // el lunes siguiente a la semana cerrada, no el de hoy
    expect(h.label).toBe('la semana pasada'); // borde aceptado: el rótulo sale de la posición
    expect(L.familyCloseIfDue('luna')).toBe(false);
  });
  it('un integrante cuya última semana registrada NO es la abierta de la familia (su progreso ya cortó otro lunes) entra con 0: sin XP, sin días, sin ↑', () => {
    fresh('2026-10-28T12:00:00Z');
    L.familyLeague(andres); // la semana abierta de la familia: la del 26-oct
    at('2026-11-03T12:00:00Z');
    runAsUser('ian', () => P.addXp(30, 'Ruta')); // su progreso corta el lunes 2-nov (nadie leyó la familia) y suma en esa semana
    at('2026-11-10T12:00:00Z');
    P.summaryOf('ian'); // …y vuelve a cortar el 9-nov: su última semana registrada es la del 2-nov
    expect(L.familyCloseIfDue('andres')).toBe(true);
    const h = L.familyLeague(andres).history[0];
    expect(h.rows.map(r => [r.id, r.xp, r.days, r.marks])).toEqual([['luna', 1290, 3, ['gano']], ['andres', 450, 2, ['supero']], ['ian', 0, 0, []]]);
    expect(h.closedAt).toBe(Date.parse('2026-11-02T00:00:00Z'));
  });
  it('familia de 1 (los dos chicos con Ligas apagadas): el lunes real cierra igual —historial de uno, sin copa (pide ≥ 2 filas)—', () => {
    fresh('2026-10-28T12:00:00Z');
    L.familyLeague(andres);
    H.ligas.ian = false; H.ligas.luna = false;
    at('2026-11-02T12:00:00Z');
    expect(L.familyCloseIfDue('andres')).toBe(true);
    const h = L.familyLeague(andres).history[0];
    expect(h.rows.map(r => [r.id, r.marks])).toEqual([['andres', ['supero']]]);
    expect(h).toMatchObject({ week: 1, total: 450, prize: null });
    expect(L.crownsOf('andres')).toBe(0);
    expect(L.familyCloseIfDue('andres')).toBe(false);
  });
  it('tras un cierre SIMULADO el perezoso queda apagado (los calendarios no se mezclan) hasta el reset de todos', () => {
    fresh('2026-10-28T12:00:00Z');
    L.closeFamilyWeekNow(andres);
    at('2026-11-02T12:00:00Z');
    expect(L.familyCloseIfDue('andres')).toBe(false);
    expect(L.familyLeague(andres).closesInDays).toBe(2); // 7 − 5 días reales desde el cierre
    at('2026-11-09T12:00:00Z');
    expect(L.familyLeague(andres).closesInDays).toBe(0); // "¡Cierra hoy!" hasta otro cierre o {scope:'all'}
    L.resetFamilyWeeks();
    L.familyLeague(andres);
    at('2026-11-16T12:00:00Z');
    expect(L.familyCloseIfDue('andres')).toBe(true);
  });
});

describe('reset: la semana es RAM de la FAMILIA', () => {
  it('el reset de UN usuario no toca el historial ni el premio; resetFamilyWeeks (scope all) vuelve al seed', () => {
    fresh();
    setPrize({ condition: 'gana-la-semana', emoji: '🚲', title: 'Bici' });
    L.closeFamilyWeekNow(andres);
    setPrize({ condition: 'supera-su-semana', emoji: '🍿', title: 'Peli' });
    P.resetProgress('ian'); L.resetLeagues('ian'); // el F5 de Ian
    const lg = L.familyLeague(luna);
    expect(lg.history).toHaveLength(2);
    expect(lg.prize?.title).toBe('Peli');
    expect(lg.rows.find(r => r.id === 'ian')?.xp).toBe(1240); // Ian volvió a SU seed ("F5 a medias")
    L.resetFamilyWeeks();
    expect(L.familyLeague(luna)).toMatchObject({ week: 0, prize: null });
    expect(L.familyLeague(luna).history).toHaveLength(1);
  });
});

/* ---------- rutas: el gating y los textos (§6.2) ---------- */
function call(user: string, method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> {
  const req = Readable.from(body === undefined ? [] : [typeof body === 'string' ? body : JSON.stringify(body)]) as unknown as IncomingMessage;
  Object.assign(req, { method, url: path, headers: { 'x-innerith-user': user } });
  return new Promise(resolve => {
    let status = 0;
    const res = { writeHead: (s: number) => { status = s; }, end: (b: string) => resolve({ status, body: JSON.parse(b) }) } as unknown as ServerResponse;
    void runAsUser(user, () => L.leaguesRoutes(req, res, new URL(path, 'http://localhost')));
  });
}

describe('rutas /api/leagues/family*', () => {
  it('un chico lee la tabla pero no pone el premio ni cierra (403 con su texto); 405 con el método equivocado', async () => {
    fresh();
    expect((await call('ian', 'GET', '/api/leagues/family')).status).toBe(200);
    expect(await call('ian', 'POST', '/api/leagues/family/prize', { condition: 'gana-la-semana', emoji: '🚲', title: 'Bici' })).toEqual({ status: 403, body: { error: 'El premio de la semana lo pone un adulto de la familia.' } });
    expect(await call('luna', 'POST', '/api/leagues/family/prize/clear')).toEqual({ status: 403, body: { error: 'El premio de la semana lo pone un adulto de la familia.' } });
    expect(await call('ian', 'GET', '/api/leagues/family/prize-options')).toEqual({ status: 403, body: { error: 'El premio de la semana lo pone un adulto de la familia.' } });
    expect(await call('ian', 'POST', '/api/leagues/family/close-week')).toEqual({ status: 403, body: { error: 'El cierre de la semana de la familia lo hace un adulto.' } });
    expect((await call('andres', 'GET', '/api/leagues/family/close-week')).status).toBe(405);
    expect((await call('andres', 'GET', '/api/leagues/family/prize')).status).toBe(405);
    expect((await call('andres', 'GET', '/api/leagues/family/prize/clear')).status).toBe(405);
    expect((await call('andres', 'POST', '/api/leagues/family/prize-options')).status).toBe(405);
    expect((await call('andres', 'GET', '/api/leagues/family/otra')).status).toBe(404);
    expect(P.summaryOf('ian').xpWeek).toBe(1240); // nada cerró
  });
  it('Ligas apagadas para el chico: 403 de Ligas en TODO /api/leagues/family* (antes que lo demás)', async () => {
    fresh();
    H.ligas.luna = false;
    for (const [m, p] of [['GET', '/api/leagues/family'], ['POST', '/api/leagues/family/close-week'], ['GET', '/api/leagues/family/prize-options']]) {
      expect(await call('luna', m, p)).toEqual({ status: 403, body: { error: 'Las ligas están apagadas por tu familia' } });
    }
  });
  it('el adulto: premio por la ruta (JSON inválido → 400), opciones, cierre y quitar', async () => {
    fresh();
    expect(await call('andres', 'POST', '/api/leagues/family/prize', '{no es json')).toEqual({ status: 400, body: { error: 'Pedido inválido (se esperaba JSON).' } });
    expect(await call('andres', 'POST', '/api/leagues/family/prize', '[1,2]')).toEqual({ status: 400, body: { error: 'Pedido inválido (se esperaba JSON).' } });
    expect(await call('andres', 'POST', '/api/leagues/family/prize', {})).toEqual({ status: 400, body: { error: 'Elegí para quién es el premio.' } });
    const set = await call('andres', 'POST', '/api/leagues/family/prize', { condition: 'supera-su-semana', from: { member: 'ian', itemId: '4' } });
    expect(set.status).toBe(200);
    expect(set.body.prize).toMatchObject({ title: '1 hora de bici en la plaza', from: { member: 'ian', itemId: 4 } });
    expect((await call('andres', 'GET', '/api/leagues/family/prize-options')).body.groups.map((g: { member: string }) => g.member)).toEqual(['ian', 'luna']);
    const closed = await call('andres', 'POST', '/api/leagues/family/close-week');
    expect(closed.status).toBe(200);
    expect(closed.body.closed.prize.winners).toEqual(['ian']);
    expect(closed.body.mine.closed.league.name).toBe('Liga Chispa');
    expect((await call('andres', 'POST', '/api/leagues/family/prize/clear')).body.prize).toBeNull();
  });
});
