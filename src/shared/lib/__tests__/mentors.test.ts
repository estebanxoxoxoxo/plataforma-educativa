import { describe, expect, it } from 'vitest';
import type { TakenSlot, Teacher } from '../../../api/types';
import {
  calendarOf, dateLong, familyIds, firstClass, forWho, fromCalendarOf, mentorMatches, pickWho, planClasses, planLabel, slotsEvery, takenBy,
  teachesWho, weeklyPrice, whoName,
} from '../mentors';

/* Mentores (tanda U2): las reglas del lado de la UI que comparten Buscar → Mentores y Familia → Mentorías.
   Fechas (tanda B2): SIN zona (null, el default) el lib usa la hora LOCAL del navegador, así que esos casos se arman con
   new Date(año, mes, día, hora) y no dependen de la zona de la máquina. CON zona (la de la familia) el lib usa la hora de
   PARED de esa zona, como el Calendario y el server: esos casos fijan instantes en UTC (Date.UTC) y esperan el reloj de esa
   zona, también sin depender de la máquina. */
const BA = 'America/Argentina/Buenos_Aires'; // UTC−3 todo el año
const MAD = 'Europe/Madrid'; // desde el 25-oct-2026, UTC+1
const NY = 'America/New_York'; // horario de verano hasta el 1-nov-2026 (UTC−4), después UTC−5

const t = (id: string, name: string, subject: string, bio: string): Teacher =>
  ({ id, name, subject, bio, emoji: '·', color: '#000', pricePerHour: 40, rating: 4.9 });
const CARO = t('caro-mendez', 'Caro Méndez', 'Matemática', 'Convierte cada problema en un misterio para resolver: los chicos terminan pidiendo otro.');
const LUCIA = t('lucia-ferraro', 'Lucía Ferraro', 'Lectura y escritura', 'Arma un club de lectura de a dos y ayuda a escribir los cuentos que tienen en la cabeza.');
const GRACE = t('grace-kim', 'Grace Kim', 'Música', 'Piano desde cero: en la primera clase ya sale una canción entera.');
const people = { andres: 'Andrés', ian: 'Ian' };

describe('mentorMatches (filtro local de Buscar → Mentores)', () => {
  it('sin búsqueda entran todos', () => {
    expect([CARO, LUCIA, GRACE].every((m) => mentorMatches(m, ''))).toBe(true);
    expect(mentorMatches(CARO, '   ')).toBe(true);
  });
  it('por materia, nombre o bio, sin acentos ni mayúsculas', () => {
    expect([CARO, LUCIA, GRACE].filter((m) => mentorMatches(m, 'mate')).map((m) => m.id)).toEqual(['caro-mendez']);
    expect(mentorMatches(CARO, 'MENDEZ')).toBe(true);
    expect(mentorMatches(LUCIA, 'lucia')).toBe(true);
    expect(mentorMatches(GRACE, 'música')).toBe(true);
    expect(mentorMatches(GRACE, 'piano')).toBe(true);
  });
  it('cada palabra tiene que estar', () => {
    expect(mentorMatches(GRACE, 'piano grace')).toBe(true);
    expect(mentorMatches(GRACE, 'piano caro')).toBe(false);
  });
});

describe('plan y precio', () => {
  it('precio semanal = plan × precio por hora', () => {
    expect(weeklyPrice(45, 2)).toBe(90);
    expect(weeklyPrice(50, 1)).toBe(50);
    expect(weeklyPrice(28, 3)).toBe(84);
  });
  it('rótulos del plan', () => {
    expect(planLabel(1)).toBe('1 clase por semana');
    expect(planLabel(3)).toBe('3 clases por semana');
    expect(planClasses(1)).toBe('1 clase de 1 h');
    expect(planClasses(2)).toBe('2 clases de 1 h');
  });
});

describe('días y horas', () => {
  it('slotsEvery: en el orden de la semana, con "y"', () => {
    expect(slotsEvery([{ weekday: 3, hour: 10 }, { weekday: 1, hour: 10 }])).toBe('los martes a las 10:00 y los jueves a las 10:00');
    expect(slotsEvery([{ weekday: 6, hour: 9 }])).toBe('los domingos a las 9:00');
    expect(slotsEvery([{ weekday: 0, hour: 9 }, { weekday: 2, hour: 17 }, { weekday: 4, hour: 15 }]))
      .toBe('los lunes a las 9:00, los miércoles a las 17:00 y los viernes a las 15:00');
  });
  it('takenBy: con quién está ocupada esa hora', () => {
    const taken: TakenSlot[] = [{ weekday: 2, hour: 17, subject: 'Matemática', mentorName: 'Caro Méndez' }];
    expect(takenBy(taken, 2, 17)?.mentorName).toBe('Caro Méndez');
    expect(takenBy(taken, 2, 18)).toBeUndefined();
    expect(takenBy(taken, 3, 17)).toBeUndefined();
  });
  it('firstClass: la próxima ocurrencia ESTRICTAMENTE futura, la más cercana de todos los días', () => {
    const wed1830 = new Date(2026, 9, 14, 18, 30).getTime(); // miércoles 14-oct-2026 18:30 (hora local)
    expect(firstClass([{ weekday: 1, hour: 10 }, { weekday: 3, hour: 10 }], wed1830)).toBe(new Date(2026, 9, 15, 10).getTime()); // jueves 15
    expect(firstClass([{ weekday: 2, hour: 17 }], wed1830)).toBe(new Date(2026, 9, 21, 17).getTime()); // hoy ya pasó: el miércoles que viene
    expect(firstClass([{ weekday: 2, hour: 19 }], wed1830)).toBe(new Date(2026, 9, 14, 19).getTime()); // hoy más tarde
    expect(firstClass([{ weekday: 2, hour: 18 }], new Date(2026, 9, 14, 18).getTime())).toBe(new Date(2026, 9, 21, 18).getTime()); // justo ahora: no
    expect(firstClass([], wed1830)).toBeNull();
  });
  it('firstClass con la zona de la familia: el día y la hora son los de SU reloj, no los del navegador', () => {
    const wed12utc = Date.UTC(2026, 9, 28, 12); // miércoles 28-oct: 9:00 en Buenos Aires, 13:00 en Madrid
    const wed17 = [{ weekday: 2, hour: 17 }];
    expect(firstClass(wed17, wed12utc, BA)).toBe(Date.UTC(2026, 9, 28, 20)); // 17:00 de Buenos Aires
    expect(firstClass(wed17, wed12utc, MAD)).toBe(Date.UTC(2026, 9, 28, 16)); // 17:00 de Madrid: otro instante
    // justo a la hora: no cuenta (estrictamente futura), es la de la semana que viene
    expect(firstClass(wed17, Date.UTC(2026, 9, 28, 20), BA)).toBe(Date.UTC(2026, 10, 4, 20));
    // "hoy" es el de la familia: a las 22:00 del miércoles en Buenos Aires ya es jueves en Madrid
    const late = Date.UTC(2026, 9, 29, 1);
    expect(firstClass([{ weekday: 3, hour: 9 }], late, BA)).toBe(Date.UTC(2026, 9, 29, 12)); // jueves 9:00 de Buenos Aires
    expect(firstClass([{ weekday: 3, hour: 9 }], late, MAD)).toBe(Date.UTC(2026, 9, 29, 8)); // jueves 9:00 de Madrid
    expect(firstClass(wed17, late, BA)).toBe(Date.UTC(2026, 10, 4, 20)); // el miércoles 17:00 de hoy ya pasó
    // sumando DÍAS de pared: del otro lado del cambio de horario de verano la clase sigue a las 17:00
    expect(firstClass(wed17, Date.UTC(2026, 9, 28, 22), NY)).toBe(Date.UTC(2026, 10, 4, 22)); // 17:00 EST (era 21:00 UTC con EDT)
    expect(firstClass([], wed12utc, BA)).toBeNull();
  });
  it('firstClass sin zona (o con una desconocida): la local, igual que antes', () => {
    const wed1830 = new Date(2026, 9, 14, 18, 30).getTime();
    const slots = [{ weekday: 1, hour: 10 }, { weekday: 3, hour: 10 }];
    expect(firstClass(slots, wed1830, null)).toBe(new Date(2026, 9, 15, 10).getTime());
    expect(firstClass(slots, wed1830, 'Marte/Olympus')).toBe(new Date(2026, 9, 15, 10).getTime());
  });
  it('dateLong en la zona de la familia', () => {
    const at = Date.UTC(2026, 9, 28, 20); // un instante: miércoles 28-oct 20:00 UTC
    expect(dateLong(at, BA)).toBe('miércoles 28 de octubre a las 17:00');
    expect(dateLong(at, MAD)).toBe('miércoles 28 de octubre a las 21:00');
    // el día también es el de la zona (no solo la hora)
    const night = Date.UTC(2026, 9, 29, 2, 30);
    expect(dateLong(night, BA)).toBe('miércoles 28 de octubre a las 23:30');
    expect(dateLong(night, MAD)).toBe('jueves 29 de octubre a las 3:30');
    // la cuenta y el texto dicen lo mismo: la primera clase de "los miércoles a las 17:00" es a las 17:00 de esa zona
    const wed12utc = Date.UTC(2026, 9, 28, 12);
    expect(dateLong(firstClass([{ weekday: 2, hour: 17 }], wed12utc, BA)!, BA)).toBe('miércoles 28 de octubre a las 17:00');
    expect(dateLong(firstClass([{ weekday: 2, hour: 17 }], wed12utc, MAD)!, MAD)).toBe('miércoles 28 de octubre a las 17:00');
  });
  it('dateLong sin zona (o con una desconocida): la local', () => {
    const local = new Date(2026, 9, 13, 10).getTime();
    expect(dateLong(local)).toBe('martes 13 de octubre a las 10:00');
    expect(dateLong(local, null)).toBe('martes 13 de octubre a las 10:00');
    expect(dateLong(new Date(2026, 9, 13, 9, 5).getTime(), 'Marte/Olympus')).toBe('martes 13 de octubre a las 9:05');
  });
});

describe('rótulos del beneficiario', () => {
  it('"vos" para el adulto, el nombre para un dependiente', () => {
    expect(whoName('andres', 'andres', people)).toBe('vos');
    expect(whoName('ian', 'andres', people)).toBe('Ian');
    expect(forWho('ian', 'andres', people)).toBe('para Ian');
    expect(forWho('andres', 'andres', people)).toBe('para vos');
    expect(pickWho('andres', 'andres', people)).toBe('Para mí');
    expect(pickWho('ian', 'andres', people)).toBe('Para Ian');
    expect(teachesWho('ian', 'andres', people)).toBe('Da clases a Ian');
    expect(teachesWho('andres', 'andres', people)).toBe('Te da clases');
    expect(calendarOf('andres', 'andres', people)).toBe('tu calendario');
    expect(calendarOf('ian', 'andres', people)).toBe('el calendario de Ian');
    // con "de" adelante: la contracción hecha ("del", nunca "de el")
    expect(fromCalendarOf('andres', 'andres', people)).toBe('de tu calendario');
    expect(fromCalendarOf('ian', 'andres', people)).toBe('del calendario de Ian');
    expect(fromCalendarOf('nadie', 'andres', people)).toBe('del calendario de alguien de tu familia');
  });
  it('la familia en orden: el adulto primero', () => {
    expect(familyIds('andres', { ian: 'Ian', andres: 'Andrés' })).toEqual(['andres', 'ian']);
  });
});
