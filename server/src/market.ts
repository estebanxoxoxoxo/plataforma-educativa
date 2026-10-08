// Tienda (marketplace): las recompensas las PUBLICA EL PADRE (horas de videojuego, salidas, lo que él
// sabe que motiva a su hijo; a futuro también ítems de plataforma) y el chico las canjea con la
// Energy Coin que cosechó practicando. El canje queda PENDIENTE hasta que el padre lo entrega
// (VISION §7, capa 3 "Utilidad"). La billetera NO vive acá: el saldo se lee con summary() y se gasta
// con spendEc() de ./progress (fuente única del saldo: nunca queda negativo).
// REGLA DEL DEMO (pedido de Esteban, 8-oct-2026; docs/AGENTS.md regla 9): la ECONOMÍA no se persiste.
// Premios, stock y canjes viven en RAM del server y cada carga de página vuelve a los valores
// iniciales: el front hace POST /api/demo/reset al arrancar → resetMarket(). Mientras navegás se
// canjea y se gasta de verdad; F5 = demo nueva (stock completo, 0 canjes).
// La LISTA DE DESEOS sí persiste (es una preferencia del chico, como space.json): ids en
// server/data/wishlist.json, del más reciente al más viejo. El reset del demo NO la toca.
//
// Contrato HTTP (congelado; formas exactas en src/api/types.ts):
//   GET  /api/market                 → { items: MarketItem[]; ec: number }
//        items: primero los deseados (del más reciente al más viejo), después el resto por precio.
//        La UI ordena la grilla por precio; de este orden saca la recencia de la lista de deseos.
//   POST /api/market/redeem {itemId} → { ok, ec, redemption?, error? }
//   GET  /api/market/redemptions     → { redemptions: Redemption[] }        (el más nuevo primero)
//   POST /api/market/wish {itemId, value?} → { wishlist: number[] }  (sin value = alternar; tope 20)
// Los rechazos de NEGOCIO vuelven con HTTP 200 + ok:false y un `error` legible para el chico (el
// cliente de la UI tira ApiError ante !r.ok y perdería el motivo): saldo insuficiente ("Te faltan
// N ⚡", N exacto) o premio agotado. Pedido mal formado → 400 · premio inexistente → 404 ·
// método equivocado → 405 · subruta desconocida → 404.
// Falta (panel del padre, no existe todavía): publicar/editar/reponer premios y marcar canjes
// como "entregado". Los textos los escribe el padre: no pasan por la moderación de contenido.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { SERVER_ROOT } from './config'
import { spendEc, summary } from './progress'
import { readJson, send } from './web'

type Source = 'padre' | 'plataforma'
type Status = 'pendiente' | 'entregado'
interface Item { id: number; title: string; desc?: string; price: number; emoji: string; source: Source; stock: number | null }
interface Redemption { id: number; itemId: number; title: string; emoji: string; price: number; ts: number; status: Status }
interface Store { seq: number; items: Item[]; redemptions: Redemption[] }

const fmt = (n: number) => n.toLocaleString('es-AR')

/* Seed DEMO "del padre" = valores INICIALES de la Tienda (a esto se vuelve con cada carga de página).
   Es lo que el papá de Ian publicaría para arrancar; con el panel del padre estos premios los carga,
   edita y repone él. Precios calibrados a una cosecha semanal de ~1.200 ⚡: lo cotidiano sale
   100–250, una salida 400, un libro 600 y hay UNA meta grande para ahorrar varias semanas.
   stock null = sin límite. */
const SEED: Omit<Item, 'id' | 'source'>[] = [
  { emoji: '🎮', title: '30 minutos de videojuegos', desc: 'Media hora de tu juego favorito, cuando terminás las tareas.', price: 150, stock: null },
  { emoji: '🍿', title: 'Elegís la película del viernes', desc: 'Noche de peli en familia: esta vez la elección es tuya.', price: 250, stock: null },
  { emoji: '🍦', title: 'Salida por un helado', desc: 'Vamos juntos a la heladería y elegís los gustos.', price: 400, stock: null },
  { emoji: '🚲', title: '1 hora de bici en la plaza', desc: 'Salimos a andar juntos. ¡Llevá el casco!', price: 200, stock: null },
  { emoji: '📚', title: 'Un libro nuevo que elijas', desc: 'Vamos a la librería y te llevás el que más te guste.', price: 600, stock: null },
  { emoji: '🦉', title: '30 minutos más despierto', desc: 'Te acostás media hora más tarde un viernes o un sábado.', price: 350, stock: 2 },
  { emoji: '🛏️', title: 'Día sin tender la cama', desc: 'Por un día la cama se queda como está. ¡Nadie te dice nada!', price: 100, stock: null },
  { emoji: '🎢', title: 'Un día en el parque de diversiones', desc: 'La gran salida: un día entero de juegos. ¡Es para ahorrar!', price: 3000, stock: 1 },
]
/** Estado inicial NUEVO (objetos propios: los canjes descuentan stock de esta copia, nunca del SEED). */
function seed(): Store {
  return { seq: SEED.length + 1, items: SEED.map((s, i) => ({ id: i + 1, ...s, source: 'padre' })), redemptions: [] }
}

let store: Store = seed()

/** Vuelve a los valores iniciales: stock completo y 0 canjes (lo dispara POST /api/demo/reset).
 *  La lista de deseos NO se toca: es del chico y persiste. */
export function resetMarket() { store = seed() }

/* ---------- lista de deseos: PERSISTE (archivo único, escritura atómica con debounce; patrón space.ts) ---------- */
const WISH_FILE = join(SERVER_ROOT, 'data', 'wishlist.json')
const WISH_CAP = 20
const SEED_IDS = new Set(SEED.map((_, i) => i + 1))
/** Solo ids del seed, sin repetidos, con tope (lo que no existe se poda). */
function cleanWish(raw: unknown): number[] {
  const out: number[] = []
  for (const v of Array.isArray(raw) ? raw : []) if (typeof v === 'number' && SEED_IDS.has(v) && !out.includes(v)) out.push(v)
  return out.slice(0, WISH_CAP)
}
function loadWish(): number[] {
  if (!existsSync(WISH_FILE)) return []
  try { return cleanWish(JSON.parse(readFileSync(WISH_FILE, 'utf8'))) }
  catch (e) {
    console.warn('[market] wishlist.json ilegible, arranco con la lista vacía:', e)
    try { renameSync(WISH_FILE, `${WISH_FILE}.roto-${Date.now()}`) } catch { /* sin copia: seguimos igual */ }
    return []
  }
}
let wishlist: number[] = loadWish() // del más reciente al más viejo
let wishTimer: ReturnType<typeof setTimeout> | null = null
function persistWish() {
  if (wishTimer) return
  wishTimer = setTimeout(() => {
    wishTimer = null
    try { writeFileSync(WISH_FILE + '.tmp', JSON.stringify(wishlist)); renameSync(WISH_FILE + '.tmp', WISH_FILE) }
    catch (e) { console.error('[market] no pude guardar wishlist.json:', e) }
  }, 250)
}
/** Marca (queda primera: es la más reciente) o desmarca un premio; sin `value` alterna. Tope WISH_CAP:
 *  si se pasa, se cae el deseo más viejo. Marcar algo ya marcado no lo mueve (idempotente). */
export function setWish(itemId: number, value?: boolean): number[] {
  const has = wishlist.includes(itemId)
  const want = value ?? !has
  if (want === has) return wishlist.slice()
  wishlist = want ? [itemId, ...wishlist].slice(0, WISH_CAP) : wishlist.filter(id => id !== itemId)
  persistWish()
  return wishlist.slice()
}

/* ---------- lógica ---------- */
const toItem = (i: Item) => ({ id: i.id, title: i.title, ...(i.desc ? { desc: i.desc } : {}), price: i.price, emoji: i.emoji, source: i.source, stock: i.stock, wished: wishlist.includes(i.id) })
const toRedemption = (r: Redemption) => ({ id: r.id, itemId: r.itemId, title: r.title, emoji: r.emoji, price: r.price, ts: r.ts, status: r.status })

/** Deseados primero (del más reciente al más viejo), después el resto por precio. */
export function listItems() {
  const rank = new Map(wishlist.map((id, i) => [id, i]))
  return store.items.slice().sort((a, b) => {
    const ra = rank.get(a.id) ?? -1, rb = rank.get(b.id) ?? -1
    if (ra >= 0 || rb >= 0) return ra < 0 ? 1 : rb < 0 ? -1 : ra - rb
    return a.price - b.price || a.id - b.id
  }).map(toItem)
}
export function listRedemptions() {
  return store.redemptions.slice(0, 100).map(toRedemption)
}

type RedeemBody = { ok: boolean; ec: number; redemption?: ReturnType<typeof toRedemption>; error?: string }

/** Canje: valida premio y stock, gasta con spendEc() y deja el canje PENDIENTE de entrega.
 *  Síncrono de punta a punta: no hay carrera entre el chequeo de saldo/stock y el gasto. */
export function redeem(itemId: number): { status: number; body: RedeemBody } {
  const ec = summary().ec
  const it = store.items.find(i => i.id === itemId)
  if (!it) return { status: 404, body: { ok: false, ec, error: 'Ese premio ya no está en la Tienda.' } }
  if (it.stock !== null && it.stock <= 0) return { status: 200, body: { ok: false, ec, error: 'Este premio se agotó.' } }
  if (ec < it.price) return { status: 200, body: { ok: false, ec, error: `Te faltan ${fmt(it.price - ec)} ⚡` } }
  const paid = spendEc(it.price, `Canje: ${it.title}`)
  if (!paid.ok) return { status: 200, body: { ok: false, ec: paid.ec, error: `Te faltan ${fmt(Math.max(1, it.price - paid.ec))} ⚡` } }
  if (it.stock !== null) it.stock -= 1
  const r: Redemption = { id: store.seq++, itemId: it.id, title: it.title, emoji: it.emoji, price: it.price, ts: Date.now(), status: 'pendiente' }
  store.redemptions.unshift(r)
  console.log(`[market] canje #${r.id}: ${it.emoji} ${it.title} (−${it.price} ⚡) → saldo ${paid.ec}${it.stock !== null ? ` · quedan ${it.stock}` : ''}`)
  return { status: 200, body: { ok: true, ec: paid.ec, redemption: toRedemption(r) } }
}

/** itemId válido = entero positivo (número, o string de dígitos). 'falta' si no vino; null si vino mal. */
function parseItemId(b: unknown): number | null | 'falta' {
  const v = b && typeof b === 'object' ? (b as Record<string, unknown>).itemId : undefined
  if (v === undefined || v === null || v === '') return 'falta'
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,9}$/.test(v.trim()) ? Number(v) : NaN
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/* ---------- rutas ---------- */
export async function marketRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const path = url.pathname.replace(/\/+$/, '')
  if (path === '/api/market') {
    if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido: usá GET.' })
    return send(res, 200, { items: listItems(), ec: summary().ec })
  }
  if (path === '/api/market/redemptions') {
    if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido: usá GET.' })
    return send(res, 200, { redemptions: listRedemptions() })
  }
  if (path === '/api/market/redeem') {
    if (req.method !== 'POST') return send(res, 405, { ok: false, ec: summary().ec, error: 'Método no permitido: para canjear se usa POST.' })
    let body: unknown
    try { body = await readJson(req) } catch { return send(res, 400, { ok: false, ec: summary().ec, error: 'Pedido inválido (se esperaba JSON).' }) }
    const itemId = parseItemId(body)
    if (itemId === 'falta') return send(res, 400, { ok: false, ec: summary().ec, error: 'Falta el premio a canjear (itemId).' })
    if (itemId === null) return send(res, 400, { ok: false, ec: summary().ec, error: 'El premio a canjear (itemId) tiene que ser un número entero positivo.' })
    const r = redeem(itemId)
    return send(res, r.status, r.body)
  }
  if (path === '/api/market/wish') {
    if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido: para la lista de deseos se usa POST.', wishlist })
    let body: unknown
    try { body = await readJson(req) } catch { return send(res, 400, { error: 'Pedido inválido (se esperaba JSON).', wishlist }) }
    const itemId = parseItemId(body)
    if (itemId === 'falta') return send(res, 400, { error: 'Falta el premio (itemId).', wishlist })
    if (itemId === null || !SEED_IDS.has(itemId)) return send(res, 404, { error: 'Ese premio no existe en la Tienda.', wishlist })
    const value = (body as Record<string, unknown>).value
    if (value !== undefined && value !== null && typeof value !== 'boolean') return send(res, 400, { error: 'value tiene que ser true o false (o no venir, para alternar).', wishlist })
    return send(res, 200, { wishlist: setWish(itemId, typeof value === 'boolean' ? value : undefined) })
  }
  return send(res, 404, { error: 'not found' })
}
