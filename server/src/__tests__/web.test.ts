import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { BodyError, MAX_JSON_BODY, listenHost, readJson } from '../web';

/* FS-BASE-B (hallazgo web.ts:6 + faltante "superficie de red"): el lector compartido de cuerpos JSON y dónde escucha la API. */

const req = (...chunks: Buffer[]) => Readable.from(chunks) as unknown as IncomingMessage;

describe('readJson', () => {
  it('una ñ (o un emoji) partida entre dos chunks llega entera (antes: «ni��o»)', async () => {
    const b = Buffer.from(JSON.stringify({ text: 'niño 🦕 canción' }), 'utf8');
    const cuts = [b.indexOf(Buffer.from('ñ')) + 1, b.indexOf(Buffer.from('🦕')) + 2];
    expect(await readJson(req(b.subarray(0, cuts[0]), b.subarray(cuts[0], cuts[1]), b.subarray(cuts[1])))).toEqual({ text: 'niño 🦕 canción' });
  });
  it('pasado el tope (en BYTES) → BodyError 413, no un Error genérico (que index.ts volvía un 500)', async () => {
    const big = Buffer.from(JSON.stringify({ text: 'x'.repeat(MAX_JSON_BODY) }));
    const e = (await readJson(req(big.subarray(0, 1000), big.subarray(1000))).catch((x: unknown) => x)) as BodyError;
    expect(e).toBeInstanceOf(BodyError);
    expect(e.status).toBe(413);
  });
  it('un JSON roto → BodyError 400; vacío → {}', async () => {
    const e = (await readJson(req(Buffer.from('{roto'))).catch((x: unknown) => x)) as BodyError;
    expect(e).toBeInstanceOf(BodyError);
    expect(e.status).toBe(400);
    expect(await readJson(req())).toEqual({});
  });
  it('FIX-MINT: un cuerpo `null` (JSON válido) → BodyError 400 (antes llegaba null a la ruta y `b.id` era un 500); lo demás, tal cual', async () => {
    const e = (await readJson(req(Buffer.from('null'))).catch((x: unknown) => x)) as BodyError;
    expect(e).toBeInstanceOf(BodyError);
    expect(e.status).toBe(400);
    expect(e.message).toBe('Pedido inválido (se esperaba un objeto JSON).');
    // solo null rompe el acceso a una propiedad: un texto, un número o una lista siguen llegando como antes
    expect(await readJson(req(Buffer.from('"x"')))).toBe('x');
    expect(await readJson(req(Buffer.from('[]')))).toEqual([]);
    expect(await readJson(req(Buffer.from('0')))).toBe(0);
  });
});

describe('listenHost (index.ts)', () => {
  it('por defecto SOLO 127.0.0.1; INNERITH_LAN=1 abre todas las interfaces (undefined = listen sin host)', () => {
    expect(listenHost({})).toBe('127.0.0.1');
    expect(listenHost({ INNERITH_LAN: '0' })).toBe('127.0.0.1');
    expect(listenHost({ INNERITH_LAN: 'true' })).toBe('127.0.0.1'); // solo "1" la abre: nada se abre por accidente
    expect(listenHost({ INNERITH_LAN: '1' })).toBeUndefined();
  });
});
