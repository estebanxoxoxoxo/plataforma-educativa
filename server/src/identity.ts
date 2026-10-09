// Identidad (avatar propio del chico) — visión §9 y audios 26, 32, 41-42: el avatar es uno de los ACTIVOS que hacen
// querer quedarse. Arranca con el look ELEGIBLE: uno de los 16 personajes dibujados del cliente
// (src/shared/components/Avatar.tsx: SVG propio, sin assets externos) en un color de la paleta, o las iniciales
// (el default típico). El guardarropas comprable con Energy Coin llega después (necesita ítems de plataforma en la Tienda).
//   GET  /api/identity          → Identity { nick, look }  (sin archivo: un look DIBUJADO derivado del nick, así Ian
//                                  arranca dentro del 80% con avatar; look null = iniciales)
//   POST /api/identity {look}   → Identity                  (400 si el look no es del set: variant 0..15 y color de la
//                                  paleta, o null)
// PERSISTE en server/data/identity.json (regla 9: es un ACTIVO del chico, como space.json y wishlist.json — NO es
// economía y NO se registra en /api/demo/reset: recargar la página no lo toca). Escritura atómica tmp+rename (space.ts).
// Moderación: no abre superficie nueva — el look es un índice y un color de listas cerradas (ni texto ni imágenes), y el
// nick sigue saliendo de la configuración de la familia (acá no se edita).
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { config, SERVER_ROOT } from './config'
import { readJson, send } from './web'

type AvatarLook = { variant: number; color: string } | null

/* ---------- ESPEJO de src/shared/components/Avatar.tsx: cantidad de personajes, paleta, sal y hash ---------- */
const VARIANTS = 16
const COLORS = ['#3A5BD9', '#13A39A', '#F26B3A', '#8A5CF5', '#E5487A', '#F2A81D', '#1C9BD6', '#18A957']
const SALT = 'idav7891201:'
function hash32(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16
  return h >>> 0
}
/** El look de arranque: el MISMO personaje y color que el hash del cliente le da a ese nick, pero siempre dibujado. */
export function defaultLook(nick: string): AvatarLook {
  const h = hash32(SALT + nick.normalize('NFC'))
  return { variant: (h >>> 8) % VARIANTS, color: COLORS[(h >>> 16) % COLORS.length] }
}

/** Valida un look (del cliente o del archivo). `undefined` = no es del set. El color se normaliza al de la paleta. */
export function parseLook(raw: unknown): AvatarLook | undefined {
  if (raw === null) return null
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const { variant, color } = raw as { variant?: unknown; color?: unknown }
  if (typeof variant !== 'number' || !Number.isInteger(variant) || variant < 0 || variant >= VARIANTS) return undefined
  if (typeof color !== 'string') return undefined
  const c = COLORS.find(x => x.toLowerCase() === color.trim().toLowerCase())
  return c ? { variant, color: c } : undefined
}

/* ---------- persistencia (archivo chico, escritura inmediata y atómica: al responder ya está en disco) ---------- */
const FILE = join(SERVER_ROOT, 'data', 'identity.json')
interface Stored { look: AvatarLook; updatedAt: number }
function load(): Stored | null {
  if (!existsSync(FILE)) return null
  try {
    const raw = JSON.parse(readFileSync(FILE, 'utf8')) as { look?: unknown; updatedAt?: unknown }
    const look = parseLook(raw?.look)
    if (look === undefined) throw new Error('el look guardado no es del set')
    return { look, updatedAt: Number(raw.updatedAt) || 0 }
  } catch (e) {
    console.warn('[identity] identity.json ilegible, vuelvo al look por defecto:', e)
    try { renameSync(FILE, `${FILE}.roto-${Date.now()}`) } catch { /* sin copia: seguimos igual */ }
    return null
  }
}
let stored: Stored | null = load()
function persist(look: AvatarLook) {
  const next: Stored = { look, updatedAt: Date.now() }
  writeFileSync(FILE + '.tmp', JSON.stringify(next))
  renameSync(FILE + '.tmp', FILE)
  stored = next
}

const myNick = () => config.apodo || 'Explorador'
/** La identidad de Ian: su nick + el look guardado (o el de arranque si nunca eligió). */
export function identity(): { nick: string; look: AvatarLook } {
  const nick = myNick()
  return { nick, look: stored ? stored.look : defaultLook(nick) }
}

/* ---------- rutas ---------- */
export async function identityRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (url.pathname !== '/api/identity') return send(res, 404, { error: 'not found' })
  if (req.method === 'GET') return send(res, 200, identity())
  if (req.method !== 'POST') return send(res, 405, { error: 'method' })
  let body: unknown
  try { body = await readJson<unknown>(req) } catch { return send(res, 400, { error: 'JSON inválido' }) }
  if (!body || typeof body !== 'object' || !('look' in body)) return send(res, 400, { error: 'Falta el look' })
  const look = parseLook((body as { look: unknown }).look)
  if (look === undefined) return send(res, 400, { error: 'Ese avatar no está en el set' })
  try { persist(look) } catch (e) {
    console.error('[identity] no pude guardar identity.json:', e)
    return send(res, 500, { error: 'No se pudo guardar el avatar' })
  }
  console.log(`[identity] ${myNick()} → ${look ? `personaje ${look.variant} · ${look.color}` : 'iniciales'}`)
  return send(res, 200, identity())
}
