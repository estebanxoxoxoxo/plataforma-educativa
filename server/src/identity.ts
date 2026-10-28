// Identidad (avatar propio) — visión §9 y audios 26, 32, 41-42: el avatar es uno de los ACTIVOS que hacen querer
// quedarse. El look ELEGIBLE: uno de los 16 personajes dibujados del cliente (src/shared/components/Avatar.tsx: SVG propio,
// sin assets externos) en un color de la paleta, o las iniciales (el default típico). Y, encima del personaje, la ROPA del
// guardarropas (tanda W): un accesorio dibujado del set (gorra, vincha, moño, anteojos de sol, auriculares, corona) que se
// compra con Energy Coin en la Tienda (market.ts).
// POR USUARIO (línea 14-oct, docs/USUARIOS.md): cada usuario del demo (users.ts: Ian, Andrés) tiene SU look; GET y POST
// leen y escriben el del usuario ACTIVO (cabecera X-Innerith-User → actingUser).
//   GET  /api/identity          → Identity { nick, look }  (el nick y el look del usuario activo; si nunca eligió, un look
//                                  DIBUJADO derivado de su nick —así arranca dentro del 80% con avatar—; look null = iniciales)
//   POST /api/identity {look}   → Identity                  (400 si el look no es del set: variant 0..15, color de la
//                                  paleta y accessory null/ausente o un id del set; o look null)
// look = { variant, color, accessory }: el accesorio PUESTO viaja en el look (null = sin nada). Con iniciales (look
// null) no hay ropa: el personaje es lo que la lleva puesta.
// LA POSESIÓN LA EXIGE LA UI, NO ESTE SERVER: acá solo se valida que el id sea del set. Las compras de ropa son
// economía y viven en RAM (market.ts: se resetean con cada carga de página, regla 9), mientras que el look es un ACTIVO
// que persiste. Por eso, tras recargar, Ian puede seguir con la gorra PUESTA aunque su guardarropas arranque vacío
// (decisión del coordinador, FLAG para Esteban: ver docs/VISION.md §13). Si algún día las compras persisten, este POST
// puede pasar a exigir la posesión consultando el guardarropas de market.ts. (Desde U4 el guardarropas también es de cada
// usuario: market.ts, docs/USUARIOS.md §10.) El look de cada uno lo lee además la tabla de la semana de la familia
// (lookOf, abajo; GET /api/leagues/family en leaguesFake.ts).
// PERSISTE en server/data/identity.json (regla 9: es un ACTIVO del usuario, como space.json y wishlist.json — NO es
// economía y NO se registra en /api/demo/reset: recargar la página no lo toca). Escritura atómica tmp+rename (space.ts).
//   v2 (14-oct): { version: 2, users: { [id]: { look, updatedAt } } }. El formato VIEJO ({ look, updatedAt }, de cuando
//   había un solo usuario) es el de ian: MIGRA al cargar (se reescribe como v2 en el acto). Archivo ilegible (JSON roto,
//   otra forma o algún look fuera del set) → copia en .roto-* y todos con su look por defecto, como antes.
// Moderación: no abre superficie nueva — el look es un índice, un color y un id de listas cerradas (ni texto ni
// imágenes), y el nick sale del seed de usuarios (el de Ian, de la configuración de la familia; acá no se edita).
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { SERVER_ROOT } from './config'
import { DEFAULT_USER_ID, actingUser, type UserInfo } from './users'
import { readJson, send } from './web'

export type AvatarLook = { variant: number; color: string; accessory: string | null } | null

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
interface Entry { look: AvatarLook; updatedAt: number }
/** v2: el look de cada usuario por id (los que nunca eligieron no tienen entrada: usan defaultLook de su nick). */
interface Stored { version: 2; users: Record<string, Entry> }
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Una entrada leída de disco. Tira si el look no es del set (el archivo entero cuenta como ilegible, como antes). */
function entryOf(raw: unknown, id: string): Entry {
  const r = isObject(raw) ? raw : {}
  const look = parseLook(r.look)
  if (look === undefined) throw new Error(`el look guardado de «${id}» no es del set`)
  return { look, updatedAt: Number(r.updatedAt) || 0 }
}
function writeAtomic(s: Stored) {
  writeFileSync(FILE + '.tmp', JSON.stringify(s))
  renameSync(FILE + '.tmp', FILE)
}
function load(): Stored {
  if (!existsSync(FILE)) return { version: 2, users: {} }
  try {
    const raw: unknown = JSON.parse(readFileSync(FILE, 'utf8'))
    if (!isObject(raw)) throw new Error('no es un objeto')
    if (raw.version === 2) {
      if (!isObject(raw.users)) throw new Error('v2 sin la lista de usuarios')
      const users: Record<string, Entry> = {}
      for (const [id, e] of Object.entries(raw.users)) users[id] = entryOf(e, id)
      return { version: 2, users }
    }
    // Formato viejo (un solo usuario: el chico del demo) → es el look de ian. Migra en el acto.
    const s: Stored = { version: 2, users: { [DEFAULT_USER_ID]: entryOf(raw, DEFAULT_USER_ID) } }
    try {
      writeAtomic(s)
      console.log(`[identity] identity.json migrado a la v2 (un look por usuario): el que estaba guardado es el de ${DEFAULT_USER_ID}`)
    } catch (e) { console.error('[identity] no pude reescribir identity.json como v2 (se reintenta en el próximo guardado):', e) }
    return s
  } catch (e) {
    console.warn('[identity] identity.json ilegible, vuelvo a los looks por defecto:', e)
    try { renameSync(FILE, `${FILE}.roto-${Date.now()}`) } catch { /* sin copia: seguimos igual */ }
    return { version: 2, users: {} }
  }
}
let stored: Stored = load()
function persist(id: string, look: AvatarLook) {
  const next: Stored = { version: 2, users: { ...stored.users, [id]: { look, updatedAt: Date.now() } } }
  writeAtomic(next)
  stored = next
}

/** La identidad de un usuario: su nick + el look que eligió (o el de arranque derivado de su nick, si nunca eligió). */
function identityOf(u: Pick<UserInfo, 'id' | 'nick'>): { nick: string; look: AvatarLook } {
  const e = stored.users[u.id]
  return { nick: u.nick, look: e ? e.look : defaultLook(u.nick) }
}
/** U4 (la tabla de la semana de la familia, leaguesFake.ts): el look ELEGIDO de un usuario (o el de arranque derivado
 *  de su nick, si nunca eligió; null = iniciales). Solo lectura: lo mismo que GET /api/identity le devuelve a ese usuario. */
export function lookOf(u: Pick<UserInfo, 'id' | 'nick'>): AvatarLook { return identityOf(u).look }

/* ---------- rutas ---------- */
export async function identityRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (url.pathname !== '/api/identity') return send(res, 404, { error: 'not found' })
  const me = actingUser(req)
  if (req.method === 'GET') return send(res, 200, identityOf(me))
  if (req.method !== 'POST') return send(res, 405, { error: 'method' })
  let body: unknown
  try { body = await readJson<unknown>(req) } catch { return send(res, 400, { error: 'JSON inválido' }) }
  if (!body || typeof body !== 'object' || !('look' in body)) return send(res, 400, { error: 'Falta el look' })
  const look = parseLook((body as { look: unknown }).look)
  if (look === undefined) return send(res, 400, { error: 'Ese avatar no está en el set' })
  try { persist(me.id, look) } catch (e) {
    console.error('[identity] no pude guardar identity.json:', e)
    return send(res, 500, { error: 'No se pudo guardar el avatar' })
  }
  console.log(`[identity] ${me.nick} → ${look ? `personaje ${look.variant} · ${look.color}${look.accessory ? ` · con ${look.accessory}` : ''}` : 'iniciales'}`)
  return send(res, 200, identityOf(me))
}
