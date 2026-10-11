// Identidad (avatar propio del chico) — visión §9 y audios 26, 32, 41-42: el avatar es uno de los ACTIVOS que hacen
// querer quedarse. El look ELEGIBLE: uno de los 16 personajes dibujados del cliente (src/shared/components/Avatar.tsx:
// SVG propio, sin assets externos) en un color de la paleta, o las iniciales (el default típico). Y, encima del
// personaje, la ROPA del guardarropas (tanda W): un accesorio dibujado del set (gorra, vincha, moño, anteojos de sol,
// auriculares, corona) que se compra con Energy Coin en la Tienda (market.ts).
//   GET  /api/identity          → Identity { nick, look }  (sin archivo: un look DIBUJADO derivado del nick, así Ian
//                                  arranca dentro del 80% con avatar; look null = iniciales)
//   POST /api/identity {look}   → Identity                  (400 si el look no es del set: variant 0..15, color de la
//                                  paleta y accessory null/ausente o un id del set; o look null)
// look = { variant, color, accessory }: el accesorio PUESTO viaja en el look (null = sin nada). Con iniciales (look
// null) no hay ropa: el personaje es lo que la lleva puesta.
// LA POSESIÓN LA EXIGE LA UI, NO ESTE SERVER: acá solo se valida que el id sea del set. Las compras de ropa son
// economía y viven en RAM (market.ts: se resetean con cada carga de página, regla 9), mientras que el look es un ACTIVO
// que persiste. Por eso, tras recargar, Ian puede seguir con la gorra PUESTA aunque su guardarropas arranque vacío
// (decisión del coordinador, FLAG para Esteban: ver docs/VISION.md §13). Si algún día las compras persisten, este POST
// puede pasar a exigir la posesión consultando el guardarropas de market.ts.
// PERSISTE en server/data/identity.json (regla 9: es un ACTIVO del chico, como space.json y wishlist.json — NO es
// economía y NO se registra en /api/demo/reset: recargar la página no lo toca). Escritura atómica tmp+rename (space.ts).
// Moderación: no abre superficie nueva — el look es un índice, un color y un id de listas cerradas (ni texto ni
// imágenes), y el nick sigue saliendo de la configuración de la familia (acá no se edita).
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { config, SERVER_ROOT } from './config'
import { readJson, send } from './web'

type AvatarLook = { variant: number; color: string; accessory: string | null } | null

/* ---------- ESPEJO de src/shared/components/Avatar.tsx: cantidad de personajes, paleta, sal, hash y el set de ropa ---------- */
const VARIANTS = 16
const COLORS = ['#3A5BD9', '#13A39A', '#F26B3A', '#8A5CF5', '#E5487A', '#F2A81D', '#1C9BD6', '#18A957']
/** Ids de la ropa del avatar (ACCESSORIES del cliente; market.ts los vende). APPEND-ONLY: es lo que se guarda. */
export const ACCESSORY_IDS = ['gorra', 'vincha', 'lazo', 'anteojos', 'auriculares', 'corona'] as const
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
  return { variant: (h >>> 8) % VARIANTS, color: COLORS[(h >>> 16) % COLORS.length], accessory: null }
}

/** Valida un look (del cliente o del archivo). `undefined` = no es del set. El color se normaliza al de la paleta;
 *  `accessory` ausente o null = sin ropa (los identity.json de antes de la ropa siguen siendo válidos). */
export function parseLook(raw: unknown): AvatarLook | undefined {
  if (raw === null) return null
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const { variant, color, accessory } = raw as { variant?: unknown; color?: unknown; accessory?: unknown }
  if (typeof variant !== 'number' || !Number.isInteger(variant) || variant < 0 || variant >= VARIANTS) return undefined
  if (typeof color !== 'string') return undefined
  const c = COLORS.find(x => x.toLowerCase() === color.trim().toLowerCase())
  if (!c) return undefined
  if (accessory === undefined || accessory === null) return { variant, color: c, accessory: null }
  if (typeof accessory !== 'string' || !(ACCESSORY_IDS as readonly string[]).includes(accessory)) return undefined
  return { variant, color: c, accessory }
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
  console.log(`[identity] ${myNick()} → ${look ? `personaje ${look.variant} · ${look.color}${look.accessory ? ` · con ${look.accessory}` : ''}` : 'iniciales'}`)
  return send(res, 200, identity())
}
