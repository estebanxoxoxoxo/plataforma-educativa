import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addXp, familyDayNum, familyWeekStart, resetProgress, setProgressTzSource, startNewWeek, summaryOf } from '../progress';
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
