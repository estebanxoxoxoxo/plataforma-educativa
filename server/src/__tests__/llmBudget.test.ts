import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/* FS-BASE-B (hallazgo llm.ts:6): cada llamada al modelo tiene un PRESUPUESTO de tiempo y, vencido, TIRA — y en el chat eso
   cae en el MISMO camino que un juez caído de FS-BASE-A (onInputJudgeDown: fail-closed con la línea de cuidado + aviso "sin
   clasificar", o el guion de crisis si la red de frases pega). Antes: los defaults del SDK (600 s × 3 intentos; con undici,
   ~15 min) y el chico mirando "pensando…". llm.ts, judge.ts y chat.ts DE VERDAD contra un server LOCAL que acepta la
   conexión y NUNCA responde (OPENAI_BASE_URL; la "clave" es de mentira). Los plazos se achican 100× con la perilla de
   pruebas INNERITH_LLM_TIME_SCALE (juez: 30 s → 300 ms; principal: 90 s → 900 ms). */

const P = vi.hoisted(() => ({ notify: [] as unknown[][], unreviewed: [] as unknown[][] }));
vi.mock('../parent', () => ({
  blackTopicsAll: () => [], familyTopics: () => ({ white: [], black: [] }), familyWords: () => [], familyBlockedTerms: () => [],
  notifyParent: (...a: unknown[]) => { P.notify.push(a); },
  notifyUnreviewed: (...a: unknown[]) => { P.unreviewed.push(a); },
}));
vi.mock('../search', () => ({ searchPages: async () => ({ results: [] }) }));
vi.mock('../articles', () => ({ articleTextForChat: async () => undefined }));
vi.mock('../images', () => ({ expandQuery: async () => [], searchImageTerm: async () => [] }));
vi.mock('../videos', () => ({ getCatalogVideo: () => undefined, loadVideoMeta: async () => {}, searchVideos: () => [], toVideoResult: (v: unknown) => v, catalogSize: () => 0 }));

let server: Server;
let hits = 0;
beforeAll(async () => {
  server = createServer(() => { hits++; /* acepta y no responde nunca: el cuelgue que el SDK esperaba 15 min */ });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
  process.env.OPENAI_API_KEY = 'test-no-es-una-clave';
  process.env.INNERITH_LLM_TIME_SCALE = '0.01';
});
afterAll(() => { server.closeAllConnections(); server.close(); delete process.env.INNERITH_LLM_TIME_SCALE; });
beforeEach(() => { P.notify.length = 0; P.unreviewed.length = 0; hits = 0; });

const L = await import('../llm');
const { judgeInput } = await import('../judge');
const { sendChildMessage } = await import('../chat');
const { runAsUser } = await import('../requestContext');

describe('el presupuesto de cada llamada', () => {
  it('el juez de entrada contra un OpenAI colgado TIRA LlmTimeoutError en su plazo (antes: ~15 min)', async () => {
    const t0 = Date.now();
    const e = await judgeInput('hola').catch(x => x);
    expect(e).toBeInstanceOf(L.LlmTimeoutError);
    expect(e.budget).toBe('judge');
    expect(Date.now() - t0).toBeLessThan(2000); // 300 ms de plazo (× 0,01) más el arranque
    expect(L.budgetDeadlineMs('judge')).toBe(30_000);
    expect(L.budgetDeadlineMs('principal')).toBe(90_000);
  });
  it('un abort del LLAMADOR no se disfraza de vencimiento (el chat cancela el principal cuando el juez bloquea)', async () => {
    const c = new AbortController();
    const p = L.complete({ model: 'x', messages: [{ role: 'user', content: 'hola' }], maxTokens: 5, signal: c.signal, budget: 'aux' });
    setTimeout(() => c.abort(), 20);
    const e = await p.catch(x => x);
    expect(e).not.toBeInstanceOf(L.LlmTimeoutError);
  });
});

describe('chat: el vencimiento desemboca en el fail-closed de FS-BASE-A', () => {
  it('sin frase de crisis: fail-closed con la línea de cuidado y el aviso "sin clasificar" (en ~0,3 s, no 15 min)', async () => {
    const t0 = Date.now();
    const r = await runAsUser('ian', () => sendChildMessage([], '¿cuántas patas tiene una araña?'));
    expect(r.kind).toBe('failclosed');
    expect(r.text).toMatch(/adulto de confianza/);
    expect(r.trace).toMatch(/juez de entrada falló/);
    expect(P.unreviewed).toEqual([['¿cuántas patas tiene una araña?', 'el chat con el asistente']]);
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(hits).toBeGreaterThan(0); // de verdad le pegó al modelo (colgado)
  });
  it('con una frase de crisis: el guion de contención y el aviso de crisis SIN CLASIFICAR', async () => {
    const r = await runAsUser('ian', () => sendChildMessage([], 'me quiero morir'));
    expect(r.kind).toBe('crisis');
    expect(P.notify).toEqual([['crisis', 'me quiero morir', 'el chat con el asistente', { unclassified: true }]]);
  });
});
