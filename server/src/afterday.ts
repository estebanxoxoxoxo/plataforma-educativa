// After Day (porte Smarty W6) — la lista de audio que cura el padre (`musicWhitelist` del POC, Dexie v13) y el chico
// escucha SOLO como fondo (playMusic con audioOnly: nunca el reproductor de video). Independiente del catálogo de MyTube
// y SIN key de YouTube. CONFIG del padre (regla 9): PERSISTE en server/data/music.json (atómico tmp+rename), FUERA de
// /api/demo/reset.
//
//   GET /api/afterday → { tracks: AfterDayTrack[] }   (público: lo lee la vista del chico; del más nuevo al más viejo,
//        como el `orderBy('addedAt').reverse()` del POC). Fuera de la franja de After Day, 403 (lo pone index.ts).
//   Los endpoints del padre viven en parent.ts (CON la sesión del portón) y llaman a los helpers de acá:
//     GET  /api/parent/music                    → { tracks }
//     POST /api/parent/music/add {url, title?}  → { ok: true, track } | { ok: false, error }  (rechazos con 200)
//     POST /api/parent/music/remove {videoId}   → { ok }
//
// FIDELIDAD (lib/afterday.ts del POC): `extractVideoId` TAL CUAL — el parseYtUrl del POC y, si no da un video, el `v=` de
// la URL o el path de youtu.be (prefiere el VIDEO aunque el link traiga `list=`: "acá queremos un track concreto"). Una
// playlist pura, un canal o un @handle → "No es un link de un video de YouTube"; el mismo videoId otra vez → "Ese video ya
// está en la lista."; thumb hqdefault sin key; addedAt = Date.now(). Sin edición, sin reorden, sin carga múltiple.
// QUIRKS FIELES (informe 03 §6, se portan a propósito): After Day NO filtra palabras bloqueadas (ni al guardar ni al
// servir: el título va tal cual) · el fallback del POC toma el `v=` de CUALQUIER dominio (no mira el host) · un video caído
// o privado queda en silencio en el fondo (el audio de fondo no maneja ese error).
// DESVÍO (decidido en el contrato del coordinador): sin nombre del padre, el título se busca en noembed (sin key, como el
// video suelto de mytube.ts); si noembed falla, queda SIN título — "(sin nombre)" en el panel, "Audio" en la tarjeta del
// chico y "Música" en el MiniPlayer, igual que el POC, que nunca buscaba título.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { SERVER_ROOT } from './config'
import { send } from './web'

export interface AfterDayTrack { videoId: string; url: string; title?: string; thumb: string; addedAt: number }

const FILE = join(SERVER_ROOT, 'data', 'music.json')

const isTrack = (x: unknown): x is AfterDayTrack => {
  const t = x as Record<string, unknown> | null
  return !!t && typeof t === 'object' && typeof t.videoId === 'string' && !!t.videoId && typeof t.url === 'string'
    && typeof t.thumb === 'string' && typeof t.addedAt === 'number' && (t.title === undefined || typeof t.title === 'string')
}
function load(): AfterDayTrack[] {
  if (!existsSync(FILE)) return []
  try {
    const raw: unknown = JSON.parse(readFileSync(FILE, 'utf8'))
    return Array.isArray(raw) ? raw.filter(isTrack) : []
  } catch (e) {
    // Ilegible: arranca vacía, pero la copia queda aparte (el próximo guardado no pisa la lista que armó el padre).
    console.error('[afterday] music.json ilegible → lista vacía; copia en .roto-*:', e)
    try { renameSync(FILE, `${FILE}.roto-${Date.now()}`) } catch { /* sin copia: seguimos igual */ }
    return []
  }
}
let tracks: AfterDayTrack[] = load()

/** Guarda la lista (atómico). Primero el disco y después la memoria: si la escritura falla, nada cambia. */
export function saveTracks(next: AfterDayTrack[]): void {
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(next, null, 1))
  renameSync(tmp, FILE)
  tracks = next
}
/** Del más nuevo al más viejo (la vista del chico y la lista del padre). Empates de addedAt: el último agregado primero,
 *  como el `reverse()` de Dexie sobre la clave. */
export function allTracks(): AfterDayTrack[] { return [...tracks].reverse().sort((a, b) => b.addedAt - a.addedAt) }

/* ---------- parser de URLs: copia TAL CUAL del parseYtUrl del POC (el mismo que porta mytube.ts; se copia y no se
   importa para no tocar el orden de carga de mytube.ts) + el extractVideoId de lib/afterday.ts ---------- */
type YtRef = { type: 'video'; id: string } | { type: 'playlist'; id: string } | { type: 'canal'; handle: string }

/* Una playlist "real" (importable) tiene id con prefijo PL/UU/OL/FL; los mixes/auto-listas (RD, LM, WL, LL) no. */
function esPlaylistReal(list: string): boolean {
  return /^(PL|UU|OL|FL)/.test(list)
}

function parseYtUrl(input: string): YtRef | null {
  const s = input.trim()
  let u: URL
  try { u = new URL(s.startsWith('http') ? s : `https://${s}`) } catch { return null }
  const host = u.hostname.replace(/^www\.|^m\./, '')
  const list = u.searchParams.get('list')
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0]
    // Link de video dentro de una playlist real → preferimos la playlist.
    if (list && esPlaylistReal(list)) return { type: 'playlist', id: list }
    return id ? { type: 'video', id } : null
  }
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null
  if (u.pathname === '/playlist' && list) return { type: 'playlist', id: list }
  // /watch?v=VID&list=PL... → preferimos la playlist real sobre el video.
  if (list && esPlaylistReal(list)) return { type: 'playlist', id: list }
  const v = u.searchParams.get('v')
  if (v) return { type: 'video', id: v }
  if (u.pathname.startsWith('/shorts/')) return { type: 'video', id: u.pathname.split('/')[2] }
  if (u.pathname.startsWith('/embed/')) return { type: 'video', id: u.pathname.split('/')[2] }
  if (u.pathname.startsWith('/@')) return { type: 'canal', handle: u.pathname.slice(1).split('/')[0] }
  return null
}

/** Saca el videoId de una URL de YouTube, incluso si viene con `list=` (preferimos el video, no la playlist — lo opuesto a
 *  parseYtUrl, porque acá queremos un track concreto). extractVideoId del POC, tal cual. */
export function extractVideoId(url: string): string | null {
  const ref = parseYtUrl(url)
  if (ref?.type === 'video') return ref.id
  try {
    const u = new URL(url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`)
    const v = u.searchParams.get('v')
    if (v) return v
    if (u.hostname.replace(/^www\.|^m\./, '') === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
  } catch { /* url inválida */ }
  return null
}

const ytThumb = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`

/** Título de un video suelto por noembed (sin key; el patrón del video suelto de mytube.ts). Sin título → undefined. */
async function noembedTitle(videoId: string): Promise<string | undefined> {
  try {
    const r = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`, { signal: AbortSignal.timeout(15000) })
    const j = (await r.json()) as { title?: unknown }
    return typeof j.title === 'string' && j.title.trim() ? j.title.trim() : undefined
  } catch {
    return undefined
  }
}

/* ---------- gestión del padre (addAfterDayTrack / removeAfterDayTrack del POC) ---------- */
export type AddTrackResult = { ok: true; track: AfterDayTrack } | { ok: false; error: string }
const NOT_A_VIDEO = 'No es un link de un video de YouTube'
const ALREADY = 'Ese video ya está en la lista.'

/** Agrega un track desde una URL. Sin repetidos por videoId (el `&videoId` único de Dexie). Título: el del padre, o el de
 *  noembed si no escribió ninguno. */
export async function addTrack(url: string, title?: string): Promise<AddTrackResult> {
  const videoId = extractVideoId(url)
  if (!videoId) return { ok: false, error: NOT_A_VIDEO }
  if (tracks.some(t => t.videoId === videoId)) return { ok: false, error: ALREADY }
  const name = title?.trim() || (await noembedTitle(videoId))
  // Mientras esperaba a noembed pudo entrar el mismo video por otro pedido: el índice único del POC lo rechazaría igual.
  if (tracks.some(t => t.videoId === videoId)) return { ok: false, error: ALREADY }
  const track: AfterDayTrack = { videoId, url: url.trim(), ...(name ? { title: name } : {}), thumb: ytThumb(videoId), addedAt: Date.now() }
  try {
    saveTracks([...tracks, track])
  } catch (e) {
    console.error('[afterday] no pude guardar music.json:', e)
    return { ok: false, error: 'No pude guardar la lista. Probá de nuevo.' }
  }
  console.log(`[afterday] + ${videoId}${title?.trim() ? ' (con nombre del padre)' : name ? ' (título de noembed)' : ' (sin nombre)'} · ${tracks.length} en la lista`)
  return { ok: true, track: { ...track } }
}

/** Quita un track por videoId. false = no estaba (o no se pudo guardar). */
export function removeTrack(videoId: string): boolean {
  const next = tracks.filter(t => t.videoId !== videoId)
  if (next.length === tracks.length) return false
  try {
    saveTracks(next)
  } catch (e) {
    console.error('[afterday] no pude guardar music.json:', e)
    return false
  }
  console.log(`[afterday] − ${videoId} · ${tracks.length} en la lista`)
  return true
}

export async function afterdayRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  // Sin filtro de palabras bloqueadas: quirk FIEL del POC (informe 03 §6, "After Day no filtra palabras bloqueadas").
  if (url.pathname === '/api/afterday' && req.method === 'GET') return send(res, 200, { tracks: allTracks() })
  return send(res, 404, { error: 'No existe.' })
}
