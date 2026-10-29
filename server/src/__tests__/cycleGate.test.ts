import { rmSync } from 'node:fs';
import { Readable } from 'node:stream';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* 29-oct — Ciclo del día con los rangos como MOMENTOS EXCLUSIVOS, por el camino REAL del 403: index.ts (su `handle`,
   capturado de createServer: no abre ningún puerto) + schedule.ts con SERVER_ROOT en una carpeta TEMPORAL que trae su PROPIO
   schedules.json (server/data no se lee ni se toca). Ian con la forma real de hoy (r1 21:00–22:00, solo After Day), Luna sin
   rangos y, A PROPÓSITO, un ciclo que cierra TODO todo el día cargado a nombre del adulto (Andrés): demuestra que al adulto
   el ciclo no lo alcanza nunca aunque sus datos lo cerrarían. Reloj: solo Date es falso, en la zona del proceso (sin
   parent.json → tz null = la del server); los minutos se arman con new Date(año, mes, día, h, m) (hora LOCAL). */

const T = vi.hoisted(() => ({ dir: '', handler: undefined as undefined | ((req: unknown, res: unknown) => void) }));
vi.mock('node:http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:http')>();
  return { ...actual, createServer: (h: (req: unknown, res: unknown) => void) => { T.handler = h; return { listen: () => ({}) }; } };
});
vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  const { mkdtempSync, mkdirSync, writeFileSync: w } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');
  T.dir = mkdtempSync(j(tmpdir(), 'innerith-cyclegate-'));
  mkdirSync(j(T.dir, 'data'));
  w(j(T.dir, 'data', 'catalog.json'), '[]'); // videos.ts lo lee al importar (sin él, ENOENT)
  w(j(T.dir, 'data', 'schedules.json'), JSON.stringify({ version: 3, members: {
    ian: { ranges: [{ id: 'r1', name: 'Rango 1', from: '21:00', to: '22:00', sections: ['afterday'] }] },
    luna: { ranges: [] },
    andres: { ranges: [{ id: 'z', name: 'Todo cerrado', from: '00:00', to: '00:00', sections: [] }] },
  } }));
  return { ...actual, SERVER_ROOT: T.dir };
});

await import('../index');
const S = await import('../schedule');
afterAll(() => { rmSync(T.dir, { recursive: true, force: true }); });
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); });
afterEach(() => { vi.useRealTimers(); });
const clock = (h: number, min: number) => vi.setSystemTime(new Date(2026, 9, 29, h, min));

function call(user: string, method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ status: number; body: any }> {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  Object.assign(req, { method, url: path, headers: { 'x-innerith-user': user, 'content-type': 'application/json' } });
  return new Promise(resolve => {
    let status = 0;
    const res = { writeHead: (s: number) => { status = s; }, end: (b: string) => resolve({ status, body: JSON.parse(b) }) };
    T.handler!(req, res);
  });
}

/** Un prefijo de API por sección (index.ts responde el 403 ANTES de rutear: el método no importa). */
const API = {
  chat: '/api/chat', buscar: '/api/search', mytube: '/api/mytube', aprender: '/api/learn-routes', tienda: '/api/market',
  calendario: '/api/calendar', espacio: '/api/space/drive', afterday: '/api/afterday',
} as const;
const REST = ['chat', 'buscar', 'mytube', 'aprender', 'tienda', 'calendario', 'espacio'] as const;

describe('Ian (r1 21:00–22:00, solo After Day) por el 403 real', () => {
  it('21:30: TODO menos After Day responde 403 {error: horario, section, opensAt: 22:00}; After Day pasa; el Feed nunca', async () => {
    clock(21, 30);
    for (const k of REST) expect(await call('ian', 'GET', API[k]), k).toEqual({ status: 403, body: { error: 'horario', section: k, opensAt: '22:00' } });
    expect((await call('ian', 'GET', API.afterday)).status).toBe(200);
    expect(S.closedSectionFor('/api/feed', 'ian')).toBeNull();
  });
  it('15:00: After Day 403 con opensAt 21:00; el resto pasa (Calendario de verdad hasta la ruta)', async () => {
    clock(15, 0);
    expect(await call('ian', 'GET', API.afterday)).toEqual({ status: 403, body: { error: 'horario', section: 'afterday', opensAt: '21:00' } });
    for (const k of REST) expect(S.closedSectionFor(API[k], 'ian'), k).toBeNull();
    expect((await call('ian', 'GET', API.calendario)).status).toBe(200);
  });
  it('override de demo en r1 a las 15:00: solo After Day y SIN opensAt (no sigue al reloj); null vuelve al reloj', async () => {
    clock(15, 0);
    expect((await call('ian', 'POST', '/api/demo/cycle', { rangeId: 'r1' })).body.demoRange).toBe('r1');
    expect(await call('ian', 'GET', API.calendario)).toEqual({ status: 403, body: { error: 'horario', section: 'calendario', opensAt: null } });
    expect((await call('ian', 'GET', API.afterday)).status).toBe(200);
    expect((await call('ian', 'POST', '/api/demo/cycle', { rangeId: null })).body.demoRange).toBeNull();
    expect((await call('ian', 'GET', API.calendario)).status).toBe(200);
  });
});

describe('Luna sin rangos y el adulto (nunca gateado)', () => {
  for (const [h, min] of [[21, 30], [15, 0], [3, 0]] as const) {
    it(`${h}:${String(min).padStart(2, '0')}: a Luna no se le cierra nada; a Andrés, tampoco, aunque "su" ciclo lo cerraría todo`, async () => {
      clock(h, min);
      for (const k of [...REST, 'afterday'] as const) expect(S.closedSectionFor(API[k], 'luna'), `luna ${k}`).toBeNull();
      // Los datos del adulto CERRARÍAN todo (el test no es trivial)…
      for (const k of [...REST, 'afterday'] as const) expect(S.closedSectionFor(API[k], 'andres'), `andres ${k}`).toEqual({ key: k, opensAt: null });
      // …pero index.ts solo mira el ciclo con un CHICO activo.
      for (const user of ['luna', 'andres']) {
        expect((await call(user, 'GET', API.afterday)).status, `${user} afterday`).toBe(200);
        expect((await call(user, 'GET', API.calendario)).status, `${user} calendario`).toBe(200);
        expect((await call(user, 'GET', API.chat)).body.error, `${user} chat`).not.toBe('horario'); // GET /api/chat: su 405, no el 403
      }
    });
  }
});
