import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* El chat (chat.ts sendChildMessage) DE VERDAD, con el juez de VERDAD (judge.ts) y el modelo simulado ('../llm'):
   · FS-BASE-A, hallazgo ALTA chat.ts:246: si el principal falla ANTES de que el juez de entrada termine, el rechazo quedaba
     sin handler y Node 24 tumbaba el server (exit 1). Acá: ningún 'unhandledRejection' y el chico recibe el fail-closed.
   · hallazgo chat.ts:252: con el juez caído una crisis no se pierde en silencio (red de frases → guion + aviso "sin
     clasificar"; si no pega → fail-closed con la línea de cuidado + aviso sin clasificar agrupado).
   · hallazgo judge.ts:36: un veredicto de entrada fuera de esquema es un juez caído (antes fallaba ABIERTO).
   Se mockean los dominios que el chat toca y acá no importan (búsquedas, artículos, imágenes, videos) y la config del
   padre (con espías en los avisos). */

const L = vi.hoisted(() => ({
  judgeIn: null as null | (() => Promise<{ text: string }>),
  principal: null as null | ((signal?: AbortSignal) => Promise<{ text: string }>),
}));
vi.mock('../llm', () => ({
  complete: vi.fn(async (o: { messages: { content: string }[] }) => {
    // el juez de SALIDA (si llega) aprueba; el de ENTRADA hace lo que diga el caso
    if (/veredicto/.test(o.messages[0].content) && !/es_crisis/.test(o.messages[0].content)) return { text: '{"veredicto":"aprobado","motivo":"","cita":"","mediosVetados":[]}' };
    return L.judgeIn!();
  }),
  completeWithTools: vi.fn((o: { signal?: AbortSignal }) => L.principal!(o.signal)),
  spotlight: (s: string) => s,
  tool: (name: string) => ({ type: 'function', name }),
  parseJudgeJson: (raw: string) => {
    const c = raw.replace(/```json|```/g, '').trim(); const a = c.indexOf('{'), b = c.lastIndexOf('}');
    if (a === -1 || b === -1) throw new Error('JUDGE_PARSE');
    return JSON.parse(c.slice(a, b + 1));
  },
}));
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

const { guionCrisis, sendChildMessage } = await import('../chat');
const { runAsUser } = await import('../requestContext');
const { ov } = await import('../config');

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const OK_IN = '{"tema":"ninguno","en_lista_negra":false,"es_critico":false,"es_crisis":false}';
const send = (text: string) => runAsUser('ian', () => sendChildMessage([], text));
/** El principal que respeta el abort (como el SDK): rechaza con un abort cuando el chat lo cancela. */
const abortable = (signal?: AbortSignal) => new Promise<{ text: string }>((_, rej) => signal?.addEventListener('abort', () => rej(new Error('aborted'))));

let unhandled: unknown[] = [];
const onUnhandled = (e: unknown) => { unhandled.push(e); };
beforeEach(() => { unhandled = []; P.notify.length = 0; P.unreviewed.length = 0; process.on('unhandledRejection', onUnhandled); });
afterEach(() => { process.off('unhandledRejection', onUnhandled); });

describe('chat: el principal falla ANTES que el juez de entrada (hallazgo ALTA chat.ts:246)', () => {
  it('no queda ningún rechazo sin manejar (antes: exit 1 del server) y el chico recibe el fail-closed', async () => {
    L.principal = async () => { await sleep(10); throw new Error('400 simulado (no reintentable)'); };
    L.judgeIn = async () => { await sleep(80); return { text: OK_IN }; };
    const r = await send('¿Por qué el cielo es azul?');
    await sleep(20); // por si el rechazo se reporta en un tick posterior
    expect(unhandled).toEqual([]);
    expect(r.kind).toBe('failclosed');
    expect(r.trace).toMatch(/principal falló/);
  });

  it('20 veces seguidas (la moneda al aire del hallazgo): 0 rechazos sin manejar', async () => {
    L.principal = async () => { await sleep(1); throw new Error('503 simulado tras reintentos'); };
    L.judgeIn = async () => { await sleep(15); return { text: OK_IN }; };
    const rs = await Promise.all(Array.from({ length: 20 }, () => send('hola')));
    await sleep(20);
    expect(unhandled).toEqual([]);
    expect(rs.every(r => r.kind === 'failclosed')).toBe(true);
  });
});

describe('chat: juez de entrada caído (hallazgo chat.ts:252): la crisis no se pierde en silencio', () => {
  it('con una frase de crisis: el GUION de contención (no el "probá en un ratito") y el aviso de crisis SIN CLASIFICAR al padre', async () => {
    L.principal = abortable;
    L.judgeIn = async () => { throw new Error('503 del juez'); };
    const r = await send('me quiero morir');
    expect(r.kind).toBe('crisis');
    expect(r.text).toBe(guionCrisis());
    expect(r.childContextText).toMatch(/protocolo de contención/);
    expect(P.notify).toEqual([['crisis', 'me quiero morir', 'el chat con el asistente', { unclassified: true }]]);
    expect(P.unreviewed).toEqual([]);
  });

  it('sin frase de crisis: fail-closed CON la línea de cuidado y el aviso sin clasificar (antes: nada para el padre)', async () => {
    L.principal = abortable;
    L.judgeIn = async () => { throw new Error('timeout del juez'); };
    const r = await send('¿cómo vuelan los aviones?');
    expect(r.kind).toBe('failclosed');
    expect(r.text).toContain(ov.text('copy.failClosed'));
    expect(r.text).toMatch(/adulto de confianza/);
    expect(P.unreviewed).toEqual([['¿cómo vuelan los aviones?', 'el chat con el asistente']]);
    expect(P.notify).toEqual([]);
  });

  it('veredicto de entrada FUERA DE ESQUEMA ({}, "true" en texto, campo faltante) = juez caído: nunca pasa como "sin crisis" (hallazgo judge.ts:36)', async () => {
    L.principal = abortable;
    for (const bad of ['{}', '{"tema":"x","en_lista_negra":"false","es_critico":false,"es_crisis":false}', '{"tema":"x","en_lista_negra":false,"es_critico":false}']) {
      P.notify.length = 0; P.unreviewed.length = 0;
      L.judgeIn = async () => ({ text: bad });
      const crisis = await send('quiero desaparecer');
      expect(crisis.kind, bad).toBe('crisis');
      expect(P.notify[0]?.[3], bad).toEqual({ unclassified: true });
      L.judgeIn = async () => ({ text: bad });
      const normal = await send('contame de los volcanes');
      expect(normal.kind, bad).toBe('failclosed');
    }
  });

  it('con el juez SANO y crisis: el camino de siempre (aviso de crisis clasificado, sin "sin clasificar")', async () => {
    L.principal = abortable;
    L.judgeIn = async () => ({ text: '{"tema":"autolesión","en_lista_negra":false,"es_critico":false,"es_crisis":true}' });
    const r = await send('me quiero morir');
    expect(r.kind).toBe('crisis');
    expect(P.notify).toEqual([['crisis', 'me quiero morir', 'el chat con el asistente']]);
  });
});
