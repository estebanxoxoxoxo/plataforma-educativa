import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivityResultRow } from '../../../../api/types';
import type { ActivityResult } from '../../../../learn/activity';

/* COLA de guardado de resultados de Learn (tanda "Deudas técnicas", 14-oct): reintentos a los 2 s / 8 s / 30 s, ORDEN
   de las filas preservado (FIFO de a uno), fila optimista UNA sola vez y reemplazada en su lugar, console.error si muere y
   sin reintentos para un rechazo 4xx. `fetch` simulado (el cliente http real de src/api) y timers falsos. Cada test
   carga el módulo de nuevo (la cola es estado de módulo). */

type Reply = { status: number; body?: unknown } | 'network';
type Call = { url: string; method: string; body: { target?: string } | null };

let calls: Call[] = [];
let serverRows: ActivityResultRow[] = [];
let nextId = 100;
/** Respuestas programadas para los POST de /api/learn/results (en orden); sin programar = 200 con la fila nueva. */
let postPlan: Reply[] = [];

function respond(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const method = init?.method ?? 'GET';
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  calls.push({ url, method, body });
  if (url === '/api/learn-routes') return respond(200, { routes: [] });
  if (url === '/api/learn-routes/definitions') return respond(200, { definitions: [] });
  if (url === '/api/learn/results' && method === 'GET') return respond(200, { rows: serverRows });
  if (url === '/api/learn/results' && method === 'POST') {
    const plan = postPlan.shift();
    if (plan === 'network') throw new TypeError('Failed to fetch');
    if (plan && plan.status !== 200) return respond(plan.status, plan.body ?? { error: 'x' });
    const row = { ...body, id: nextId++, finishedAt: Date.now() } as ActivityResultRow;
    serverRows = [...serverRows, row];
    return respond(200, { row, awarded: { ec: 30, xp: 30 } });
  }
  return respond(404, { error: 'not found' });
});

const result = (score = 3): ActivityResult => ({
  activityId: 'flashcards', version: 1, startedAt: 0, finishedAt: 1, durationMs: 1, outcome: 'completed',
  score, maxScore: 3, stats: { correct: score, wrong: 0, hintsUsed: 0, bestStreak: score }, config: null, definitionId: 'd', seed: 1,
});
const input = (target: string) => ({ target, source: `ruta:r/posta:${target}`, result: result() });
const posts = () => calls.filter((c) => c.method === 'POST').map((c) => c.body?.target);

async function freshModule() {
  vi.resetModules();
  const m = await import('../learnData');
  await m.loadLearn(); // filas iniciales del "server" (la cola necesita el camino cargado para la optimista)
  return m;
}

beforeEach(() => {
  vi.useFakeTimers();
  calls = []; serverRows = [{ id: 1, target: 'viejo', source: 's', typeId: 'quiz', outcome: 'completed', score: 1, maxScore: 1, pct: 1, finishedAt: 1 }];
  nextId = 100; postPlan = [];
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('cola de guardado de resultados (learnData.recordResult)', () => {
  it('sin fallas: un solo POST, la fila del server entra y paga', async () => {
    const m = await freshModule();
    const awarded = await m.recordResult(input('t1'));
    expect(awarded).toEqual({ ec: 30, xp: 30 });
    expect(posts()).toEqual(['t1']);
    await vi.waitFor(() => expect(m.getLearnData().rows?.map((r) => r.id)).toEqual([1, 100]));
  });

  it('reintenta a los 2 s, 8 s y 30 s (backoff exacto) y la optimista aparece UNA vez y se reemplaza en su lugar', async () => {
    const m = await freshModule();
    postPlan = ['network', { status: 503 }, 'network']; // falla 3 veces; el 4.º intento (3.er reintento) anda
    let awarded: unknown = 'pendiente';
    void m.recordResult(input('t1')).then((a) => { awarded = a; });
    await vi.advanceTimersByTimeAsync(0);
    expect(posts()).toEqual(['t1']);
    const opt = () => (m.getLearnData().rows ?? []).filter((r) => r.id < 0);
    expect(opt()).toHaveLength(1); // la optimista, en el camino
    expect(opt()[0].target).toBe('t1');
    await vi.advanceTimersByTimeAsync(1999);
    expect(posts()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(posts()).toHaveLength(2); // 2 s
    await vi.advanceTimersByTimeAsync(7999);
    expect(posts()).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(posts()).toHaveLength(3); // + 8 s
    expect(opt()).toHaveLength(1); // re-encolar no la duplica
    await vi.advanceTimersByTimeAsync(29999);
    expect(posts()).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(posts()).toHaveLength(4); // + 30 s → anda
    await vi.waitFor(() => expect(awarded).toEqual({ ec: 30, xp: 30 }));
    const rows = m.getLearnData().rows ?? [];
    expect(rows.filter((r) => r.target === 't1')).toHaveLength(1); // ni optimista ni duplicada
    expect(rows.map((r) => r.id)).toEqual([1, 100]);
  });

  it('conserva el ORDEN: lo que se juega después espera a que se guarde lo anterior', async () => {
    const m = await freshModule();
    postPlan = ['network']; // el primero falla una vez
    const a = m.recordResult(input('primero'));
    const b = m.recordResult(input('segundo'));
    await vi.advanceTimersByTimeAsync(0);
    expect(posts()).toEqual(['primero']); // el segundo NO salió todavía
    const pend = (m.getLearnData().rows ?? []).filter((r) => r.id < 0).map((r) => r.target);
    expect(pend).toEqual(['primero']); // el segundo todavía no falló: no es optimista
    await vi.advanceTimersByTimeAsync(2000);
    await Promise.all([a, b]);
    expect(posts()).toEqual(['primero', 'primero', 'segundo']); // reintento del primero y recién ahí el segundo
    expect(serverRows.map((r) => r.target)).toEqual(['viejo', 'primero', 'segundo']); // el server las tiene en orden
    await vi.waitFor(() => expect((m.getLearnData().rows ?? []).map((r) => r.target)).toEqual(['viejo', 'primero', 'segundo']));
  });

  it('una relectura del camino mientras espera no pierde la optimista (y la deja al final, en orden)', async () => {
    const m = await freshModule();
    postPlan = ['network'];
    const p = m.recordResult(input('pendiente'));
    await vi.advanceTimersByTimeAsync(0);
    await m.loadLearn(); // relectura (otra vista, F5 lógico): el server todavía no la tiene
    expect((m.getLearnData().rows ?? []).map((r) => [r.target, r.id < 0])).toEqual([['viejo', false], ['pendiente', true]]);
    await vi.advanceTimersByTimeAsync(2000);
    await p;
    await vi.waitFor(() => expect((m.getLearnData().rows ?? []).map((r) => r.id)).toEqual([1, 100]));
  });

  it('si muere (3 reintentos fallidos): console.error como antes, sin optimista, undefined, y la cola sigue', async () => {
    const m = await freshModule();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    postPlan = ['network', 'network', 'network', 'network'];
    const a = m.recordResult(input('perdido'));
    const b = m.recordResult(input('siguiente'));
    await vi.advanceTimersByTimeAsync(2000 + 8000 + 30000);
    expect(await a).toBeUndefined();
    expect(await b).toEqual({ ec: 30, xp: 30 });
    expect(err).toHaveBeenCalledTimes(1);
    expect(String(err.mock.calls[0][0])).toContain('no pude grabar el resultado');
    expect(posts()).toEqual(['perdido', 'perdido', 'perdido', 'perdido', 'siguiente']);
    await vi.waitFor(() => expect((m.getLearnData().rows ?? []).map((r) => r.target)).toEqual(['viejo', 'siguiente']));
  });

  it('un rechazo 4xx (p. ej. 403 por horario) no se reintenta ni bloquea la cola', async () => {
    const m = await freshModule();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    postPlan = [{ status: 403, body: { error: 'horario' } }];
    const a = m.recordResult(input('cerrado'));
    const b = m.recordResult(input('despues'));
    expect(await a).toBeUndefined();
    expect(await b).toEqual({ ec: 30, xp: 30 });
    expect(posts()).toEqual(['cerrado', 'despues']);
    expect(err).toHaveBeenCalledTimes(1);
    expect((m.getLearnData().rows ?? []).some((r) => r.id < 0)).toBe(false);
  });
});
