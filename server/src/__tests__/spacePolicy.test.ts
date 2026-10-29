import { rmSync } from 'node:fs';
import { afterAll, describe, expect, it, vi } from 'vitest';

/* Mi espacio con la política vigente (FS-BASE-A): space.ts, parent.ts, filters.ts y videos.ts DE VERDAD, con SERVER_ROOT en
   una carpeta TEMPORAL (parent.json, catalog.json y space.json de fixture; server/data no se toca).
   · hallazgos space.ts:243 / parent.ts:884: Familia → Actividad re-modera lo guardado del integrante con SU política (antes,
     con la del ADULTO del pedido: listaba lo que el Drive del chico ya escondía).
   · faltante 3 del workflow base-review-2: lo persistido que NO es video se re-modera al leer (artículos: lista blanca +
     palabras en el título; imágenes: origen aprobado + palabras en el epígrafe), fail-closed.
   · hallazgo index.ts:212: un id ausente o inválido nunca es la RAÍZ (spaceIdError → 400) y el borrado definitivo es solo
     de lo que está en la papelera. */

const T = vi.hoisted(() => ({ dir: '' }));
vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  const { mkdtempSync, mkdirSync, writeFileSync: w } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');
  T.dir = mkdtempSync(j(tmpdir(), 'innerith-space-'));
  mkdirSync(j(T.dir, 'data'));
  const member = (extraWords: string[], black: string[]) => ({ features: { tienda: true, ligas: true, amigos: true, chat: true }, items: [], topics: { white: [], black }, extraWords, volume: { maxMusic: 100, maxNoise: 100 }, preset: null, feedMotion: 'normal' });
  w(j(T.dir, 'data', 'parent.json'), JSON.stringify({ version: 3, seq: 20, tz: 'UTC', pinHash: '0'.repeat(64), members: { ian: member([], ['tiburones']), luna: member(['volcan'], []) } }));
  const vid = (videoId: string, title: string) => ({ videoId, title, thumb: '', channelId: 'UCx', channelTitle: 'Canal', source: 'Canal', description: '', duration: 60, addedAt: 0, tags: [], topics: [] });
  w(j(T.dir, 'data', 'catalog.json'), JSON.stringify([vid('vvvvvvvvvv1', 'El volcán más grande del mundo'), vid('vvvvvvvvvv2', 'Planetas del sistema solar'), vid('vvvvvvvvvv3', 'Tiburones del Pacífico')]));
  const it = (id: number, type: string, title: string, target: Record<string, string>, extra: Record<string, unknown> = {}) => ({ id, type, title, target, folderId: 1, createdAt: 1000 + id, ...extra });
  const items = [
    it(10, 'video', 'El volcán más grande del mundo', { type: 'video', id: 'vvvvvvvvvv1' }),
    it(11, 'video', 'Planetas del sistema solar', { type: 'video', id: 'vvvvvvvvvv2' }),
    it(12, 'video', 'Tiburones del Pacífico', { type: 'video', id: 'vvvvvvvvvv3' }),
    it(13, 'articulo', 'Volcán activo en Islandia', { type: 'article', url: 'https://es.wikipedia.org/wiki/Hekla' }),
    it(14, 'articulo', 'Saturno', { type: 'article', url: 'https://es.wikipedia.org/wiki/Saturno' }),
    it(15, 'articulo', 'Algo de un sitio cualquiera', { type: 'article', url: 'https://sitio-fuera-de-la-lista.example/nota' }),
    it(16, 'imagen', 'Un dibujo', { type: 'image', url: 'https://example.org/dibujo.png' }, { img: 'https://example.org/dibujo.png' }),
    it(17, 'imagen', 'Gatitos', { type: 'image', url: 'https://pixabay.com/get/gatitos_640.jpg' }, { img: 'https://pixabay.com/get/gatitos_640.jpg' }),
    it(18, 'imagen', 'Un volcán humeante', { type: 'image', url: 'https://upload.wikimedia.org/a/volcan.jpg' }, { img: 'https://upload.wikimedia.org/a/volcan.jpg' }),
  ];
  const space = (id: number) => ({ folders: [{ id, name: 'General', parentId: 0, createdAt: 1 }, { id: id + 1, name: 'Hija', parentId: id, createdAt: 1 }], items: items.map(x => ({ ...x, folderId: id })), playlists: [], follows: [] });
  w(j(T.dir, 'data', 'space.json'), JSON.stringify({ version: 2, seq: 100, users: { luna: space(1), ian: { ...space(3), items: items.map(x => ({ ...x, id: x.id + 50, folderId: 3 })) } } }));
  return { ...actual, SERVER_ROOT: T.dir };
});
vi.mock('../afterday', () => ({ addTrack: () => null, allTracks: () => [], removeTrack: () => false }));
vi.mock('../market', () => ({ deliverRedemption: () => false, listRedemptions: () => [], redeemedCount: () => 0, stockLeft: () => null }));
vi.mock('../schedule', () => ({ checkCycle: () => null, cycleView: () => ({}), saveCycle: () => ({ ok: true }), setFamilyTzSource: () => {} }));
vi.mock('../identity', () => ({ lookOf: () => null }));
vi.mock('../feedFake', () => ({ injectLeagueClose: () => 0 }));

const S = await import('../space');
await import('../parent');
const { runAsUser } = await import('../requestContext');
afterAll(() => { rmSync(T.dir, { recursive: true, force: true }); });

const titles = (xs: { title: string }[]) => xs.map(x => x.title).sort();

describe('Familia → Actividad: lo guardado del integrante con SU política (hallazgos space.ts:243 / parent.ts:884)', () => {
  it('pedido del ADULTO: a Luna se le esconde lo que choca con SU palabra «volcan»; a Ian, con SU tema negro «tiburones»', () => {
    const luna = runAsUser('andres', () => S.allSavedForParent('luna'));
    const ian = runAsUser('andres', () => S.allSavedForParent('ian'));
    expect(titles(luna)).not.toContain('El volcán más grande del mundo');
    expect(titles(luna)).toContain('Tiburones del Pacífico');
    expect(titles(ian)).toContain('El volcán más grande del mundo');
    expect(titles(ian)).not.toContain('Tiburones del Pacífico');
    // lo MISMO que ve cada uno en su Drive
    const driveLuna = runAsUser('luna', () => S.driveView(1)).items.map(i => i.title).sort();
    expect(titles(luna)).toEqual(driveLuna);
  });
});

describe('Mi espacio: lo persistido que NO es video se re-modera al leer (faltante 3), fail-closed', () => {
  it('artículos: título con palabra de la política ✗, sitio fuera de la lista blanca ✗; imágenes: origen no aprobado ✗, epígrafe con palabra ✗', () => {
    const luna = runAsUser('luna', () => S.driveView(1)).items.map(i => i.title).sort();
    expect(luna).toEqual(['Gatitos', 'Planetas del sistema solar', 'Saturno', 'Tiburones del Pacífico']);
    // Ian no tiene la palabra «volcan»: el artículo y la imagen del volcán SÍ (siguen guardados: vuelven si la familia la saca)
    const ian = runAsUser('ian', () => S.driveView(3)).items.map(i => i.title).sort();
    expect(ian).toEqual(['El volcán más grande del mundo', 'Gatitos', 'Planetas del sistema solar', 'Saturno', 'Un volcán humeante', 'Volcán activo en Islandia']);
    // la cuenta de la carpeta también
    expect(runAsUser('luna', () => S.driveView(0)).folders.find(f => f.id === 1)?.count).toBe(1 + 4);
  });

  it('guardar: una imagen de un origen cualquiera no se guarda; un epígrafe con palabra de la política tampoco', () => {
    expect(runAsUser('ian', () => S.saveItem({ folderId: 3, image: { url: 'https://example.org/x.png', caption: 'x' } })).error).toBe('Imagen fuera de los orígenes aprobados');
    expect(runAsUser('luna', () => S.saveItem({ folderId: 1, image: { url: 'https://upload.wikimedia.org/b/v.jpg', caption: 'Volcán de noche' } })).error).toMatch(/palabra bloqueada/);
    expect(runAsUser('ian', () => S.saveItem({ folderId: 3, image: { url: 'https://upload.wikimedia.org/b/v.jpg', caption: 'Volcán de noche' } })).error).toBeUndefined();
  });
});

describe('Papelera: nunca la raíz, y el borrado definitivo es solo de lo que está en la papelera (hallazgo index.ts:212)', () => {
  it('spaceIdError: id ausente, 0, negativo, roto o booleano → 400; los válidos pasan; mover a la raíz vale', () => {
    const P = '/api/space/drive/purge';
    for (const id of [undefined, 0, '0', -1, 'abc', '', true, 1.5, null, '1e3']) expect(S.spaceIdError(P, { kind: 'folder', id }), String(id)).toMatch(/id entero positivo/);
    expect(S.spaceIdError(P, { kind: 'folder', id: 7 })).toBeNull();
    expect(S.spaceIdError(P, { kind: 'folder', id: '7' })).toBeNull();
    for (const p of ['/api/space/drive/folder/trash', '/api/space/drive/restore', '/api/space/drive/item/trash', '/api/space/drive/folder/move', '/api/space/drive/item/move', '/api/space/drive/folder/update'])
      expect(S.spaceIdError(p, {}), p).not.toBeNull();
    expect(S.spaceIdError('/api/space/drive/folder/move', { id: 2, parentId: 0 })).toBeNull();
    expect(S.spaceIdError('/api/space/drive/folder/move', { id: 2, parentId: -3 })).toMatch(/destino/);
    expect(S.spaceIdError('/api/space/save', {})).toBeNull(); // las que no son sobre UN id no se tocan
    expect(S.spaceIdError('/api/space/drive/folder', { name: 'x' })).toBeNull();
  });

  it('purgeFolder(0) no borra NADA (antes: todo el Mi espacio); una carpeta viva tampoco se purga; en la papelera, sí', () => {
    const before = runAsUser('luna', () => S.folderTree()).folders.length;
    expect(runAsUser('luna', () => S.purgeFolder(0))).toBe(false);
    expect(runAsUser('luna', () => S.purgeFolder(1))).toBe(false); // viva
    expect(runAsUser('luna', () => S.folderTree()).folders.length).toBe(before);
    expect(runAsUser('luna', () => S.purgeItem(11))).toBe(false); // un archivo vivo tampoco
    runAsUser('luna', () => S.trashFolder(2));
    expect(runAsUser('luna', () => S.purgeFolder(2))).toBe(true);
    expect(runAsUser('luna', () => S.folderTree()).folders.map(f => f.id)).toEqual([1]);
  });
});
