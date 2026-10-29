import { rmSync } from 'node:fs';
import { Readable } from 'node:stream';
import { afterAll, describe, expect, it, vi } from 'vitest';

/* FIX-MINT (hallazgo BAJA de QA-SEGURIDAD): un cuerpo JSON `null` en las rutas de index.ts que leen con el readJson
   compartido (/api/space/*, /api/feed/react y /less, /api/chat) respondía 500 {error:'internal'} —`b.id` sobre null—. Ahora
   es BodyError 400 desde web.ts, por el mismo camino que un JSON roto; los módulos con lector propio siguen con su 400 (el
   contrato de FS-BASE-B). index.ts DE VERDAD (su `handle`, capturado de createServer: no abre ningún puerto), con
   SERVER_ROOT en una carpeta TEMPORAL (server/data no se toca). */

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
  T.dir = mkdtempSync(j(tmpdir(), 'innerith-nullbody-'));
  mkdirSync(j(T.dir, 'data'));
  w(j(T.dir, 'data', 'catalog.json'), '[]'); // videos.ts lo lee al importar (sin él, ENOENT)
  return { ...actual, SERVER_ROOT: T.dir };
});

await import('../index');
afterAll(() => { rmSync(T.dir, { recursive: true, force: true }); });

function call(user: string, path: string, raw: string): Promise<{ status: number; body: any }> {
  const req = Readable.from([Buffer.from(raw)]);
  Object.assign(req, { method: 'POST', url: path, headers: { 'x-innerith-user': user, 'content-type': 'application/json' } });
  return new Promise(resolve => {
    let status = 0;
    const res = { writeHead: (s: number) => { status = s; }, end: (b: string) => resolve({ status, body: JSON.parse(b) }) };
    T.handler!(req, res);
  });
}

describe('cuerpo JSON `null` → 400, no 500 (hallazgo BAJA de QA-SEGURIDAD)', () => {
  it.each([
    ['luna', '/api/space/drive/folder'],
    ['luna', '/api/space/save'],
    ['luna', '/api/space/follow'],
    ['luna', '/api/feed/react'],
    ['luna', '/api/feed/less'],
    ['andres', '/api/chat'],
  ])('%s · POST %s con body null → 400 con motivo', async (user, path) => {
    expect(await call(user, path, 'null')).toEqual({ status: 400, body: { error: 'Pedido inválido (se esperaba un objeto JSON).' } });
  });

  it('lo demás sigue igual: un objeto válido pasa, un JSON roto es su 400 y los módulos con lector propio responden el suyo', async () => {
    expect((await call('luna', '/api/space/drive/folder', JSON.stringify({ name: 'Cosas' }))).status).toBe(200);
    expect(await call('luna', '/api/feed/react', '{"id":"x"}')).toEqual({ status: 400, body: { error: 'id/emoji' } });
    expect(await call('luna', '/api/space/drive/folder', '{roto')).toEqual({ status: 400, body: { error: 'Pedido inválido (se esperaba JSON).' } });
    expect(await call('luna', '/api/friends/requests/accept', 'null')).toEqual({ status: 400, body: { error: 'Pedido inválido (se esperaba un objeto JSON).' } });
    expect(await call('andres', '/api/parent/unlock', 'null')).toEqual({ status: 200, body: { ok: false } }); // un PIN mal formado más
  });
});
