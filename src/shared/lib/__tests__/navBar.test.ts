import { describe, expect, it } from 'vitest';
import { pickBar } from '../navBar';

// El orden del menú (docs/AGENTS.md regla 8) y las dos listas de la barra (RESPONSIVE.md §2.2, D1/D2).
const MENU = ['home', 'search', 'chat', 'mytube', 'learn', 'afterday', 'store', 'calendar', 'space', 'family'];
const KID = ['home', 'search', 'mytube', 'learn'];
const ADULT = ['home', 'search', 'learn', 'family'];
const items = (secs: string[]) => secs.map((sec) => ({ sec }));
const secs = (xs: { sec: string }[]) => xs.map((x) => x.sec);
const without = (...off: string[]) => items(MENU.filter((s) => s !== 'family' && !off.includes(s)));

describe('pickBar (barra inferior del teléfono)', () => {
  it('chico con todo prendido: Feed · Buscar · MyTube · Aprender', () => {
    expect(secs(pickBar(without(), KID, MENU))).toEqual(['home', 'search', 'mytube', 'learn']);
  });
  it('adulto: Familia entra en lugar de MyTube, al final (D2)', () => {
    expect(secs(pickBar(items(MENU), ADULT, MENU))).toEqual(['home', 'search', 'learn', 'family']);
  });
  it('una apagada la reemplaza la siguiente visible del menú que no esté ya', () => {
    // sin MyTube: la siguiente después de MyTube es Aprender (ya está) → After Day
    expect(secs(pickBar(without('mytube'), KID, MENU))).toEqual(['home', 'search', 'learn', 'afterday']);
    // sin Buscar: la siguiente es Chat, y la barra queda en el orden del menú
    expect(secs(pickBar(without('search'), KID, MENU))).toEqual(['home', 'chat', 'mytube', 'learn']);
  });
  it('si no hay ninguna después, toma la primera libre', () => {
    expect(secs(pickBar(items(['home', 'search', 'chat']), KID, MENU))).toEqual(['home', 'search', 'chat']);
    // sin Buscar ni MyTube: Chat (la siguiente de Buscar) y Calendario (la siguiente de MyTube que queda libre),
    // aunque la entrada venga desordenada
    expect(secs(pickBar(items(['home', 'chat', 'learn', 'space', 'calendar']), KID, MENU))).toEqual(['home', 'chat', 'learn', 'calendar']);
  });
  it('con el ciclo cerrando todo queda solo el Feed (nunca se inventa una sección)', () => {
    expect(secs(pickBar(items(['home']), KID, MENU))).toEqual(['home']);
  });
  it('nunca pasa de 4', () => {
    expect(pickBar(items(MENU), [...KID, 'chat', 'store'], MENU)).toHaveLength(4);
  });
});
