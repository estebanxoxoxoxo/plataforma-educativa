import { describe, expect, it } from 'vitest';
import {
  type CycleRange, type SectionKey, SECTION_KEYS, availableSections, checkCycle, findRange, hhmm, minuteOfDay, opensAtToday,
  parseHHMM, rangeCovers, sanitizeStoredRanges, sectionAvailableAt,
} from '../../../src/shared/lib/cycleRules';

/* Ciclo del día (tanda F1, 28-oct; docs/USUARIOS.md §11): las reglas PURAS del server. `cur` = minuto del día (0..1439) en
   la zona de la familia. Zonas sin horario de verano y en los extremos (Kiritimati UTC+14, Pago Pago UTC−11) para que el
   resultado no dependa de la zona del proceso que corre el test.
   29-oct — RANGOS COMO MOMENTOS EXCLUSIVOS (pedido de Esteban: «solo los que específicamente se indiquen tiene que
   aparecer»): mientras un rango está en curso, solo está disponible lo que lista (los solapados suman); fuera de todo rango,
   lo que no figura en ninguno. Los tests viejos que fijaban «no figura → disponible DURANTE un rango ajeno» se ajustaron
   (cada uno dice el porqué en la línea) y los casos obligatorios de la spec están en los bloques marcados «29-oct». Todo con
   literales: cycleRules es pura y ningún test lee server/data. */

const m = (s: string) => parseHHMM(s)!;
const R = (id: string, from: string, to: string, sections: SectionKey[], name = id): CycleRange => ({ id, name, from, to, sections });
/** Mañana (escuela) · Tarde (tiempo libre) · Noche (cruza la medianoche). Chat, Calendario y Mi espacio no figuran en ninguno. */
const DAY: CycleRange[] = [
  R('manana', '08:00', '12:00', ['aprender', 'buscar'], 'Mañana'),
  R('tarde', '14:00', '18:00', ['mytube', 'tienda', 'buscar'], 'Tarde'),
  R('noche', '21:00', '07:00', ['afterday'], 'Noche'),
];
const at = (key: SectionKey, t: string, ranges: unknown = DAY, demo?: string | null) => sectionAvailableAt(ranges, key, m(t), demo);
const ALL = [...SECTION_KEYS];
const except = (...keys: SectionKey[]) => ALL.filter(k => !keys.includes(k));

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
  it('29-oct: un rango con horas inválidas NUNCA está en curso (en curso = cierra lo que no lista)', () => {
    for (const r of [{ from: '25:00', to: '09:00' }, { from: '08:00', to: 'x' }, { from: '', to: '' }, {}]) {
      for (let c = 0; c < 1440; c += 59) expect(rangeCovers(r, c)).toBe(false);
    }
  });
});

describe('disponibilidad con el reloj real', () => {
  it('una sección que no figura en ningún rango: disponible FUERA de todo rango, cerrada durante los rangos ajenos', () => {
    // 29-oct: antes este test fijaba «disponible SIEMPRE» (la regla vieja); con los rangos exclusivos, Mañana, Tarde y Noche
    // la cierran mientras están en curso. La referencia va escrita a mano (08–12, 14–18, 21–07), sin usar rangeCovers.
    const inSomeRange = (c: number) => (c >= 480 && c < 720) || (c >= 840 && c < 1080) || c >= 1260 || c < 420;
    for (let c = 0; c < 1440; c++) {
      for (const k of ['chat', 'calendario', 'espacio'] as const) expect(sectionAvailableAt(DAY, k, c), `${k} ${hhmm(c)}`).toBe(!inSomeRange(c));
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
    // 29-oct: a las 09:00 y a las 22:00 antes salían también chat/calendario/espacio (no figuran en ningún rango); ahora el
    // rango en curso es exclusivo. Fuera de todo rango (13:00) quedan justo ésas.
    expect(availableSections(DAY, m('09:00'))).toEqual(['buscar', 'aprender']);
    expect(availableSections(DAY, m('22:00'))).toEqual(['afterday']);
    expect(availableSections(DAY, m('13:00'))).toEqual(['chat', 'calendario', 'espacio']);
  });
});

describe('fail-open: los datos inválidos nunca encierran', () => {
  it('un rango con horas inválidas abre sus secciones las 24 h (aunque otro rango válido las nombre)', () => {
    const bad = [R('ok', '08:00', '09:00', ['chat']), { id: 'roto', name: 'Roto', from: '25:00', to: '09:00', sections: ['chat'] }];
    for (let c = 0; c < 1440; c += 13) expect(sectionAvailableAt(bad, 'chat', c)).toBe(true);
  });
  it('lista que no es lista, entradas basura y secciones que no son lista: no cierran nada', () => {
    for (const ranges of [null, undefined, 'x', 42, { ranges: [] }]) expect(sectionAvailableAt(ranges, 'aprender', m('03:00'))).toBe(true);
    const junk = [null, 7, 'x', { id: 'a', sections: 'aprender', from: '08:00', to: '09:00' }];
    expect(sectionAvailableAt(junk, 'aprender', m('03:00'))).toBe(true);
    for (const k of ALL) expect(sectionAvailableAt(junk, k, m('08:30'))).toBe(true); // 29-oct: tampoco DURANTE "su" horario
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
    // 29-oct: antes chat a las 09:00 daba null ("no figura: siempre disponible"); ahora Mañana lo cierra y abre al terminar.
    expect(opensAtToday(DAY, 'chat', m('09:00'))).toBe('12:00');
    expect(opensAtToday(DAY, 'chat', m('15:00'))).toBe('18:00');
    expect(opensAtToday(DAY, 'chat', m('13:00'))).toBeNull(); // fuera de todo rango: disponible
  });
});

describe('override de DEMO ("estás en este rango")', () => {
  it('las secciones del rango disponibles; las de otros rangos Y las de ninguno, cerradas', () => {
    const real = '09:00'; // el reloj real cae en Mañana: el override manda igual
    expect(at('mytube', real, DAY, 'tarde')).toBe(true);
    expect(at('tienda', real, DAY, 'tarde')).toBe(true);
    expect(at('buscar', real, DAY, 'tarde')).toBe(true); // está en Tarde (y en Mañana)
    expect(at('aprender', real, DAY, 'tarde')).toBe(false); // solo en Mañana
    expect(at('afterday', real, DAY, 'tarde')).toBe(false); // solo en Noche
    // 29-oct: antes chat y calendario (en ningún rango) quedaban disponibles con el override; ahora es EXACTAMENTE la Tarde.
    expect(at('chat', real, DAY, 'tarde')).toBe(false);
    expect(at('calendario', real, DAY, 'tarde')).toBe(false);
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
    // 29-oct: el MISMO instante, en Kiritimati (dentro de «cole») cierra el chat; en Pago Pago (fuera) no.
    expect(sectionAvailableAt(school, 'chat', minuteOfDay(t, 'Pacific/Kiritimati'))).toBe(false);
    expect(sectionAvailableAt(school, 'chat', minuteOfDay(t, 'Pacific/Pago_Pago'))).toBe(true);
  });
});

/* ---------- 29-oct: los casos obligatorios de la spec (rangos exclusivos) ---------- */

describe('29-oct · el ciclo de Ian con la forma real (r1 21:00–22:00, solo After Day)', () => {
  const IAN: CycleRange[] = [R('r1', '21:00', '22:00', ['afterday'], 'Rango 1')]; // = server/data/schedules.json de hoy (sin leerlo)
  const REST = except('afterday'); // chat, buscar, mytube, aprender, tienda, calendario, espacio
  it('a las 21:30 SOLO After Day: Chat, Buscar, MyTube, Aprender, Tienda, Calendario y Mi espacio cerrados, se abren a las 22:00', () => {
    expect(availableSections(IAN, m('21:30'))).toEqual(['afterday']);
    expect(REST).toEqual(['chat', 'buscar', 'mytube', 'aprender', 'tienda', 'calendario', 'espacio']);
    for (const k of REST) {
      expect(sectionAvailableAt(IAN, k, m('21:30')), k).toBe(false);
      expect(opensAtToday(IAN, k, m('21:30')), k).toBe('22:00');
    }
    expect(opensAtToday(IAN, 'afterday', m('21:30'))).toBeNull(); // disponible
  });
  it('a las 15:00 todo menos After Day, que se abre a las 21:00', () => {
    expect(availableSections(IAN, m('15:00'))).toEqual(REST);
    expect(opensAtToday(IAN, 'afterday', m('15:00'))).toBe('21:00');
    for (const k of REST) expect(opensAtToday(IAN, k, m('15:00')), k).toBeNull();
  });
  it('bordes: 21:00 entra (solo After Day) y 22:00 sale (todo menos After Day); a las 22:30 After Day ya no abre hoy', () => {
    expect(availableSections(IAN, m('20:59'))).toEqual(REST);
    expect(availableSections(IAN, m('21:00'))).toEqual(['afterday']);
    expect(availableSections(IAN, m('21:59'))).toEqual(['afterday']);
    expect(availableSections(IAN, m('22:00'))).toEqual(REST);
    expect(opensAtToday(IAN, 'chat', m('21:59'))).toBe('22:00');
    expect(opensAtToday(IAN, 'afterday', m('22:30'))).toBeNull(); // mañana a las 21:00: no se promete
  });
  it('con el override en r1 (la demo), solo After Day a cualquier hora y sin opensAt', () => {
    for (const t of ['03:00', '15:00', '21:30']) expect(availableSections(IAN, m(t), 'r1')).toEqual(['afterday']);
    expect(opensAtToday(IAN, 'chat', m('15:00'), 'r1')).toBeNull();
  });
});

describe('29-oct · Luna sin rangos: todo disponible siempre', () => {
  it('cada sección, cada minuto, sin opensAt (también con un override que no existe)', () => {
    for (const ranges of [[], undefined]) {
      for (let c = 0; c < 1440; c++) expect(availableSections(ranges, c)).toEqual(ALL);
      for (const k of ALL) expect(opensAtToday(ranges, k, m('21:30'))).toBeNull();
    }
    expect(availableSections([], m('21:30'), 'r1')).toEqual(ALL);
  });
});

describe('29-oct · los solapados suman (la unión de los rangos en curso)', () => {
  const OV = [R('a', '08:00', '12:00', ['chat', 'aprender']), R('b', '10:00', '14:00', ['buscar'])];
  it('solo A · A y B · solo B · ninguno', () => {
    expect(availableSections(OV, m('09:00'))).toEqual(['chat', 'aprender']);
    expect(availableSections(OV, m('11:00'))).toEqual(['chat', 'buscar', 'aprender']);
    expect(availableSections(OV, m('13:00'))).toEqual(['buscar']);
    expect(availableSections(OV, m('15:00'))).toEqual(except('chat', 'buscar', 'aprender'));
  });
  it('opensAt atraviesa el borde de A (12:00) mientras B sigue en curso: MyTube abre a las 14:00', () => {
    expect(opensAtToday(OV, 'buscar', m('09:00'))).toBe('10:00');
    expect(opensAtToday(OV, 'mytube', m('11:00'))).toBe('14:00');
    expect(opensAtToday(OV, 'chat', m('13:00'))).toBeNull(); // solo figura en A, que ya pasó
  });
  it('un rango de 24 h es un momento permanente: lo suyo siempre y lo de otro rango, sumado mientras ése esté en curso', () => {
    const ranges = [R('todo', '00:00', '00:00', ['espacio']), R('tarde', '14:00', '18:00', ['mytube'])];
    expect(availableSections(ranges, m('10:00'))).toEqual(['espacio']);
    expect(availableSections(ranges, m('15:00'))).toEqual(['mytube', 'espacio']);
    expect(opensAtToday(ranges, 'chat', m('10:00'))).toBeNull(); // hoy nunca hay "fuera de todo rango"
  });
});

describe('29-oct · una lista vacía EN CURSO cierra todo (es explícita)', () => {
  it('a las 21:30 nada (salvo el Feed, que no es sección) y todo se abre a las 22:00; fuera del rango, todo', () => {
    const empty = [R('nada', '21:00', '22:00', [])];
    expect(availableSections(empty, m('21:30'))).toEqual([]);
    for (const k of ALL) expect(opensAtToday(empty, k, m('21:30'))).toBe('22:00');
    expect(availableSections(empty, m('15:00'))).toEqual(ALL); // la lista vacía no hace "figurar" a nadie
  });
  it('solapada con otro rango, suma lo de ése', () => {
    const ranges = [R('nada', '20:00', '23:00', []), R('ad', '21:00', '22:00', ['afterday'])];
    expect(availableSections(ranges, m('20:30'))).toEqual([]);
    expect(availableSections(ranges, m('21:30'))).toEqual(['afterday']);
    expect(opensAtToday(ranges, 'chat', m('20:30'))).toBe('23:00');
  });
});

describe('29-oct · un rango ROTO no cierra nada (fail-open intacto)', () => {
  const broken = [
    { id: 'h1', name: 'Horas rotas', from: '25:00', to: '22:00', sections: [] },
    { id: 'h2', name: 'Media hora rota', from: '21:00', to: 'tarde', sections: [] },
    { id: 'h3', name: 'Sin horas', sections: [] },
    { id: 's1', name: 'Secciones rotas', from: '21:00', to: '22:00', sections: 'afterday' },
    { id: 's2', name: 'Sin secciones', from: '21:00', to: '22:00' },
  ];
  it('ni horas inválidas ni secciones que no son lista lo ponen "en curso": a ninguna hora cierra nada', () => {
    for (const r of broken) for (let c = 0; c < 1440; c += 7) expect(availableSections([r], c), `${r.id} ${hhmm(c)}`).toEqual(ALL);
  });
  it('al lado de un rango vivo: no suma cierres, y el de horas rotas sigue abriendo lo suyo las 24 h', () => {
    const ranges = [R('r1', '21:00', '22:00', ['afterday']), { id: 'roto', name: 'Roto', from: '99:99', to: '22:00', sections: ['chat'] }];
    expect(availableSections(ranges, m('21:30'))).toEqual(['chat', 'afterday']); // r1 en curso; chat, por el fail-open
    expect(availableSections(ranges, m('15:00'))).toEqual(except('afterday'));
    expect(opensAtToday(ranges, 'afterday', m('15:00'))).toBe('21:00');
    expect(opensAtToday(ranges, 'calendario', m('21:30'))).toBe('22:00');
  });
  it('un override sobre un rango roto = sin override (rige el reloj real); findRange no lo devuelve', () => {
    const ranges = [R('r1', '21:00', '22:00', ['afterday']), ...broken];
    for (const id of ['h1', 'h2', 'h3', 's1', 's2']) {
      expect(findRange(ranges, id)).toBeNull();
      expect(availableSections(ranges, m('15:00'), id)).toEqual(except('afterday'));
      expect(opensAtToday(ranges, 'afterday', m('15:00'), id)).toBe('21:00');
    }
    expect(findRange(ranges, 'r1')).toEqual(ranges[0]);
  });
});

describe('29-oct · override de demo EXCLUSIVO', () => {
  it('EXACTAMENTE las secciones del rango elegido, a cualquier hora: también se cierran las que no figuran en ningún rango', () => {
    for (let c = 0; c < 1440; c += 31) {
      expect(availableSections(DAY, c, 'tarde')).toEqual(['buscar', 'mytube', 'tienda']);
      expect(availableSections(DAY, c, 'manana')).toEqual(['buscar', 'aprender']);
    }
  });
  it('un rango vacío elegido en la demo cierra todo; sin opensAt', () => {
    const ranges = [R('nada', '03:00', '04:00', []), ...DAY];
    expect(availableSections(ranges, m('13:00'), 'nada')).toEqual([]);
    for (const k of ALL) expect(opensAtToday(ranges, k, m('13:00'), 'nada')).toBeNull();
  });
});

describe('29-oct · cruce de la medianoche (rango exclusivo)', () => {
  const NOCHE = [R('noche', '21:00', '07:00', ['afterday'])];
  it('de 21:00 a 06:59 solo After Day; de 07:00 a 20:59, todo lo demás', () => {
    for (const t of ['21:00', '23:00', '00:00', '03:00', '06:59']) expect(availableSections(NOCHE, m(t)), t).toEqual(['afterday']);
    for (const t of ['07:00', '12:00', '20:59']) expect(availableSections(NOCHE, m(t)), t).toEqual(except('afterday'));
  });
  it('opensAt: de madrugada abre a las 07:00; antes de la medianoche, hoy ya no (no se promete mañana)', () => {
    expect(opensAtToday(NOCHE, 'chat', m('03:00'))).toBe('07:00');
    expect(opensAtToday(NOCHE, 'chat', m('23:00'))).toBeNull();
    expect(opensAtToday(NOCHE, 'afterday', m('12:00'))).toBe('21:00');
    const late = [R('tarde', '23:00', '01:00', [])];
    expect(opensAtToday(late, 'chat', m('23:30'))).toBeNull();
    expect(opensAtToday(late, 'chat', m('00:30'))).toBe('01:00');
  });
});

describe('29-oct · opensAt genérico: barrer los cortes = barrer cada minuto', () => {
  /** La referencia de fuerza bruta (lo que hacía el opensAt viejo): minuto a minuto hasta la medianoche, sobre la
   *  disponibilidad de cada minuto del día. */
  const brute = (avail: boolean[], cur: number): string | null => {
    if (avail[cur]) return null;
    for (let t = cur + 1; t < 1440; t++) if (avail[t]) return hhmm(t);
    return null;
  };
  let seed = 29;
  const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const random = (): CycleRange[] => Array.from({ length: 1 + rnd(4) }, (_, i) =>
    R(`r${i}`, hhmm(rnd(96) * 15), hhmm(rnd(96) * 15), ALL.filter(() => rnd(3) === 0)));
  it('mismo resultado en 40 ciclos (los fijos + al azar con semilla), para cada sección y cada minuto', () => {
    const all: CycleRange[][] = [
      DAY, [R('r1', '21:00', '22:00', ['afterday'])], [R('n', '21:00', '22:00', [])],
      [R('x', '23:59', '00:01', ['chat']), R('y', '00:00', '00:00', [])],
      ...Array.from({ length: 36 }, random),
    ];
    expect(all).toHaveLength(40);
    const bad: string[] = [];
    let opened = 0;
    for (const [i, ranges] of all.entries()) for (const k of ALL) {
      const avail = Array.from({ length: 1440 }, (_, t) => sectionAvailableAt(ranges, k, t));
      for (let c = 0; c < 1440; c++) {
        const got = opensAtToday(ranges, k, c), want = brute(avail, c);
        if (got !== want) bad.push(`ciclo ${i} ${k} ${hhmm(c)}: ${got} ≠ ${want}`);
        if (want) opened++;
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
    expect(opened).toBeGreaterThan(10_000); // el barrido de verdad encuentra aperturas (no compara null con null)
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
  it('arregla sin encerrar y avisa: horas inválidas → vacías, ids y nombres nuevos, secciones raras afuera', () => {
    // 29-oct: antes las horas inválidas iban a "00:00"–"00:00" (24 h) y las secciones que no eran lista a "ninguna"; con los
    // rangos exclusivos los dos CERRARÍAN (en curso todo el día / en su horario), así que ahora: horas → "" (sigue roto: no
    // cierra nada) y un rango con secciones que no son lista sale (no cierra ni abre nada).
    const s = sanitizeStoredRanges([
      { id: 'a', name: 'Bien', from: '8:00', to: '09:00', sections: ['chat', 'feed'] },
      { id: 'a', name: '', from: '99:00', to: 'x', sections: ['aprender', 'aprender'] },
      'basura',
      { name: 'Sin id', from: '10:00', to: '11:00', sections: ['buscar'] },
      { id: 'b', name: 'Lista rota', from: '12:00', to: '13:00', sections: 'chat' },
      { id: 'c', name: 'Media', from: '12:00', to: '25:00', sections: [] },
    ]);
    expect(s.ranges).toEqual([
      { id: 'a', name: 'Bien', from: '08:00', to: '09:00', sections: ['chat'] },
      { id: 'r1', name: 'Rango 2', from: '', to: '', sections: ['aprender'] },
      { id: 'r2', name: 'Sin id', from: '10:00', to: '11:00', sections: ['buscar'] },
      { id: 'c', name: 'Media', from: '12:00', to: '', sections: [] },
    ]);
    expect(s.fixes.length).toBeGreaterThanOrEqual(7);
    expect(s.fixes.join(' | ')).toMatch(/rango 5: las secciones no eran una lista → lo saco/);
    expect(sanitizeStoredRanges({ no: 'lista' }).ranges).toEqual([]);
    expect(sanitizeStoredRanges(undefined)).toEqual({ ranges: [], fixes: [] });
  });
  it('un rango con horas rotas sigue abriendo su sección todo el día después del saneo', () => {
    const s = sanitizeStoredRanges([{ id: 'x', name: 'Roto', from: '25:00', to: '01:00', sections: ['chat'] }]);
    for (let c = 0; c < 1440; c += 17) expect(sectionAvailableAt(s.ranges, 'chat', c)).toBe(true);
  });
  it('29-oct: la disponibilidad de lo saneado es IDÉNTICA a la de lo crudo, sección por sección y minuto a minuto', () => {
    const raws: unknown[][] = [
      [{ id: 'x', name: 'Roto', from: '25:00', to: '01:00', sections: ['chat'] }], // antes: 24 h en curso → cerraba el resto
      [{ id: 'y', name: 'Lista rota', from: '21:00', to: '22:00', sections: 'afterday' }], // antes: [] en curso → cerraba todo
      [{ id: 'r1', name: 'Rango 1', from: '21:00', to: '22:00', sections: ['afterday', 'feed'] }, { from: 'x', to: 'y', sections: [] }, 7],
      [{ id: 'd', name: 'D', from: '8:00', to: '12:00', sections: ['buscar'] }, { id: 'd', name: '!!', from: '11:00', to: '9:00', sections: ['chat', 'zz'] }],
    ];
    const bad: string[] = [];
    for (const [i, raw] of raws.entries()) {
      const { ranges } = sanitizeStoredRanges(raw);
      for (const k of ALL) for (let c = 0; c < 1440; c++) if (sectionAvailableAt(ranges, k, c) !== sectionAvailableAt(raw, k, c)) bad.push(`caso ${i} ${k} ${hhmm(c)}`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});
