import { beforeEach, describe, expect, it, vi } from 'vitest';

/* El circuito de jueces de BUSCAR (FS-BASE-A; hallazgo ALTA index.ts:287 del workflow base-review): searchGuard.ts DE VERDAD
   —con matchBlockedWord, la red de crisis y onInputJudgeDown de verdad— y los jueces y los buscadores simulados. Lo que fija:
   SOLO con un chico; corte de la consulta por palabra Y por nombre de tema negro DE FÁBRICA sin gastar modelo; juez de
   ENTRADA una sola vez para las tres solapas paralelas (un solo aviso de crisis); crisis → guion + aviso; lista negra →
   bloqueo; juez caído → red de crisis (guion + aviso sin clasificar) o 'falla' (fail-closed); y, por tipo, el veto ítem por
   ítem y el juez de SALIDA (bloqueado → vacío, mediosVetados → afuera, error → 'falla'). */

const J = vi.hoisted(() => ({
  input: vi.fn(async (_t: string) => ({ tema: 'ninguno', en_lista_negra: false, es_critico: false, es_crisis: false })),
  output: vi.fn(async (_t: string) => ({ veredicto: 'aprobado' as 'aprobado' | 'bloqueado', mediosVetados: [] as string[] })),
}));
vi.mock('../judge', () => ({ judgeInput: (t: string) => J.input(t), judgeOutput: (t: string) => J.output(t) }));
const S = vi.hoisted(() => ({
  pages: vi.fn(async (_q: string) => ({ results: [] as { title: string; link: string; snippet?: string }[] })),
  videos: vi.fn((_q: string) => [] as { videoId: string; title: string }[]),
  expand: vi.fn(async (_q: string) => [] as { q: string; lente: string | null }[]),
  gallery: vi.fn(async (terms: { q: string }[]) => terms.map((t, i) => ({ id: `img${i}`, thumb: '', full: '', title: `${t.q} foto`, source: 'Pixabay', pageUrl: '' }))),
}));
vi.mock('../search', () => ({ searchPages: (q: string) => S.pages(q) }));
vi.mock('../videos', () => ({ searchVideos: (q: string) => S.videos(q), getCatalogVideo: () => undefined, loadVideoMeta: async () => {}, toVideoResult: (v: unknown) => v, catalogSize: () => 0 }));
vi.mock('../images', () => ({
  expandQuery: (q: string) => S.expand(q), galleryFor: (t: { q: string }[]) => S.gallery(t),
  searchImages: async (q: string) => { const terms = await S.expand(q); return { terms: terms.map(t => t.q), items: await S.gallery(terms) }; },
  searchImageTerm: async () => [],
}));
vi.mock('../articles', () => ({ articleTextForChat: async () => undefined }));
vi.mock('../llm', () => ({ spotlight: (s: string) => s, complete: async () => ({ text: '' }), completeWithTools: async () => ({ text: '' }), tool: () => ({}), parseJudgeJson: () => ({}) }));
const P = vi.hoisted(() => ({ notify: [] as unknown[][], unreviewed: [] as unknown[][], words: [] as string[] }));
vi.mock('../parent', () => ({
  // la lista negra DE FÁBRICA que rige (blackTopicsAll): dos temas que NO son palabras bloqueadas
  blackTopicsAll: () => [{ kind: 'negra', name: 'couple kissing', description: '', critical: false }, { kind: 'negra', name: 'satanismo', description: '', critical: true }],
  familyBlockedTerms: () => P.words, familyWords: () => P.words, familyTopics: () => ({ white: [], black: [] }),
  notifyParent: (...a: unknown[]) => { P.notify.push(a); },
  notifyUnreviewed: (...a: unknown[]) => { P.unreviewed.push(a); },
}));

const G = await import('../searchGuard');
const { guionCrisis } = await import('../chat');
const { runAsUser } = await import('../requestContext');
const { config } = await import('../config');

const asIan = <T,>(fn: () => Promise<T>) => runAsUser('ian', fn);
const tabs = (q: string) => asIan(() => Promise.all([G.guardedPages(q), G.guardedImages(q), G.guardedVideos(q)]));
let n = 0;
const uniq = (q: string) => `${q} ${++n}` // el memo de 60 s es por consulta: cada caso con la suya

beforeEach(() => {
  J.input.mockReset().mockImplementation(async () => ({ tema: 'ninguno', en_lista_negra: false, es_critico: false, es_crisis: false }));
  J.output.mockReset().mockImplementation(async () => ({ veredicto: 'aprobado', mediosVetados: [] }));
  for (const f of Object.values(S)) f.mockClear();
  P.notify.length = 0; P.unreviewed.length = 0; P.words = [];
});

describe('Buscar con un CHICO: la consulta', () => {
  it('crisis: las TRES solapas devuelven el guion de contención, el juez corre UNA vez y el padre recibe UN aviso CON el texto; no se busca nada', async () => {
    J.input.mockImplementation(async () => ({ tema: 'autolesión', en_lista_negra: false, es_critico: false, es_crisis: true }));
    const q = uniq('me siento muy mal');
    const [p, i, v] = await tabs(q);
    for (const r of [p, i, v]) expect(r.block).toEqual({ kind: 'crisis', text: guionCrisis() });
    expect(J.input).toHaveBeenCalledTimes(1);
    expect(P.notify).toEqual([['crisis', q, 'el buscador']]);
    expect(S.pages).not.toHaveBeenCalled(); expect(S.videos).not.toHaveBeenCalled(); expect(S.expand).not.toHaveBeenCalled();
  });

  it('el NOMBRE de un tema negro DE FÁBRICA (no es palabra bloqueada) se veta sin modelo en las tres solapas', async () => {
    expect(config.blockedWords.some(w => /couple kissing|satanismo/i.test(w))).toBe(false); // el hueco del hallazgo
    for (const q of ['couple kissing', 'Satanismo para chicos']) {
      const [p, i, v] = await tabs(q);
      for (const r of [p, i, v]) expect(r.block?.kind, q).toBe('tema');
    }
    expect(J.input).not.toHaveBeenCalled();
    expect(S.pages).not.toHaveBeenCalled();
  });

  it('una palabra bloqueada (de fábrica o de la familia) en la consulta: bloqueo en las tres solapas sin modelo', async () => {
    const w = config.blockedWords.find(x => /^[\p{L} ]{4,}$/u.test(x))!;
    let [p, i, v] = await tabs(`videos de ${w}`);
    for (const r of [p, i, v]) expect(r.block).toEqual({ kind: 'tema', text: G.BLOCK_TEXT.palabra });
    P.words = ['volcanes'];
    [p, i, v] = await tabs('volcanes de Chile');
    for (const r of [p, i, v]) expect(r.block?.kind).toBe('tema');
    expect(J.input).not.toHaveBeenCalled();
  });

  it('lista negra según el juez de entrada → bloqueo (el texto del POC), sin buscar', async () => {
    J.input.mockImplementation(async () => ({ tema: 'ocultismo', en_lista_negra: true, es_critico: false, es_crisis: false }));
    const [p] = await tabs(uniq('rituales'));
    expect(p.block).toEqual({ kind: 'tema', text: G.BLOCK_TEXT.tema });
    expect(S.pages).not.toHaveBeenCalled();
    expect(P.notify).toEqual([]);
  });

  it('juez de entrada CAÍDO + frase de crisis: guion y aviso de crisis SIN CLASIFICAR (fail-closed, nada se busca)', async () => {
    J.input.mockImplementation(async () => { throw new Error('503'); });
    const q = uniq('quiero morirme');
    const [p, i, v] = await tabs(q);
    for (const r of [p, i, v]) expect(r.block).toEqual({ kind: 'crisis', text: guionCrisis() });
    expect(P.notify).toEqual([['crisis', q, 'el buscador', { unclassified: true }]]);
    expect(S.pages).not.toHaveBeenCalled();
  });

  it('juez de entrada CAÍDO sin frase de crisis: "falla" con la línea de cuidado, aviso sin clasificar, y el reintento vuelve a juzgar', async () => {
    J.input.mockImplementation(async () => { throw new Error('timeout'); });
    const q = uniq('dinosaurios');
    const [p] = await tabs(q);
    expect(p.block?.kind).toBe('falla');
    expect(p.block?.text).toMatch(/^Hubo un problema con la búsqueda\. Probá de nuevo\. Si te pasa algo/);
    expect(P.unreviewed).toEqual([[q, 'el buscador']]);
    expect(S.pages).not.toHaveBeenCalled();
    J.input.mockImplementation(async () => ({ tema: 'ninguno', en_lista_negra: false, es_critico: false, es_crisis: false }));
    await asIan(() => G.guardedPages(q));
    expect(J.input).toHaveBeenCalledTimes(2); // una falla no queda memorizada
  });
});

describe('Buscar con un CHICO: el juez de SALIDA por solapa', () => {
  it('Páginas: veto por ítem (título y resumen) con los temas negros y juez de salida sobre títulos Y resúmenes', async () => {
    S.pages.mockImplementation(async () => ({ results: [
      { title: 'Volcanes del mundo', link: 'https://es.wikipedia.org/wiki/Volc%C3%A1n', snippet: 'Un volcán es…' },
      { title: 'Historia', link: 'https://es.wikipedia.org/wiki/X', snippet: 'el satanismo en la edad media' },
      { title: 'Erupciones', link: 'https://es.wikipedia.org/wiki/E', snippet: 'Lava y ceniza' },
    ] }));
    J.output.mockImplementation(async () => ({ veredicto: 'aprobado', mediosVetados: ['Erupciones'] }));
    const r = await asIan(() => G.guardedPages(uniq('volcanes')));
    expect(r.results.map(x => x.title)).toEqual(['Volcanes del mundo']);
    const annex = J.output.mock.calls[0][0];
    expect(annex).toMatch(/Artículos sugeridos para leer: «Volcanes del mundo» \(resumen: Un volcán es…\) · «Erupciones»/);
    expect(annex).not.toContain('Historia'); // el vetado por tema negro ni llega al juez
  });

  it('juez de salida BLOQUEADO → la solapa vacía; juez de salida caído → vacía con "falla" (nunca deja pasar)', async () => {
    S.videos.mockImplementation(() => [{ videoId: 'aaaaaaaaaaa', title: 'Planetas' }, { videoId: 'bbbbbbbbbbb', title: 'Couple kissing compilation' }]);
    J.output.mockImplementation(async () => ({ veredicto: 'bloqueado', mediosVetados: [] }));
    const blocked = await asIan(() => G.guardedVideos(uniq('planetas')));
    expect(blocked).toEqual({ hits: [] });
    expect(J.output.mock.calls[0][0]).toMatch(/Videos que se mostrarán: «Planetas»$/); // el título con tema negro se vetó antes
    J.output.mockImplementation(async () => { throw new Error('JUDGE_SCHEMA'); });
    expect(await asIan(() => G.guardedVideos(uniq('planetas')))).toEqual({ block: { kind: 'falla', text: G.BLOCK_TEXT.fallaSolapa }, hits: [] });
  });

  it('Imágenes: los términos del expansor pasan veto + juez ANTES de buscarse, y un epígrafe con tema negro sale "Filtrado"', async () => {
    S.expand.mockImplementation(async () => [{ q: 'red panda', lente: null }, { q: 'couple kissing', lente: null }, { q: 'bamboo', lente: null }]);
    S.gallery.mockImplementation(async (terms: { q: string }[]) => terms.map((t, i) => ({ id: `img${i}`, thumb: '', full: '', title: i === 1 ? 'satanismo ritual' : `${t.q} foto`, source: 'Pixabay', pageUrl: '' })));
    J.output.mockImplementation(async () => ({ veredicto: 'aprobado', mediosVetados: ['«bamboo»'] }));
    const r = await asIan(() => G.guardedImages(uniq('pandas')));
    expect(J.output.mock.calls[0][0]).toMatch(/Imágenes que se buscarán y mostrarán: «red panda», «bamboo»$/);
    expect(S.gallery).toHaveBeenCalledWith([{ q: 'red panda', lente: null }]);
    expect(r.terms).toEqual(['red panda']);
  });

  it('un epígrafe con palabra bloqueada se devuelve como "Filtrado" (blocked), no con su contenido', async () => {
    S.expand.mockImplementation(async () => [{ q: 'red panda', lente: null }, { q: 'tree', lente: null }]);
    S.gallery.mockImplementation(async () => [{ id: 'a', thumb: 't', full: 'f', title: 'red panda', source: 'Pixabay', pageUrl: '' }, { id: 'b', thumb: 't', full: 'f', title: 'satanismo', source: 'Pixabay', pageUrl: '' }]);
    const r = await asIan(() => G.guardedImages(uniq('pandas')));
    expect(r.items).toEqual([{ id: 'a', thumb: 't', full: 'f', title: 'red panda', source: 'Pixabay', pageUrl: '' }, { id: 'veto-b', blocked: true, reason: 'palabras bloqueadas' }]);
  });
});

describe('Buscar con un ADULTO: los candados son del chico', () => {
  it('ni corte por tema negro ni jueces: las tres solapas como antes', async () => {
    S.pages.mockImplementation(async () => ({ results: [{ title: 'Satanismo (historia)', link: 'https://es.wikipedia.org/wiki/S', snippet: '' }] }));
    const r = await runAsUser('andres', () => G.guardedPages('satanismo'));
    expect(r.block).toBeUndefined();
    expect(r.results.length).toBe(1);
    expect(J.input).not.toHaveBeenCalled();
    expect(J.output).not.toHaveBeenCalled();
  });
});
