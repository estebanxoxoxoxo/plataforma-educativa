import { describe, expect, it } from 'vitest';
import { upgradeLearnRaw, upgradeSpaceRaw, upgradeWishRaw } from '../userDataMigrate';

/* U4 (cada uno lo suyo): las migraciones PURAS de learn-results.json, wishlist.json y space.json (v1 → v2: todo lo
   existente pasa a `ian`). El respaldo .pre-v2, el saneo fila por fila y la copia .roto-* los hacen los módulos al cargar:
   acá solo la FORMA, que es lo que no se puede romper sin perder lo de Ian. */

const ROW_A = { id: 1, target: 'ruta.x.m.a.check', source: 'ruta:ruta.x/posta:a.check', typeId: 'multiplechoice', outcome: 'completed', score: 20, maxScore: 20, pct: 1, finishedAt: 10 };
const ROW_B = { id: 7, target: 'ruta.x.m.b.check', source: 'ruta:ruta.x/posta:b.check', typeId: 'flashcards', outcome: 'aborted', score: 0, maxScore: 5, pct: 0, finishedAt: 20 };
const DEMO = ['UC-demo-1', 'UC-demo-2', 'UC-demo-3'] as const;

describe('upgradeLearnRaw', () => {
  it('v1 (array) → v2: TODAS las filas pasan intactas y en orden a users[owner]', () => {
    const v1 = [ROW_A, ROW_B];
    const up = upgradeLearnRaw(v1, 'ian');
    expect(up.from).toBe(1);
    expect(up.raw).toEqual({ version: 2, users: { ian: [ROW_A, ROW_B] } });
    expect((up.raw.users.ian as unknown[])[0]).toBe(ROW_A); // las mismas filas, sin copiar ni tocar
  });
  it('v1 vacío → v2 con el dueño y sin filas', () => {
    expect(upgradeLearnRaw([], 'ian').raw).toEqual({ version: 2, users: { ian: [] } });
  });
  it('v2 pasa igual (from 2, mismo objeto)', () => {
    const v2 = { version: 2, users: { ian: [ROW_A], luna: [ROW_B] } };
    const up = upgradeLearnRaw(v2, 'ian');
    expect(up.from).toBe(2);
    expect(up.raw).toBe(v2);
  });
  it('v2 sin users, versión desconocida, no-objeto/no-array → tira (el módulo lo trata como ilegible)', () => {
    expect(() => upgradeLearnRaw({ version: 2 }, 'ian')).toThrow();
    expect(() => upgradeLearnRaw({ version: 2, users: [] }, 'ian')).toThrow();
    expect(() => upgradeLearnRaw({ version: 3, users: {} }, 'ian')).toThrow();
    expect(() => upgradeLearnRaw({ rows: [ROW_A] }, 'ian')).toThrow();
    expect(() => upgradeLearnRaw(null, 'ian')).toThrow();
    expect(() => upgradeLearnRaw('[]', 'ian')).toThrow();
    expect(() => upgradeLearnRaw(42, 'ian')).toThrow();
  });
});

describe('upgradeWishRaw', () => {
  it('v1 [2,4] → v2 { users: { ian: [2,4] } } (orden conservado: del más reciente al más viejo)', () => {
    const up = upgradeWishRaw([2, 4], 'ian');
    expect(up.from).toBe(1);
    expect(up.raw).toEqual({ version: 2, users: { ian: [2, 4] } });
  });
  it('v1 con basura pasa TAL CUAL (el saneo —cleanWish— lo hace market.ts al cargar)', () => {
    expect(upgradeWishRaw([4, 'x', 4, -1], 'ian').raw).toEqual({ version: 2, users: { ian: [4, 'x', 4, -1] } });
  });
  it('v2 pasa igual', () => {
    const v2 = { version: 2, users: { ian: [2, 4], luna: [11] } };
    const up = upgradeWishRaw(v2, 'ian');
    expect(up.from).toBe(2);
    expect(up.raw).toBe(v2);
  });
  it('v2 sin users, objeto suelto o escalar → tira', () => {
    expect(() => upgradeWishRaw({ version: 2 }, 'ian')).toThrow();
    expect(() => upgradeWishRaw({}, 'ian')).toThrow();
    expect(() => upgradeWishRaw(null, 'ian')).toThrow();
    expect(() => upgradeWishRaw(7, 'ian')).toThrow();
  });
});

describe('upgradeSpaceRaw', () => {
  const FOLDERS = [{ id: 1, name: 'carpeta1', parentId: 0, createdAt: 1 }, { id: 3, name: 'otra', parentId: 1, createdAt: 3 }];
  const ITEMS = [{ id: 2, type: 'video', title: 'V', target: { type: 'video', id: 'abc' }, folderId: 1, createdAt: 2 }];
  const LISTS = [{ id: 5, name: 'Música para estudiar', videoIds: ['abc', 'def'], createdAt: 5 }];
  const FOLLOWS = ['UC-a', 'UC-b'];

  it('v1 (el de hoy) → v2: todo intacto y en orden en users[owner]; seq de la familia; follows propios', () => {
    const v1 = { seq: 6, folders: FOLDERS, items: ITEMS, playlists: LISTS, follows: FOLLOWS };
    const up = upgradeSpaceRaw(v1, 'ian', DEMO);
    expect(up.from).toBe(1);
    expect(up.raw).toEqual({ version: 2, seq: 6, users: { ian: { folders: FOLDERS, items: ITEMS, playlists: LISTS, follows: FOLLOWS } } });
    // nada queda colgado en el top-level
    for (const k of ['folders', 'items', 'playlists', 'follows']) expect(k in up.raw).toBe(false);
  });
  it('A8: v1 con follows vacío → los de demo (la conducta de antes, UNA vez)', () => {
    const up = upgradeSpaceRaw({ seq: 2, folders: FOLDERS, items: [], playlists: [], follows: [] }, 'ian', DEMO);
    expect((up.raw.users.ian as { follows: string[] }).follows).toEqual([...DEMO]);
  });
  it('A8: v1 sin follows → los de demo (copia: no comparte el array de la constante)', () => {
    const up = upgradeSpaceRaw({ seq: 2 }, 'ian', DEMO);
    const f = (up.raw.users.ian as { follows: string[] }).follows;
    expect(f).toEqual([...DEMO]);
    expect(f).not.toBe(DEMO);
  });
  it('v1 sin seq (o seq inválido) → seq 1; listas ausentes o que no son array → []', () => {
    expect(upgradeSpaceRaw({ folders: FOLDERS }, 'ian', DEMO).raw.seq).toBe(1);
    expect(upgradeSpaceRaw({ seq: 0 }, 'ian', DEMO).raw.seq).toBe(1);
    expect(upgradeSpaceRaw({ seq: 'x' }, 'ian', DEMO).raw.seq).toBe(1);
    const up = upgradeSpaceRaw({ seq: 3, folders: 'no', items: { a: 1 } }, 'ian', DEMO);
    expect(up.raw.users.ian).toEqual({ folders: [], items: [], playlists: [], follows: [...DEMO] });
  });
  it('v1 vacío ({}) → el espacio de ian vacío con los seguidos de demo', () => {
    expect(upgradeSpaceRaw({}, 'ian', DEMO).raw).toEqual({ version: 2, seq: 1, users: { ian: { folders: [], items: [], playlists: [], follows: [...DEMO] } } });
  });
  it('v2 pasa igual (from 2, mismo objeto)', () => {
    const v2 = { version: 2, seq: 9, users: { ian: { folders: FOLDERS, items: ITEMS, playlists: LISTS, follows: FOLLOWS }, luna: { folders: [], items: [], playlists: [], follows: [] } } };
    const up = upgradeSpaceRaw(v2, 'ian', DEMO);
    expect(up.from).toBe(2);
    expect(up.raw).toBe(v2);
  });
  it('v2 sin users → tira; no-objeto (array, null, escalar) → tira', () => {
    expect(() => upgradeSpaceRaw({ version: 2, seq: 3 }, 'ian', DEMO)).toThrow();
    expect(() => upgradeSpaceRaw({ version: 2, users: [] }, 'ian', DEMO)).toThrow();
    expect(() => upgradeSpaceRaw([], 'ian', DEMO)).toThrow();
    expect(() => upgradeSpaceRaw(null, 'ian', DEMO)).toThrow();
    expect(() => upgradeSpaceRaw('space', 'ian', DEMO)).toThrow();
  });
});
