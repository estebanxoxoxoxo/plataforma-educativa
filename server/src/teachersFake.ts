// Profesores (marketplace del padre) + Calendario del chico — visión audios 30 y 67 (mentores), v1 demo.
// FAKE de servidor con las formas finales (src/api/types.ts: Teacher, TeacherSlot, HireResult, CalendarEvent).
//
// ESTE ARCHIVO ES UN STUB del coordinador: contrato montado y compilable. La tanda CAL lo reemplaza con:
//   · Catálogo de 7-8 profes (nombre, materia, USD/hora, bio cálida de 1 línea, rating) — datos del demo.
//   · GET  /api/teachers            → { teachers } (hired/slot según lo contratado)
//   · POST /api/teachers/hire       {id, slot:{weekday 0=lunes..6, hour}} → HireResult (genera las próximas
//     4 clases semanales en el calendario; error de negocio con 200 + ok:false, patrón market.ts)
//   · POST /api/teachers/cancel     {id} → {ok} (saca la contratación y sus clases futuras)
//   · GET  /api/calendar            → { events } (las clases del CHICO: sin precios, orden por start)
//   · PERSISTE en server/data/teachers.json (contrataciones = config del padre, regla 9; escritura
//     atómica tmp+rename). Seed PRIMERA vez: 1 profe ya contratado para que el calendario nazca vivo.
//   · La UI del padre vive tras el portón de /padres; estos endpoints quedan públicos como el resto de
//     los fakes (deuda anotada: moverlos a la sesión del padre cuando el contrato lo incorpore).
import type { IncomingMessage, ServerResponse } from 'node:http'
import { send } from './web'

export async function teachersRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (req.method === 'GET' && url.pathname === '/api/teachers') return send(res, 200, { teachers: [] })
  if (req.method === 'GET' && url.pathname === '/api/calendar') return send(res, 200, { events: [] })
  return send(res, 501, { error: 'Profesores todavía no está (stub)' })
}
