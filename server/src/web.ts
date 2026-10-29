// Helpers HTTP compartidos por index.ts y los módulos de rutas (practice, progress, market, leagues).
import type { IncomingMessage, ServerResponse } from 'node:http'

/** Tope del cuerpo JSON (en BYTES): más que eso es un 413. */
export const MAX_JSON_BODY = 200_000
/** FS-BASE-B (hallazgo web.ts:6): un cuerpo que no se pudo leer, con el status HTTP que le corresponde (413 = demasiado
 *  grande, 400 = no es JSON). El catch de index.ts lo responde con ese status (antes cualquier falla de lectura era un 500
 *  {error:'internal'} sin motivo); los módulos que atrapan readJson por su cuenta siguen respondiendo su 400. */
export class BodyError extends Error {
  constructor(readonly status: 400 | 413, message: string) { super(message); this.name = 'BodyError' }
}

/** Lee el cuerpo como JSON. FS-BASE-B: junta los Buffers y decodifica UNA vez al final (antes `raw += chunk` decodificaba
 *  cada chunk por separado y una ñ, una tilde o un emoji partido entre dos chunks llegaba como «��»); pasado el tope tira
 *  BodyError 413, y un JSON roto, BodyError 400. Cuerpo vacío = {}.
 *  FIX-MINT (hallazgo BAJA de QA-SEGURIDAD): un cuerpo `null` —JSON válido— también es BodyError 400. Llegaba a las rutas
 *  que leen sin validar la forma (index.ts: /api/space/*, /api/feed/react y /less, /api/chat; mytube.ts) y `b.id` / `b[k]`
 *  tiraba un TypeError → 500 {error:'internal'}. Es el único valor de JSON con el que el acceso a una propiedad tira (con un
 *  texto, un número o una lista da undefined: siguen como antes). Mismo camino que un JSON roto: index.ts lo responde con
 *  su status y los módulos que atrapan readJson por su cuenta responden su propio 400 (el contrato de FS-BASE-B). */
export async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const b = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : (chunk as Buffer)
    size += b.length
    if (size > MAX_JSON_BODY) throw new BodyError(413, 'El pedido es demasiado grande.')
    chunks.push(b)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  let v: unknown
  try { v = JSON.parse(raw || '{}') } catch { throw new BodyError(400, 'Pedido inválido (se esperaba JSON).') }
  if (v === null) throw new BodyError(400, 'Pedido inválido (se esperaba un objeto JSON).')
  return v as T
}

/** FS-BASE-B: dónde escucha la API. Por defecto SOLO 127.0.0.1 (esta máquina: el navegador llega por el proxy de Vite);
 *  INNERITH_LAN=1 → todas las interfaces (undefined = lo que hacía `listen(PORT)` antes), para una prueba desde otro equipo. */
export const listenHost = (env: NodeJS.ProcessEnv = process.env): string | undefined => (env.INNERITH_LAN === '1' ? undefined : '127.0.0.1')

export function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}
