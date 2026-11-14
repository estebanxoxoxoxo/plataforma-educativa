import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterAll, describe, expect, it, vi } from 'vitest';

/* i18n (regla del dueño, 10-nov): en INGLÉS no se sirve contenido real en castellano — videos.ts (channelLangEs /
   videoVisibleNow y el filtro DENTRO de searchVideos/searchVideosStrict/relatedVideos/getVideo), mytube.ts (vistas del
   chico), afterday.ts (la lista del chico), space.ts (Drive, papelera y listas) y chat.ts (resolveMedia). Todo DE VERDAD con
   SERVER_ROOT en una carpeta TEMPORAL con datos de fixture (server/data no se toca; el patrón de mytubeFixes.test.ts). En
   castellano (el default, también fuera de un pedido) todo sale idéntico a antes. */

const T = vi.hoisted(() => ({ dir: '' }));
const FIX = vi.hoisted(() => {
  const v = (videoId: string, title: string, channelId: string, channelTitle: string, tags: string[] = ['ciencia']) => ({
    videoId, title, thumb: '', channelId, channelTitle, source: `Canal ${channelTitle} (9 videos)`, description: '', duration: 300, addedAt: 0, tags, topics: [],
  });
  const catalog = [
    v('ES_numeros1', 'CANCIÓN de los NÚMEROS del 1 al 20 🎵 ¡Aprende a contar!', 'UCes', 'Smile and Learn - Español'),
    v('ES_volcan01', 'Volcanes de Argentina', 'UCes2', 'Veritasium en español'),
    v('EN_volcano1', 'How volcanoes work', 'UCen', 'Veritasium'),
    v('EN_numbers1', 'The counting song', 'UCen', 'Veritasium'),
    v('EN_spanish1', 'Palabras de Inspiración: El poder de la humildad', 'UCen', 'Veritasium'), // canal inglés, título castellano
    v('EN_lalaland', 'La La Land piano theme', 'UCen', 'Veritasium'), // «la» suelto no es castellano
  ];
  const mytube = {
    version: 1, entrySeq: 1, videoSeq: 1, videoCap: 500, entries: [], videos: [],
    channels: [
      { channelId: 'UCen', title: 'Veritasium', descRaw: 'An element of truth - videos about science.', desc: 'Es un canal de ciencia con experimentos.', createdAt: 1, metaAt: 1, descTriedAt: 1, playlistsAt: 1 },
      { channelId: 'UCes', title: 'Smile and Learn - Español', descRaw: 'Canal educativo para niños.', desc: 'Canal para aprender jugando.', createdAt: 1, metaAt: 1, descTriedAt: 1, playlistsAt: 1 },
    ],
    playlists: [
      { playlistId: 'PLmixed', channelId: 'UCen', title: 'Science mix', videoIds: ['EN_volcano1', 'EN_spanish1'], createdAt: 1 },
      { playlistId: 'PLonlyes', channelId: 'UCen', title: 'Inspiration', videoIds: ['EN_spanish1'], createdAt: 1 },
      { playlistId: 'PLestitle', channelId: 'UCen', title: 'Videos para aprender más', videoIds: ['EN_volcano1'], createdAt: 1 },
      { playlistId: 'PLes', channelId: 'UCes', title: 'Números', videoIds: ['ES_numeros1'], createdAt: 1 },
    ],
  };
  const item = (id: number, vid: string, title: string, folderId: number, trashedAt?: number) =>
    ({ id, type: 'video', title, img: '', subtitle: '', target: { type: 'video', id: vid }, folderId, createdAt: id, ...(trashedAt ? { trashedAt } : {}) });
  const space = {
    version: 2, seq: 40, users: {
      ian: {
        folders: [
          { id: 1, name: 'Favoritos', parentId: 0, createdAt: 1 },
          { id: 2, name: 'Matematica', parentId: 0, createdAt: 2 },
          { id: 3, name: 'otra', parentId: 1, createdAt: 3, trashedAt: 100 },
        ],
        items: [
          item(10, 'ES_numeros1', 'CANCIÓN de los NÚMEROS del 1 al 20 🎵 ¡Aprende a contar!', 1),
          item(11, 'EN_volcano1', 'How volcanoes work', 1),
          item(12, 'ES_volcan01', 'Volcanes de Argentina', 1),
          item(13, 'ES_volcan01', 'Volcanes de Argentina', 2),
          item(14, 'ES_numeros1', 'CANCIÓN de los NÚMEROS del 1 al 20 🎵 ¡Aprende a contar!', 2, 100), // papelera
          item(15, 'EN_numbers1', 'The counting song', 2, 100), // papelera
          { id: 16, type: 'articulo', title: '¿Cómo se forman los volcanes?', target: { type: 'article', url: 'https://es.wikipedia.org/wiki/Volc%C3%A1n' }, folderId: 2, createdAt: 16 },
        ],
        playlists: [{ id: 20, name: 'mi lista', videoIds: ['ES_numeros1', 'EN_numbers1', 'EN_volcano1'], createdAt: 20 }],
        follows: ['UCes', 'UCen', 'UCes2'],
      },
    },
  };
  const music = [
    { videoId: 'lf6aHZOj4xA', url: 'https://www.youtube.com/watch?v=lf6aHZOj4xA', title: 'El Sonido Más Poderoso para Dormir Rápido – Lluvia con Truenos Toda la Noche', thumb: 't', addedAt: 3 },
    { videoId: 'rainEN00001', url: 'https://www.youtube.com/watch?v=rainEN00001', title: 'Rain Sounds for Sleeping - 10 Hours', thumb: 't', addedAt: 2 },
    { videoId: 'ES_numeros1', url: 'https://www.youtube.com/watch?v=ES_numeros1', thumb: 't', addedAt: 1 }, // sin título: decide su canal
  ];
  return { catalog, mytube, space, music };
});
vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  const { mkdtempSync, mkdirSync, writeFileSync: w } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');
  T.dir = mkdtempSync(j(tmpdir(), 'innerith-i18nvideos-'));
  mkdirSync(j(T.dir, 'data'));
  const member = () => ({ features: { tienda: true, ligas: true, amigos: true, chat: true }, items: [], topics: { white: [], black: [] }, extraWords: [], volume: { maxMusic: 100, maxNoise: 100 }, preset: null, feedMotion: 'normal' });
  w(j(T.dir, 'data', 'parent.json'), JSON.stringify({ version: 3, seq: 20, tz: 'UTC', pinHash: '0'.repeat(64), members: { ian: member(), luna: member() } }));
  w(j(T.dir, 'data', 'catalog.json'), JSON.stringify(FIX.catalog));
  w(j(T.dir, 'data', 'mytube.json'), JSON.stringify(FIX.mytube));
  w(j(T.dir, 'data', 'space.json'), JSON.stringify(FIX.space));
  w(j(T.dir, 'data', 'music.json'), JSON.stringify(FIX.music));
  return { ...actual, SERVER_ROOT: T.dir };
});
vi.mock('../market', () => ({ deliverRedemption: () => false, listRedemptions: () => [], redeemedCount: () => 0, stockLeft: () => null }));
vi.mock('../schedule', () => ({ checkCycle: () => null, cycleView: () => ({}), saveCycle: () => ({ ok: true }), setFamilyTzSource: () => {} }));
vi.mock('../identity', () => ({ lookOf: () => null }));
vi.mock('../feedFake', () => ({ injectLeagueClose: () => 0 }));
vi.stubGlobal('fetch', async () => { throw new Error('sin red en el test'); });
delete process.env.YOUTUBE_API_KEY;
delete process.env.OPENAI_API_KEY;

const V = await import('../videos');
const MT = await import('../mytube');
const SP = await import('../space');
const AD = await import('../afterday');
const { runAsUser } = await import('../requestContext');
afterAll(() => { rmSync(T.dir, { recursive: true, force: true }); vi.unstubAllGlobals(); });

const en = <R,>(fn: () => R) => runAsUser('ian', fn, 'en');
const es = <R,>(fn: () => R) => runAsUser('ian', fn, 'es');
const ids = (vs: { videoId: string }[]) => vs.map(v => v.videoId).sort();
const ES_IDS = new Set(FIX.catalog.filter(v => V.channelLangEs(v.channelTitle)).map(v => v.videoId));

function call(path: string, lang: 'es' | 'en', route: typeof MT.mytubeRoutes = MT.mytubeRoutes): Promise<{ status: number; body: any }> {
  const req = Readable.from([]) as unknown as IncomingMessage;
  Object.assign(req, { method: 'GET', url: path, headers: { 'x-innerith-user': 'ian', 'x-smarty-lang': lang } });
  return new Promise(resolve => {
    let status = 0;
    const res = { writeHead: (s: number) => { status = s; }, end: (raw: string) => resolve({ status, body: JSON.parse(raw) }) } as unknown as ServerResponse;
    void runAsUser('ian', () => route(req, res, new URL(path, 'http://localhost')), lang);
  });
}

describe('videos.ts: la fuente de verdad del idioma', () => {
  it('channelLangEs reconoce los canales castellanos del catálogo real (y no los ingleses)', () => {
    for (const c of ['Smile and Learn - Español', 'KhanAcademyEspañol', 'Veritasium en español', 'Susi Profe', 'Date un Vlog', 'Platzi', 'midudev', 'Dot CSV', 'unicoos', 'Aventuras con los Kratt - Scholastic', 'Gracia a Vosotros'])
      expect(V.channelLangEs(c), c).toBe(true);
    for (const c of ['Veritasium', '3Blue1Brown', 'Numberphile', 'Mark Rober', 'Kurzgesagt – In a Nutshell', 'BBC Earth', 'TED', 'Brilliant Classics', '', undefined])
      expect(V.channelLangEs(c), String(c)).toBe(false);
  });
  it('ES_CHANNELS cubre a todo canal del catálogo REAL con «español/Español/ES» en el nombre (server/data, solo lectura)', () => {
    let real: { channelTitle: string }[] = [];
    try { real = JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'catalog.json'), 'utf8')); } catch { return; } // sin catálogo (no está en git): nada que mirar
    const names = [...new Set(real.map(v => v.channelTitle).filter(Boolean))];
    for (const n of names.filter(n => /español|\bES$/i.test(n))) expect(V.channelLangEs(n), n).toBe(true);
  });
  it('looksSpanish: castellano sí; inglés, «La La Land» o «El Capitan» no', () => {
    expect(V.looksSpanish('El Sonido Más Poderoso para Dormir Rápido – Lluvia con Truenos Toda la Noche')).toBe(true);
    expect(V.looksSpanish('¿Cómo se forman los volcanes?')).toBe(true);
    expect(V.looksSpanish('Palabras de Inspiración: El poder de la humildad')).toBe(true);
    expect(V.looksSpanish('Rain Sounds for Sleeping - 10 Hours')).toBe(false);
    expect(V.looksSpanish('La La Land piano theme')).toBe(false);
    expect(V.looksSpanish('Climbing El Capitan')).toBe(false);
    expect(V.looksSpanish('')).toBe(false);
  });
  it('videoVisibleNow: en castellano todo; en inglés ni canal ni título castellano', () => {
    const es1 = FIX.catalog[0], en1 = FIX.catalog[2], enEs = FIX.catalog[4];
    expect([es1, en1, enEs].map(v => V.videoVisibleNow(v))).toEqual([true, true, true]); // fuera de un pedido = castellano
    expect(es(() => [es1, en1, enEs].map(v => V.videoVisibleNow(v)))).toEqual([true, true, true]);
    expect(en(() => [es1, en1, enEs].map(v => V.videoVisibleNow(v)))).toEqual([false, true, false]);
  });
});

describe('(a) búsqueda: searchVideos / searchVideosStrict / relacionados / reproductor', () => {
  it('en inglés no devuelven ningún video de ES_CHANNELS (ni de título castellano)', () => {
    const got = en(() => [V.searchVideos('ciencia', 50), V.searchVideosStrict('ciencia', 50)]);
    for (const list of got) {
      expect(list.length).toBeGreaterThan(0);
      for (const v of list) { expect(V.channelLangEs(v.channelTitle), v.videoId).toBe(false); expect(ES_IDS.has(v.videoId)).toBe(false); }
      expect(ids(list)).toEqual(['EN_lalaland', 'EN_numbers1', 'EN_volcano1']);
    }
  });
  it('el corte es DESPUÉS del filtro: en inglés el límite se llena con lo servible', () => {
    expect(en(() => V.searchVideos('ciencia', 2)).map(v => v.videoId).every(id => id.startsWith('EN_'))).toBe(true);
    expect(en(() => V.searchVideos('ciencia', 2))).toHaveLength(2);
  });
  it('relacionados y reproductor: en inglés, nada castellano (getCatalogVideo sigue resolviendo todo)', async () => {
    const base = V.getCatalogVideo('EN_volcano1')!;
    expect(en(() => V.relatedVideos(base, 10)).every(v => !ES_IDS.has(v.videoId) && v.videoId !== 'EN_spanish1')).toBe(true);
    expect(await en(() => V.getVideo('ES_numeros1'))).toBeNull();
    expect(await en(() => V.getVideo('EN_volcano1'))).not.toBeNull();
    expect(en(() => V.getCatalogVideo('ES_numeros1'))?.videoId).toBe('ES_numeros1'); // lookups internos: sin filtro
  });
});

describe('(b) MyTube del chico', () => {
  it('en inglés: los canales castellanos no aparecen entre los seguidos; el inglés cuenta solo lo servible', async () => {
    const r = await call('/api/mytube/channels', 'en');
    expect(r.body.channels).toEqual([{ channelId: 'UCen', title: 'Veritasium', thumb: undefined, videos: 3 }]);
  });
  it('en inglés: el canal castellano no existe; el inglés sin videos ni listas castellanas y sin la descripción del modelo', async () => {
    expect((await call('/api/mytube/channel?id=UCes', 'en')).body).toEqual({ channel: null, followed: false, total: 0, playlists: [], pending: false });
    const d = (await call('/api/mytube/channel?id=UCen', 'en')).body;
    expect(d.total).toBe(3);
    expect(d.channel.desc).toBe('An element of truth - videos about science.');
    expect(d.playlists).toEqual([{ playlistId: 'PLmixed', title: 'Science mix' }]); // la mixta sí; la solo-castellana y la de título castellano no
    const vids = (await call('/api/mytube/channel/videos?id=UCen', 'en')).body;
    expect(vids.total).toBe(3);
    expect(vids.videos.map((v: { videoId: string }) => v.videoId)).not.toContain('EN_spanish1');
    expect((await call('/api/mytube/channel/videos?id=UCes', 'en')).body).toEqual({ videos: [], total: 0 });
  });
  it('en inglés: la lista mixta sirve solo lo inglés; las demás, 404', async () => {
    expect((await call('/api/mytube/channel/playlist?id=PLmixed', 'en')).body.videos.map((v: { videoId: string }) => v.videoId)).toEqual(['EN_volcano1']);
    for (const id of ['PLonlyes', 'PLestitle', 'PLes']) expect((await call(`/api/mytube/channel/playlist?id=${id}`, 'en')).status, id).toBe(404);
  });
  it('(e) en castellano, todo como siempre', async () => {
    const r = await call('/api/mytube/channels', 'es');
    expect(r.body.channels.map((c: { channelId: string; videos: number }) => [c.channelId, c.videos])).toEqual([['UCen', 4], ['UCes', 1], ['UCes2', 1]]);
    const d = (await call('/api/mytube/channel?id=UCen', 'es')).body;
    expect(d.channel.desc).toBe('Es un canal de ciencia con experimentos.');
    expect(d.total).toBe(4);
    expect(d.playlists.map((p: { playlistId: string }) => p.playlistId).sort()).toEqual(['PLestitle', 'PLmixed', 'PLonlyes']);
    expect((await call('/api/mytube/channel?id=UCes', 'es')).body.channel.title).toBe('Smile and Learn - Español');
    expect((await call('/api/mytube/channel/playlist?id=PLmixed', 'es')).body.videos.map((v: { videoId: string }) => v.videoId)).toEqual(['EN_spanish1', 'EN_volcano1']);
    expect((await call('/api/mytube/channel/playlist?id=PLes', 'es')).status).toBe(200);
  });
});

describe('(c) After Day', () => {
  it('en inglés no se sirve el tema castellano (por título) ni el que es de un canal castellano (sin título)', async () => {
    expect((await call('/api/afterday', 'en', AD.afterdayRoutes)).body.tracks.map((t: { videoId: string }) => t.videoId)).toEqual(['rainEN00001']);
  });
  it('(e) en castellano la lista entera; la del padre (allTracks) nunca se filtra', async () => {
    expect((await call('/api/afterday', 'es', AD.afterdayRoutes)).body.tracks).toHaveLength(3);
    expect(en(() => AD.allTracks())).toHaveLength(3);
  });
});

describe('(d) Mi espacio: Drive, papelera y listas', () => {
  it('en inglés: sin los ítems castellanos, con las carpetas del usuario TAL CUAL y los contadores de lo servible', () => {
    const root = en(() => SP.driveView(0));
    expect(root.folders).toEqual([{ id: 1, name: 'Favoritos', parentId: 0, count: 1 }, { id: 2, name: 'Matematica', parentId: 0, count: 0 }]);
    expect(en(() => SP.driveView(1)).items.map(i => i.id)).toEqual([11]);
    expect(en(() => SP.driveView(2)).items).toEqual([]); // el video castellano y el artículo de título castellano
    expect(en(() => SP.folderTree()).folders.map(f => f.name)).toEqual(['Favoritos', 'Matematica']);
  });
  it('en inglés la papelera no sirve el ítem castellano pero sí la carpeta del usuario', () => {
    const t = en(() => SP.trashView());
    expect(t.folders).toEqual([{ id: 3, name: 'otra' }]);
    expect(t.items.map(i => i.id)).toEqual([15]);
  });
  it('en inglés las listas del usuario conservan su nombre y sirven solo lo inglés', () => {
    expect(en(() => SP.playlists()).playlists).toEqual([{ id: 20, name: 'mi lista', count: 2, cover: 'https://i.ytimg.com/vi/EN_numbers1/mqdefault.jpg' }]);
    expect(en(() => SP.playlistDetail(20))!.videos.map(v => v.id)).toEqual(['EN_numbers1', 'EN_volcano1']);
  });
  it('(e) en castellano todo idéntico a antes', () => {
    expect(es(() => SP.driveView(0)).folders.map(f => [f.name, f.count])).toEqual([['Favoritos', 3], ['Matematica', 2]]);
    expect(es(() => SP.trashView()).items.map(i => i.id).sort()).toEqual([14, 15]);
    expect(es(() => SP.playlistDetail(20))!.videos.map(v => v.id)).toEqual(['ES_numeros1', 'EN_numbers1', 'EN_volcano1']);
    expect(SP.driveView(1).items.map(i => i.id).sort()).toEqual([10, 11, 12]); // fuera de un pedido = castellano
  });
  it('restaurar por id un ítem escondido en inglés funciona (y vuelve a verse en castellano)', () => {
    en(() => SP.restoreItem(14));
    expect(en(() => SP.driveView(2)).items).toEqual([]);
    expect(es(() => SP.driveView(2)).items.map(i => i.id).sort()).toEqual([13, 14, 16]);
    en(() => SP.trashItem(14));
    expect(es(() => SP.trashView()).items.map(i => i.id).sort()).toEqual([14, 15]);
  });
});
