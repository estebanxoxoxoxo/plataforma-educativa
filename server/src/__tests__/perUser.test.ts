import { describe, expect, it } from 'vitest';
import { perUser } from '../perUser';
import { currentUser, runAsUser } from '../requestContext';
import { DEFAULT_USER_ID, familyOf } from '../users';

/* U4 (cada uno lo suyo): el mecanismo común — un slice por usuario resuelto por el contexto del pedido (U3: ALS) — y la
   familia de un usuario. Solo lee la config (users.ts → config.ts): no toca server/data. */

describe('perUser', () => {
  it('fuera de un pedido now() es el de DEFAULT_USER_ID (ian), como actingUser sin cabecera', () => {
    const s = perUser(id => ({ id, n: 0 }));
    expect(currentUser()).toBeUndefined();
    expect(s.nowId()).toBe(DEFAULT_USER_ID);
    expect(s.now().id).toBe('ian');
  });
  it('dentro de runAsUser now() es el slice de ESE usuario; los slices no se pisan', () => {
    const s = perUser(id => ({ id, n: 0 }));
    runAsUser('luna', () => { s.now().n += 5 });
    runAsUser('ian', () => { s.now().n += 1 });
    expect(s.of('luna').n).toBe(5);
    expect(s.of('ian').n).toBe(1);
    expect(runAsUser('andres', () => s.nowId())).toBe('andres');
    expect(s.of('andres').n).toBe(0);
  });
  it('el contexto viaja por await (lo que hace un handler async)', async () => {
    const s = perUser(id => ({ id, n: 0 }));
    await runAsUser('luna', async () => { await new Promise(r => setTimeout(r, 1)); s.now().n++ });
    expect(s.of('luna').n).toBe(1);
    expect(s.of('ian').n).toBe(0);
  });
  it('of() crea con el seed la primera vez y devuelve SIEMPRE el mismo objeto', () => {
    let calls = 0;
    const s = perUser(id => { calls++; return { id } });
    const a = s.of('luna');
    expect(s.of('luna')).toBe(a);
    expect(calls).toBe(1);
    expect(s.ids()).toEqual(['luna']);
  });
  it('reset(id) re-siembra solo a ese usuario; reset() vacía todos (nacen de nuevo al usarse)', () => {
    const s = perUser(id => ({ id, n: 0 }));
    s.of('ian').n = 3; s.of('luna').n = 4;
    s.reset('luna');
    expect(s.of('luna').n).toBe(0);
    expect(s.of('ian').n).toBe(3);
    s.reset();
    expect(s.ids()).toEqual([]);
    expect(s.of('ian').n).toBe(0);
  });
});

describe('runAsUser', () => {
  it('pone el usuario del seed como currentUser y tira con un id desconocido', () => {
    expect(runAsUser('luna', () => currentUser()?.name)).toBe('Luna');
    expect(() => runAsUser('nadie', () => 1)).toThrow(/no es un usuario del seed/);
    expect(currentUser()).toBeUndefined();
  });
});

describe('familyOf', () => {
  it('seed actual: los tres ven la misma familia, en el orden del seed', () => {
    const ids = (id: string) => familyOf(id).map(u => u.id);
    expect(ids('andres')).toEqual(['ian', 'luna', 'andres']);
    expect(ids('ian')).toEqual(['ian', 'luna', 'andres']);
    expect(ids('luna')).toEqual(['ian', 'luna', 'andres']);
  });
  it('id desconocido → []; devuelve copias (no se puede tocar el seed)', () => {
    expect(familyOf('nadie')).toEqual([]);
    const fam = familyOf('andres');
    fam[2].dependents!.push('x');
    expect(familyOf('andres')[2].dependents).toEqual(['ian', 'luna']);
  });
});
