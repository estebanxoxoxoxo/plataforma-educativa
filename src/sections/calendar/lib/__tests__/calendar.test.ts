import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../../../../api/types';
import { buildCalendar, dayTitle, daysBetween, hm } from '../calendar';

/* Calendario (tanda B1): las horas y los días se leen en la pared de la ZONA DE LA FAMILIA, no en la del navegador. Los
   instantes se arman en UTC, así el resultado no depende de la zona de la máquina que corre los tests (salvo los casos
   "sin zona", que comparan contra la local a propósito). */

const BA = 'America/Argentina/Buenos_Aires'; // UTC−3 todo el año
const MAD = 'Europe/Madrid'; // UTC+1 en invierno, UTC+2 en verano (cambia el 25-oct-2026)
const ev = (start: number, id = 1): CalendarEvent =>
  ({ id, teacherId: 'caro-mendez', title: 'Clase de Matemática con Caro', subject: 'Matemática', emoji: '🧮', color: '#3A5BD9', start, durationMin: 60 });

// Miércoles 28-oct-2026 17:00 en Buenos Aires = 20:00 UTC = 21:00 en Madrid.
const WED_17_BA = Date.UTC(2026, 9, 28, 20);
// Ese mismo miércoles a la 01:00 de Buenos Aires.
const NOW_WED_BA = Date.UTC(2026, 9, 28, 4);

describe('hm en la zona de la familia', () => {
  it('17:00 de Buenos Aires se ve 17:00 con esa zona, y 21:00 con la de Madrid', () => {
    expect(hm(WED_17_BA, BA)).toBe('17:00');
    expect(hm(WED_17_BA, MAD)).toBe('21:00');
  });
  it('sin zona (o con una desconocida), la local: lo de antes', () => {
    const d = new Date(WED_17_BA);
    const local = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    expect(hm(WED_17_BA)).toBe(local);
    expect(hm(WED_17_BA, null)).toBe(local);
    expect(hm(WED_17_BA, 'Mars/Olympus_Mons')).toBe(local);
  });
});

describe('días de pared', () => {
  it('una clase a las 22:00 de Buenos Aires es "Hoy" allá y "Mañana" en Madrid (ya es jueves)', () => {
    const wed22 = Date.UTC(2026, 9, 29, 1);
    expect(dayTitle(wed22, NOW_WED_BA, BA)).toBe('Hoy');
    expect(dayTitle(wed22, NOW_WED_BA, MAD)).toBe('Mañana');
  });
  it('cuenta fechas, no horas: el cambio de horario de Madrid no corre los días', () => {
    const sat = Date.UTC(2026, 9, 24, 10); // sábado 12:00 en Madrid (verano)
    const mon = Date.UTC(2026, 9, 26, 11); // lunes 12:00 en Madrid (invierno)
    expect(daysBetween(sat, mon, MAD)).toBe(2);
  });
  it('fecha larga con el mes cuando no es el de hoy', () => {
    const nov4 = Date.UTC(2026, 10, 4, 20); // miércoles 4-nov 17:00 en Buenos Aires
    expect(dayTitle(nov4, NOW_WED_BA, BA)).toBe('Miércoles 4 de noviembre');
  });
});

describe('buildCalendar con la zona de la familia', () => {
  it('el hero y las filas dicen 17:00 aunque el navegador esté en otra zona', () => {
    const view = buildCalendar([ev(WED_17_BA, 1), ev(WED_17_BA + 7 * 86_400_000, 2)], NOW_WED_BA, BA);
    expect(view.hero?.when).toBe('Hoy a las 17:00');
    expect(view.hero?.leaf).toEqual({ month: 'oct', day: 28, weekday: 'hoy' });
    expect(view.groups.map((g) => g.title)).toEqual(['Hoy', 'Miércoles 4 de noviembre']);
    expect(view.groups[0].sub).toBe('miércoles 28');
  });
  it('agrupa por el día de PARED de la zona: dos clases del mismo día allá quedan juntas', () => {
    const wed17 = WED_17_BA, wed22 = Date.UTC(2026, 9, 29, 1);
    expect(buildCalendar([ev(wed17, 1), ev(wed22, 2)], NOW_WED_BA, BA).groups).toHaveLength(1);
    expect(buildCalendar([ev(wed17, 1), ev(wed22, 2)], NOW_WED_BA, MAD).groups).toHaveLength(2);
  });
});
