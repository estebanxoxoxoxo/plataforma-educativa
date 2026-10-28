import { describe, expect, it } from 'vitest';
import type { FamilyLeague, FamilyLeagueRow } from '../../../../api/types';
import { familyTabOn, geoCaption, leagueCaption, resolveTab } from '../tabs';

/* U4 — las solapas de /ligas (la de Familia solo con ≥ 2 integrantes; ?tab=familia sin solapa → Mi liga) y los captions
   del adulto (su liga y sus tops son de grandes: nada de "chicos"). */

const row = (id: string, pos: number, me = false): FamilyLeagueRow =>
  ({ pos, id, name: id, nick: id, kind: 'child', xp: 100 * pos, streakDays: pos, look: null, ...(me ? { me } : {}) });
const fam = (n: number): FamilyLeague => ({ closesInDays: 3, rows: Array.from({ length: n }, (_, i) => row(`u${i}`, i + 1, i === 0)) });

describe('familyTabOn', () => {
  it('con dos o más integrantes, sí', () => {
    expect(familyTabOn(fam(2))).toBe(true);
    expect(familyTabOn(fam(3))).toBe(true);
  });
  it('una familia de uno, vacía o sin lectura (falló / todavía no llegó): no', () => {
    expect(familyTabOn(fam(1))).toBe(false);
    expect(familyTabOn(fam(0))).toBe(false);
    expect(familyTabOn(null)).toBe(false);
    expect(familyTabOn(undefined)).toBe(false);
  });
});

describe('resolveTab', () => {
  it('zona y país siempre; familia solo si la solapa existe', () => {
    expect(resolveTab('zona', false)).toBe('zona');
    expect(resolveTab('pais', true)).toBe('pais');
    expect(resolveTab('familia', true)).toBe('familia');
    expect(resolveTab('familia', false)).toBe('liga');
  });
  it('sin parámetro o con uno desconocido: Mi liga', () => {
    expect(resolveTab(null, true)).toBe('liga');
    expect(resolveTab('', true)).toBe('liga');
    expect(resolveTab('liga', true)).toBe('liga');
    expect(resolveTab('Familia', true)).toBe('liga');
  });
});

describe('captions', () => {
  it('Mi liga: chicos para un chico, grandes para el adulto', () => {
    expect(leagueCaption('Liga Cometa', 12, false)).toBe('Liga Cometa · 12 chicos');
    expect(leagueCaption('Liga Chispa', 12, true)).toBe('Liga Chispa · 12 grandes');
  });
  it('zona y país: el lugar; para el adulto, "Grandes de …"', () => {
    expect(geoCaption('Palermo', false)).toBe('Palermo');
    expect(geoCaption('Palermo', true)).toBe('Grandes de Palermo');
    expect(geoCaption('Argentina', true)).toBe('Grandes de Argentina');
  });
});
