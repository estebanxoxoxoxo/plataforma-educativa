import { describe, expect, it } from 'vitest';
import { crisisNetHit } from '../crisisNet';

/* La RED DE CRISIS determinística (FS-BASE-A, hallazgo chat.ts:252): corre SOLO con el juez de entrada caído. Lo que importa:
   pega con las frases de crisis aunque vengan con tildes, mayúsculas, signos o en inglés; no pega por un pedazo de palabra
   ("mato" en "tomato", "corto" en "cortometraje") ni con lo cotidiano que más se le parece ("me toca jugar"). */

describe('crisisNetHit', () => {
  it.each([
    ['me quiero morir', 'me quiero morir'],
    ['ME QUIERO MORIR!!!', 'me quiero morir'],
    ['a veces quiero morirme', 'quiero morir*'],
    ['pienso en el suicidio', 'suicid*'],
    ['Me quiero suicidar', 'suicid*'],
    ['no quiero vivir más', 'no quiero vivir'],
    ['quiero desaparecer', 'quiero desaparecer'],
    ['me voy a hacer daño', 'me voy a hacer dano'],
    ['me corto los brazos', 'me corto'],
    ['mi papá me pega mucho', 'me pega'],
    ['me pega mi tío', 'me pega'],
    ['en la escuela me pegan', 'me pegan'],
    ['me tocaron sin permiso', 'me tocaron'],
    ['I want to die', 'want to die'],
    ['i will kill myself', 'kill myself'],
  ])('«%s» → %s', (text, want) => {
    expect(crisisNetHit(text)).toBe(want);
  });

  it('lo cotidiano que se le parece NO pega (palabras enteras, no pedazos)', () => {
    for (const t of ['me toca jugar a mí', 'un tomato rojo', 'vi un cortometraje', 'los dinosaurios se murieron', 'matemáticas', 'quiero ver videos de volcanes', 'la pelota me pegó en la cara'])
      expect(crisisNetHit(t), t).toBeNull();
  });

  it('vacío o no-texto → null', () => {
    expect(crisisNetHit('')).toBeNull();
    expect(crisisNetHit(undefined as unknown as string)).toBeNull();
  });
});
