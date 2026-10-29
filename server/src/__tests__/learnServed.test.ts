import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterAll, describe, expect, it, vi } from 'vitest';

/* Catálogo de Learn (FS-BASE-A): learnRoutes.ts, parent.ts, filters.ts y videos.ts DE VERDAD, con SERVER_ROOT en una carpeta
   TEMPORAL (parent.json, catalog.json y learn-routes.json de fixture; server/data no se toca).
   · hallazgo learnRoutes.ts:333 + faltante 3: lo que un chico importa no se le sirve a un HERMANO sin moderación (todo el
     texto, videos solo del catálogo aprobado, artículos de la lista blanca, sin su portada subida) y toda ruta pasa la
     política del chico que mira (título y descripción) al LEER — lista, /one, /definitions y el Feed (servedRoutes).
   · hallazgo learnRoutes.ts:94: las cotas del import (400 claro) antes del acuñado seco. */

const T = vi.hoisted(() => ({ dir: '' }));
vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  const { mkdtempSync, mkdirSync, writeFileSync: w } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');
  T.dir = mkdtempSync(j(tmpdir(), 'innerith-learn-'));
  mkdirSync(j(T.dir, 'data'));
  const member = (extraWords: string[]) => ({ features: { tienda: true, ligas: true, amigos: true, chat: true }, items: [], topics: { white: [], black: [] }, extraWords, volume: { maxMusic: 100, maxNoise: 100 }, preset: null, feedMotion: 'normal' });
  w(j(T.dir, 'data', 'parent.json'), JSON.stringify({ version: 3, seq: 20, tz: 'UTC', pinHash: '0'.repeat(64), members: { ian: member([]), luna: member(['tiburon']) } }));
  w(j(T.dir, 'data', 'catalog.json'), JSON.stringify([{ videoId: 'ppppppppppp', title: 'Los planetas', thumb: '', channelId: 'UCx', channelTitle: 'C', source: 'C', description: '', duration: 60, addedAt: 0, tags: [], topics: [] }]));
  const fc = (id: string, cards: { id: string; front: string; back: string }[]) => ({ id, typeId: 'flashcards', title: id, target: id, generatorId: 'static', params: { cards }, mode: 'untimed', durationSec: 60 });
  const card = (back: string) => [{ id: 'c1', front: 'Pregunta', back }, { id: 'c2', front: 'Otra', back: 'Respuesta' }];
  const row = (id: string, by: string | undefined, route: Record<string, unknown>, editorial?: unknown) => ({
    id, enabled: true, origin: 'generated', importedAt: 1, route: { id, emoji: '🪐', description: '', postas: [{ id: 'p1', title: 'Jugar', kind: 'activity', definitionId: `${id}.d`, target: `${id}.t` }], ...route },
    ...(editorial ? { editorial } : {}), ...(by ? { createdBy: by, createdAt: 1, importedBy: by } : {}),
  });
  const audit = { status: 'confirmado', confidence: 0.9, summary: 'Las fuentes lo confirman.', sources: [
    { title: 'Júpiter - Wikipedia', url: 'https://es.wikipedia.org/wiki/J%C3%BApiter', snippet: 'el planeta más grande', agrees: 'si' },
    { title: 'Un blog cualquiera', url: 'https://blog-cualquiera.example/jupiter', snippet: 'opinión', agrees: 'parcial' },
  ], model: 'gpt-5.5', auditedAt: 1 };
  const routes = [
    row('r.adulto', 'andres', { title: 'Planetas', cover: 'data:image/jpeg;base64,QURVTFRP' }, { modules: { m1: { inventory: { concepts: [], integrityDropped: [], facts: [{ id: 'f1', statement: 'Júpiter es el más grande', audit }] } } } }),
    row('r.ian.limpia', 'ian', { title: 'Mi ruta de planetas', cover: 'data:image/jpeg;base64,SUFO', postas: [{ id: 'p1', title: 'Video', kind: 'activity', definitionId: 'r.ian.limpia.d', target: 't', reading: { kind: 'video', videoId: 'ppppppppppp', url: 'https://youtu.be/ppppppppppp', title: 'Los planetas' } }] }),
    row('r.ian.sucia', 'ian', { title: 'Cosas raras' }),
    row('r.ian.video', 'ian', { title: 'Mi video', postas: [{ id: 'p1', title: 'Video', kind: 'activity', definitionId: 'r.ian.video.d', target: 't', reading: { kind: 'video', videoId: 'zzzzzzzzzzz', url: 'https://youtu.be/zzzzzzzzzzz', title: 'Un video cualquiera' } }] }),
    row('r.ian.articulo', 'ian', { title: 'Mi lectura', postas: [{ id: 'p1', title: 'Leer', kind: 'activity', definitionId: 'r.ian.articulo.d', target: 't', reading: { kind: 'article', url: 'https://sitio-fuera-de-la-lista.example/a', title: 'Algo' } }] }),
    row('r.ian.tiburon', 'ian', { title: 'El tiburón blanco' }),
    row('r.seed', undefined, { title: 'Sistema solar' }),
    row('r.adulto.tiburon', 'andres', { title: 'El tiburón martillo' }), // curada por el adulto, pero choca con la palabra de Luna
  ];
  const defs = [
    ...routes.filter(r => r.id !== 'r.ian.sucia').map(r => ({ id: `${r.id}.d`, routeId: r.id, target: 't', importedAt: 1, def: fc(`${r.id}.d`, card('Bien')) })),
    { id: 'r.ian.sucia.d', routeId: 'r.ian.sucia', target: 't', importedAt: 1, def: fc('r.ian.sucia.d', card('el satanismo es…')) },
  ];
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

function call(user: string, method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;
  Object.assign(req, { method, url: path, headers: { 'x-innerith-user': user } });
  return new Promise(resolve => {
    let status = 0;
    const res = { writeHead: (s: number) => { status = s; }, end: (raw: string) => resolve({ status, body: JSON.parse(raw) }) } as unknown as ServerResponse;
    void runAsUser(user, () => RT.learnRoutesRoutes(req, res, new URL(path, 'http://localhost')));
  });
}
const list = async (u: string) => (await call(u, 'GET', '/api/learn-routes')).body.routes as { id: string; cover?: string }[];

describe('lo que se le sirve a un chico (hallazgo learnRoutes.ts:333 + faltante 3)', () => {
  it('Luna NO ve lo que importó su hermano sin pasar la moderación; lo que pasa, sin la portada que él subió', async () => {
    const l = await list('luna');
    expect(l.map(r => r.id)).toEqual(['r.adulto', 'r.ian.limpia', 'r.seed']);
    expect(l.find(r => r.id === 'r.ian.limpia')!.cover).toBeUndefined(); // la data URL de Ian no se le sirve a Luna
    expect(l.find(r => r.id === 'r.adulto')!.cover).toMatch(/^data:/); // lo del adulto (el que cura), tal cual
  });

  it('Ian ve TODO lo suyo (con su portada); el adulto ve todo', async () => {
    const i = await list('ian');
    expect(i.map(r => r.id)).toEqual(['r.adulto', 'r.adulto.tiburon', 'r.ian.articulo', 'r.ian.limpia', 'r.ian.sucia', 'r.ian.tiburon', 'r.ian.video', 'r.seed']);
    expect(i.find(r => r.id === 'r.ian.limpia')!.cover).toMatch(/^data:/);
    expect((await list('andres')).length).toBe(8);
  });

  it('la política del que MIRA rige sobre toda ruta (la palabra «tiburon» de Luna esconde el título; a Ian no)', async () => {
    expect((await list('luna')).some(r => r.id === 'r.ian.tiburon')).toBe(false);
    expect((await list('ian')).some(r => r.id === 'r.ian.tiburon')).toBe(true);
    // también sobre lo que curó el adulto (no es de un hermano: rige igual la política del que mira)
    expect((await list('luna')).some(r => r.id === 'r.adulto.tiburon')).toBe(false);
    expect((await list('ian')).some(r => r.id === 'r.adulto.tiburon')).toBe(true);
  });

  it('/one de una ruta que no se le sirve → el mismo 404; /definitions sin las de esas rutas', async () => {
    expect((await call('luna', 'GET', '/api/learn-routes/one?id=r.ian.sucia')).status).toBe(404);
    expect((await call('ian', 'GET', '/api/learn-routes/one?id=r.ian.sucia')).status).toBe(200);
    const dl = (await call('luna', 'GET', '/api/learn-routes/definitions')).body.definitions.map((d: { id: string }) => d.id);
    expect(dl).not.toContain('r.ian.sucia.d');
    expect(dl).not.toContain('r.ian.video.d');
    expect(dl).toContain('r.ian.limpia.d');
    expect((await call('andres', 'GET', '/api/learn-routes/definitions')).body.definitions.length).toBe(8);
  });

  it('el Feed sirve lo mismo (servedRoutes) y la economía sigue con el catálogo crudo (catalogRoutes)', () => {
    expect(runAsUser('luna', () => RT.servedRoutes()).map(r => r.id)).toEqual(['r.adulto', 'r.ian.limpia', 'r.seed']);
    expect(runAsUser('luna', () => RT.catalogRoutes()).length).toBe(8);
  });

  it('/one a un chico: las auditorías del inventario solo con fuentes de la lista blanca (hallazgo create.ts:211, lo persistido)', async () => {
    const src = (b: any) => b.editorial.modules.m1.inventory.facts[0].audit.sources.map((s: { url: string }) => s.url);
    expect(src((await call('luna', 'GET', '/api/learn-routes/one?id=r.adulto')).body)).toEqual(['https://es.wikipedia.org/wiki/J%C3%BApiter']);
    expect(src((await call('andres', 'GET', '/api/learn-routes/one?id=r.adulto')).body).length).toBe(2);
  });

  it('una REIMPORTACIÓN cambia quién la importó (importedBy): lo que Luna reimporta sobre la ruta de Ian es "de un hermano" para Ian', async () => {
    const bundle = (title: string, back: string) => ({ kind: 'smarty-route-bundle', schemaVersion: 1,
      route: { id: 'r.compartida', title, emoji: '🌋', description: '', postas: [{ id: 'p1', title: 'Jugar', kind: 'activity', definitionId: 'r.compartida.d', target: 't' }] },
      definitions: [{ id: 'r.compartida.d', typeId: 'flashcards', title: 'd', target: 't', generatorId: 'static', params: { cards: [{ id: 'c1', front: 'P', back }, { id: 'c2', front: 'Q', back: 'R' }] }, mode: 'untimed', durationSec: 60 }] });
    expect((await call('ian', 'POST', '/api/learn-routes/import', { bundle: bundle('Volcanes', 'lava') })).body.ok).toBe(true);
    expect((await list('luna')).some(r => r.id === 'r.compartida')).toBe(true);
    expect((await call('luna', 'POST', '/api/learn-routes/import', { bundle: bundle('Volcanes', 'el satanismo') })).body.ok).toBe(true);
    expect((await list('ian')).some(r => r.id === 'r.compartida')).toBe(false); // ahora es de Luna, sin revisar
    expect((await list('luna')).some(r => r.id === 'r.compartida')).toBe(true);
    const disk = JSON.parse(readFileSync(join(T.dir, 'data', 'learn-routes.json'), 'utf8')).routes.find((r: { id: string }) => r.id === 'r.compartida');
    expect(disk).toMatchObject({ createdBy: 'ian', importedBy: 'luna' });
    expect(JSON.stringify((await call('ian', 'GET', '/api/learn-routes')).body)).not.toMatch(/importedBy|createdBy/); // no se sirve
  });
});

describe('cotas del import antes del acuñado seco (hallazgo learnRoutes.ts:94)', () => {
  const domino = (params: Record<string, unknown>, n = 1) => ({ kind: 'smarty-route-bundle', schemaVersion: 1,
    route: { id: 'r.cota', title: 'Cotas', emoji: '➕', postas: [{ id: 'p1', title: 'x', kind: 'activity', definitionId: 'r.cota.d0', target: 't' }] },
    definitions: Array.from({ length: n }, (_, i) => ({ id: `r.cota.d${i}`, typeId: 'domino', title: 'd', target: 't', generatorId: 'math', params, mode: 'untimed', durationSec: 60 })) });
  const imp = (b: unknown) => call('andres', 'POST', '/api/learn-routes/import', { bundle: b });

  it('un import diminuto que antes colgaba o tiraba el server (maxValue 2e9) responde 400 enseguida', async () => {
    const t0 = Date.now();
    const r = await imp(domino({ maxValue: 2_000_000_000, ops: ['+'], tileCount: 6 }));
    expect(r.status).toBe(400);
    expect(r.body).toEqual({ ok: false, error: 'La ruta excede los límites del importador: r.cota.d0: params.maxValue = 2000000000: fuera de rango (0 a 1000).' });
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('cantidad de definiciones, params que escalan, listas largas y anidamiento → 400 con el motivo', async () => {
    expect((await imp(domino({ maxValue: 10, ops: ['+'], tileCount: 6 }, 201))).body.error).toMatch(/201 definiciones: el máximo es 200/);
    const quiz = domino({ questionCount: 1_000_000, maxValue: 12, ops: ['+'], optionCount: 4 });
    quiz.definitions[0].typeId = 'quiz';
    expect((await imp(quiz)).status).toBe(400);
    expect((await imp(domino({ maxValue: 10, ops: ['+'], tileCount: -1 }))).status).toBe(400);
    expect((await imp(domino({ maxValue: 10, ops: Array.from({ length: 501 }, () => '+'), tileCount: 6 }))).body.error).toMatch(/501 elementos/);
    let deep: unknown = 1; for (let i = 0; i < 20; i++) deep = [deep];
    expect((await imp(domino({ maxValue: 10, ops: ['+'], tileCount: 6, x: deep }))).body.error).toMatch(/anidados/);
  });

  it('lo normal pasa (un domino de /crear, la seed poc-solar) y las validaciones del POC siguen con su 200 + texto', async () => {
    expect((await imp(domino({ maxValue: 20, ops: ['+', '-'], tileCount: 8 }))).body).toMatchObject({ ok: true, routeId: 'r.cota' });
    const seed = JSON.parse(readFileSync(join(process.cwd(), 'server', 'seeds', 'poc-solar.route-bundle.json'), 'utf8'));
    expect(RT.checkBounds(seed)).toBeNull();
    const r = await imp({ kind: 'otra-cosa' });
    expect(r).toEqual({ status: 200, body: { ok: false, error: 'No es un route-bundle de Smarty (falta kind: "smarty-route-bundle").' } });
  });
});

describe('FIX-MINT: un param que escala tiene que ser un NÚMERO (hallazgo ALTA de QA-SEGURIDAD: el texto saltaba la cota)', () => {
  // Cada clave que escala, en el generador que la lee. Antes la cota solo miraba `typeof x === 'number'`: "200000000" pasaba
  // y el generador lo coaccionaba (Array.from({length: "200000000" + 1}) → OOM: un body de ~300 bytes de un CHICO tiraba el
  // server). El POC nunca emite estas claves como texto (solo 'static' en route-lab y /crear; el seed, en números).
  const VECTORS: Record<string, [typeId: string, generatorId: string, rest: Record<string, unknown>]> = {
    maxValue: ['domino', 'math', { ops: ['+'], tileCount: 6 }],
    tileCount: ['domino', 'math', { maxValue: 10, ops: ['+'] }],
    questionCount: ['quiz', 'math', { maxValue: 12, ops: ['+'], optionCount: 4 }],
    optionCount: ['quiz', 'math', { questionCount: 4, maxValue: 12, ops: ['+'] }],
    count: ['domino', 'capitales-latam', {}],
  };
  const bundle = (k: string, value: unknown) => {
    const [typeId, generatorId, rest] = VECTORS[k];
    return { kind: 'smarty-route-bundle', schemaVersion: 1,
      route: { id: 'r.texto', title: 'Texto', emoji: '➕', postas: [{ id: 'p1', title: 'x', kind: 'activity', definitionId: 'r.texto.d', target: 't' }] },
      definitions: [{ id: 'r.texto.d', typeId, title: 'd', target: 't', generatorId, params: { ...rest, [k]: value }, mode: 'untimed', durationSec: 60 }] };
  };
  const reason = (k: string, kind: string) => `La ruta excede los límites del importador: r.texto.d: params.${k}: tiene que ser un número de 0 a ${RT.IMPORT_LIMITS.scaled[k]} (llegó ${kind}).`;

  it('las claves de la cota son las de los generadores (una sola fuente: src/learn/scaledParams.ts)', () => {
    expect(Object.keys(VECTORS).sort()).toEqual(Object.keys(RT.IMPORT_LIMITS.scaled).sort());
  });

  it.each(Object.keys(VECTORS))('%s como texto (el tope + 1) → 400 con el motivo, enseguida y sin acuñar (antes: 200 ok, importada)', async (k) => {
    const t0 = Date.now();
    const r = await call('ian', 'POST', '/api/learn-routes/import', { bundle: bundle(k, String(RT.IMPORT_LIMITS.scaled[k] + 1)) });
    expect(r).toEqual({ status: 400, body: { ok: false, error: reason(k, 'un texto') } });
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('la repro EXACTA del QA (maxValue "200000000", y "5000000") y los otros tipos que el generador coacciona → el motivo, sin acuñar', () => {
    // checkBounds a secas: sin el arreglo devolvía null y lo que seguía era el acuñado (OOM): acá no se acuña nada
    expect(RT.checkBounds(bundle('maxValue', '200000000') as never)).toBe(reason('maxValue', 'un texto'));
    expect(RT.checkBounds(bundle('maxValue', '5000000') as never)).toBe(reason('maxValue', 'un texto'));
    expect(RT.checkBounds(bundle('questionCount', '2000000') as never)).toBe(reason('questionCount', 'un texto'));
    expect(RT.checkBounds(bundle('maxValue', [200_000_000]) as never)).toBe(reason('maxValue', 'una lista')); // [n] + 1 = "n1"
    expect(RT.checkBounds(bundle('tileCount', null) as never)).toBe(reason('tileCount', 'null'));
    expect(RT.checkBounds(bundle('optionCount', true) as never)).toBe(reason('optionCount', 'true/false'));
    expect(RT.checkBounds(bundle('count', { valueOf: 1 }) as never)).toBe(reason('count', 'un objeto'));
    // decisión documentada: un número escrito como texto NO se coacciona, ni dentro del rango
    expect(RT.checkBounds(bundle('maxValue', '12') as never)).toBe(reason('maxValue', 'un texto'));
  });

  it('los números siguen como antes: en rango pasa (y se importa), fuera de rango es el 400 de siempre', async () => {
    expect(RT.checkBounds(bundle('questionCount', 100) as never)).toBeNull();
    expect(RT.checkBounds(bundle('questionCount', 200) as never)).toBe('La ruta excede los límites del importador: r.texto.d: params.questionCount = 200: fuera de rango (0 a 100).');
    expect((await call('ian', 'POST', '/api/learn-routes/import', { bundle: bundle('maxValue', 1000) })).body).toMatchObject({ ok: true, routeId: 'r.texto' });
  });
});
