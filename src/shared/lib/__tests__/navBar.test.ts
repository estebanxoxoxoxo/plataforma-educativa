import { describe, expect, it } from 'vitest';
import { pickBar } from '../navBar';

// El orden del menú (docs/AGENTS.md regla 8; = NAV de Sidebar.tsx, reordenado por Esteban el 30-oct: después de MyTube van
// Mi espacio, Calendario, Aprender y Tienda; After Day al fondo por decisión del coordinador) y las dos listas de la barra
// (RESPONSIVE.md §2.2, D1/D2: no cambiaron).
const MENU = ['home', 'search', 'chat', 'mytube', 'space', 'calendar', 'learn', 'store', 'afterday', 'family'];
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
    // sin MyTube: con el orden del 30-oct la siguiente después de MyTube es Mi espacio (antes era Aprender, que ya estaba,
    // y entraba After Day). La regla de pickBar no cambió: cambió qué sección viene después.
    expect(secs(pickBar(without('mytube'), KID, MENU))).toEqual(['home', 'search', 'space', 'learn']);
    // sin Buscar: la siguiente es Chat, y la barra queda en el orden del menú
    expect(secs(pickBar(without('search'), KID, MENU))).toEqual(['home', 'chat', 'mytube', 'learn']);
  });
  it('si no hay ninguna después, toma la primera libre', () => {
    expect(secs(pickBar(items(['home', 'search', 'chat']), KID, MENU))).toEqual(['home', 'search', 'chat']);
    // sin Buscar ni MyTube: Chat (la siguiente de Buscar) y Tienda (la siguiente de MyTube que queda libre: Aprender, que
    // viene antes, ya está), aunque la entrada venga desordenada. (Antes del orden del 30-oct este caso usaba Mi espacio y
    // Calendario, que ahora quedan pegados a MyTube y no ejercitarían el salto.)
    expect(secs(pickBar(items(['store', 'home', 'learn', 'chat', 'afterday']), KID, MENU))).toEqual(['home', 'chat', 'learn', 'store']);
  });
  it('con el ciclo cerrando todo queda solo el Feed (nunca se inventa una sección)', () => {
    expect(secs(pickBar(items(['home']), KID, MENU))).toEqual(['home']);
  });
  it('nunca pasa de 4', () => {
    expect(pickBar(items(MENU), [...KID, 'chat', 'store'], MENU)).toHaveLength(4);
  });
});
