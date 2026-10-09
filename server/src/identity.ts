// Identidad (avatar propio del chico) — visión audios 26, 32, 41-42: el avatar es uno de los activos
// que hacen querer quedarse; acá arranca con el look elegible (dibujado determinístico, sin assets
// externos). El guardarropas comprable con Energy Coin llega después (necesita ítems de plataforma).
//
// ESTE ARCHIVO ES UN STUB del coordinador: contrato montado y compilable. La tanda I lo reemplaza con:
//   · GET /api/identity          → Identity { nick, look }  (look null = iniciales, el default típico)
//   · POST /api/identity {look}  → Identity (valida variant/color contra el set del demo)
//   · PERSISTE en server/data/identity.json (regla 9: es un activo del chico, NO economía; escritura
//     atómica tmp+rename como space.ts). No se registra en /api/demo/reset.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { config } from './config'
import { send } from './web'

export async function identityRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (url.pathname !== '/api/identity') return send(res, 404, { error: 'not found' })
  if (req.method === 'GET' || req.method === 'POST') {
    // Stub: siempre el default (iniciales). La tanda I implementa el PUT real y la persistencia.
    return send(res, 200, { nick: config.apodo || 'Explorador', look: null })
  }
  return send(res, 405, { error: 'method' })
}
