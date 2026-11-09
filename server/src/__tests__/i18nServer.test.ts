import { describe, expect, it } from 'vitest';

/* i18n (pedido 9-nov): las tablas es→en del server, resueltas AL SERVIR por el idioma del pedido (runAsUser con lang).
   Fuera de un pedido (o en castellano) todo sale EXACTO como antes. */
const { runAsUser } = await import('../requestContext');
const { feedText } = await import('../feedEn');
const { dmText, statusEn, streakEn, monthEn } = await import('../friendsEn');
const { localizeMedal } = await import('../medals');
const { MEDALS } = await import('../medalRules');

const en = <T,>(fn: () => T) => runAsUser('ian', fn, 'en');

describe('feedEn: noticias, "por qué" y plantillas', () => {
  it('en inglés traduce lo conocido; en castellano y fuera de un pedido, nada', () => {
    expect(en(() => feedText('llegó a una racha de 12 días seguidos practicando'))).toBe('hit a 12-day practice streak');
    expect(en(() => feedText('LuMagma quiere ser tu amiga'))).toBe('LuMagma wants to be your friend');
    expect(en(() => feedText('La empezaste y te quedan 3 postas'))).toBe('You started it and have 3 steps left');
    expect(en(() => feedText('ganó la medalla de plata 🥈 en la Liga Cometa y subió a la Liga Estrella ⭐'))).toBe('won the silver medal 🥈 in Liga Cometa and moved up to Liga Estrella ⭐');
    expect(en(() => feedText('hace 5 min'))).toBe('5 min ago');
    expect(en(() => feedText('algo que no está en la tabla'))).toBe('algo que no está en la tabla');
    expect(runAsUser('ian', () => feedText('Videos para vos'), 'es')).toBe('Videos para vos');
    expect(feedText('Videos para vos')).toBe('Videos para vos');
  });
  it('respeta el espacio duro antes de un emoji (feedFake.glue)', () => {
    expect(en(() => feedText('llegó a 8 días seguidos practicando 🔥'))).toBe('hit 8 days of practice in a row 🔥');
  });
});

describe('friendsEn: mensajes de los NPCs y su perfil', () => {
  it('plantillas con el nombre y la prenda, frases sembradas; lo que no conoce, tal cual', () => {
    expect(en(() => dmText('Gracias, Ian. Me puse la gorra para el próximo experimento 🧪'))).toBe('Thanks, Ian. I put on the cap for my next experiment 🧪');
    expect(en(() => dmText('Che, ¿viste el curso nuevo de paleontología?'))).toBe('Hey, did you see the new paleontology course?');
    expect(en(() => dmText('hola, esto lo escribió el chico'))).toBe('hola, esto lo escribió el chico');
    expect(dmText('Che, ¿viste el curso nuevo de paleontología?')).toBe('Che, ¿viste el curso nuevo de paleontología?');
  });
  it('status, racha y mes', () => {
    expect(en(() => [statusEn('Practicando: El sistema solar'), statusEn('Racha de 8 días'), streakEn('12 días'), monthEn('marzo')]))
      .toEqual(['Practicing: The solar system', '8-day streak', '12 days', 'March']);
    expect([statusEn('Racha de 8 días'), streakEn('12 días'), monthEn('marzo')]).toEqual(['Racha de 8 días', '12 días', 'marzo']);
  });
});

describe('medallas por id', () => {
  it('localizeMedal: inglés en un pedido en inglés, el castellano de la spec si no', () => {
    const m = { id: 'primera-posta' as const, emoji: '🎯', title: MEDALS['primera-posta'].title, text: MEDALS['primera-posta'].text, at: null };
    expect(en(() => localizeMedal(m))).toMatchObject({ title: 'First step', text: 'You completed your first step in Learn.' });
    expect(localizeMedal(m)).toBe(m);
  });
});

describe('calendario: el título de la clase (teachersFake.classTitle)', () => {
  it('en inglés «Science class with Sam»; en castellano, igual que siempre', async () => {
    const { classTitle } = await import('../teachersFake');
    expect(en(() => classTitle('Ciencias', 'Sam'))).toBe('Science class with Sam');
    expect(en(() => classTitle('Astronomía', 'Ana'))).toBe('Astronomía class with Ana');
    expect(classTitle('Ciencias', 'Sam')).toBe('Clase de Ciencias con Sam');
  });
});
