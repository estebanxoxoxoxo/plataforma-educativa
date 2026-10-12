// After Day (porte Smarty W6) — la lista de audio que cura el padre (musicWhitelist del POC, Dexie v13)
// y el chico escucha SOLO como fondo. Independiente del catálogo de MyTube; un video suelto no necesita
// key (título por noembed, como la ingesta de sueltos de mytube.ts). CONFIG del padre (regla 9):
// PERSISTE en server/data/music.json (atómico tmp+rename), FUERA de /api/demo/reset.
//
//   GET /api/afterday → { tracks: AfterDayTrack[] }   (público: lo lee la vista del chico; del más
//        nuevo al más viejo, como el POC)
//   Los endpoints del padre (/api/parent/music, /add, /remove) viven en parent.ts (sesión del portón)
//   y llaman a los helpers de acá.
//
// ESQUELETO del coordinador (contrato congelado). PENDIENTE W6 (la tanda): `addTrack` con el parser
// de URLs de video del POC (solo videos: "No es un link de un video de YouTube"), sin repetidos
// ("Ese video ya está en la lista."), título por noembed si no viene, thumb hqdefault.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { SERVER_ROOT } from './config'
import { send } from './web'

export interface AfterDayTrack { videoId: string; url: string; title?: string; thumb: string; addedAt: number }

const FILE = join(SERVER_ROOT, 'data', 'music.json')

function load(): AfterDayTrack[] {
  if (!existsSync(FILE)) return []
  try { return JSON.parse(readFileSync(FILE, 'utf8')) as AfterDayTrack[] } catch { return [] }
}
let tracks: AfterDayTrack[] = load()

export function saveTracks(next: AfterDayTrack[]): void {
  tracks = next
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(tracks, null, 1))
  renameSync(tmp, FILE)
}
/** Del más nuevo al más viejo (la vista del chico y la lista del padre). */
export function allTracks(): AfterDayTrack[] { return [...tracks].sort((a, b) => b.addedAt - a.addedAt) }

export async function afterdayRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (url.pathname === '/api/afterday' && req.method === 'GET') return send(res, 200, { tracks: allTracks() })
  return send(res, 404, { error: 'No existe.' })
}
