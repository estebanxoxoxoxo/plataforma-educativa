// Tienda (marketplace): las recompensas las PUBLICA EL PADRE (horas de videojuego, salidas, lo que él
// sabe que motiva a su hijo; a futuro también ítems de plataforma) y el chico las canjea con la
// Energy Coin que cosechó practicando. El canje queda PENDIENTE hasta que el padre lo entrega
// (VISION §7, capa 3 "Utilidad"). La billetera NO vive acá: el saldo se lee con summary() y se gasta
// con spendEc() de ./progress (fuente única del saldo: nunca queda negativo).
// PREMIOS = CONFIG DEL PADRE (tanda 4): viven en server/data/parent.json y los administra la Zona de
// padres (./parent: publicar, editar, archivar/reactivar). Acá solo se LEEN. Archivado = no aparece en
// la Tienda ni en /api/market (y no se puede canjear ni desear), pero sigue en parent.json.
// REGLA DEL DEMO (pedido de Esteban, 8-oct-2026; docs/AGENTS.md regla 9): la ECONOMÍA no se persiste.
// Los CANJES viven en RAM del server y cada carga de página vuelve a los valores iniciales: el front
// hace POST /api/demo/reset al arrancar → resetMarket() → 0 canjes. El stock que ve el chico se DERIVA
// (stock configurado por el padre − canjes de esta demo), así que con el reset vuelve completo.
// Mientras navegás se canjea y se gasta de verdad; F5 = demo nueva (stock completo, 0 canjes).
// La LISTA DE DESEOS sí persiste (es una preferencia del chico, como space.json): ids en
// server/data/wishlist.json, del más reciente al más viejo. El reset del demo NO la toca.
// APAGADO POR EL PADRE (features.tienda = false): TODO /api/market* responde 403 (fail-closed).
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
// método equivocado → 405 · subruta desconocida → 404 · Tienda apagada por el padre → 403.
// Entrega: el padre marca el canje como "entregado" desde su zona (POST /api/parent/deliver →
// deliverRedemption()). Los textos los escribe el padre: no pasan por la moderación de contenido.
// Imports cruzados con ./parent: ver la regla en su cabecera (ninguno llama al otro al cargar).
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { SERVER_ROOT } from './config'
import { featureOn, parentItem, parentItems, type ParentItem } from './parent'
import { spendEc, summary } from './progress'
import { readJson, send } from './web'

type Status = 'pendiente' | 'entregado'
interface Redemption { id: number; itemId: number; title: string; emoji: string; price: number; ts: number; status: Status }
interface Store { seq: number; redemptions: Redemption[] }

const fmt = (n: number) => n.toLocaleString('es-AR')
const OFF = { error: 'La Tienda está apagada por tu familia' }

/** Estado inicial NUEVO: 0 canjes (los premios no viven acá: son config del padre, en parent.json). */
const fresh = (): Store => ({ seq: 1, redemptions: [] })
let store: Store = fresh()

/** Vuelve a los valores iniciales: 0 canjes → stock completo (lo dispara POST /api/demo/reset).
 *  La lista de deseos NO se toca: es del chico y persiste. Los premios tampoco: son del padre. */
export function resetMarket() { store = fresh() }

/* ---------- premios (del padre) y stock derivado ---------- */
/** Premio canjeable: existe y no está archivado. */
function activeItem(id: number): ParentItem | undefined {
  const it = parentItem(id)
  return it && !it.archived ? it : undefined
}
/** Canjes de esta demo de un premio (pendientes + entregados: los dos consumen stock). */
export function redeemedCount(itemId: number): number {
  let n = 0
  for (const r of store.redemptions) if (r.itemId === itemId) n++
  return n
}
/** Lo que queda para canjear (null = sin límite): stock configurado por el padre − canjes de esta demo. */
export const stockLeft = (it: Pick<ParentItem, 'id' | 'stock'>): number | null => (it.stock === null ? null : Math.max(0, it.stock - redeemedCount(it.id)))

/* ---------- lista de deseos: PERSISTE (archivo único, escritura atómica con debounce; patrón space.ts) ---------- */
const WISH_FILE = join(SERVER_ROOT, 'data', 'wishlist.json')
const WISH_CAP = 20
/** Enteros positivos, sin repetidos, con tope. Qué premio existe se mira al LEER (los premios son del
 *  padre y pueden archivarse/reactivarse; además, al cargar este módulo todavía no se consulta ./parent). */
function cleanWish(raw: unknown): number[] {
  const out: number[] = []
  for (const v of Array.isArray(raw) ? raw : []) if (typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && !out.includes(v)) out.push(v)
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
let wishlist: number[] = loadWish() // del más reciente al más viejo (puede guardar ids de premios archivados)
let wishTimer: ReturnType<typeof setTimeout> | null = null
function persistWish() {
  if (wishTimer) return
  wishTimer = setTimeout(() => {
    wishTimer = null
    try { writeFileSync(WISH_FILE + '.tmp', JSON.stringify(wishlist)); renameSync(WISH_FILE + '.tmp', WISH_FILE) }
    catch (e) { console.error('[market] no pude guardar wishlist.json:', e) }
  }, 250)
}
/** Lo que se le muestra al chico: solo deseos de premios que hoy están en la Tienda. */
const liveWish = () => wishlist.filter(id => activeItem(id) !== undefined)
/** Marca (queda primera: es la más reciente) o desmarca un premio; sin `value` alterna. Tope WISH_CAP:
 *  si se pasa, se cae el deseo más viejo. Marcar algo ya marcado no lo mueve (idempotente). */
export function setWish(itemId: number, value?: boolean): number[] {
  const has = wishlist.includes(itemId)
  const want = value ?? !has
  if (want === has) return liveWish()
  wishlist = want ? [itemId, ...wishlist].slice(0, WISH_CAP) : wishlist.filter(id => id !== itemId)
  persistWish()
  return liveWish()
}

/* ---------- lógica ---------- */
const toItem = (i: ParentItem) => ({ id: i.id, title: i.title, ...(i.desc ? { desc: i.desc } : {}), price: i.price, emoji: i.emoji, source: 'padre' as const, stock: stockLeft(i), wished: wishlist.includes(i.id) })
const toRedemption = (r: Redemption) => ({ id: r.id, itemId: r.itemId, title: r.title, emoji: r.emoji, price: r.price, ts: r.ts, status: r.status })

/** Premios publicados (sin los archivados): deseados primero (del más reciente al más viejo), después el resto por precio. */
export function listItems() {
  const rank = new Map(wishlist.map((id, i) => [id, i]))
  return parentItems().filter(i => !i.archived).sort((a, b) => {
    const ra = rank.get(a.id) ?? -1, rb = rank.get(b.id) ?? -1
    if (ra >= 0 || rb >= 0) return ra < 0 ? 1 : rb < 0 ? -1 : ra - rb
    return a.price - b.price || a.id - b.id
  }).map(toItem)
}
export function listRedemptions() {
  return store.redemptions.slice(0, 100).map(toRedemption)
}

/** El padre ya lo entregó (POST /api/parent/deliver). Idempotente; false si el canje no existe (por
 *  ejemplo, porque una carga de página reseteó la demo). */
export function deliverRedemption(id: number): boolean {
  const r = store.redemptions.find(x => x.id === id)
  if (!r) return false
  if (r.status !== 'entregado') {
    r.status = 'entregado'
    console.log(`[market] canje #${r.id} entregado: ${r.emoji} ${r.title}`)
  }
  return true
}

type RedeemBody = { ok: boolean; ec: number; redemption?: ReturnType<typeof toRedemption>; error?: string }

/** Canje: valida premio y stock, gasta con spendEc() y deja el canje PENDIENTE de entrega.
 *  Síncrono de punta a punta: no hay carrera entre el chequeo de saldo/stock y el gasto. */
export function redeem(itemId: number): { status: number; body: RedeemBody } {
  const ec = summary().ec
  const it = activeItem(itemId)
  if (!it) return { status: 404, body: { ok: false, ec, error: 'Ese premio ya no está en la Tienda.' } }
  const left = stockLeft(it)
  if (left !== null && left <= 0) return { status: 200, body: { ok: false, ec, error: 'Este premio se agotó.' } }
  if (ec < it.price) return { status: 200, body: { ok: false, ec, error: `Te faltan ${fmt(it.price - ec)} ⚡` } }
  const paid = spendEc(it.price, `Canje: ${it.title}`)
  if (!paid.ok) return { status: 200, body: { ok: false, ec: paid.ec, error: `Te faltan ${fmt(Math.max(1, it.price - paid.ec))} ⚡` } }
  const r: Redemption = { id: store.seq++, itemId: it.id, title: it.title, emoji: it.emoji, price: it.price, ts: Date.now(), status: 'pendiente' }
  store.redemptions.unshift(r)
  console.log(`[market] canje #${r.id}: ${it.emoji} ${it.title} (−${it.price} ⚡) → saldo ${paid.ec}${left !== null ? ` · quedan ${left - 1}` : ''}`)
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
  // "Si el papá dice que no existe, no existe" (audio 22): con la Tienda apagada no hay premios,
  // ni canjes, ni lista de deseos. Antes que cualquier otra validación (fail-closed).
  if (!featureOn('tienda')) return send(res, 403, OFF)
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
    if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido: para la lista de deseos se usa POST.', wishlist: liveWish() })
    let body: unknown
    try { body = await readJson(req) } catch { return send(res, 400, { error: 'Pedido inválido (se esperaba JSON).', wishlist: liveWish() }) }
    const itemId = parseItemId(body)
    if (itemId === 'falta') return send(res, 400, { error: 'Falta el premio (itemId).', wishlist: liveWish() })
    if (itemId === null || !activeItem(itemId)) return send(res, 404, { error: 'Ese premio no existe en la Tienda.', wishlist: liveWish() })
    const value = (body as Record<string, unknown>).value
    if (value !== undefined && value !== null && typeof value !== 'boolean') return send(res, 400, { error: 'value tiene que ser true o false (o no venir, para alternar).', wishlist: liveWish() })
    return send(res, 200, { wishlist: setWish(itemId, typeof value === 'boolean' ? value : undefined) })
  }
  return send(res, 404, { error: 'not found' })
}
