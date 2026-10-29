import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* FS-BASE-B, dependencias externas (WF3):
   · hallazgo search.ts:13: Serper, Wikipedia REST y Jina llevan timeout (antes, sin signal: hasta 300 s por fetch).
   · hallazgo extract.ts:155: el fallback markdown de Jina mira r.ok (un 429 quedaba guardado 7 días como EL artículo).
   · hallazgo images.ts:109: una falla pasajera de Pixabay/Commons/moderación NO se cachea 7 días como el resultado.
   search.ts, extract.ts e images.ts DE VERDAD con `fetch` simulado (vi.stubGlobal): nada sale a la red. */

vi.mock('../parent', () => ({ familyBlockedTerms: () => [] }));
vi.mock('../llm', () => ({
  complete: async () => { throw new Error('sin modelo en el test'); },
  openai: () => ({ moderations: { create: async () => ({ results: [{ flagged: false }] }) } }),
  withBudget: (_b: string, _s: unknown, fn: (o: object) => Promise<unknown>) => fn({}),
}));

type Call = { url: string; init?: RequestInit };
const calls: Call[] = [];
let handler: (url: string, init?: RequestInit) => Promise<Response> = async () => new Response('{}');
beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal('fetch', (url: string | URL, init?: RequestInit) => { calls.push({ url: String(url), init }); return handler(String(url), init); });
  process.env.SERPER_API_KEY = 'test-no-es-una-clave';
  process.env.PIXABAY_API_KEY = 'test-no-es-una-clave';
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

const { searchPages } = await import('../search');
const { extractArticle } = await import('../extract');
const { searchImageTerm } = await import('../images');
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'Content-Type': 'application/json' } });

describe('todo fetch externo lleva un AbortSignal (timeout)', () => {
  it('Serper: cada lote de la búsqueda de páginas', async () => {
    handler = async () => json({ organic: [] });
    await searchPages('volcanes');
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c.init?.signal, c.url).toBeInstanceOf(AbortSignal);
  });
  it('Wikipedia REST (summary + html) y Jina (html + markdown)', async () => {
    handler = async (url) => (url.includes('/summary/') ? json({ title: 'Saturno' }) : new Response('<html><body><p>corto</p></body></html>'));
    await extractArticle('https://es.wikipedia.org/wiki/Saturno').catch(() => null);
    await extractArticle('https://concepto.de/volcan/').catch(() => null);
    expect(calls.map(c => new URL(c.url).hostname)).toEqual(expect.arrayContaining(['es.wikipedia.org', 'r.jina.ai']));
    for (const c of calls) expect(c.init?.signal, c.url).toBeInstanceOf(AbortSignal);
  });
});

describe('el fallback markdown de Jina mira r.ok (hallazgo extract.ts:155)', () => {
  it('un 429 de Jina NO se convierte en "el artículo": tira (getArticle responde error y no cachea)', async () => {
    const LIMIT = 'Error 429: RateLimitTriggeredError — per IP rate limit exceeded, please slow down and retry in a minute.';
    handler = async (url, init) => {
      const md = (init?.headers as Record<string, string> | undefined)?.Accept === 'text/plain';
      if (md) return new Response(LIMIT, { status: 429 });
      return new Response('<html><body><p>poco texto para Readability</p></body></html>'); // html: no alcanza → fallback
    };
    await expect(extractArticle('https://concepto.de/volcan/')).rejects.toThrow(/JINA_429/);
  });
});

describe('imágenes: una falla pasajera no se cachea 7 días (hallazgo images.ts:109)', () => {
  it('Pixabay en 429: sale sin sus fotos y ese resultado vence en 1 minuto; después vuelve a preguntar y las trae', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T10:00:00Z'));
    let pixabayDown = true;
    handler = async (url) => {
      if (url.startsWith('https://pixabay.com/')) {
        return pixabayDown ? json({ error: 'Too Many Requests' }, 429)
          : json({ hits: [{ id: 7, tags: 'volcano, lava', pageURL: 'https://pixabay.com/p/7', webformatURL: 'https://cdn.pixabay.com/7_640.jpg', largeImageURL: 'https://cdn.pixabay.com/7.jpg' }] });
      }
      return json({ query: { pages: {} } }); // Commons: sin resultados (responde bien)
    };
    expect(await searchImageTerm('volcano')).toEqual([]);
    const n = calls.length;
    vi.setSystemTime(new Date('2026-10-29T10:00:30Z'));
    expect(await searchImageTerm('volcano')).toEqual([]); // dentro del minuto: el degradado (no se martilla a Pixabay)
    expect(calls.length).toBe(n);
    pixabayDown = false;
    vi.setSystemTime(new Date('2026-10-29T10:01:01Z'));
    const items = await searchImageTerm('volcano'); // antes: [] guardado 7 días
    expect(items.map(i => i.id)).toEqual(['px7']);
    expect(calls.length).toBeGreaterThan(n);
    const m = calls.length;
    vi.setSystemTime(new Date('2026-10-30T10:00:00Z'));
    expect((await searchImageTerm('volcano')).map(i => i.id)).toEqual(['px7']); // el completo sí vale días
    expect(calls.length).toBe(m);
  });
});
