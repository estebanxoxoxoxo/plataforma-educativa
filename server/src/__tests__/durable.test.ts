import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/* FS-BASE-B (hallazgo mytube.ts:142, "mapa de durabilidad"): el helper ÚNICO de escritura segura de server/data
   (durable.ts). Carpeta TEMPORAL; node:fs de verdad, con un rename que se puede hacer fallar y un espía en fsync. */

const F = vi.hoisted(() => ({ failRename: 0, fsyncs: 0 }));
vi.mock('node:fs', async (importOriginal) => {
  const a = await importOriginal<typeof import('node:fs')>();
  return {
    ...a,
    renameSync: (...args: Parameters<typeof a.renameSync>) => {
      if (F.failRename > 0) { F.failRename--; throw Object.assign(new Error('ENOSPC simulado'), { code: 'ENOSPC' }); }
      return a.renameSync(...args);
    },
    fsyncSync: (fd: number) => { F.fsyncs++; return a.fsyncSync(fd); },
  };
});

const { backupBeforeMigrate, quarantine, tryWriteFileAtomic, writeFileAtomic } = await import('../durable');
const DIR = mkdtempSync(join(tmpdir(), 'innerith-durable-'));
afterAll(() => { rmSync(DIR, { recursive: true, force: true }); });
beforeEach(() => { F.failRename = 0; F.fsyncs = 0; });
const leftovers = () => readdirSync(DIR).filter((f) => f.endsWith('.tmp'));

describe('writeFileAtomic', () => {
  it('escribe el contenido entero, con fsync ANTES del rename, y no deja el .tmp', () => {
    const f = join(DIR, 'a.json');
    writeFileAtomic(f, '{"ñandú":"niño"}');
    expect(readFileSync(f, 'utf8')).toBe('{"ñandú":"niño"}');
    expect(F.fsyncs).toBe(1); // sin fsync, tras un corte el rename podía quedar antes que los datos (archivo vacío)
    expect(leftovers()).toEqual([]);
  });
  it('si el rename falla: TIRA, el archivo de antes queda intacto y no queda el .tmp', () => {
    const f = join(DIR, 'b.json');
    writeFileAtomic(f, 'viejo');
    F.failRename = 1;
    expect(() => writeFileAtomic(f, 'nuevo')).toThrow(/ENOSPC/);
    expect(readFileSync(f, 'utf8')).toBe('viejo');
    expect(leftovers()).toEqual([]);
  });
  it('{ durable: false } (las cachés regenerables) no hace fsync', () => {
    writeFileAtomic(join(DIR, 'c.json'), 'x', { durable: false });
    expect(F.fsyncs).toBe(0);
  });
  it('mode 0600 rige aunque haya quedado un .tmp viejo con otros permisos (alerts.json)', () => {
    const f = join(DIR, 'alerts.json');
    writeFileSync(`${f}.tmp`, 'resto de una escritura cortada', { mode: 0o644 });
    writeFileAtomic(f, '{}', { mode: 0o600 });
    expect(statSync(f).mode & 0o777).toBe(0o600);
  });
  it('tryWriteFileAtomic: el contrato boolean (true = quedó escrito; false = no, sin tirar)', () => {
    const f = join(DIR, 'd.json');
    expect(tryWriteFileAtomic(f, '1', 'test')).toBe(true);
    F.failRename = 1;
    expect(tryWriteFileAtomic(f, '2', 'test')).toBe(false);
    expect(readFileSync(f, 'utf8')).toBe('1');
  });
});

describe('quarantine y backupBeforeMigrate', () => {
  it('quarantine aparta el archivo como .roto-<ms> (la convención de todos; mytube usaba .broken-)', () => {
    const f = join(DIR, 'roto.json');
    writeFileSync(f, '{roto');
    const r = quarantine(f, 'test');
    expect(r).toMatch(/roto\.json\.roto-\d+$/);
    expect(existsSync(f)).toBe(false);
    expect(readFileSync(r!, 'utf8')).toBe('{roto');
    expect(quarantine(join(DIR, 'no-existe.json'), 'test')).toBeNull(); // nunca tira
  });
  it('respaldo: sin .pre-v3 lo crea; con el MISMO contenido no duplica; con OTRO, va a .pre-v3-<ms> (nunca saltea)', () => {
    const f = join(DIR, 'schedules.json');
    expect(backupBeforeMigrate(f, '.pre-v3', 'v2-A', 'test')).toBe(`${f}.pre-v3`);
    expect(readFileSync(`${f}.pre-v3`, 'utf8')).toBe('v2-A');
    expect(backupBeforeMigrate(f, '.pre-v3', 'v2-A', 'test')).toBe(`${f}.pre-v3`);
    const again = backupBeforeMigrate(f, '.pre-v3', 'v2-B', 'test');
    expect(again).toMatch(/schedules\.json\.pre-v3-\d+$/);
    expect(readFileSync(again!, 'utf8')).toBe('v2-B');
    expect(readFileSync(`${f}.pre-v3`, 'utf8')).toBe('v2-A'); // el de la primera migración no se pisa
  });
  it('si el respaldo no se puede escribir devuelve null (el que llama decide no pisar el original)', () => {
    F.failRename = 1;
    expect(backupBeforeMigrate(join(DIR, 'x.json'), '.pre-v2', 'texto', 'test')).toBeNull();
  });
});
