// Porte Smarty · Rutas de Learn (CATÁLOGO del server) — STUB del coordinador: la tanda W1 lo reemplaza.
// Guarda lo que en el POC vivía en Dexie `learnRoutes` + `learnDefinitions` (desvío forzado §4 del
// mapa: IndexedDB → server), manteniendo las FORMAS EXACTAS (src/api/types.ts, espejo del POC).
//   GET  /api/learn-routes            → { routes: LearnRouteListItem[] }
//   GET  /api/learn-routes/one?id=    → { route, definitions }
//   POST /api/learn-routes/import     → ImportBundleResult  (validación + acuñado de prueba como el
//        importador del POC: kind/schemaVersion, integridad referencial, reemplazo transaccional)
//   POST /api/learn-routes/delete     → { ok }  (borra ruta + definiciones; los resultados QUEDAN)
// PERSISTE (regla 9: catálogo) en server/data/learn-routes.json, escritura atómica tmp+rename.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { send } from './web'

export async function learnRoutesRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (req.method === 'GET' && url.pathname === '/api/learn-routes') return send(res, 200, { routes: [] })
  return send(res, 501, { error: 'Rutas de Learn todavía no están (stub W1)' })
}
