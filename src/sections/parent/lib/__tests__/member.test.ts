import { describe, expect, it } from 'vitest';
import type { UserInfo } from '../../../../api/types';
import { FAMILY_NOTE, FAMILY_WIDE, famTo, membersOf, pickMember } from '../member';

/* U3 · M2 — el selector de integrante de Familia: quiénes son los integrantes (los dependents del adulto, en su orden), a
   quién apunta `?m=` (trim + minúsculas como el ?member= del server; ausente/ajeno → el primero) y los links con `?m=`. */

const USERS: UserInfo[] = [
  { id: 'ian', name: 'Ian', nick: 'Ian', age: 9, kind: 'child' },
  { id: 'luna', name: 'Luna', nick: 'Luna', age: 12, kind: 'child' },
  { id: 'andres', name: 'Andrés', nick: 'Andrés', age: 38, kind: 'adult', dependents: ['ian', 'luna'] },
];

describe('membersOf', () => {
  it('los dependents del adulto, en su orden y con la forma FamilyMember', () => {
    expect(membersOf(USERS, 'andres')).toEqual([
      { id: 'ian', name: 'Ian', age: 9, nick: 'Ian' },
      { id: 'luna', name: 'Luna', age: 12, nick: 'Luna' },
    ]);
  });
  it('respeta el orden de dependents (no el de la lista de usuarios)', () => {
    const swapped = USERS.map((u) => (u.id === 'andres' ? { ...u, dependents: ['luna', 'ian'] } : u));
    expect(membersOf(swapped, 'andres').map((m) => m.id)).toEqual(['luna', 'ian']);
  });
  it('un chico o un adulto sin dependents no tiene integrantes; un id que no existe se saltea', () => {
    expect(membersOf(USERS, 'ian')).toEqual([]);
    expect(membersOf(USERS, undefined)).toEqual([]);
    const ghost = USERS.map((u) => (u.id === 'andres' ? { ...u, dependents: ['ian', 'nadie'] } : u));
    expect(membersOf(ghost, 'andres').map((m) => m.id)).toEqual(['ian']);
  });
});

describe('pickMember', () => {
  const members = membersOf(USERS, 'andres');
  it('?m= válido → ese integrante (con trim y sin importar mayúsculas)', () => {
    expect(pickMember(members, 'luna').id).toBe('luna');
    expect(pickMember(members, '  LUNA ').id).toBe('luna');
    expect(pickMember(members, 'ian').id).toBe('ian');
  });
  it('ausente, vacío o ajeno → el primero', () => {
    expect(pickMember(members, null).id).toBe('ian');
    expect(pickMember(members, '').id).toBe('ian');
    expect(pickMember(members, 'bogus').id).toBe('ian');
    expect(pickMember(members, 'andres').id).toBe('ian'); // el adulto no es un integrante que se configura
  });
});

describe('famTo y las solapas de familia', () => {
  it('arma el link con ?m= (codificado) y sin el resto de la query', () => {
    expect(famTo('/familia/temas', 'luna')).toEqual({ pathname: '/familia/temas', search: '?m=luna' });
    expect(famTo('/familia', 'a b')).toEqual({ pathname: '/familia', search: '?m=a%20b' });
  });
  it('YouTube y Mentorías son de toda la familia, cada una con su nota; el resto, del integrante', () => {
    expect([...FAMILY_WIDE].sort()).toEqual(['/familia/mentorias', '/familia/youtube']);
    for (const p of FAMILY_WIDE) expect(FAMILY_NOTE[p]).toBeTruthy();
    for (const p of ['/familia', '/familia/temas', '/familia/limites', '/familia/avisos', '/familia/premios', '/familia/actividad', '/familia/protecciones']) {
      expect(FAMILY_WIDE.has(p)).toBe(false);
    }
  });
});
