import { describe, expect, it } from 'vitest';
import {
  type CycleRange, type SectionKey, SECTION_KEYS, availableSections, checkCycle, hhmm, minuteOfDay, opensAtToday,
  parseHHMM, rangeCovers, sanitizeStoredRanges, sectionAvailableAt,
} from '../../../src/shared/lib/cycleRules';

/* Ciclo del día (tanda F1, 28-oct; docs/USUARIOS.md §11): las reglas PURAS del server. `cur` = minuto del día (0..1439) en
   la zona de la familia. Zonas sin horario de verano y en los extremos (Kiritimati UTC+14, Pago Pago UTC−11) para que el
   resultado no dependa de la zona del proceso que corre el test. */

const m = (s: string) => parseHHMM(s)!;
const R = (id: string, from: string, to: string, sections: SectionKey[], name = id): CycleRange => ({ id, name, from, to, sections });
/** Mañana (escuela) · Tarde (tiempo libre) · Noche (cruza la medianoche). Chat y Calendario no figuran en ninguno. */
const DAY: CycleRange[] = [
  R('manana', '08:00', '12:00', ['aprender', 'buscar'], 'Mañana'),
  R('tarde', '14:00', '18:00', ['mytube', 'tienda', 'buscar'], 'Tarde'),
  R('noche', '21:00', '07:00', ['afterday'], 'Noche'),
];
const at = (key: SectionKey, t: string, ranges: unknown = DAY, demo?: string | null) => sectionAvailableAt(ranges, key, m(t), demo);

describe('horas', () => {
  it('parseHHMM acepta H:MM y HH:MM de 00:00 a 23:59; hhmm es canónica', () => {
    expect(parseHHMM('8:05')).toBe(485);
    expect(parseHHMM(' 23:59 ')).toBe(1439);
    for (const bad of ['24:00', '12:60', '1200', '12:5', '', 'ab:cd', null, 8]) expect(parseHHMM(bad)).toBeNull();
    expect(hhmm(485)).toBe('08:05');
    expect(hhmm(0)).toBe('00:00');
  });
  it('rangeCovers: [from, to), cruce de medianoche y from == to = 24 h', () => {
    expect(rangeCovers({ from: '08:00', to: '12:00' }, m('08:00'))).toBe(true);
    expect(rangeCovers({ from: '08:00', to: '12:00' }, m('12:00'))).toBe(false);
    expect(rangeCovers({ from: '22:00', to: '07:00' }, m('03:00'))).toBe(true);
    expect(rangeCovers({ from: '22:00', to: '07:00' }, m('07:00'))).toBe(false);
    for (let c = 0; c < 1440; c += 37) expect(rangeCovers({ from: '10:30', to: '10:30' }, c)).toBe(true);
  });
});

describe('disponibilidad con el reloj real', () => {
  it('una sección que no figura en ningún rango está disponible siempre', () => {
    for (let c = 0; c < 1440; c++) {
      expect(sectionAvailableAt(DAY, 'chat', c)).toBe(true);
      expect(sectionAvailableAt(DAY, 'calendario', c)).toBe(true);
    }
    expect(sectionAvailableAt([], 'aprender', m('03:00'))).toBe(true); // sin rangos: todo disponible
  });
  it('dentro y fuera de su rango (bordes incluidos: from entra, to no)', () => {
    expect(at('aprender', '07:59')).toBe(false);
    expect(at('aprender', '08:00')).toBe(true);
    expect(at('aprender', '11:59')).toBe(true);
    expect(at('aprender', '12:00')).toBe(false);
    expect(at('mytube', '10:00')).toBe(false);
    expect(at('mytube', '15:00')).toBe(true);
  });
  it('una sección en varios rangos está disponible en CUALQUIERA de ellos', () => {
    expect(at('buscar', '09:00')).toBe(true); // Mañana
    expect(at('buscar', '13:00')).toBe(false); // entre rangos
    expect(at('buscar', '15:00')).toBe(true); // Tarde
  });
  it('cruce de la medianoche (Noche 21:00–07:00)', () => {
    for (const t of ['21:00', '23:59', '00:00', '03:30', '06:59']) expect(at('afterday', t)).toBe(true);
    for (const t of ['07:00', '12:00', '20:59']) expect(at('afterday', t)).toBe(false);
  });
  it('from == to = disponible las 24 h', () => {
    const allDay = [R('todo', '09:15', '09:15', ['espacio'])];
    for (let c = 0; c < 1440; c++) expect(sectionAvailableAt(allDay, 'espacio', c)).toBe(true);
  });
  it('availableSections lista las disponibles en el orden del menú', () => {
    expect(availableSections(DAY, m('09:00'))).toEqual(['chat', 'buscar', 'aprender', 'calendario', 'espacio']);
    expect(availableSections(DAY, m('22:00'))).toEqual(['chat', 'calendario', 'espacio', 'afterday']);
  });
});

describe('fail-open: los datos inválidos nunca encierran', () => {
  it('un rango con horas inválidas abre sus secciones las 24 h (aunque otro rango válido las nombre)', () => {
    const bad = [R('ok', '08:00', '09:00', ['chat']), { id: 'roto', name: 'Roto', from: '25:00', to: '09:00', sections: ['chat'] }];
    for (let c = 0; c < 1440; c += 13) expect(sectionAvailableAt(bad, 'chat', c)).toBe(true);
  });
  it('lista que no es lista, entradas basura y secciones que no son lista: no cierran nada', () => {
    for (const ranges of [null, undefined, 'x', 42, { ranges: [] }]) expect(sectionAvailableAt(ranges, 'aprender', m('03:00'))).toBe(true);
    expect(sectionAvailableAt([null, 7, 'x', { id: 'a', sections: 'aprender', from: '08:00', to: '09:00' }], 'aprender', m('03:00'))).toBe(true);
  });
  it('una excepción al evaluar = disponible', () => {
    const evil = [new Proxy({}, { get() { throw new Error('boom'); } })];
    expect(sectionAvailableAt(evil, 'chat', 0)).toBe(true);
    expect(opensAtToday(evil, 'chat', 0)).toBeNull();
  });
});

describe('opensAt (el "se abre de nuevo a las…" del 403)', () => {
  it('el próximo minuto de HOY en que abre; null si hoy ya no abre o si está disponible', () => {
    expect(opensAtToday(DAY, 'aprender', m('07:00'))).toBe('08:00');
    expect(opensAtToday(DAY, 'aprender', m('13:00'))).toBeNull(); // hoy ya no abre (mañana a las 08:00: no se promete)
    expect(opensAtToday(DAY, 'buscar', m('12:30'))).toBe('14:00'); // entre dos rangos: el siguiente
    expect(opensAtToday(DAY, 'afterday', m('08:00'))).toBe('21:00'); // el rango que cruza la medianoche abre a las 21
    expect(opensAtToday(DAY, 'aprender', m('09:00'))).toBeNull(); // disponible: no hay "se abre"
    expect(opensAtToday(DAY, 'chat', m('09:00'))).toBeNull(); // sin rangos: siempre disponible
  });
});

describe('override de DEMO ("estás en este rango")', () => {
  it('las secciones del rango disponibles, las de otros rangos cerradas, las de ninguno disponibles', () => {
    const real = '09:00'; // el reloj real cae en Mañana: el override manda igual
    expect(at('mytube', real, DAY, 'tarde')).toBe(true);
    expect(at('tienda', real, DAY, 'tarde')).toBe(true);
    expect(at('buscar', real, DAY, 'tarde')).toBe(true); // está en Tarde (y en Mañana)
    expect(at('aprender', real, DAY, 'tarde')).toBe(false); // solo en Mañana
    expect(at('afterday', real, DAY, 'tarde')).toBe(false); // solo en Noche
    expect(at('chat', real, DAY, 'tarde')).toBe(true); // en ninguno
    expect(at('calendario', real, DAY, 'tarde')).toBe(true);
  });
  it('no sigue al reloj: da lo mismo a cualquier hora', () => {
    for (let c = 0; c < 1440; c += 29) {
      expect(sectionAvailableAt(DAY, 'afterday', c, 'noche')).toBe(true);
      expect(sectionAvailableAt(DAY, 'aprender', c, 'noche')).toBe(false);
    }
  });
  it('los solapamientos no cuentan: con el override, solo el rango elegido', () => {
    const overlap = [R('a', '08:00', '12:00', ['chat']), R('b', '10:00', '14:00', ['buscar'])];
    expect(sectionAvailableAt(overlap, 'buscar', m('11:00'))).toBe(true); // reloj real: los dos rangos
    expect(sectionAvailableAt(overlap, 'buscar', m('11:00'), 'a')).toBe(false); // override en A: B no cuenta
  });
  it('un id que ya no existe (o null) = el reloj real; con override no hay opensAt', () => {
    expect(at('aprender', '09:00', DAY, 'borrado')).toBe(true);
    expect(at('aprender', '13:00', DAY, null)).toBe(false);
    expect(opensAtToday(DAY, 'aprender', m('07:00'), 'tarde')).toBeNull();
    expect(opensAtToday(DAY, 'aprender', m('07:00'), 'borrado')).toBe('08:00');
  });
});

describe('zona horaria de la familia', () => {
  it('el mismo instante cae en minutos distintos según la zona, y con él la disponibilidad', () => {
    const t = new Date('2026-10-28T19:30:00Z'); // Kiritimati (UTC+14): 09:30 del 29 · Pago Pago (UTC−11): 08:30 del 28
    expect(minuteOfDay(t, 'Pacific/Kiritimati')).toBe(m('09:30'));
    expect(minuteOfDay(t, 'Pacific/Pago_Pago')).toBe(m('08:30'));
    const school = [R('cole', '09:00', '12:00', ['aprender'])];
    expect(sectionAvailableAt(school, 'aprender', minuteOfDay(t, 'Pacific/Kiritimati'))).toBe(true);
    expect(sectionAvailableAt(school, 'aprender', minuteOfDay(t, 'Pacific/Pago_Pago'))).toBe(false);
    expect(opensAtToday(school, 'aprender', minuteOfDay(t, 'Pacific/Pago_Pago'))).toBe('09:00');
  });
});

describe('checkCycle (POST /api/parent/cycle)', () => {
  const ok = (raw: unknown) => { const c = checkCycle(raw, 'Ian'); if (!c.ok) throw new Error(c.error); return c.value; };
  const err = (raw: unknown) => { const c = checkCycle(raw, 'Ian'); if (c.ok) throw new Error('esperaba un 400'); return c.error; };
  it('lo válido sale canónico: horas HH:MM, nombre limpio, secciones sin repetir y en el orden del menú', () => {
    expect(ok([{ id: 'a', name: '  Mañana   de  cole ', from: '8:00', to: '12:30', sections: ['buscar', 'chat', 'buscar'], extra: 1 }])).toEqual([
      { id: 'a', name: 'Mañana de cole', from: '08:00', to: '12:30', sections: ['chat', 'buscar'] },
    ]);
    expect(ok([])).toEqual([]);
    expect(ok([{ id: 'x', name: 'Libre', from: '10:00', to: '10:00', sections: [] }])[0].sections).toEqual([]);
  });
  it('los rangos sin id reciben r1, r2… sin pisar los ids que vinieron', () => {
    const v = ok([
      { name: 'Uno', from: '08:00', to: '09:00', sections: [] },
      { id: 'r1', name: 'Dos', from: '09:00', to: '10:00', sections: [] },
      { id: '', name: 'Tres', from: '10:00', to: '11:00', sections: [] },
    ]);
    expect(v.map(r => r.id)).toEqual(['r2', 'r1', 'r3']);
  });
  it('400 con motivo claro', () => {
    expect(err({ ranges: [] })).toMatch(/lista/);
    expect(err(Array.from({ length: 9 }, (_, i) => ({ id: `r${i}`, name: `R${i}`, from: '08:00', to: '09:00', sections: [] })))).toMatch(/hasta 8 rangos/);
    expect(err([{ id: 'a', name: 'A', from: '08:00', to: '09:00', sections: [] }, { id: 'a', name: 'B', from: '08:00', to: '09:00', sections: [] }])).toMatch(/«a» está repetido/);
    expect(err([{ id: 'a b', name: 'A', from: '08:00', to: '09:00', sections: [] }])).toMatch(/id/);
    expect(err([{ id: 'a', name: '   ', from: '08:00', to: '09:00', sections: [] }])).toMatch(/entre 1 y 30/);
    expect(err([{ id: 'a', name: 'x'.repeat(31), from: '08:00', to: '09:00', sections: [] }])).toMatch(/entre 1 y 30/);
    expect(err([{ id: 'a', name: '!!!', from: '08:00', to: '09:00', sections: [] }])).toMatch(/letras o números/);
    expect(err([{ id: 'a', name: 'Tarde', from: '14:00', to: '25:00', sections: [] }])).toMatch(/«Tarde»: las horas/);
    expect(err([{ id: 'a', name: 'Tarde', from: '14:00', to: '18:00', sections: ['chat', 'feed'] }])).toMatch(/sección «feed»/);
    expect(err([{ id: 'a', name: 'Tarde', from: '14:00', to: '18:00' }])).toMatch(/faltan las secciones/);
    expect(err([null])).toMatch(/Rango 1: tiene que ser un objeto/);
  });
});

describe('sanitizeStoredRanges (leer schedules.json editado a mano)', () => {
  it('arregla hacia ABIERTO y avisa: horas inválidas → 24 h, ids y nombres nuevos, secciones raras afuera', () => {
    const s = sanitizeStoredRanges([
      { id: 'a', name: 'Bien', from: '8:00', to: '09:00', sections: ['chat', 'feed'] },
      { id: 'a', name: '', from: '99:00', to: 'x', sections: 'chat' },
      'basura',
      { name: 'Sin id', from: '10:00', to: '11:00', sections: ['buscar'] },
    ]);
    expect(s.ranges).toEqual([
      { id: 'a', name: 'Bien', from: '08:00', to: '09:00', sections: ['chat'] },
      { id: 'r1', name: 'Rango 2', from: '00:00', to: '00:00', sections: [] },
      { id: 'r2', name: 'Sin id', from: '10:00', to: '11:00', sections: ['buscar'] },
    ]);
    expect(s.fixes.length).toBeGreaterThanOrEqual(5);
    expect(sanitizeStoredRanges({ no: 'lista' }).ranges).toEqual([]);
    expect(sanitizeStoredRanges(undefined)).toEqual({ ranges: [], fixes: [] });
  });
  it('un rango con horas rotas sigue abriendo su sección todo el día después del saneo', () => {
    const s = sanitizeStoredRanges([{ id: 'x', name: 'Roto', from: '25:00', to: '01:00', sections: ['chat'] }]);
    for (let c = 0; c < 1440; c += 17) expect(sectionAvailableAt(s.ranges, 'chat', c)).toBe(true);
  });
});
