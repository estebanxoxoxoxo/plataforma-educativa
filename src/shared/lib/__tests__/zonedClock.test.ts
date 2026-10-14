import { describe, expect, it } from 'vitest';
import { isValidTimeZone, wallClock } from '../zonedClock';
import { isOpenAt, nextOpenLabelAt } from '../../../sections/parent/lib/scheduleRules';
import type { FeatureSchedule } from '../../../api/types';

/* Zona horaria de la familia (tanda "Deudas técnicas", 14-oct): el helper Intl que usan el server (schedule.ts, feedFake.ts)
   y el cliente (scheduleRules.ts). Instantes en UTC fijos: no dependen de la zona de la máquina que corre los tests. */

describe('wallClock (hora de pared en una zona IANA)', () => {
  it('cruce de medianoche: el mismo instante es otro DÍA en otra zona', () => {
    const at = new Date('2026-10-14T02:30:00Z'); // miércoles 02:30 UTC
    expect(wallClock(at, 'Europe/Madrid')).toEqual({ day: 3, hour: 4, minute: 30, minutes: 270 }); // miércoles 04:30 (CEST)
    expect(wallClock(at, 'America/Los_Angeles')).toEqual({ day: 2, hour: 19, minute: 30, minutes: 1170 }); // MARTES 19:30 (PDT)
    expect(wallClock(at, 'America/Argentina/Buenos_Aires')).toEqual({ day: 2, hour: 23, minute: 30, minutes: 1410 }); // martes 23:30
  });
  it('la medianoche en punto es 0 (no 24) y el domingo es 0, como getDay', () => {
    expect(wallClock(new Date('2026-10-18T07:00:00Z'), 'America/Los_Angeles')).toMatchObject({ day: 0, hour: 0, minute: 0 }); // domingo 00:00 PDT
    expect(wallClock(new Date('2026-10-17T22:00:00Z'), 'Europe/Madrid')).toMatchObject({ day: 0, hour: 0 }); // domingo 00:00 CEST
  });
  it('sigue el cambio de horario (Nueva York: EDT −4 en octubre, EST −5 en diciembre)', () => {
    expect(wallClock(new Date('2026-10-14T16:00:00Z'), 'America/New_York').hour).toBe(12);
    expect(wallClock(new Date('2026-12-14T16:00:00Z'), 'America/New_York').hour).toBe(11);
  });
  it('sin zona o con una zona desconocida → el reloj local (getDay/getHours)', () => {
    const at = new Date('2026-10-14T12:34:00Z');
    const local = { day: at.getDay(), hour: at.getHours(), minute: at.getMinutes(), minutes: at.getHours() * 60 + at.getMinutes() };
    expect(wallClock(at)).toEqual(local);
    expect(wallClock(at, null)).toEqual(local);
    expect(wallClock(at, 'Marte/Olympus_Mons')).toEqual(local);
  });
  it('isValidTimeZone: las del selector del padre sí; basura no', () => {
    for (const tz of ['America/Argentina/Buenos_Aires', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/Madrid'])
      expect(isValidTimeZone(tz), tz).toBe(true);
    for (const tz of ['', ' ', 'Marte/Olympus_Mons', 42, null, 'x'.repeat(65)]) expect(isValidTimeZone(tz)).toBe(false);
  });
});

describe('franjas evaluadas en la zona de la familia (scheduleRules, espejo de server/src/schedule.ts)', () => {
  const week = (from: string, to: string): FeatureSchedule => ({ restrictionActive: true, week: Array.from({ length: 7 }, () => ({ open: true, from, to })) });
  const at = new Date('2026-10-14T14:00:00Z'); // Madrid 16:00 · Los Ángeles 07:00
  it('una franja abierta acá puede estar cerrada allá (y "se abre a las…" se calcula en esa zona)', () => {
    const tarde = week('15:00', '20:00');
    expect(isOpenAt(tarde, at, 'Europe/Madrid')).toBe(true);
    expect(isOpenAt(tarde, at, 'America/Los_Angeles')).toBe(false);
    expect(nextOpenLabelAt(tarde, at, 'America/Los_Angeles')).toBe('15:00');
    expect(nextOpenLabelAt(tarde, at, 'Europe/Madrid')).toBeNull();
  });
  it('la franja que cruza la medianoche se evalúa con el día de ESA zona', () => {
    const noche = { restrictionActive: true, week: Array.from({ length: 7 }, (_, d) => ({ open: d === 2, from: '22:00', to: '02:00' })) }; // solo los martes
    const t = new Date('2026-10-14T05:30:00Z'); // martes 22:30 en Los Ángeles · miércoles 07:30 en Madrid
    expect(isOpenAt(noche, t, 'America/Los_Angeles')).toBe(true);
    expect(isOpenAt(noche, t, 'Europe/Madrid')).toBe(false);
  });
});
