import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* Búsqueda de páginas según el idioma del pedido (search.ts DE VERDAD, `fetch` simulado: nada sale a la red).
   · EN → Serper con gl us / hl en; ES → los de config (searchGl/searchHl), como siempre.
   · Wikimedia (commons, upload…) nunca es artículo: no va en los site: ni vuelve como resultado, en los dos idiomas.
   · Stop words inglesas en el re-rank solo en EN; queryTokens castellano idéntico al de siempre. */

vi.mock('../parent', () => ({ familyBlockedTerms: () => [] }));

type Call = { url: string; body: { q: string; gl: string; hl: string } };
const calls: Call[] = [];
let organic: { title: string; link: string; snippet?: string; position?: number }[] = [];
beforeEach(() => {
  calls.length = 0;
  organic = [];
  vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) });
    return new Response(JSON.stringify({ organic }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  process.env.SERPER_API_KEY = 'test-no-es-una-clave';
});
afterEach(() => { vi.unstubAllGlobals(); });

const { searchPages, queryTokens } = await import('../search');
const { runAsUser } = await import('../requestContext');
const { config, whitelistSites } = await import('../config');

const en = <T,>(fn: () => Promise<T> | T) => runAsUser('ian', fn, 'en');
const es = <T,>(fn: () => Promise<T> | T) => runAsUser('ian', fn, 'es');

describe('Serper en el idioma del pedido', () => {
  it('EN manda gl us / hl en en cada lote', async () => {
    await en(() => searchPages('greatest common divisor'));
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) { expect(c.body.gl).toBe('us'); expect(c.body.hl).toBe('en'); }
  });
  it('ES manda los de config', async () => {
    await es(() => searchPages('máximo común divisor'));
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) { expect(c.body.gl).toBe(config.searchGl); expect(c.body.hl).toBe(config.searchHl); }
  });
});

describe('Wikimedia nunca es artículo', () => {
  it('wikimedia.org sigue en la lista blanca (otros usos) pero no aparece en los site: de ningún idioma', async () => {
    expect(whitelistSites()).toContain('wikimedia.org');
    for (const run of [en, es]) {
      calls.length = 0;
      await run(() => searchPages('volcanoes', { maxBatches: 99 }));
      expect(calls.length).toBeGreaterThan(0);
      for (const c of calls) expect(c.body.q).not.toMatch(/wikimedia/i);
    }
  });
  it('un hit de commons/upload.wikimedia.org no vuelve; uno de es.wikipedia (en la lista blanca) sí', async () => {
    organic = [
      { title: 'File:Greatest common divisor chart.png', link: 'https://commons.wikimedia.org/wiki/File:Greatest_common_divisor_chart.png', snippet: 'greatest common divisor', position: 1 },
      { title: 'Greatest common divisor chart', link: 'https://upload.wikimedia.org/wikipedia/commons/x/xx/gcd.png', snippet: 'greatest common divisor', position: 2 },
      { title: 'Greatest common divisor', link: 'https://es.wikipedia.org/wiki/Greatest_common_divisor', snippet: 'In mathematics, the greatest common divisor…', position: 3 },
    ];
    for (const run of [en, es]) {
      const { results } = await run(() => searchPages('greatest common divisor'));
      expect(results.map(r => r.link)).toEqual(['https://es.wikipedia.org/wiki/Greatest_common_divisor']);
    }
  });
});

describe('stop words del re-rank', () => {
  it('en EN se descartan las inglesas', () => {
    expect(en(() => queryTokens('how and what are the volcanoes for kids'))).toEqual(['volcanoes']);
    expect(queryTokens('what is the greatest common divisor', 'en')).toEqual(['greatest', 'common', 'divisor']);
  });
  it('en ES el resultado es el de siempre (las inglesas cuentan; las castellanas no)', () => {
    expect(es(() => queryTokens('how and what are the volcanoes'))).toEqual(['how', 'and', 'what', 'are', 'the', 'volcanoes']);
    expect(es(() => queryTokens('¿Cómo son los volcanes para niños?'))).toEqual(['son', 'volcanes']);
    expect(queryTokens('máximo común divisor de los números')).toEqual(['maximo', 'comun', 'divisor', 'numeros']);
  });
});
