import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterAll, describe, expect, it, vi } from 'vitest';

/* Resultados de Learn: la fila entra a RAM recién cuando quedó en DISCO (FS-BASE-A; hallazgos learnResults.ts:174 de los dos
   workflows) y el cuerpo tiene tope (:134). learnResults.ts DE VERDAD con SERVER_ROOT en una carpeta TEMPORAL y un
   renameSync que falla a pedido (disco lleno, EPERM de un antivirus): antes, el 500 dejaba la fila en RAM como «ya
   completado», el reintento del cliente no cobraba NUNCA y la partida quedaba duplicada con la próxima escritura buena. */

const F = vi.hoisted(() => ({ failRename: 0 }));
vi.mock('node:fs', async (importOriginal) => {
  const a = await importOriginal<typeof import('node:fs')>();
  return { ...a, renameSync: (...args: Parameters<typeof a.renameSync>) => {
    if (F.failRename > 0) { F.failRename--; throw Object.assign(new Error('EPERM simulado'), { code: 'EPERM' }); }
    return a.renameSync(...args);
  } };
});
const T = vi.hoisted(() => ({ dir: '' }));
vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  const { mkdtempSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');
  T.dir = mkdtempSync(j(tmpdir(), 'innerith-learnres-'));
  mkdirSync(j(T.dir, 'data'));
  return { ...actual, SERVER_ROOT: T.dir };
});
const X = vi.hoisted(() => ({ paid: 0 }));
vi.mock('../progress', () => ({ addXp: (n: number) => { X.paid += n; return { xp: n }; }, registerContinue: () => {} }));
vi.mock('../learnRoutes', () => ({ catalogRoutes: () => [], routeTitle: () => undefined }));

const LR = await import('../learnResults');
const { runAsUser } = await import('../requestContext');
afterAll(() => { rmSync(T.dir, { recursive: true, force: true }); });

function call(method: string, body?: unknown, raw?: Buffer): Promise<{ status: number; body: any }> {
  const req = Readable.from(raw ? [raw] : body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;
  Object.assign(req, { method, url: '/api/learn/results', headers: { 'x-innerith-user': 'luna' } });
  return new Promise(resolve => {
    let status = 0;
    const res = { writeHead: (s: number) => { status = s; }, end: (r: string) => resolve({ status, body: JSON.parse(r) }) } as unknown as ServerResponse;
    void runAsUser('luna', () => LR.learnResultsRoutes(req, res, new URL('/api/learn/results', 'http://localhost')));
  });
}
const row = { target: 'ruta.x/t1', source: 'ruta:ruta.x/posta:p1', typeId: 'flashcards', outcome: 'completed', score: 5, maxScore: 5, pct: 1 };
const onDisk = () => { const f = join(T.dir, 'data', 'learn-results.json'); return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')).users.luna ?? []) : []; };

describe('POST /api/learn/results: disco primero (hallazgo learnResults.ts:174)', () => {
  it('si el disco falla: 500, NINGUNA fila en RAM ni en disco y sin pago; el reintento cobra UNA vez y deja UNA fila', async () => {
    F.failRename = 1;
    const fail = await call('POST', row);
    expect(fail).toEqual({ status: 500, body: { error: 'No pude guardar el resultado. Probá de nuevo.' } });
    expect((await call('GET')).body.rows).toEqual([]);
    expect(onDisk()).toEqual([]);
    expect(X.paid).toBe(0);
    const ok = await call('POST', row); // el reintento del cliente (learnData.ts reintenta los 5xx)
    expect(ok.status).toBe(200);
    expect(ok.body.awarded).toEqual({ ec: 30, xp: 30 }); // la primera vez SÍ paga
    expect((await call('GET')).body.rows.length).toBe(1);
    expect(onDisk().length).toBe(1);
    expect(X.paid).toBe(30);
  });

  it('una falla con filas previas vuelve EXACTO a lo de antes (y los ids nunca se reusan)', async () => {
    const before = (await call('GET')).body.rows;
    F.failRename = 1;
    expect((await call('POST', { ...row, target: 'ruta.x/t2' })).status).toBe(500);
    expect((await call('GET')).body.rows).toEqual(before);
    const ok = await call('POST', { ...row, target: 'ruta.x/t2' });
    expect(ok.body.row.id).toBeGreaterThan(before[before.length - 1].id + 1); // el id del intento fallido no se reusa
  });
});

describe('POST /api/learn/results: tope del cuerpo (hallazgo learnResults.ts:134)', () => {
  it('un cuerpo de más de 64 KB → 413 sin tocar nada; uno roto → 400', async () => {
    const n = (await call('GET')).body.rows.length;
    const big = Buffer.from(JSON.stringify({ ...row, skills: { x: 'y'.repeat(70 * 1024) } }));
    expect(await call('POST', undefined, big)).toEqual({ status: 413, body: { error: 'El resultado es demasiado grande.' } });
    expect(await call('POST', undefined, Buffer.from('{roto'))).toEqual({ status: 400, body: { error: 'Body inválido.' } });
    expect(await call('POST', undefined, Buffer.from('[1,2]'))).toEqual({ status: 400, body: { error: 'Body inválido.' } });
    expect((await call('GET')).body.rows.length).toBe(n);
  });
});
