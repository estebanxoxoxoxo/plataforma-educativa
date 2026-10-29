import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/* FS-BASE-B, schedule.ts DE VERDAD con SERVER_ROOT en una carpeta TEMPORAL (server/data no se toca):
   · hallazgo schedule.ts:87 (WF2 + WF3): una SEGUNDA migración (un .pre-v3 que ya existe con otro contenido) deja su
     respaldo en .pre-v3-<ms> en vez de saltearlo en silencio y pisar el archivo sin copia; sin respaldo no se pisa nada.
   · hallazgo familyMigrate.ts:31: una `version` desconocida es ilegible: el archivo queda ENTERO en .roto-* (antes se
     "migraba" como un v1 y los rangos se perdían).
   · hallazgo familyMigrate.test.ts:132 (el camino que el test viejo no cubría): un v3 leído con JSON.parse que TRAE la
     clave propia "__proto__" en members no crea ese integrante ni contamina prototipos.
   · hallazgos schedule.ts:125 / cycleRules.ts:172: borrar el rango del override de demo y agregar otro EN EL MISMO
     guardado ya no le pasa el id (ni el override) al rango nuevo. */

const T = vi.hoisted(() => ({ dir: '', failRenameTo: '' }));
vi.mock('node:fs', async (importOriginal) => {
  const a = await importOriginal<typeof import('node:fs')>();
  return { ...a, renameSync: (...args: Parameters<typeof a.renameSync>) => {
    if (T.failRenameTo && String(args[1]).endsWith(T.failRenameTo)) throw Object.assign(new Error('EACCES simulado'), { code: 'EACCES' });
    return a.renameSync(...args);
  } };
});
vi.mock('../config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config')>();
  const { mkdtempSync, mkdirSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join: j } = await import('node:path');
  T.dir = mkdtempSync(j(tmpdir(), 'innerith-sched-'));
  mkdirSync(j(T.dir, 'data'));
  return { ...actual, SERVER_ROOT: T.dir };
});
await import('../config');
const DATA = () => join(T.dir, 'data');
const FILE = () => join(DATA(), 'schedules.json');
afterAll(() => { rmSync(T.dir, { recursive: true, force: true }); });
beforeEach(() => { T.failRenameTo = ''; });

async function boot(files: Record<string, string>) {
  for (const f of readdirSync(DATA())) rmSync(join(DATA(), f), { force: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(DATA(), name), text);
  vi.resetModules();
  const S = await import('../schedule');
  const { runAsUser } = await import('../requestContext');
  const demo = (user: string, rangeId: string | null): Promise<{ status: number; body: any }> => {
    const req = Readable.from([Buffer.from(JSON.stringify({ rangeId }))]) as unknown as IncomingMessage;
    Object.assign(req, { method: 'POST', url: '/api/demo/cycle', headers: { 'x-innerith-user': user } });
    return new Promise(resolve => {
      let status = 0;
      const res = { writeHead: (s: number) => { status = s; }, end: (raw: string) => resolve({ status, body: JSON.parse(raw) }) } as unknown as ServerResponse;
      void runAsUser(user, () => S.scheduleRoutes(req, res, new URL('/api/demo/cycle', 'http://localhost')));
    });
  };
  return { S, demo };
}
const V2 = JSON.stringify({ version: 2, members: { ian: { chat: { restrictionActive: true } }, luna: {} } });
const names = () => readdirSync(DATA()).sort();

describe('migración de schedules.json: el respaldo nunca se saltea (hallazgo schedule.ts:87)', () => {
  it('con un .pre-v3 VIEJO de otra migración, el v2 de ahora queda en .pre-v3-<ms> antes de reescribir', async () => {
    await boot({ 'schedules.json': V2, 'schedules.json.pre-v3': '{"version":2,"members":{"ian":{},"luna":{}}}' });
    const again = names().filter(f => /^schedules\.json\.pre-v3-\d+$/.test(f));
    expect(again).toHaveLength(1);
    expect(readFileSync(join(DATA(), again[0]), 'utf8')).toBe(V2);
    expect(readFileSync(join(DATA(), 'schedules.json.pre-v3'), 'utf8')).toBe('{"version":2,"members":{"ian":{},"luna":{}}}');
    expect(JSON.parse(readFileSync(FILE(), 'utf8')).version).toBe(3);
  });
  it('si el respaldo no se puede escribir, schedules.json NO se pisa (rige en RAM hasta el primer guardado)', async () => {
    T.failRenameTo = '.pre-v3';
    const { S } = await boot({ 'schedules.json': V2 });
    expect(readFileSync(FILE(), 'utf8')).toBe(V2);
    expect(S.cycleOf('ian')).toEqual([]);
  });
});

describe('versión desconocida y "__proto__"', () => {
  for (const version of ['3', 4]) {
    it(`version ${JSON.stringify(version)} → el archivo ENTERO en .roto-* y todo disponible (sin rangos), sin reescribir`, async () => {
      const raw = JSON.stringify({ version, members: { luna: { ranges: [{ id: 'a', name: 'Mañana', from: '08:00', to: '12:00', sections: ['aprender'] }] } } });
      const { S } = await boot({ 'schedules.json': raw });
      const roto = names().filter(f => f.startsWith('schedules.json.roto-'));
      expect(roto).toHaveLength(1);
      expect(readFileSync(join(DATA(), roto[0]), 'utf8')).toBe(raw);
      expect(existsSync(FILE())).toBe(false); // no se escribe hasta el primer guardado
      expect(S.cycleOf('luna')).toEqual([]);
    });
  }
  it('un v3 con la clave PROPIA "__proto__" (JSON.parse la crea) no hace un integrante ni contamina prototipos', async () => {
    const raw = '{"version":3,"members":{"__proto__":{"ranges":[{"id":"x","name":"Mal","from":"00:00","to":"23:00","sections":["chat"]}]},"ian":{"ranges":[]}}}';
    expect(Object.hasOwn(JSON.parse(raw).members, '__proto__')).toBe(true); // el caso existe
    const { S } = await boot({ 'schedules.json': raw });
    expect(S.cycleOf('__proto__')).toEqual([]);
    expect(S.cycleOf('ian')).toEqual([]);
    expect(({} as Record<string, unknown>).ranges).toBeUndefined();
    expect(S.isOpen('chat', 'ian')).toBe(true);
  });
});

describe('el id de un rango borrado NO se recicla en el mismo guardado (hallazgos schedule.ts:125 / cycleRules.ts:172)', () => {
  it('Luna en «Mañana» (override); el padre borra Mañana y agrega Noche: Noche no hereda el id y vuelve el reloj real', async () => {
    const { S, demo } = await boot({});
    const save = (ranges: unknown[]) => {
      const c = S.checkCycle(ranges, 'Luna', S.cycleOf('luna').map(r => r.id)); // lo que hace POST /api/parent/cycle
      if (!c.ok) throw new Error(c.error);
      return S.saveCycle('luna', c.value)!;
    };
    const first = save([
      { name: 'Mañana', from: '08:00', to: '12:00', sections: ['aprender'] },
      { name: 'Tarde', from: '14:00', to: '18:00', sections: ['mytube', 'tienda'] },
    ]);
    expect(first.map(r => r.id)).toEqual(['r1', 'r2']);
    expect((await demo('luna', 'r1')).body.demoRange).toBe('r1');
    const second = save([
      { id: 'r2', name: 'Tarde', from: '14:00', to: '18:00', sections: ['mytube', 'tienda'] },
      { name: 'Noche', from: '21:00', to: '07:00', sections: ['afterday'] },
    ]);
    const noche = second.find(r => r.name === 'Noche')!;
    expect(noche.id).not.toBe('r1'); // antes: r1, y con él el override
    expect(S.demoRangeOf('luna')).toBeNull();
    const at10 = new Date(2026, 9, 29, 10, 0); // 10:00 en la zona del proceso (sin zona de la familia)
    expect(S.isOpen('afterday', 'luna', at10)).toBe(false); // reloj real: After Day abre a las 21:00
    expect(S.isOpen('aprender', 'luna', at10)).toBe(true);
  });
});

describe('tz Automática: el server manda SU zona (hallazgos cycleRules.ts:62 / mentors.ts:49)', () => {
  it('GET /api/schedules lleva serverTz (aditivo) = la zona IANA del proceso; tz sigue diciendo lo que eligió el adulto', async () => {
    const { S } = await boot({});
    const req = Readable.from([]) as unknown as IncomingMessage;
    Object.assign(req, { method: 'GET', url: '/api/schedules', headers: { 'x-innerith-user': 'luna' } });
    const r = await new Promise<{ status: number; body: any }>(resolve => {
      let status = 0;
      const res = { writeHead: (s: number) => { status = s; }, end: (raw: string) => resolve({ status, body: JSON.parse(raw) }) } as unknown as ServerResponse;
      void S.scheduleRoutes(req, res, new URL('/api/schedules', 'http://localhost'));
    });
    expect(r.status).toBe(200);
    expect(r.body.tz).toBeNull();
    expect(r.body.serverTz).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(S.cycleView('luna').serverTz).toBe(r.body.serverTz);
  });
});

