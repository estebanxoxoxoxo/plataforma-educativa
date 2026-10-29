import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addXp, familyDayNum, familyWeekStart, medalCountersOf, resetProgress, seedLastWeekOf, setProgressTzSource, startNewWeek,
  summaryOf, weekFactsOf,
} from '../progress';
import { runAsUser } from '../requestContext';

/* U4-A (remate): el corte de semana de la XP y el día de la racha corren en la ZONA HORARIA DE LA FAMILIA (la misma del
   ciclo de liga), no en la hora local del server. Zonas sin horario de verano y en los extremos —Kiritimati (UTC+14) y
   Pago Pago (UTC−11)— para que el resultado no dependa de la zona del proceso que corre el test. Semana de referencia:
   lunes 26-oct-2026 a domingo 1-nov-2026; el lunes siguiente es el 2-nov. Solo lee la config (users.ts → config.ts). */

const KIRI = 'Pacific/Kiritimati', PAGO = 'Pacific/Pago_Pago';
const at = (iso: string) => vi.setSystemTime(new Date(iso));
const lunaWeek = () => summaryOf('luna').xpWeek;
/** Vuelve al seed y hace NACER los tres slices en ESTE instante (nacen perezosos, en su primer uso). */
const reseed = () => { resetProgress(); for (const u of ['ian', 'luna', 'andres']) summaryOf(u); };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); setProgressTzSource(() => null); resetProgress(); });

describe('calendario de la familia (puro)', () => {
  it('el mismo instante cae en días y semanas distintos según la zona', () => {
    const t = Date.parse('2026-11-01T10:30:00Z'); // Kiritimati: lunes 2-nov 00:30 · Pago Pago: sábado 31-oct 23:30
    expect(familyDayNum(t, KIRI) - familyDayNum(t, PAGO)).toBe(2);
    expect(familyWeekStart(t, KIRI)).toBe(familyDayNum(Date.parse('2026-11-02T12:00:00Z'), 'UTC')); // su lunes = 2-nov
    expect(familyWeekStart(t, PAGO)).toBe(familyDayNum(Date.parse('2026-10-26T12:00:00Z'), 'UTC')); // su lunes = 26-oct
  });
  it('domingo 23:59 y lunes 00:00 de la familia son semanas distintas; lunes a domingo, la misma', () => {
    const sun = Date.parse('2026-11-01T09:59:00Z'), mon = Date.parse('2026-11-01T10:00:00Z'); // Kiritimati: dom 23:59 / lun 00:00
    expect(familyWeekStart(mon, KIRI) - familyWeekStart(sun, KIRI)).toBe(7);
    const lun = Date.parse('2026-10-26T11:00:00Z'), dom = Date.parse('2026-11-02T10:59:00Z'); // Pago Pago: lun 00:00 / dom 23:59
    expect(familyWeekStart(lun, PAGO)).toBe(familyWeekStart(dom, PAGO));
  });
});

describe('XP semanal: vuelve a 0 el lunes 00:00 DE LA FAMILIA', () => {
  it('Kiritimati: a las 00:30 del lunes de la familia ya es semana nueva (en UTC todavía es domingo)', () => {
    setProgressTzSource(() => KIRI);
    at('2026-11-01T09:00:00Z'); // domingo 23:00 de la familia
    reseed();
    expect(lunaWeek()).toBe(1290);
    at('2026-11-01T10:30:00Z'); // lunes 00:30 de la familia
    const s = summaryOf('luna');
    expect(s.xpWeek).toBe(0);
    expect(s.ec).toBe(1290); // la billetera NO se toca
    expect(s.streakDays).toBe(9);
  });
  it('Pago Pago: el domingo 23:30 de la familia sigue siendo la semana (aunque en UTC ya sea lunes); a las 00:30 del lunes, 0', () => {
    setProgressTzSource(() => PAGO);
    at('2026-11-01T10:30:00Z'); // sábado 31-oct 23:30 de la familia
    reseed();
    expect(lunaWeek()).toBe(1290);
    at('2026-11-02T10:30:00Z'); // domingo 1-nov 23:30 de la familia (lunes 2-nov en UTC)
    expect(lunaWeek()).toBe(1290);
    at('2026-11-02T11:30:00Z'); // lunes 2-nov 00:30 de la familia
    expect(lunaWeek()).toBe(0);
  });
  it('lo que se gana el lunes de la familia cuenta para la semana nueva; startNewWeek (cierre simulado) no se deshace', () => {
    setProgressTzSource(() => KIRI);
    at('2026-11-01T09:00:00Z');
    reseed();
    at('2026-11-01T10:30:00Z');
    expect(runAsUser('luna', () => addXp(30, 'Ruta: x')).xpWeek).toBe(30);
    runAsUser('luna', () => startNewWeek());
    expect(lunaWeek()).toBe(0);
    expect(runAsUser('luna', () => addXp(30, 'Ruta: x')).xpWeek).toBe(30);
  });
  it('sin zona (Automática) usa el calendario local del server, como antes', () => {
    setProgressTzSource(() => null);
    vi.setSystemTime(new Date(2026, 10, 1, 23, 0)); // domingo 1-nov 23:00 LOCAL
    reseed();
    expect(lunaWeek()).toBe(1290);
    vi.setSystemTime(new Date(2026, 10, 2, 0, 30)); // lunes 2-nov 00:30 LOCAL
    expect(lunaWeek()).toBe(0);
  });
});

describe('racha: días de calendario DE LA FAMILIA', () => {
  it('practicar al día siguiente de la familia la estira; el mismo día no; saltear un día la vuelve a 1', () => {
    setProgressTzSource(() => KIRI);
    at('2026-11-01T09:00:00Z'); // domingo 23:00 de la familia (el seed de Luna: racha 9, último día = hoy)
    reseed();
    expect(runAsUser('luna', () => addXp(30, 'Ruta: x')).streakDays).toBe(9); // mismo día del seed
    at('2026-11-01T10:30:00Z'); // lunes 00:30 de la familia: día siguiente (en UTC sigue siendo el mismo día)
    expect(runAsUser('luna', () => addXp(30, 'Ruta: x')).streakDays).toBe(10);
    at('2026-11-01T20:00:00Z'); // lunes 10:00 de la familia
    expect(runAsUser('luna', () => addXp(30, 'Ruta: x')).streakDays).toBe(10);
    at('2026-11-03T10:30:00Z'); // miércoles 00:30 de la familia (salteó el martes)
    expect(runAsUser('luna', () => addXp(30, 'Ruta: x')).streakDays).toBe(1);
  });
  it('cada usuario con su racha (el día es de la familia, la racha de cada uno)', () => {
    setProgressTzSource(() => PAGO);
    at('2026-11-02T10:30:00Z'); // domingo 23:30 de la familia
    reseed();
    at('2026-11-02T11:30:00Z'); // lunes 00:30 de la familia
    expect(runAsUser('ian', () => addXp(30, 'Ruta: x')).streakDays).toBe(6);
    expect(summaryOf('luna').streakDays).toBe(9);
    expect(summaryOf('andres').streakDays).toBe(2);
  });
});

/* U5-A (docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §2.3, §4.1, §5.4): el corte de semana deja de PERDER la semana — guarda lastWeek,
   mueve pbWeeks/fullWeeks — y la semana abierta lleva sus días con aprendizaje nuevo (weekDays). Zona fija 'UTC' para que el
   día de la semana no dependa del proceso: miércoles 28-oct-2026 (dow 2), lunes 26-oct, domingo 1-nov, lunes 2-nov. */
const UTC = 'UTC';
const day = (iso: string) => familyDayNum(Date.parse(iso), UTC);
const WEEK = day('2026-10-26T12:00:00Z'); // el lunes de la semana de referencia
const as = <T,>(id: string, fn: () => T) => runAsUser(id, fn);

describe('U5: seeds con semana pasada y días coherentes con la racha', () => {
  it('un miércoles: esta semana Ian 3 · Luna 3 · Andrés 2 días; la pasada 6 · 6 · 3 (Luna no puede tener 7: el lunes anterior fue hueco)', () => {
    setProgressTzSource(() => UTC);
    at('2026-10-28T12:00:00Z');
    reseed();
    expect([weekFactsOf('ian').days, weekFactsOf('luna').days, weekFactsOf('andres').days]).toEqual([3, 3, 2]);
    expect(weekFactsOf('luna').bestRun).toBe(3);
    expect(weekFactsOf('ian').lastWeek).toEqual({ weekStart: WEEK - 7, xp: 1180, days: 6, prevXp: null });
    expect(weekFactsOf('luna').lastWeek).toEqual({ weekStart: WEEK - 7, xp: 1350, days: 6, prevXp: null });
    expect(weekFactsOf('andres').lastWeek).toEqual({ weekStart: WEEK - 7, xp: 300, days: 3, prevXp: null });
    expect(seedLastWeekOf('luna')).toEqual({ weekStart: WEEK - 7, xp: 1350, days: 6 });
  });
  it('un lunes Luna tiene los 7 de la pasada (racha 9) y 1 de esta; un domingo, 7 de esta', () => {
    setProgressTzSource(() => UTC);
    at('2026-10-26T12:00:00Z');
    reseed();
    expect(seedLastWeekOf('luna')?.days).toBe(7);
    expect(weekFactsOf('luna').days).toBe(1);
    at('2026-11-01T12:00:00Z');
    reseed();
    expect(weekFactsOf('luna').days).toBe(7);
  });
  it('hechos fijos de las medallas del seed (§5.4) y un usuario sin seed sin semana anterior', () => {
    setProgressTzSource(() => UTC);
    at('2026-10-28T12:00:00Z');
    reseed();
    expect(medalCountersOf('ian')).toEqual({ bestStreak: 5, comebacks: 0, pbWeeks: 0, fullWeeks: 0 });
    expect(medalCountersOf('luna')).toEqual({ bestStreak: 9, comebacks: 0, pbWeeks: 0, fullWeeks: 1 });
    expect(medalCountersOf('andres')).toEqual({ bestStreak: 2, comebacks: 0, pbWeeks: 0, fullWeeks: 0 });
    expect(seedLastWeekOf('nadie')).toBeNull();
  });
});

describe('U5: el corte guarda la semana (lastWeek) y mueve los contadores', () => {
  it('cierre simulado: lastWeek = la semana que cerró (con su comparación), XP y días a 0; ↑ suma pbWeeks', () => {
    setProgressTzSource(() => UTC);
    at('2026-10-28T12:00:00Z');
    reseed();
    as('ian', () => startNewWeek()); // 1.240 > 1.180 → superó su semana
    expect(weekFactsOf('ian')).toEqual({ days: 0, bestRun: 0, lastWeek: { weekStart: WEEK, xp: 1240, days: 3, prevXp: 1180 } });
    expect(summaryOf('ian').xpWeek).toBe(0);
    expect(medalCountersOf('ian').pbWeeks).toBe(1);
    as('luna', () => startNewWeek()); // 1.290 < 1.350 → no
    expect(medalCountersOf('luna').pbWeeks).toBe(0);
    as('ian', () => startNewWeek()); // 0 contra 1.240 → no; igualar tampoco alcanzaría
    expect(weekFactsOf('ian').lastWeek).toEqual({ weekStart: WEEK, xp: 0, days: 0, prevXp: 1240 });
    expect(medalCountersOf('ian').pbWeeks).toBe(1);
  });
  it('tras un cierre simulado el MISMO día, la próxima posta de hoy cuenta en la semana nueva (weekDays fuera de touchStreak)', () => {
    setProgressTzSource(() => UTC);
    at('2026-10-28T12:00:00Z');
    reseed();
    as('luna', () => startNewWeek());
    expect(weekFactsOf('luna').days).toBe(0);
    expect(as('luna', () => addXp(30, 'Ruta: x')).streakDays).toBe(9); // la racha ya contó hoy: no se mueve
    expect(weekFactsOf('luna').days).toBe(1); // pero el día SÍ cuenta para la semana
    as('luna', () => addXp(30, 'Ruta: x'));
    expect(weekFactsOf('luna').days).toBe(1); // un mismo día cuenta una vez
    expect(as('luna', () => addXp(0, 'nada')).xp).toBe(0);
    expect(weekFactsOf('luna').days).toBe(1); // un monto 0 no marca nada
  });
  it('los 7 días de la semana suman fullWeeks al cortar (Luna un domingo)', () => {
    setProgressTzSource(() => UTC);
    at('2026-11-01T12:00:00Z');
    reseed();
    as('luna', () => startNewWeek());
    expect(weekFactsOf('luna').lastWeek?.days).toBe(7);
    expect(medalCountersOf('luna').fullWeeks).toBe(2); // la del seed + ésta
  });
  it('lunes real (perezoso): se registra la semana que estaba abierta, aunque hayan pasado varias; las del medio no existen', () => {
    setProgressTzSource(() => UTC);
    at('2026-10-28T12:00:00Z');
    reseed();
    as('luna', () => addXp(30, 'Ruta: x')); // 1.320, mismo día
    at('2026-11-11T12:00:00Z'); // miércoles de DOS semanas después (se salteó la del 2-nov)
    expect(weekFactsOf('luna')).toEqual({ days: 0, bestRun: 0, lastWeek: { weekStart: WEEK, xp: 1320, days: 3, prevXp: 1350 } });
    expect(summaryOf('luna').xpWeek).toBe(0);
    expect(medalCountersOf('luna').pbWeeks).toBe(0); // 1.320 < 1.350
    at('2026-11-16T12:00:00Z'); // el lunes siguiente: se corta la semana del 9-nov (sin XP) contra la última registrada
    expect(weekFactsOf('luna').lastWeek).toEqual({ weekStart: WEEK + 14, xp: 0, days: 0, prevXp: 1320 });
  });
});

describe('U5: hechos de constancia (bestStreak, comebacks)', () => {
  it('bestStreak lleva el máximo histórico (no la racha de hoy)', () => {
    setProgressTzSource(() => UTC);
    at('2026-10-28T12:00:00Z');
    reseed();
    at('2026-10-29T12:00:00Z');
    as('luna', () => addXp(30, 'Ruta: x')); // racha 10
    expect(medalCountersOf('luna').bestStreak).toBe(10);
    at('2026-11-02T12:00:00Z');
    as('luna', () => addXp(30, 'Ruta: x')); // salteó → racha 1, el máximo queda
    expect(summaryOf('luna').streakDays).toBe(1);
    expect(medalCountersOf('luna').bestStreak).toBe(10);
  });
  it('comebacks: aprender algo nuevo tras ≥ 3 días de calendario sin hacerlo; con 2 no', () => {
    setProgressTzSource(() => UTC);
    at('2026-10-28T12:00:00Z');
    reseed(); // Andrés: último día = hoy (28)
    at('2026-10-30T12:00:00Z'); // 2 días
    as('andres', () => addXp(30, 'Aprender'));
    expect(medalCountersOf('andres').comebacks).toBe(0);
    at('2026-11-02T12:00:00Z'); // 3 días desde el 30
    as('andres', () => addXp(30, 'Aprender'));
    expect(medalCountersOf('andres').comebacks).toBe(1);
    expect(medalCountersOf('ian').comebacks).toBe(0); // cada uno lo suyo
  });
});

/* ---------- FS-BASE-B (hallazgo progress.ts:206): el padre corre la zona de la familia hacia ATRÁS a mitad de semana ---------- */
describe('cambio de la zona de la familia hacia atrás', () => {
  it('Madrid → Los Ángeles pasada la medianoche de Madrid: la racha NO se corta (antes volvía a 1) y la XP sigue en su semana', () => {
    setProgressTzSource(() => 'Europe/Madrid');
    at('2026-10-28T22:30:00Z'); // miércoles 23:30 en Madrid
    reseed();
    runAsUser('luna', () => addXp(10, 'posta'));
    at('2026-10-28T23:30:00Z'); // jueves 00:30 en Madrid: un día más de racha
    const r1 = runAsUser('luna', () => addXp(10, 'posta'));
    setProgressTzSource(() => 'America/Los_Angeles'); // el adulto elige Pacífico: allá es miércoles 16:30
    const r2 = runAsUser('luna', () => addXp(10, 'posta'));
    expect(r2.streakDays).toBe(r1.streakDays); // el "último día" quedó en el futuro: no es saltear un día
    expect(r2.xpWeek).toBe(r1.xpWeek + 10); // lunes 26-oct en las dos zonas: la misma semana
    at('2026-10-29T23:30:00Z'); // jueves 16:30 en Los Ángeles: el día siguiente de verdad
    expect(runAsUser('luna', () => addXp(10, 'posta')).streakDays).toBe(r1.streakDays); // jueves = el "último día": sigue igual
  });
  it('un retroceso que cruza el LUNES: la XP de la semana vuelve a 0 sin registrar nada (rollWeek, DOCUMENTADO); la racha no se corta', () => {
    // Se FIJA el comportamiento de antes a propósito: ese corte se cruza con el cierre de la semana de la familia (U5) y no se
    // cambia sin revisarlo (informe de FS-BASE-B).
    setProgressTzSource(() => 'Europe/Madrid');
    at('2026-11-01T23:30:00Z'); // lunes 2-nov 00:30 en Madrid: semana nueva
    reseed();
    const before = runAsUser('luna', () => addXp(30, 'posta'));
    setProgressTzSource(() => 'America/Los_Angeles'); // domingo 1-nov 15:30 allá: la semana ANTERIOR
    const after = runAsUser('luna', () => addXp(5, 'posta'));
    expect(after.xpWeek).toBe(5);
    expect(after.streakDays).toBe(before.streakDays);
  });
});

