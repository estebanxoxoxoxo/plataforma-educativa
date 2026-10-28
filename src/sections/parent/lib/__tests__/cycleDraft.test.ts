import { describe, expect, it } from 'vitest';
import type { CycleRange } from '../../../../api/types';
import { MAX_RANGES, coversNow, freeSections, isDirty, newRange, rangeOptionLabel, spanLabel, toDrafts, toRequest, toggleSection } from '../cycleDraft';

/* Ciclo del día (tanda F2): lo puro del editor de Familia → Ciclo del día. La validación es del server (el 400 se muestra
   tal cual): acá solo el borrador, el POST y los textos. */

const m = (s: string) => { const [h, mm] = s.split(':').map(Number); return h * 60 + mm; };
const SAVED: CycleRange[] = [
  { id: 'r1', name: 'Mañana', from: '08:00', to: '12:00', sections: ['buscar', 'aprender'] },
  { id: 'r2', name: 'Tarde', from: '14:00', to: '18:00', sections: ['mytube', 'tienda'] },
];

describe('borrador', () => {
  it('toDrafts copia (editar el borrador no toca lo guardado) y da una key estable por id', () => {
    const d = toDrafts(SAVED);
    expect(d.map((x) => x.key)).toEqual(['id:r1', 'id:r2']);
    d[0].sections.push('chat');
    expect(SAVED[0].sections).toEqual(['buscar', 'aprender']);
  });
  it('newRange: "Rango N" libre, arranca donde termina el último (3 h) o de 08:00 a 12:00, sin secciones', () => {
    expect(newRange([])).toEqual({ key: 'new:1', name: 'Rango 1', from: '08:00', to: '12:00', sections: [] });
    const d = toDrafts(SAVED);
    const n = newRange(d);
    expect(n).toMatchObject({ name: 'Rango 3', from: '18:00', to: '21:00', sections: [] });
    expect(n.id).toBeUndefined();
    // cruza la medianoche al sumar 3 h; un nombre ya usado se saltea; las keys no se repiten
    const late = [...d, { ...n, key: 'new:3', name: 'Rango 3', from: '21:00', to: '23:00' }];
    expect(newRange(late)).toMatchObject({ key: 'new:4', name: 'Rango 4', from: '23:00', to: '02:00' });
    // una hora inválida en el último → vuelve al default
    expect(newRange([{ ...n, to: '' }])).toMatchObject({ from: '08:00', to: '12:00' });
  });
  it('toggleSection prende y apaga conservando el orden del menú', () => {
    expect(toggleSection(['tienda'], 'chat')).toEqual(['chat', 'tienda']);
    expect(toggleSection(['chat', 'tienda'], 'chat')).toEqual(['tienda']);
    expect(toggleSection([], 'afterday')).toEqual(['afterday']);
  });
  it('toRequest: la lista COMPLETA tal cual (los nuevos sin id; una hora vacía viaja vacía: la valida el server)', () => {
    const d = [...toDrafts(SAVED), { ...newRange(toDrafts(SAVED)), from: '' }];
    const req = toRequest(d);
    expect(req).toHaveLength(3);
    expect(req[0]).toEqual({ id: 'r1', name: 'Mañana', from: '08:00', to: '12:00', sections: ['buscar', 'aprender'] });
    expect(req[2]).toEqual({ name: 'Rango 3', from: '', to: '21:00', sections: [] });
    expect('key' in req[0]).toBe(false);
  });
  it('isDirty: cualquier cambio (campo, secciones, orden, alta, baja) vs. lo guardado', () => {
    const d = toDrafts(SAVED);
    expect(isDirty(d, SAVED)).toBe(false);
    expect(isDirty([{ ...d[0], name: 'Escuela' }, d[1]], SAVED)).toBe(true);
    expect(isDirty([{ ...d[0], sections: ['aprender', 'buscar'] }, d[1]], SAVED)).toBe(true); // otro orden de secciones
    expect(isDirty([d[1], d[0]], SAVED)).toBe(true);
    expect(isDirty([d[0]], SAVED)).toBe(true);
    expect(isDirty([...d, newRange(d)], SAVED)).toBe(true);
    expect(isDirty([], [])).toBe(false);
  });
  it('MAX_RANGES es el tope del server', () => {
    expect(MAX_RANGES).toBe(8);
  });
});

describe('textos', () => {
  it('spanLabel: rango normal, cruce de medianoche, 24 h e inválido', () => {
    expect(spanLabel('14:00', '18:00')).toBe('de 14:00 a 18:00');
    expect(spanLabel('8:00', '9:30')).toBe('de 08:00 a 09:30');
    expect(spanLabel('21:00', '07:00')).toBe('de 21:00 a 07:00 (cruza la medianoche)');
    expect(spanLabel('10:00', '10:00')).toBe('todo el día');
    expect(spanLabel('', '10:00')).toBeNull();
    expect(spanLabel('25:00', '10:00')).toBeNull();
  });
  it('rangeOptionLabel (el selector de la demo)', () => {
    expect(rangeOptionLabel(SAVED[1])).toBe('Tarde · 14:00–18:00');
    expect(rangeOptionLabel({ name: 'Libre', from: '09:00', to: '09:00' })).toBe('Libre · todo el día');
    expect(rangeOptionLabel({ name: 'Roto', from: 'x', to: '09:00' })).toBe('Roto');
  });
  it('coversNow: solo con horas válidas ([from, to), cruza la medianoche)', () => {
    expect(coversNow(SAVED[1], m('14:00'))).toBe(true);
    expect(coversNow(SAVED[1], m('18:00'))).toBe(false);
    expect(coversNow({ from: '22:00', to: '02:00' }, m('01:00'))).toBe(true);
    expect(coversNow({ from: '', to: '02:00' }, m('01:00'))).toBe(false); // la regla fail-open es otra cosa: esto es el "Ahora"
  });
  it('freeSections: las que no figuran en ningún rango (siempre disponibles)', () => {
    expect(freeSections(SAVED)).toEqual(['chat', 'calendario', 'espacio', 'afterday']);
    expect(freeSections([])).toHaveLength(8);
  });
});
