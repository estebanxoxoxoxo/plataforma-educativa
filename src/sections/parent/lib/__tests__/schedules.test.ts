import { describe, expect, it } from 'vitest';
import type { FeatureSchedule } from '../../../../api/types';
import { isOpenAt, nextOpenLabelAt, normalizeSchedule, sectionForPath } from '../scheduleRules';

/* PORTE INNERITH (W7) — Horarios por sección: las reglas del cliente son el ESPEJO de server/src/schedule.ts y ambas son
   el isFeatureOpen / nextOpenLabel EXACTOS del POC (lib/featureSchedule.ts): [from, to), to < from cruza la medianoche,
   from == to = 24 h, día cerrado = cerrada, datos inválidos = ABIERTA (fail-open), week por getDay() (0 = domingo).
   Más el mapa ruta → sección del menú/portón (el lector y el reproductor nunca se cierran: overlays del POC). */

// 12-oct-2026 es lunes (getDay 1); 11-oct-2026, domingo. Fechas en hora local.
const at = (h: number, m: number, day = 12) => new Date(2026, 9, day, h, m);
const week = (open: boolean, from: string, to: string) => Array.from({ length: 7 }, () => ({ open, from, to }));
const S = (from: string, to: string, open = true): FeatureSchedule => ({ restrictionActive: true, week: week(open, from, to) });

describe('isOpenAt (isFeatureOpen del POC)', () => {
  it('sin horario o sin restricción: siempre abierta', () => {
    expect(isOpenAt(undefined, at(3, 0))).toBe(true);
    expect(isOpenAt({ restrictionActive: false, week: week(false, '08:00', '09:00') }, at(3, 0))).toBe(true);
  });
  it('día cerrado: cerrada todo el día', () => {
    expect(isOpenAt(S('08:00', '20:00', false), at(12, 0))).toBe(false);
  });
  it('franja [from, to): from incluido, to excluido', () => {
    expect(isOpenAt(S('08:00', '20:00'), at(7, 59))).toBe(false);
    expect(isOpenAt(S('08:00', '20:00'), at(8, 0))).toBe(true);
    expect(isOpenAt(S('08:00', '20:00'), at(19, 59))).toBe(true);
    expect(isOpenAt(S('08:00', '20:00'), at(20, 0))).toBe(false);
  });
  it('to < from cruza la medianoche; from == to son las 24 h', () => {
    expect(isOpenAt(S('20:00', '02:00'), at(21, 0))).toBe(true);
    expect(isOpenAt(S('20:00', '02:00'), at(1, 59))).toBe(true);
    expect(isOpenAt(S('20:00', '02:00'), at(2, 0))).toBe(false);
    expect(isOpenAt(S('20:00', '02:00'), at(10, 0))).toBe(false);
    expect(isOpenAt(S('09:30', '09:30'), at(3, 0))).toBe(true);
  });
  it('datos inválidos o incompletos: abierta (fail-open)', () => {
    expect(isOpenAt(S('', '20:00'), at(3, 0))).toBe(true);
    expect(isOpenAt(S('25:00', '20:00'), at(3, 0))).toBe(true);
    expect(isOpenAt(S('8:5', '20:00'), at(3, 0))).toBe(true);
    expect(isOpenAt({ restrictionActive: true, week: [] }, at(3, 0))).toBe(true);
    expect(isOpenAt({ restrictionActive: true } as FeatureSchedule, at(3, 0))).toBe(true);
    expect(isOpenAt({ restrictionActive: true, week: [{ open: true, from: 5, to: 6 }] } as unknown as FeatureSchedule, at(3, 0, 11))).toBe(true);
  });
  it('H:MM de un dígito vale', () => {
    expect(isOpenAt(S('8:00', '9:00'), at(8, 30))).toBe(true);
  });
  it('la semana se indexa con getDay(): week[0] = domingo', () => {
    const s: FeatureSchedule = { restrictionActive: true, week: [{ open: false, from: '08:00', to: '20:00' }, ...week(true, '00:00', '00:00').slice(1)] };
    expect(isOpenAt(s, at(12, 0, 11))).toBe(false); // domingo
    expect(isOpenAt(s, at(12, 0, 12))).toBe(true); // lunes
  });
});

describe('nextOpenLabelAt (nextOpenLabel del POC)', () => {
  it('solo si HOY abre más tarde', () => {
    expect(nextOpenLabelAt(S('15:00', '18:00'), at(10, 0))).toBe('15:00');
    expect(nextOpenLabelAt(S('15:00', '18:00'), at(19, 0))).toBeNull();
    expect(nextOpenLabelAt(S('15:00', '18:00', false), at(10, 0))).toBeNull();
    expect(nextOpenLabelAt(S('20:00', '02:00'), at(3, 0))).toBe('20:00');
    expect(nextOpenLabelAt(undefined, at(3, 0))).toBeNull();
  });
});

describe('normalizeSchedule (el editor del padre)', () => {
  it('sin dato: restricción off y los 7 días 08:00-20:00 abiertos', () => {
    const n = normalizeSchedule(undefined);
    expect(n.restrictionActive).toBe(false);
    expect(n.week).toHaveLength(7);
    expect(n.week.every((d) => d.open && d.from === '08:00' && d.to === '20:00')).toBe(true);
  });
  it('completa POR DÍA lo que falta o vino vacío', () => {
    const n = normalizeSchedule({ restrictionActive: true, week: [{ open: false } as never, { open: true, from: '', to: '10:00' }] });
    expect(n.restrictionActive).toBe(true);
    expect(n.week[0]).toEqual({ open: false, from: '08:00', to: '20:00' });
    expect(n.week[1]).toEqual({ open: true, from: '08:00', to: '10:00' });
    expect(n.week[6]).toEqual({ open: true, from: '08:00', to: '20:00' });
  });
});

describe('sectionForPath (menú y portón)', () => {
  it('cada ruta del chico con su sección', () => {
    expect(sectionForPath('/chat')).toBe('chat');
    expect(sectionForPath('/buscar')).toBe('buscar');
    expect(sectionForPath('/buscar/')).toBe('buscar');
    expect(sectionForPath('/mytube')).toBe('mytube');
    expect(sectionForPath('/mytube/canal/UCx')).toBe('mytube');
    expect(sectionForPath('/mytube/lista/3')).toBe('mytube');
    expect(sectionForPath('/afterday')).toBe('afterday');
    expect(sectionForPath('/aprender')).toBe('aprender');
    expect(sectionForPath('/crear')).toBe('aprender');
    expect(sectionForPath('/tienda')).toBe('tienda');
    expect(sectionForPath('/calendario')).toBe('calendario');
    expect(sectionForPath('/espacio/carpetas')).toBe('espacio');
    expect(sectionForPath('/espacio/carpetas/12')).toBe('espacio');
    expect(sectionForPath('/espacio/papelera')).toBe('espacio');
  });
  it('lo que nunca se cierra: Feed, lector, reproductor, Ligas, Familia (y la vieja /padres), redirecciones viejas', () => {
    for (const p of ['/', '/buscar/articulo/x', '/buscar/video/abc', '/ligas', '/familia', '/familia/limites', '/padres', '/padres/limites', '/espacio/videos', '/amigos', '/tiendas']) {
      expect(sectionForPath(p)).toBeNull();
    }
  });
});
