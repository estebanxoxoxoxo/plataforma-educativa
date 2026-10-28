import { describe, expect, it } from 'vitest';
import { socialOn } from '../social';

/* U4 · D4 — lo social (dock, Personas, solicitudes, regalos) es de los chicos: el adulto nunca lo ve, aunque useFeatures()
   le dé todo prendido; al chico lo rige su Amigos; mientras no se sabe, nada (fail-closed). */
describe('socialOn', () => {
  it('un chico con Amigos prendido lo ve; apagado, no', () => {
    expect(socialOn(true, 'child')).toBe(true);
    expect(socialOn(false, 'child')).toBe(false);
  });
  it('un adulto NUNCA (aunque useFeatures le dé Amigos prendido)', () => {
    expect(socialOn(true, 'adult')).toBe(false);
    expect(socialOn(false, 'adult')).toBe(false);
    expect(socialOn(undefined, 'adult')).toBe(false);
  });
  it('mientras no se sabe si Amigos está prendido: undefined (no se muestra)', () => {
    expect(socialOn(undefined, 'child')).toBeUndefined();
  });
  it('sin usuario resuelto se trata como chico: manda Amigos', () => {
    expect(socialOn(true, undefined)).toBe(true);
    expect(socialOn(false, undefined)).toBe(false);
    expect(socialOn(undefined, undefined)).toBeUndefined();
  });
});
