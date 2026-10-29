import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/* FS-BASE-B, parent.ts DE VERDAD con SERVER_ROOT en una carpeta TEMPORAL (server/data no se toca; patrón de
   alertsPersist.test):
   · hallazgo parent.ts:732: si parent.json no se escribe, el cambio NO rige en RAM y el reintento vuelve a escribir (antes
     el candado regía igual, el reintento caía en "sin cambios" y respondía 200 sin guardar; un premio fallido quedaba
     canjeable y el reintento lo duplicaba con otro id).
   · hallazgo familyMigrate.ts:31: una `version` desconocida es un archivo ilegible: queda ENTERO en .roto-* y arranca
     CERRADO (antes se "migraba" como un v1: Luna con la config de fábrica, todo prendido).
   · hallazgo videos.ts:113, la misma regla en topicHit: el plural -z/-ces de los temas NEGROS. */

const T = vi.hoisted(() => ({ dir: '', failRename: 0 }));
vi.mock('node:fs', async (importOriginal) => {
  const a = await importOriginal<typeof import('node:fs')>();
  return { ...a, renameSync: (...args: Parameters<typeof a.renameSync>) => {
    if (T.failRename > 0 && String(args[1]).endsWith('parent.json')) { T.failRename--; throw Object.assign(new Error('EBUSY simulado'), { code: 'EBUSY' }); }
    return a.renameSync(...args);
  } };
});
const member = () => ({ features: { tienda: true, ligas: true, amigos: true, chat: true }, items: [], topics: { white: [], black: [] }, extraWords: [], volume: { maxMusic: 100, maxNoise: 100 }, preset: null, feedMotion: 'normal' });
const SEED = () => JSON.stringify({ version: 3, seq: 20, tz: 'UTC', pinHash: '0'.repeat(64), members: { ian: member(), luna: member() } });
vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  const { mkdtempSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');
  T.dir = mkdtempSync(j(tmpdir(), 'innerith-parentdisk-'));
  mkdirSync(j(T.dir, 'data'));
  return { ...actual, SERVER_ROOT: T.dir };
});
vi.mock('../afterday', () => ({ addTrack: () => null, allTracks: () => [], removeTrack: () => false }));
vi.mock('../market', () => ({ deliverRedemption: () => false, listRedemptions: () => [], redeemedCount: () => 0, stockLeft: () => null }));
vi.mock('../schedule', () => ({ checkCycle: () => null, cycleOf: () => [], cycleView: () => ({}), saveCycle: () => ({ ok: true }), setFamilyTzSource: () => {} }));
vi.mock('../space', () => ({ allSavedForParent: () => [] }));
vi.mock('../videos', () => ({ catalogSize: () => 0 }));
vi.mock('../identity', () => ({ lookOf: () => null }));
vi.mock('../feedFake', () => ({ injectLeagueClose: () => 0 }));

await import('../config'); // crea la carpeta temporal (el mock de config la arma)
const FILE = () => join(T.dir, 'data', 'parent.json');
const disk = () => JSON.parse(readFileSync(FILE(), 'utf8'));
afterAll(() => { rmSync(T.dir, { recursive: true, force: true }); });
beforeEach(() => { T.failRename = 0; });

/** Un server recién prendido sobre el parent.json que haya en la carpeta. */
async function boot(text = SEED()) {
  for (const f of readdirSync(join(T.dir, 'data'))) rmSync(join(T.dir, 'data', f), { force: true });
  writeFileSync(FILE(), text);
  vi.resetModules();
  const P = await import('../parent');
  const { runAsUser } = await import('../requestContext');
  const call = (method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> => {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;
    Object.assign(req, { method, url: path, headers: { 'x-innerith-user': 'andres' } });
    return new Promise(resolve => {
      let status = 0;
      const res = { writeHead: (s: number) => { status = s; }, end: (raw: string) => resolve({ status, body: JSON.parse(raw) }) } as unknown as ServerResponse;
      void runAsUser('andres', () => P.parentRoutes(req, res, new URL(path, 'http://localhost')));
    });
  };
  return { P, call };
}

describe('Familia: disco PRIMERO (hallazgo parent.ts:732)', () => {
  it('apagar Amigos de Luna con el disco fallando: 500 y el candado NO rige; el reintento SÍ escribe (antes: 200 sin guardar)', async () => {
    const { P, call } = await boot();
    T.failRename = 1;
    expect((await call('POST', '/api/parent/features?member=luna', { key: 'amigos', on: false })).status).toBe(500);
    expect(P.featureOn('amigos', 'luna')).toBe(true); // la RAM quedó como el disco
    expect((await call('GET', '/api/parent/config?member=luna')).body.features.amigos).toBe(true);
    expect(disk().members.luna.features.amigos).toBe(true);
    const retry = await call('POST', '/api/parent/features?member=luna', { key: 'amigos', on: false });
    expect(retry).toMatchObject({ status: 200, body: { amigos: false } });
    expect(disk().members.luna.features.amigos).toBe(false); // antes el reintento caía en "sin cambios" y no escribía
    expect(P.featureOn('amigos', 'luna')).toBe(false);
  });

  it('un premio que no se guardó no queda canjeable y el reintento NO lo duplica (mismo id)', async () => {
    const { P, call } = await boot();
    const item = { emoji: '🎮', title: 'Media hora de juego', price: 150 };
    T.failRename = 1;
    expect(await call('POST', '/api/parent/items?member=luna', item)).toMatchObject({ status: 400, body: { error: 'No pude guardar el premio. Probá de nuevo.' } });
    expect(P.memberItemsOf('luna')).toEqual([]);
    const ok = await call('POST', '/api/parent/items?member=luna', item);
    expect(ok.status).toBe(200);
    expect(ok.body.id).toBe(20); // el seq de la familia no se consumió en el intento fallido
    expect(P.memberItemsOf('luna').map(i => i.id)).toEqual([20]);
    expect(disk().members.luna.items.map((i: { id: number }) => i.id)).toEqual([20]);
  });

  it('la zona de la familia y las palabras: si no se guardan, no rigen', async () => {
    const { P, call } = await boot();
    T.failRename = 2;
    expect((await call('POST', '/api/parent/tz', { tz: 'America/Chicago' })).status).toBe(400);
    expect(P.familyTz()).toBe('UTC');
    expect((await call('POST', '/api/parent/words?member=luna', { extra: ['tonto'] })).status).toBe(400);
    expect((await call('GET', '/api/parent/config?member=luna')).body.words.extra).toEqual([]);
    expect((await call('POST', '/api/parent/tz', { tz: 'America/Chicago' })).body).toEqual({ tz: 'America/Chicago' });
    expect(disk().tz).toBe('America/Chicago');
  });
});

describe('parent.json con una versión DESCONOCIDA (hallazgo familyMigrate.ts:31)', () => {
  for (const version of ['3', 4]) {
    it(`version ${JSON.stringify(version)}: queda ENTERO en .roto-* y arranca CERRADO (antes: Luna con todo prendido)`, async () => {
      const raw = JSON.stringify({ version, seq: 30, tz: null, pinHash: '1'.repeat(64), members: { ian: { ...member(), features: { tienda: true, ligas: true, amigos: false, chat: false } } } });
      const { P } = await boot(raw);
      for (const id of ['ian', 'luna']) for (const k of ['chat', 'amigos', 'tienda', 'ligas'] as const) expect(P.featureOn(k, id), `${id}.${k}`).toBe(false);
      const roto = readdirSync(join(T.dir, 'data')).filter(f => f.startsWith('parent.json.roto-'));
      expect(roto).toHaveLength(1);
      expect(readFileSync(join(T.dir, 'data', roto[0]), 'utf8')).toBe(raw); // el original no se pierde
      expect(disk().version).toBe(3);
    });
  }
});

describe('topicHit: el plural -z/-ces de los temas NEGROS (hallazgo videos.ts:113)', () => {
  it('"disfraz" pega con "Disfraces…", "cruz" con "cruces" y "avestruces" con "avestruz" (antes, no: fail-open angosto)', async () => {
    const { P } = await boot();
    expect(P.topicHit('Disfraces para chicos', ['disfraz'])).toBe('disfraz');
    expect(P.topicHit('Las cruces del camino', ['cruz'])).toBe('cruz');
    expect(P.topicHit('Un avestruz gigante', ['avestruces'])).toBe('avestruces');
    expect(P.topicHit('Volcanes de Argentina', ['volcán'])).toBe('volcán'); // lo de siempre sigue igual
    expect(P.topicHit('Cruzando el río', ['cruz'])).toBeNull(); // palabra entera: no por raíz
  });
});
