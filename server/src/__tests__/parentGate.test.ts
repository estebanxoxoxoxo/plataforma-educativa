import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MedalFacts } from '../medalRules';

/* parent.ts DE VERDAD (revisión de U5: ningún test lo importaba, todos lo mockeaban): lee y escribe en una carpeta TEMPORAL
   —'../config' con SERVER_ROOT apuntando a un tmp con un parent.json v3 de fixture; server/data no se toca—. Se prueban
   las piezas de U5 que los mocks reimplementaban: el gate REAL de las medallas (⚠ featureOn de un ADULTO da false por
   fail-closed: sin el `kind === 'adult'` se le escondería su propia copa), checkPrizeFields (título → descripción → emoji,
   con los textos literales de la Tienda) y memberItemsOf (sin archivados, copias), la Actividad de Familia que sincroniza
   las medallas bajo el runAsUser del INTEGRANTE y las devuelve forParent, y las guardas `kind === 'adult'` de leaguesFake
   con ESE featureOn. Se mockean los dominios que parent importa y acá no importan (afterday, market, schedule, space,
   videos) y, para leaguesFake, lo que lee server/data o mueve otros dominios (identity, feedFake). */

const T = vi.hoisted(() => ({ dir: '' }));
vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  T.dir = mkdtempSync(join(tmpdir(), 'innerith-parent-'));
  mkdirSync(join(T.dir, 'data'));
  const all = (on: boolean) => ({ tienda: on, ligas: on, amigos: on, chat: on });
  const member = (features: Record<string, boolean>, items: unknown[]) =>
    ({ features, items, topics: { white: [], black: [] }, extraWords: [], volume: { maxMusic: 100, maxNoise: 100 }, preset: null, feedMotion: 'normal' });
  const item = (id: number, emoji: string, title: string, archived: boolean, desc?: string) =>
    ({ id, emoji, title, ...(desc ? { desc } : {}), price: 200, stock: null, archived, createdAt: 1 });
  writeFileSync(join(T.dir, 'data', 'parent.json'), JSON.stringify({
    version: 3, seq: 20, tz: 'UTC', pinHash: '0'.repeat(64),
    members: {
      ian: member(all(true), [item(1, '🚲', '1 hora de bici en la plaza', false, 'Salimos a andar juntos.'), item(2, '📚', 'Un libro nuevo que elijas', true)]),
      luna: member({ ...all(true), ligas: false }, [item(9, '🍦', 'Salida por un helado', false)]),
    },
  }));
  return { ...actual, SERVER_ROOT: T.dir };
});
vi.mock('../afterday', () => ({ addTrack: () => null, allTracks: () => [], removeTrack: () => false }));
vi.mock('../market', () => ({
  deliverRedemption: () => false, listRedemptions: () => [], redeemedCount: () => 0, stockLeft: () => null,
  grantFamilyPrize: () => ({}),
}));
vi.mock('../schedule', () => ({ checkCycle: () => null, cycleView: () => ({}), saveCycle: () => ({ ok: true }), setFamilyTzSource: () => {} }));
vi.mock('../space', () => ({ allSavedForParent: () => [] }));
vi.mock('../videos', () => ({ catalogSize: () => 0 }));
vi.mock('../identity', () => ({ lookOf: () => null }));
vi.mock('../feedFake', () => ({ injectLeagueClose: () => 0 }));

const parent = await import('../parent');
const M = await import('../medals');
const L = await import('../leaguesFake');
const { currentUser, runAsUser } = await import('../requestContext');
const { userById } = await import('../users');

// Los hechos REALES de progress (rachas y semanas del seed: Ian 🗓️, Luna 🗓️ ✨) y de leaguesFake (las copas) también se
// registran al cargar; esta fuente de prueba va DESPUÉS y pisa solo las claves que pone.
const F: Record<string, Partial<MedalFacts>> = {};
M.registerMedalFacts((uid) => F[uid] ?? {}, 'test');
const NEWS: { ctx: string | undefined; id: string }[] = [];
M.registerMedalNews((m) => { NEWS.push({ ctx: currentUser()?.id, id: m.id }); });
const ids = (uid: string) => M.medalsOf(uid).map(m => m.id);

beforeEach(() => { F.ian = {}; F.luna = {}; F.andres = {}; M.resetMedals(); NEWS.length = 0; });
afterAll(async () => {
  const { rmSync } = await import('node:fs');
  if (T.dir.includes('innerith-parent-')) rmSync(T.dir, { recursive: true, force: true });
});

function call(route: (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void>, user: string, method: string, path: string):
  Promise<{ status: number; body: any }> {
  const req = Readable.from([]) as unknown as IncomingMessage;
  Object.assign(req, { method, url: path, headers: { 'x-innerith-user': user } });
  return new Promise(resolve => {
    let status = 0;
    const res = { writeHead: (s: number) => { status = s; }, end: (b: string) => resolve({ status, body: JSON.parse(b) }) } as unknown as ServerResponse;
    void runAsUser(user, () => route(req, res, new URL(path, 'http://localhost')));
  });
}

describe('featureOn es fail-closed: un ADULTO (sin config de integrante) da false', () => {
  it('el adulto y un id desconocido: false en todo; cada chico, lo suyo', () => {
    for (const k of parent.FEATURE_KEYS) {
      expect(parent.featureOn(k, 'andres')).toBe(false);
      expect(parent.featureOn(k, 'pepe')).toBe(false);
    }
    expect(parent.featureOn('ligas', 'ian')).toBe(true);
    expect(parent.featureOn('ligas', 'luna')).toBe(false);
    expect(parent.featureOn('tienda', 'luna')).toBe(true);
  });
});

describe('el gate REAL de las medallas (registrado por parent.ts al cargar)', () => {
  it('el adulto ve su copa y su primer amigo aunque featureOn le dé false (la guarda `kind === adult`)', () => {
    F.andres = { crowns: 1, friends: 1 };
    M.resetMedals('andres');
    expect(parent.featureOn('ligas', 'andres')).toBe(false);
    expect(ids('andres')).toEqual(['primer-amigo', 'semana-familia']);
  });
  it('un chico con Ligas apagadas: su copa se ESCONDE de su pila y Familia la ve marcada; con Ligas prendidas, la ve', () => {
    F.luna = { crowns: 1 }; F.ian = { crowns: 1 };
    M.resetMedals();
    expect(ids('luna')).toEqual(['tres-dias', 'semana-completa']);
    expect(M.medalsOf('luna', { forParent: true }).map(m => [m.id, m.hidden ?? null]))
      .toEqual([['tres-dias', null], ['semana-completa', null], ['semana-familia', 'ligas']]);
    expect(ids('ian')).toEqual(['tres-dias', 'semana-familia']);
  });
});

describe('checkPrizeFields: los textos LITERALES de un premio de la Tienda, en el orden título → descripción → emoji', () => {
  const err = (b: Record<string, unknown>) => { const r = parent.checkPrizeFields(b); return r.ok ? null : r.error; };
  it('cada campo con su texto', () => {
    expect(err({ title: 'B', emoji: '🚲' })).toBe('El título tiene que tener entre 2 y 60 caracteres.');
    expect(err({ title: 'x'.repeat(61), emoji: '🚲' })).toBe('El título tiene que tener entre 2 y 60 caracteres.');
    expect(err({ title: 'Bici', desc: 'x'.repeat(141), emoji: '🚲' })).toBe('La descripción admite hasta 140 caracteres.');
    expect(err({ title: 'Bici', desc: 42, emoji: '🚲' })).toBe('La descripción tiene que ser texto.');
    for (const emoji of ['', 'ab', '🎮🎮🎮', 42]) expect(err({ title: 'Bici', emoji })).toBe('Elegí un emoji para el premio (por ejemplo 🎮).');
  });
  it('el orden: con todo mal, primero el título; después la descripción; recién después el emoji', () => {
    expect(err({ title: 'B', desc: 5, emoji: 'x' })).toBe('El título tiene que tener entre 2 y 60 caracteres.');
    expect(err({ title: 'Bici', desc: 5, emoji: 'x' })).toBe('La descripción tiene que ser texto.');
    expect(err({ title: 'Bici', emoji: 'x' })).toBe('Elegí un emoji para el premio (por ejemplo 🎮).');
  });
  it('lo válido sale limpio (espacios y controles colapsados; descripción vacía = sin descripción)', () => {
    expect(parent.checkPrizeFields({ title: '  Bici \n en la   plaza ', desc: ' Salimos  juntos. ', emoji: ' 🚲 ' }))
      .toEqual({ ok: true, value: { emoji: '🚲', title: 'Bici en la plaza', desc: 'Salimos juntos.' } });
    expect(parent.checkPrizeFields({ title: 'Bici', desc: '', emoji: '🚲' })).toEqual({ ok: true, value: { emoji: '🚲', title: 'Bici' } });
    expect(parent.checkPrizeFields({ title: 'Bici', desc: null, emoji: '🇦🇷' })).toEqual({ ok: true, value: { emoji: '🇦🇷', title: 'Bici' } });
  });
});

describe('memberItemsOf: los premios NO archivados del integrante, como copias', () => {
  it('sin el archivado, en su orden; el adulto y un desconocido no tienen premios', () => {
    expect(parent.memberItemsOf('ian').map(i => [i.id, i.title])).toEqual([[1, '1 hora de bici en la plaza']]);
    expect(parent.memberItemsOf('luna').map(i => i.id)).toEqual([9]);
    expect(parent.memberItemsOf('andres')).toEqual([]);
    expect(parent.memberItemsOf('pepe')).toEqual([]);
  });
  it('son copias: tocar lo devuelto no cambia la Tienda del chico', () => {
    parent.memberItemsOf('ian')[0].title = 'otra cosa';
    expect(parent.memberItemsOf('ian')[0].title).toBe('1 hora de bici en la plaza');
  });
});

describe('Familia → Actividad: sincroniza bajo el contexto del INTEGRANTE y devuelve todas sus medallas (forParent)', () => {
  it('una medalla nueva de Luna cae en el feed de ELLA (no en el del adulto que mira); la escondida va con su marca, nada con fresh', async () => {
    F.luna = { crowns: 1 };
    M.resetMedals('luna');
    F.luna = { crowns: 1, comebacks: 1 }; // un hecho nuevo desde la siembra
    const r = await call(parent.parentRoutes, 'andres', 'GET', '/api/parent/activity?member=luna');
    expect(r.status).toBe(200);
    expect(r.body.member).toBe('luna');
    expect(NEWS).toEqual([{ ctx: 'luna', id: 'de-vuelta' }]);
    expect(r.body.medals.map((m: { id: string; hidden?: string }) => [m.id, m.hidden ?? null]))
      .toEqual([['de-vuelta', null], ['tres-dias', null], ['semana-completa', null], ['semana-familia', 'ligas']]);
    expect(r.body.medals.some((m: object) => 'fresh' in m)).toBe(false);
  });
  it('un chico no la puede pedir (401: es del adulto)', async () => {
    expect(await call(parent.parentRoutes, 'ian', 'GET', '/api/parent/activity?member=luna')).toEqual({ status: 401, body: { error: 'Solo para un adulto de la familia.' } });
  });
});

describe('las guardas `kind === adult` de leaguesFake, con el featureOn REAL', () => {
  it('el adulto juega la tabla de la familia y no recibe 403; el chico con Ligas apagadas sale de la tabla y sí', async () => {
    const andres = userById('andres')!;
    expect(L.familyLeague(andres).rows.map(r => r.id).sort()).toEqual(['andres', 'ian']);
    expect((await call(L.leaguesRoutes, 'andres', 'GET', '/api/leagues/family')).status).toBe(200);
    expect((await call(L.leaguesRoutes, 'andres', 'GET', '/api/leagues/mine')).status).toBe(200);
    expect(await call(L.leaguesRoutes, 'luna', 'GET', '/api/leagues/family')).toEqual({ status: 403, body: { error: 'Las ligas están apagadas por tu familia' } });
  });
});
