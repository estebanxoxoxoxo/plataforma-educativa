// Porte Smarty · /crear, lado server — STUB del coordinador: la tanda W1 lo reemplaza.
// Acá vive SOLO la auditoría de facts: la MISMA lógica del factAudit del POC
// (app/src/learn/factAudit.ts: OpenAI Responses con tool-calling + Serper + Wikipedia), corrida en
// nuestro server porque las claves JAMÁS van al cliente (desvío forzado §4 del mapa). El resto del
// flujo /crear habla DIRECTO con route-lab (:5203) desde el navegador, como en el POC.
//   POST /api/create/audit → formas espejo del POC (aditivas; el coordinador las formaliza al cierre)
import type { IncomingMessage, ServerResponse } from 'node:http'
import { send } from './web'

export async function createRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (req.method === 'POST' && url.pathname === '/api/create/audit') {
    return send(res, 501, { error: 'La auditoría de facts todavía no está (stub W1)' })
  }
  return send(res, 404, { error: 'not found' })
}
