import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/* FS-BASE-B (hallazgo space.ts:128, WF3): Mi espacio y la lista de deseos se escriben ANTES de responder. Antes la ruta
   respondía 200, el archivo se escribía 250 ms después en un timer que solo logueaba la falla, y un reinicio de tsx watch
   (o un Ctrl+C) en esa ventana perdía el cambio; con el disco fallando, el chico nunca se enteraba. space.ts, market.ts y
   parent.ts DE VERDAD, con SERVER_ROOT en una carpeta TEMPORAL (server/data no se toca) y un rename que se puede hacer fallar. */

const T = vi.hoisted(() => ({ dir: '', failRenameTo: '' as string, fails: 0 }));
vi.mock('node:fs', async (importOriginal) => {
  const a = await importOriginal<typeof import('node:fs')>();
  return { ...a, renameSync: (...args: Parameters<typeof a.renameSync>) => {
    if (T.fails > 0 && String(args[1]).endsWith(T.failRenameTo)) { T.fails--; throw Object.assign(new Error('EIO simulado'), { code: 'EIO' }); }
    return a.renameSync(...args);
  } };
});
vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  const { mkdtempSync, mkdirSync, writeFileSync: w } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');
  T.dir = mkdtempSync(j(tmpdir(), 'innerith-spacedisk-'));
  mkdirSync(j(T.dir, 'data'));
  const premio = { id: 4, emoji: '🚲', title: 'Bici en la plaza', price: 200, stock: null, archived: false, createdAt: 1 };
  const member = (items: unknown[]) => ({ features: { tienda: true, ligas: true, amigos: true, chat: true }, items, topics: { white: [], black: [] }, extraWords: [], volume: { maxMusic: 100, maxNoise: 100 }, preset: null, feedMotion: 'normal' });
  w(j(T.dir, 'data', 'parent.json'), JSON.stringify({ version: 3, seq: 20, tz: 'UTC', pinHash: '0'.repeat(64), members: { ian: member([premio]), luna: member([]) } }));
  w(j(T.dir, 'data', 'catalog.json'), JSON.stringify([]));
  w(j(T.dir, 'data', 'space.json'), JSON.stringify({ version: 2, seq: 100, users: { ian: { folders: [{ id: 1, name: 'General', parentId: 0, createdAt: 1 }], items: [], playlists: [], follows: [] } } }));
  return { ...actual, SERVER_ROOT: T.dir };
});
vi.mock('../afterday', () => ({ addTrack: () => null, allTracks: () => [], removeTrack: () => false }));
vi.mock('../schedule', () => ({ checkCycle: () => null, cycleOf: () => [], cycleView: () => ({}), saveCycle: () => ({ ok: true }), setFamilyTzSource: () => {} }));
vi.mock('../identity', () => ({ lookOf: () => null, ACCESSORY_IDS: ['gorra', 'vincha', 'lazo', 'anteojos', 'auriculares', 'corona'] }));
vi.mock('../feedFake', () => ({ injectLeagueClose: () => 0 }));

const S = await import('../space');
const M = await import('../market');
await import('../parent');
const { DiskWriteError } = await import('../durable');
const { runAsUser } = await import('../requestContext');
afterAll(() => { rmSync(T.dir, { recursive: true, force: true }); });
beforeEach(() => { T.fails = 0; T.failRenameTo = ''; });

const spaceDisk = () => JSON.parse(readFileSync(join(T.dir, 'data', 'space.json'), 'utf8'));
const folderNames = () => runAsUser('ian', () => S.driveView(0)).folders.map((f: { name: string }) => f.name);

describe('Mi espacio: disco ANTES de responder', () => {
  it('crear una carpeta queda escrito en el acto (antes: 250 ms después, en un timer que un reinicio mataba)', () => {
    runAsUser('ian', () => S.createFolder('Dinosaurios', 0));
    expect(spaceDisk().users.ian.folders.map((f: { name: string }) => f.name)).toContain('Dinosaurios');
  });
  it('si space.json no se escribe: tira DiskWriteError (la ruta responde 500), la carpeta NO queda y el id no se consume', () => {
    const seqBefore = spaceDisk().seq;
    T.failRenameTo = 'space.json'; T.fails = 1;
    expect(() => runAsUser('ian', () => S.createFolder('Volcanes', 0))).toThrow(DiskWriteError);
    expect(folderNames()).not.toContain('Volcanes'); // la RAM volvió a la foto de antes
    expect(spaceDisk().seq).toBe(seqBefore);
    const ok = runAsUser('ian', () => S.createFolder('Volcanes', 0));
    expect(ok.id).toBe(seqBefore); // el reintento usa el mismo id: nada quedó a medias
    expect(folderNames()).toContain('Volcanes');
  });
  it('una papelera que no se pudo guardar no manda nada a la papelera', () => {
    const g = runAsUser('ian', () => S.createFolder('Para tirar', 0));
    T.failRenameTo = 'space.json'; T.fails = 1;
    expect(() => runAsUser('ian', () => S.trashFolder(g.id))).toThrow(DiskWriteError);
    expect(folderNames()).toContain('Para tirar');
    expect(runAsUser('ian', () => S.trashView()).folders).toEqual([]);
  });
});

describe('lista de deseos: disco ANTES de responder', () => {
  const wishDisk = () => (existsSync(join(T.dir, 'data', 'wishlist.json')) ? JSON.parse(readFileSync(join(T.dir, 'data', 'wishlist.json'), 'utf8')).users.ian ?? [] : []);
  it('marcar un deseo con el disco fallando: tira (500), no cambia; el reintento SÍ escribe (antes: "ya estaba" y nada)', () => {
    T.failRenameTo = 'wishlist.json'; T.fails = 1;
    expect(() => runAsUser('ian', () => M.setWish(4, true))).toThrow(DiskWriteError);
    expect(wishDisk()).toEqual([]);
    expect(runAsUser('ian', () => M.listItems()).find((i: { id: number }) => i.id === 4)?.wished).toBe(false);
    expect(runAsUser('ian', () => M.setWish(4, true))).toEqual([4]);
    expect(wishDisk()).toEqual([4]); // escrito en el acto, sin timer
  });
});
