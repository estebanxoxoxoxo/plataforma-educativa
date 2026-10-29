import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/* POST /api/create/audit (FS-BASE-A; hallazgo create.ts:211 + revisión del módulo): create.ts, auditView.ts y filters.ts DE
   VERDAD; el modelo (con sus llamadas a herramientas), Serper y Wikipedia simulados.
   · Con un CHICO: buscar_web va por la lista blanca (searchPages de Buscar), lo de Wikipedia y las fuentes del resultado
     pasan la lista blanca y las palabras, y un resumen con palabra bloqueada no se muestra (ok:false).
   · Con el ADULTO (el editor): Serper amplio, como el POC.
   · `lang` ya no llega crudo al hostname de Wikipedia (SSRF con lang = "evil.example#"). */

const M = vi.hoisted(() => ({ summary: 'Las fuentes lo confirman.', calls: [] as string[], urls: [] as string[] }));
vi.mock('../llm', () => ({
  tool: (name: string) => ({ type: 'function', name }),
  parseJudgeJson: (raw: string) => JSON.parse(raw),
  completeWithTools: async (o: { onToolCall: (n: string, a: Record<string, unknown>) => Promise<{ output: string }> }) => {
    const web = JSON.parse((await o.onToolCall('buscar_web', { query: 'júpiter planeta más grande' })).output).results ?? [];
    const wiki = JSON.parse((await o.onToolCall('buscar_wikipedia', { query: 'Júpiter' })).output).results ?? [];
    const all = [...web, ...wiki] as { title: string; url: string; snippet: string }[];
    M.urls = all.map(s => s.url);
    return { text: JSON.stringify({ status: 'confirmado', confidence: 0.9, summary: M.summary, sources: all.map(s => ({ ...s, agrees: 'si' })) }) };
  },
}));
vi.mock('../search', () => ({
  searchPages: async (q: string) => { M.calls.push(`whitelist:${q}`); return { results: [{ title: 'Júpiter (planeta)', link: 'https://es.wikipedia.org/wiki/J%C3%BApiter', snippet: 'el más grande' }] }; },
}));
vi.mock('../parent', () => ({ blackTopicsAll: () => [{ kind: 'negra', name: 'satanismo', description: '', critical: true }], familyBlockedTerms: () => [] }));

const fetches: string[] = [];
vi.stubGlobal('fetch', async (url: string) => {
  fetches.push(url);
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'content-type': 'application/json' } });
  const u = new URL(url);
  if (u.hostname === 'google.serper.dev') return json({ organic: [
    { title: 'Júpiter en un blog', link: 'https://blog-abierto.example/jupiter', snippet: 'opinión de alguien' },
    { title: 'Foro', link: 'https://foro.example/satanismo', snippet: 'el satanismo y los planetas' },
  ] });
  if (u.hostname.endsWith('.wikipedia.org')) return json({ pages: [{ key: 'Júpiter_(planeta)', title: 'Júpiter (planeta)', excerpt: 'el planeta más grande' }] });
  return json({});
});
process.env.OPENAI_API_KEY = 'sk-falsa-de-test';
process.env.SERPER_API_KEY = 'serper-falsa-de-test';

const { auditFact, createRoutes } = await import('../create');
const { runAsUser } = await import('../requestContext');

function audit(user: string, payload: unknown): Promise<{ status: number; body: any }> {
  const req = Readable.from([Buffer.from(JSON.stringify({ payload }))]) as unknown as IncomingMessage;
  Object.assign(req, { method: 'POST', url: '/api/create/audit', headers: { 'x-innerith-user': user } });
  return new Promise(resolve => {
    let status = 0;
    const res = { writeHead: (s: number) => { status = s; }, end: (raw: string) => resolve({ status, body: JSON.parse(raw) }) } as unknown as ServerResponse;
    void runAsUser(user, () => createRoutes(req, res, new URL('/api/create/audit', 'http://localhost')));
  });
}
const fact = { statement: 'Júpiter es el planeta más grande', front: 'Júpiter', back: 'el más grande', quote: '', kind: 'property' };
beforeEach(() => { M.calls.length = 0; fetches.length = 0; M.summary = 'Las fuentes lo confirman.'; });

describe('auditoría de /crear con un CHICO: nada de la web abierta (hallazgo create.ts:211)', () => {
  it('buscar_web va por la lista blanca (no Serper amplio) y las fuentes son solo de sitios aprobados', async () => {
    const r = await audit('ian', { fact, lang: 'es' });
    expect(r.body.ok).toBe(true);
    expect(M.calls).toEqual(['whitelist:júpiter planeta más grande']);
    expect(fetches.some(u => u.includes('google.serper.dev'))).toBe(false);
    expect(r.body.result.sources.map((s: { url: string }) => new URL(s.url).hostname)).toEqual(['es.wikipedia.org', 'es.wikipedia.org']);
  });

  it('un resumen con una palabra o un tema de la lista negra no se le muestra (ok:false neutro)', async () => {
    M.summary = 'Según algunos, el satanismo…';
    expect((await audit('luna', { fact })).body).toEqual({ ok: false, error: 'El resultado de esta auditoría no se puede mostrar.' });
  });
});

describe('auditoría de /crear con el ADULTO (el editor): como el POC', () => {
  it('Serper amplio y las fuentes de la web abierta, tal cual', async () => {
    const r = await audit('andres', { fact });
    expect(r.body.ok).toBe(true);
    expect(fetches.some(u => u.includes('google.serper.dev'))).toBe(true);
    expect(r.body.result.sources.map((s: { url: string }) => s.url)).toContain('https://blog-abierto.example/jupiter');
  });
});

describe('lang nunca llega crudo al hostname (SSRF)', () => {
  it('lang = "evil.example#" → la búsqueda va a es.wikipedia.org; "pt-BR" → pt.wikipedia.org', async () => {
    await audit('andres', { fact, lang: 'evil.example#' });
    const hosts = fetches.filter(u => !u.includes('serper')).map(u => new URL(u).hostname);
    expect(hosts).toEqual(['es.wikipedia.org']);
    fetches.length = 0;
    await audit('andres', { fact, lang: 'pt-BR' });
    expect(fetches.filter(u => !u.includes('serper')).map(u => new URL(u).hostname)).toEqual(['pt.wikipedia.org']);
  });

  it('doble guarda: auditFact (sin pasar por la ruta) tampoco lleva un lang crudo al hostname', async () => {
    await runAsUser('andres', () => auditFact(fact, { lang: 'evil.example#' }));
    expect(fetches.filter(u => !u.includes('serper')).map(u => new URL(u).hostname)).toEqual(['es.wikipedia.org']);
  });
});
