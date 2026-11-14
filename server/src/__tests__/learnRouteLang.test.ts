import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterAll, describe, expect, it, vi } from 'vitest';

/* i18n (14-nov): idioma POR RUTA en learnRoutes.ts (reemplaza el corte del 9-nov «en inglés sin rutas»). Cada fila tiene
   un idioma (`lang: 'en'`, o sin el campo = castellano) y se sirve SOLO en la app de ese idioma: lista, /one (otro idioma
   → el mismo 404), /definitions y servedRoutes (el Feed). El import de una ruta NUEVA estampa el idioma del pedido (en
   castellano no escribe el campo); una reimportación lo conserva. catalogRoutes() crudo no filtra por idioma.
   SERVER_ROOT en una carpeta TEMPORAL (server/data no se toca). */

const T = vi.hoisted(() => ({ dir: '' }));
vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  const { mkdtempSync, mkdirSync, writeFileSync: w } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');
  T.dir = mkdtempSync(j(tmpdir(), 'innerith-learn-lang-'));
  mkdirSync(j(T.dir, 'data'));
  const member = () => ({ features: { tienda: true, ligas: true, amigos: true, chat: true }, items: [], topics: { white: [], black: [] }, extraWords: [], volume: { maxMusic: 100, maxNoise: 100 }, preset: null, feedMotion: 'normal' });
  w(j(T.dir, 'data', 'parent.json'), JSON.stringify({ version: 3, seq: 20, tz: 'UTC', pinHash: '0'.repeat(64), members: { ian: member(), luna: member() } }));
  w(j(T.dir, 'data', 'catalog.json'), JSON.stringify([]));
  const fc = (id: string) => ({ id, typeId: 'flashcards', title: id, target: id, generatorId: 'static', params: { cards: [{ id: 'c1', front: 'Q', back: 'A' }, { id: 'c2', front: 'Q2', back: 'A2' }] }, mode: 'untimed', durationSec: 60 });
  const row = (id: string, title: string, lang?: 'en') => ({
    id, enabled: true, origin: 'generated', importedAt: 1, createdBy: 'andres', createdAt: 1, importedBy: 'andres',
    route: { id, title, emoji: '🪐', description: '', postas: [{ id: 'p1', title: 'Jugar', kind: 'activity', definitionId: `${id}.d`, target: 't' }] },
    ...(lang ? { lang } : {}),
  });
  const routes = [row('r.es', 'Planetas'), row('r.en', 'Planets', 'en')];
  const defs = routes.map((r) => ({ id: `${r.id}.d`, routeId: r.id, target: 't', importedAt: 1, def: fc(`${r.id}.d`) }));
  w(j(T.dir, 'data', 'learn-routes.json'), JSON.stringify({ v: 1, routes, definitions: defs }));
  return { ...actual, SERVER_ROOT: T.dir };
});
vi.mock('../afterday', () => ({ addTrack: () => null, allTracks: () => [], removeTrack: () => false }));
vi.mock('../market', () => ({ deliverRedemption: () => false, listRedemptions: () => [], redeemedCount: () => 0, stockLeft: () => null }));
vi.mock('../schedule', () => ({ checkCycle: () => null, cycleView: () => ({}), saveCycle: () => ({ ok: true }), setFamilyTzSource: () => {} }));
vi.mock('../identity', () => ({ lookOf: () => null }));
vi.mock('../feedFake', () => ({ injectLeagueClose: () => 0 }));
vi.mock('../routeCover', () => ({ fetchWikiThumb: async () => null, wikiTarget: () => null }));

const RT = await import('../learnRoutes');
await import('../parent');
const { runAsUser } = await import('../requestContext');
afterAll(() => { rmSync(T.dir, { recursive: true, force: true }); });

type Lang = 'es' | 'en';
function call(user: string, lang: Lang, method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;
  Object.assign(req, { method, url: path, headers: { 'x-innerith-user': user, 'x-smarty-lang': lang } });
  return new Promise(resolve => {
    let status = 0;
    const res = { writeHead: (s: number) => { status = s; }, end: (raw: string) => resolve({ status, body: JSON.parse(raw) }) } as unknown as ServerResponse;
    void runAsUser(user, () => RT.learnRoutesRoutes(req, res, new URL(path, 'http://localhost')), lang);
  });
}
const ids = async (user: string, lang: Lang) => ((await call(user, lang, 'GET', '/api/learn-routes')).body.routes as { id: string }[]).map(r => r.id);
const defIds = async (user: string, lang: Lang) => ((await call(user, lang, 'GET', '/api/learn-routes/definitions')).body.definitions as { id: string }[]).map(d => d.id);
const one = (user: string, lang: Lang, id: string) => call(user, lang, 'GET', `/api/learn-routes/one?id=${id}`);
const disk = () => JSON.parse(readFileSync(join(T.dir, 'data', 'learn-routes.json'), 'utf8')).routes as Record<string, unknown>[];
const bundle = (id: string, title: string) => ({ kind: 'smarty-route-bundle', schemaVersion: 1,
  route: { id, title, emoji: '🌋', description: '', postas: [{ id: 'p1', title: 'Jugar', kind: 'activity', definitionId: `${id}.d`, target: 't' }] },
  definitions: [{ id: `${id}.d`, typeId: 'flashcards', title: 'd', target: 't', generatorId: 'static', params: { cards: [{ id: 'c1', front: 'P', back: 'R' }, { id: 'c2', front: 'Q', back: 'S' }] }, mode: 'untimed', durationSec: 60 }] });

describe('idioma por ruta (i18n 14-nov)', () => {
  it('(a) una fila con lang en: NO se sirve en castellano y SÍ en inglés (lista, /one, /definitions, servedRoutes)', async () => {
    for (const u of ['andres', 'ian']) {
      expect(await ids(u, 'es')).not.toContain('r.en');
      expect(await ids(u, 'en')).toContain('r.en');
      expect(await defIds(u, 'es')).not.toContain('r.en.d');
      expect(await defIds(u, 'en')).toContain('r.en.d');
      const esOne = await one(u, 'es', 'r.en');
      expect(esOne).toEqual({ status: 404, body: { error: 'No encontré esa ruta.' } }); // el mismo 404 de una ruta que no existe
      const enOne = await one(u, 'en', 'r.en');
      expect(enOne.status).toBe(200);
      expect(enOne.body.route.title).toBe('Planets');
      expect(enOne.body.definitions.map((d: { id: string }) => d.id)).toEqual(['r.en.d']);
    }
    expect(runAsUser('ian', () => RT.servedRoutes(), 'es').map(r => r.id)).toEqual(['r.es']);
    expect(runAsUser('ian', () => RT.servedRoutes(), 'en').map(r => r.id)).toEqual(['r.en']);
  });

  it('(b) una fila sin lang (castellano): se sirve en castellano y no en inglés', async () => {
    for (const u of ['andres', 'ian']) {
      expect(await ids(u, 'es')).toEqual(['r.es']);
      expect(await ids(u, 'en')).toEqual(['r.en']);
      expect(await defIds(u, 'es')).toEqual(['r.es.d']);
      expect(await defIds(u, 'en')).toEqual(['r.en.d']);
      expect((await one(u, 'es', 'r.es')).status).toBe(200);
      const enOne = await one(u, 'en', 'r.es');
      expect(enOne).toEqual({ status: 404, body: { error: 'I couldn’t find that route.' } });
    }
  });

  it('(c) el import estampa lang en con el pedido en inglés y no escribe el campo en castellano; reimportar no lo cambia', async () => {
    expect((await call('andres', 'en', 'POST', '/api/learn-routes/import', { bundle: bundle('r.nueva.en', 'Volcanoes') })).body).toMatchObject({ ok: true, routeId: 'r.nueva.en' });
    expect((await call('andres', 'es', 'POST', '/api/learn-routes/import', { bundle: bundle('r.nueva.es', 'Volcanes') })).body).toMatchObject({ ok: true, routeId: 'r.nueva.es' });
    const rows = disk();
    expect(rows.find(r => r.id === 'r.nueva.en')!.lang).toBe('en');
    expect('lang' in rows.find(r => r.id === 'r.nueva.es')!).toBe(false);
    expect('lang' in rows.find(r => r.id === 'r.es')!).toBe(false); // la fila de siempre, intacta
    expect(await ids('andres', 'en')).toEqual(['r.en', 'r.nueva.en']);
    expect(await ids('andres', 'es')).toEqual(['r.es', 'r.nueva.es']);
    // editar (reimportar la misma ruta) con la app en el OTRO idioma no le cambia el idioma
    expect((await call('andres', 'es', 'POST', '/api/learn-routes/import', { bundle: bundle('r.nueva.en', 'Volcanoes 2') })).body.ok).toBe(true);
    expect((await call('andres', 'en', 'POST', '/api/learn-routes/import', { bundle: bundle('r.nueva.es', 'Volcanes 2') })).body.ok).toBe(true);
    expect(disk().find(r => r.id === 'r.nueva.en')!.lang).toBe('en');
    expect('lang' in disk().find(r => r.id === 'r.nueva.es')!).toBe(false);
    expect((await one('andres', 'en', 'r.nueva.en')).body.route.title).toBe('Volcanoes 2');
    // borrar en el otro idioma borra igual (no depende del idioma)
    expect((await call('andres', 'es', 'POST', '/api/learn-routes/delete', { id: 'r.nueva.en' })).body).toEqual({ ok: true });
    expect(disk().some(r => r.id === 'r.nueva.en')).toBe(false);
  });

  it('(d) catalogRoutes() crudo (economía y medallas) devuelve TODAS las filas en ambos idiomas', () => {
    const all = (lang: Lang) => runAsUser('ian', () => RT.catalogRoutes(), lang).map(r => r.id).sort();
    expect(all('es')).toEqual(['r.en', 'r.es', 'r.nueva.es']);
    expect(all('en')).toEqual(all('es'));
    expect(RT.catalogRoutes().map(r => r.id).sort()).toEqual(all('es')); // fuera de un pedido, igual
  });
});
