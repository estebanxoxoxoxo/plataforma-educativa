// MyTube (porte Smarty, tanda W5) — STUB del coordinador: la tanda lo reemplaza entero.
// Contrato previsto (formas espejo del POC, docs/porte-smarty/03 §1; ADITIVAS: W5 las define y el
// coordinador las formaliza al cierre):
//   · Lado chico (/api/mytube/*): canal enriquecido (handle + descripción CURADA editable + solapa
//     Playlists DEL CANAL filtradas a lo aprobado) — el catálogo plano actual (server/data/catalog.json,
//     94.923 videos SIN entidades de canal ni playlists) se enriquece acá con la key de YouTube
//     server-side y caché persistida propia. catalog.json NO SE TOCA (regla de AGENTS).
//   · Lado padre (/api/mytube/admin/*): la ingesta del POC — lote de URLs (video/playlist/canal/@handle),
//     entradas con sus videos, reingestar, completar canales, quitar duplicados, tope por entrada,
//     borrar entrada en cascada, descripción de canal editable. Persistencia en server/data/mytube.json
//     (CATÁLOGO de la familia, regla 9: persiste; atómico tmp+rename). Endpoints públicos como teachers
//     (la pantalla vive tras el portón de /padres; deuda de sesión anotada).
import type { IncomingMessage, ServerResponse } from 'node:http'
import { send } from './web'

export async function mytubeRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  return send(res, 501, { error: `MyTube todavía no está (stub W5): ${url.pathname}` })
}
