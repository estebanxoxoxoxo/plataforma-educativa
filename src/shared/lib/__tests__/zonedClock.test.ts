import { describe, expect, it } from 'vitest';
import { isValidTimeZone, wallClock } from '../zonedClock';
import { minuteOfDay, opensAtToday, sectionAvailableAt } from '../cycleRules';

/* Zona horaria de la familia (tanda "Deudas técnicas", 14-oct): el helper Intl que usan el server (schedule.ts, feedFake.ts)
   y el cliente (el store del Ciclo del día, sections/parent/lib/cycle.ts, con las reglas compartidas de cycleRules.ts —F2,
   28-oct; antes, el espejo de los horarios por sección—). Instantes en UTC fijos: no dependen de la zona de la máquina. */

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

describe('el ciclo del día evaluado en la zona de la familia (cycleRules: el mismo código en server y cliente)', () => {
  const R = (from: string, to: string) => [{ id: 'r', name: 'Rango', from, to, sections: ['aprender' as const] }];
  const at = new Date('2026-10-14T14:00:00Z'); // Madrid 16:00 · Los Ángeles 07:00
  it('un rango disponible acá puede estar cerrado allá (y "se abre a las…" se calcula en esa zona)', () => {
    const tarde = R('15:00', '20:00');
    expect(sectionAvailableAt(tarde, 'aprender', minuteOfDay(at, 'Europe/Madrid'))).toBe(true);
    expect(sectionAvailableAt(tarde, 'aprender', minuteOfDay(at, 'America/Los_Angeles'))).toBe(false);
    expect(opensAtToday(tarde, 'aprender', minuteOfDay(at, 'America/Los_Angeles'))).toBe('15:00');
    expect(opensAtToday(tarde, 'aprender', minuteOfDay(at, 'Europe/Madrid'))).toBeNull();
  });
  it('el rango que cruza la medianoche se evalúa con la hora de ESA zona', () => {
    const noche = R('22:00', '02:00');
    const t = new Date('2026-10-14T05:30:00Z'); // 22:30 en Los Ángeles · 07:30 en Madrid
    expect(sectionAvailableAt(noche, 'aprender', minuteOfDay(t, 'America/Los_Angeles'))).toBe(true);
    expect(sectionAvailableAt(noche, 'aprender', minuteOfDay(t, 'Europe/Madrid'))).toBe(false);
  });
});
