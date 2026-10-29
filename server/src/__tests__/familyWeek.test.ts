import { describe, expect, it } from 'vitest';
import {
  beatsLastWeek, bestRun, closeFamilyWeek, prizeWinners, seedWeekDays, sortFamilyRows,
  type FamilyWeekInputRow, type FamilyWeekPrize,
} from '../familyWeek';

/* U5-A (docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §2.2, §3.4, §4.3): la lógica PURA del cierre de la semana de la familia. Sin
   estado ni imports con estado: nada de server/data. */

const row = (id: string, kind: 'adult' | 'child', xp: number, o: Partial<FamilyWeekInputRow> = {}): FamilyWeekInputRow =>
  ({ id, name: id[0].toUpperCase() + id.slice(1), kind, xp, days: 3, prevXp: null, streakDays: 0, seedIdx: 0, ...o });
/** La familia del seed tal como queda HOY en vivo (U4: 1.240 / 1.290 / 450) contra la "semana pasada" sembrada. */
const SEED_LIVE = [
  row('ian', 'child', 1240, { prevXp: 1180, streakDays: 5, seedIdx: 0 }),
  row('luna', 'child', 1290, { prevXp: 1350, streakDays: 9, seedIdx: 1 }),
  row('andres', 'adult', 450, { prevXp: 300, streakDays: 2, seedIdx: 2 }),
];
const prize = (condition: FamilyWeekPrize['condition']): FamilyWeekPrize => ({
  emoji: '🚲', title: '1 hora de bici en la plaza', condition, by: { id: 'andres', name: 'Andrés' }, from: { member: 'luna', itemId: 12 }, setAt: 1,
});
const meta = { week: 1, closedAt: 1000, simulated: true };
const marksOf = (c: ReturnType<typeof closeFamilyWeek>) => Object.fromEntries(c.rows.map(r => [r.id, r.marks]));

describe('orden de la tabla (U4 D2: XP → racha → seed)', () => {
  it('ordena por XP, desempata por racha y después por el orden del seed', () => {
    const rs = sortFamilyRows([
      row('a', 'child', 100, { streakDays: 1, seedIdx: 0 }), row('b', 'child', 100, { streakDays: 3, seedIdx: 1 }),
      row('c', 'child', 100, { streakDays: 3, seedIdx: 2 }), row('d', 'adult', 200, { seedIdx: 3 }),
    ]);
    expect(rs.map(r => r.id)).toEqual(['d', 'b', 'c', 'a']);
  });
});

describe('marcas del cierre (§2.2): nada negativo, solo alcanzables + la copa', () => {
  it('la familia del seed: 🏆 Luna; ↑ Ian (1.240 > 1.180) y Andrés (450 > 300); Luna sin ↑ (1.290 < 1.350); total 2.980', () => {
    const c = closeFamilyWeek(SEED_LIVE, null, meta);
    expect(c.rows.map(r => r.id)).toEqual(['luna', 'ian', 'andres']);
    expect(marksOf(c)).toEqual({ luna: ['gano'], ian: ['supero'], andres: ['supero'] });
    expect(c.total).toBe(2980);
    expect(c.prize).toBeNull();
    expect(c).toMatchObject({ week: 1, closedAt: 1000, simulated: true });
  });
  it('la copa pide ≥ 2 filas y XP > 0 ("Nadie sumó esta semana")', () => {
    expect(marksOf(closeFamilyWeek([row('andres', 'adult', 500)], null, meta))).toEqual({ andres: [] });
    expect(marksOf(closeFamilyWeek([row('ian', 'child', 0), row('luna', 'child', 0)], null, meta))).toEqual({ ian: [], luna: [] });
    expect(marksOf(closeFamilyWeek([row('ian', 'child', 1), row('luna', 'child', 0)], null, meta))).toEqual({ ian: ['gano'], luna: [] });
  });
  it('empate en la punta: la copa es del 1.º de la tabla (racha → seed); es la ÚNICA marca que desempata', () => {
    const c = closeFamilyWeek([row('ian', 'child', 300, { streakDays: 2, seedIdx: 0 }), row('luna', 'child', 300, { streakDays: 5, seedIdx: 1 })], null, meta);
    expect(marksOf(c)).toEqual({ luna: ['gano'], ian: [] });
  });
  it('↑ "superó su semana": sin semana anterior no hay marca; con prevXp 0 cualquier XP la supera; igualar no alcanza', () => {
    expect(beatsLastWeek({ xp: 999, prevXp: null })).toBe(false);
    expect(beatsLastWeek({ xp: 1, prevXp: 0 })).toBe(true);
    expect(beatsLastWeek({ xp: 0, prevXp: 0 })).toBe(false);
    expect(beatsLastWeek({ xp: 300, prevXp: 300 })).toBe(false);
    expect(beatsLastWeek({ xp: 301, prevXp: 300 })).toBe(true);
  });
  it('✨ "los 7 días" para TODOS los que llegaron (adulto incluido), con 6 no', () => {
    const c = closeFamilyWeek([row('ian', 'child', 100, { days: 7 }), row('luna', 'child', 50, { days: 6 }), row('andres', 'adult', 10, { days: 7 })], null, meta);
    expect(marksOf(c)).toEqual({ ian: ['gano', 'siete'], luna: [], andres: ['siete'] });
  });
  it('varias marcas en una fila, en orden fijo (gano → supero → siete); nunca otra cosa', () => {
    const c = closeFamilyWeek([row('luna', 'child', 900, { prevXp: 100, days: 7 }), row('ian', 'child', 10)], null, meta);
    expect(c.rows[0].marks).toEqual(['gano', 'supero', 'siete']);
    for (const r of c.rows) for (const m of r.marks) expect(['gano', 'supero', 'siete']).toContain(m);
  });
});

describe('ganadores del premio (§3.4): solo chicos, sin sorteo', () => {
  it('"supera su semana": cada chico que superó la suya (Ian sí, Luna no); el adulto nunca cobra', () => {
    expect(prizeWinners(SEED_LIVE, 'supera-su-semana')).toEqual(['ian']);
    const c = closeFamilyWeek(SEED_LIVE, prize('supera-su-semana'), meta);
    expect(c.prize?.winners).toEqual(['ian']);
    expect(c.rows.filter(r => r.prize).map(r => r.id)).toEqual(['ian']);
    expect(c.rows.find(r => r.id === 'andres')?.marks).toContain('supero'); // la marca sí, el premio no
  });
  it('"gana la semana": el chico con más XP (Luna 1.290)', () => {
    expect(prizeWinners(SEED_LIVE, 'gana-la-semana')).toEqual(['luna']);
  });
  it('"gana la semana" con el adulto 1.º: la copa es del adulto, el premio del chico mejor ubicado', () => {
    const rs = [row('andres', 'adult', 3000, { seedIdx: 2 }), ...SEED_LIVE.filter(r => r.kind === 'child')];
    const c = closeFamilyWeek(rs, prize('gana-la-semana'), meta);
    expect(c.rows[0]).toMatchObject({ id: 'andres', marks: ['gano'] });
    expect(c.prize?.winners).toEqual(['luna']);
  });
  it('empate exacto entre chicos = los dos (no se desempata por racha ni por seed)', () => {
    const rs = [row('ian', 'child', 500, { streakDays: 1, seedIdx: 0 }), row('luna', 'child', 500, { streakDays: 9, seedIdx: 1 }), row('andres', 'adult', 10)];
    expect(prizeWinners(rs, 'gana-la-semana')).toEqual(['luna', 'ian']); // en el orden de la tabla
  });
  it('todo en 0 → nadie (el premio sigue en juego: winners [])', () => {
    const rs = [row('ian', 'child', 0, { prevXp: 0 }), row('luna', 'child', 0, { prevXp: 1290 }), row('andres', 'adult', 0)];
    expect(prizeWinners(rs, 'gana-la-semana')).toEqual([]);
    expect(prizeWinners(rs, 'supera-su-semana')).toEqual([]);
    const c = closeFamilyWeek(rs, prize('supera-su-semana'), meta);
    expect(c.prize).toMatchObject({ title: '1 hora de bici en la plaza', winners: [] });
    expect(c.rows.every(r => !r.prize && r.marks.length === 0)).toBe(true);
  });
  it('sin chicos en la tabla, nadie cobra', () => {
    expect(prizeWinners([row('andres', 'adult', 900, { prevXp: 1 })], 'supera-su-semana')).toEqual([]);
  });
  it('el premio guardado en el cierre es una COPIA (cambiar el de la semana después no reescribe la historia)', () => {
    const p = prize('supera-su-semana');
    const c = closeFamilyWeek(SEED_LIVE, p, meta);
    p.title = 'otro'; p.from!.itemId = 99;
    expect(c.prize).toMatchObject({ title: '1 hora de bici en la plaza', from: { member: 'luna', itemId: 12 } });
  });
});

describe('seedWeekDays (§4.3): los días del seed no contradicen la racha', () => {
  // dow: 0 = lunes … 6 = domingo. Deseados del seed: Ian 6 · Luna 7 · Andrés 3.
  const table = (streak: number, wanted: number) => Array.from({ length: 7 }, (_, dow) => seedWeekDays(streak, dow, wanted));
  it('esta semana = min(racha, dow + 1): días que terminan hoy', () => {
    expect(table(2, 3).map(x => x.thisWeek)).toEqual([1, 2, 2, 2, 2, 2, 2]);
    expect(table(5, 6).map(x => x.thisWeek)).toEqual([1, 2, 3, 4, 5, 5, 5]);
    expect(table(9, 7).map(x => x.thisWeek)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('Luna (racha 9, quiere 7): 7 solo un lunes o un martes; de miércoles en adelante el lunes anterior al arranque fue hueco', () => {
    // spill = 9 − (dow+1): 8, 7 → 7 · 6 → [6..6] · 5 → [5..6] → 6 · 4 → 6 · 3 → 6 · 2 → 6
    expect(table(9, 7).map(x => x.lastWeek)).toEqual([7, 7, 6, 6, 6, 6, 6]);
  });
  it('Ian (racha 5, quiere 6): spill > 0 → entre spill y 6; spill = 0 → como mucho 6; spill < 0 → lo deseado', () => {
    // spill = 5 − (dow+1): 4, 3, 2, 1 → 6 (≥ spill) · 0 → min(6, 6) · −1, −2 → 6
    expect(table(5, 6).map(x => x.lastWeek)).toEqual([6, 6, 6, 6, 6, 6, 6]);
    expect(table(5, 2).map(x => x.lastWeek)).toEqual([4, 3, 2, 2, 2, 2, 2]); // nunca menos que el tramo de la racha
  });
  it('Andrés (racha 2, quiere 3): el lunes la racha arrancó el domingo (spill 1: ≥ 1); después, lo deseado', () => {
    expect(table(2, 3).map(x => x.lastWeek)).toEqual([3, 3, 3, 3, 3, 3, 3]);
    expect(table(2, 0).map(x => x.lastWeek)).toEqual([1, 0, 0, 0, 0, 0, 0]);
  });
  it('spill = 0 recorta a 6 aunque se quieran 7 (el domingo pasado fue hueco)', () => {
    expect(seedWeekDays(3, 2, 7)).toEqual({ thisWeek: 3, lastWeek: 6 });
  });
  it('racha de 7+ que cubre la semana pasada entera → 7 sin importar lo deseado', () => {
    expect(seedWeekDays(14, 6, 0)).toEqual({ thisWeek: 7, lastWeek: 7 });
  });
  it('sin racha: 0 esta semana y lo deseado la pasada (acotado a 0..7)', () => {
    expect(seedWeekDays(0, 3, 9)).toEqual({ thisWeek: 0, lastWeek: 7 });
    expect(seedWeekDays(0, 3, -2)).toEqual({ thisWeek: 0, lastWeek: 0 });
  });
});

describe('bestRun: el tramo de días seguidos más largo (D2, variante "seguidos")', () => {
  it('cuenta el tramo más largo, sin importar orden ni repetidos', () => {
    expect(bestRun([])).toBe(0);
    expect(bestRun([10])).toBe(1);
    expect(bestRun([10, 11, 12])).toBe(3);
    expect(bestRun([14, 10, 11, 13, 11, 15])).toBe(3); // 13-14-15
    expect(bestRun([1, 3, 5, 7])).toBe(1);
  });
  it('romper un tramo no baja el número (es monotónico al sumar días)', () => {
    const days = [20, 21, 22];
    const before = bestRun(days);
    expect(bestRun([...days, 24])).toBe(before);
    expect(bestRun([...days, 24, 25, 26, 27])).toBe(4);
  });
});
