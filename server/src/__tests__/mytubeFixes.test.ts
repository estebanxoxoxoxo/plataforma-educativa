import { rmSync } from 'node:fs';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/* MyTube (FS-BASE-A, hallazgos del workflow base-review-2): mytube.ts, videos.ts, space.ts y parent.ts DE VERDAD con
   SERVER_ROOT en una carpeta TEMPORAL (catálogo base de fixture, mytube.json nace solo; server/data no se toca), YouTube y
   noembed simulados con un fetch falso y un renameSync que falla a pedido.
   · :599 — con noembed caído, un video suelto NO queda con el videoId como título (el de videos.list) y la reingesta no pisa
     un título real con el id; sin título real, el alta se rechaza (fail-closed: las palabras bloqueadas no verían el video).
   · :153 — save() que no pudo escribir: el panel recibe el fallo real (antes ok:true y un reinicio revertía el cambio).
   · :787 — con channels.list fallando, el canal no queda "pending" durante el enfriamiento.
   · :293 — parseYtUrl: /shorts/ y /embed/ sin id, e ids con forma inválida → null. */

const F = vi.hoisted(() => ({ failRename: 0 }));
vi.mock('node:fs', async (importOriginal) => {
  const a = await importOriginal<typeof import('node:fs')>();
  return { ...a, renameSync: (...args: Parameters<typeof a.renameSync>) => {
    if (F.failRename > 0) { F.failRename--; throw Object.assign(new Error('ENOSPC simulado'), { code: 'ENOSPC' }); }
    return a.renameSync(...args);
  } };
});
const T = vi.hoisted(() => ({ dir: '' }));
vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  const { mkdtempSync, mkdirSync, writeFileSync: w } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');
  T.dir = mkdtempSync(j(tmpdir(), 'innerith-mytube-'));
  mkdirSync(j(T.dir, 'data'));
  const member = () => ({ features: { tienda: true, ligas: true, amigos: true, chat: true }, items: [], topics: { white: [], black: [] }, extraWords: [], volume: { maxMusic: 100, maxNoise: 100 }, preset: null, feedMotion: 'normal' });
  w(j(T.dir, 'data', 'parent.json'), JSON.stringify({ version: 3, seq: 20, tz: 'UTC', pinHash: '0'.repeat(64), members: { ian: member(), luna: member() } }));
  w(j(T.dir, 'data', 'catalog.json'), JSON.stringify([{ videoId: 'BBBBBBBBBBB', title: 'Video base', thumb: '', channelId: 'UCbase', channelTitle: 'Canal base', source: 'Canal base', description: '', duration: 60, addedAt: 0, tags: [], topics: [] }]));
  return { ...actual, SERVER_ROOT: T.dir };
});
vi.mock('../afterday', () => ({ addTrack: () => null, allTracks: () => [], removeTrack: () => false }));
vi.mock('../market', () => ({ deliverRedemption: () => false, listRedemptions: () => [], redeemedCount: () => 0, stockLeft: () => null }));
vi.mock('../schedule', () => ({ checkCycle: () => null, cycleView: () => ({}), saveCycle: () => ({ ok: true }), setFamilyTzSource: () => {} }));
vi.mock('../identity', () => ({ lookOf: () => null }));
vi.mock('../feedFake', () => ({ injectLeagueClose: () => 0 }));

/** YouTube y noembed simulados: cada servicio responde lo que diga el caso. */
const Y = vi.hoisted(() => ({ noembed: 'falla' as 'falla' | string, videos: 'ok' as 'ok' | 'falla', channels: 'ok' as 'ok' | 'falla', title: 'Cómo se forman los volcanes' }));
const fakeFetch = async (url: string) => {
  const u = new URL(url);
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  if (u.hostname === 'noembed.com') { if (Y.noembed === 'falla') throw new Error('noembed caído'); return json({ title: Y.noembed }); }
  if (u.pathname.endsWith('/videos')) {
    if (Y.videos === 'falla') return json({ error: 'cuota' }, 403);
    return json({ items: (u.searchParams.get('id') ?? '').split(',').map(id => ({ id, snippet: { title: Y.title, channelId: 'UCfam', channelTitle: 'Canal F' }, contentDetails: { duration: 'PT2M' } })) });
  }
  if (u.pathname.endsWith('/channels')) return Y.channels === 'falla' ? json({ error: 'x' }, 500) : json({ items: [] });
  return json({ items: [] });
};
vi.stubGlobal('fetch', fakeFetch);
process.env.YOUTUBE_API_KEY = 'clave-falsa-de-test';
delete process.env.OPENAI_API_KEY;

const MT = await import('../mytube');
const V = await import('../videos');
const { runAsUser } = await import('../requestContext');
afterAll(() => { rmSync(T.dir, { recursive: true, force: true }); vi.unstubAllGlobals(); });

function call(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;
  Object.assign(req, { method, url: path, headers: { 'x-innerith-user': 'andres' } });
  return new Promise(resolve => {
    let status = 0;
    const res = { writeHead: (s: number) => { status = s; }, end: (raw: string) => resolve({ status, body: JSON.parse(raw) }) } as unknown as ServerResponse;
    void runAsUser('andres', () => MT.mytubeRoutes(req, res, new URL(path, 'http://localhost')));
  });
}
beforeEach(() => { Y.noembed = 'falla'; Y.videos = 'ok'; Y.channels = 'ok'; F.failRename = 0; });

describe('parseYtUrl (hallazgo mytube.ts:293)', () => {
  it('/shorts/ y /embed/ sin id, e ids con forma inválida → null; los válidos pasan', () => {
    for (const u of ['https://www.youtube.com/shorts/', 'https://youtube.com/shorts/?feature=share', 'https://www.youtube.com/embed/', 'https://youtu.be/', 'https://www.youtube.com/watch?v=abc%20%3Cb%3E', 'https://www.youtube.com/watch?v=short', 'https://youtu.be/abc'])
      expect(MT.parseYtUrl(u), u).toBeNull();
    expect(MT.parseYtUrl('https://www.youtube.com/shorts/AAAAAAAAAAA')).toEqual({ type: 'video', id: 'AAAAAAAAAAA' });
    expect(MT.parseYtUrl('https://www.youtube.com/embed/A-_AAAAAAAA')).toEqual({ type: 'video', id: 'A-_AAAAAAAA' });
    expect(MT.parseYtUrl('https://youtu.be/AAAAAAAAAAA')).toEqual({ type: 'video', id: 'AAAAAAAAAAA' });
    expect(MT.parseYtUrl('https://www.youtube.com/watch?v=AAAAAAAAAAA')).toEqual({ type: 'video', id: 'AAAAAAAAAAA' });
    expect(MT.parseYtUrl('https://www.youtube.com/@canal')).toEqual({ type: 'canal', handle: '@canal' });
  });
});

describe('título de un video suelto con noembed caído (hallazgo mytube.ts:599)', () => {
  it('el alta toma el título de videos.list (no el videoId): las palabras bloqueadas lo ven', async () => {
    const r = await call('POST', '/api/mytube/admin/add', { url: 'https://youtu.be/AAAAAAAAAAA' });
    expect(r.body).toMatchObject({ ok: true, added: 1, title: 'Cómo se forman los volcanes' });
    expect(V.getCatalogVideo('AAAAAAAAAAA')?.title).toBe('Cómo se forman los volcanes');
    expect((await call('GET', '/api/mytube/admin/state')).body.entries.find((e: { url: string }) => e.url.includes('AAAAAAAAAAA')).title).toBe('Cómo se forman los volcanes');
  });

  it('la reingesta con noembed Y videos.list caídos no pisa el título real con el id', async () => {
    Y.videos = 'falla';
    const id = (await call('GET', '/api/mytube/admin/state')).body.entries.find((e: { url: string }) => e.url.includes('AAAAAAAAAAA')).id;
    expect((await call('POST', '/api/mytube/admin/reingest', { id })).body.ok).toBe(true);
    expect(V.getCatalogVideo('AAAAAAAAAAA')?.title).toBe('Cómo se forman los volcanes');
    expect((await call('GET', '/api/mytube/admin/state')).body.entries.find((e: { id: number }) => e.id === id).title).toBe('Cómo se forman los volcanes');
  });

  it('sin ningún título real, el alta se rechaza (fail-closed) y no queda nada aprobado', async () => {
    Y.videos = 'falla';
    const r = await call('POST', '/api/mytube/admin/add', { url: 'https://youtu.be/CCCCCCCCCCC' });
    expect(r.body).toEqual({ ok: false, error: 'Sin título no se puede revisar el video (YouTube no respondió). Probá más tarde.' });
    expect(V.getCatalogVideo('CCCCCCCCCCC')).toBeUndefined();
  });
});

describe('save() que no pudo escribir: el panel recibe el fallo real (hallazgo mytube.ts:153)', () => {
  it('alta: {ok:false} y NO queda aprobada en RAM; quitar: {ok:false} (sigue quitada); tope: 500; descripción: {ok:false}', async () => {
    F.failRename = 99;
    const add = await call('POST', '/api/mytube/admin/add', { url: 'https://youtu.be/DDDDDDDDDDD' });
    expect(add.body).toEqual({ ok: false, error: 'No pude guardar en disco (mytube.json). Probá de nuevo.' });
    expect(V.getCatalogVideo('DDDDDDDDDDD')).toBeUndefined();
    F.failRename = 0;
    const id = (await call('GET', '/api/mytube/admin/state')).body.entries[0].id;
    F.failRename = 99;
    expect((await call('POST', '/api/mytube/admin/remove', { id })).body).toEqual({ ok: false, error: 'No pude guardar en disco (mytube.json). Probá de nuevo.' });
    expect(V.getCatalogVideo('AAAAAAAAAAA')).toBeUndefined(); // en RAM sí se quitó (lo des-aprobado no se muestra)
    expect((await call('POST', '/api/mytube/admin/cap', { cap: '10' })).status).toBe(500);
    expect((await call('POST', '/api/mytube/admin/channel-desc', { channelId: 'UCbase', desc: 'x' })).body).toEqual({ ok: false, error: 'No pude guardar en disco (mytube.json). Probá de nuevo.' });
    F.failRename = 0;
    // el reintento de "quitar" escribe y responde ok
    expect((await call('POST', '/api/mytube/admin/remove', { id })).body).toEqual({ ok: true });
  });
});

describe('channels.list fallando no deja el canal "pending" (hallazgo mytube.ts:787)', () => {
  it('después del intento fallido, los GET siguientes responden pending:false (antes: true durante 30 min)', async () => {
    Y.channels = 'falla';
    const first = await call('GET', '/api/mytube/channel?id=UCbase');
    expect(first.body.channel.channelId).toBe('UCbase');
    for (let i = 0; i < 20 && first.body.pending; i++) await new Promise(r => setTimeout(r, 10)); // que termine el job de fondo
    await new Promise(r => setTimeout(r, 30));
    const again = await call('GET', '/api/mytube/channel?id=UCbase');
    expect(again.body.pending).toBe(false);
  });
});
