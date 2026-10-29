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
// APAGADO POR EL PADRE (features.tienda = false): TODO /api/market* responde 403 (fail-closed) — al CHICO: los candados son
// del dependiente; con un adulto como usuario activo (users.ts, docs/USUARIOS.md §4) la Tienda sigue abierta.
// U3 (docs/USUARIOS.md §9): POR CHICO ACTIVO. El apagado es el de ESE chico; los premios que ve y canjea son los SUYOS
// (parent.policyItems: la política vigente del pedido). Con un ADULTO activo (D1) la Tienda es solo la ropa de plataforma:
// los premios son para los chicos.
// U4 (cada uno lo suyo, docs/USUARIOS.md §10): TODO es POR USUARIO. La billetera (⚡) es la de cada uno (progress.ts); los
// canjes y el guardarropas viven en un slice por usuario (perUser.ts: RAM, vuelven al seed con el reset de ESE usuario);
// la lista de deseos es server/data/wishlist.json v2 { version: 2, users: { [id]: ids } } (un v1 —el array de antes, los
// deseos de Ian— migra en el acto a users.ian con respaldo en wishlist.json.pre-v2: userDataMigrate.ts). FS-BASE-B (hallazgo
// space.ts:128, también acá): cada cambio de la lista se escribe ANTES de responder (durable.ts: tmp + fsync + rename) —antes
// el 200 salía y el disco se escribía 250 ms después en un timer que solo logueaba la falla, y un reinicio de tsx watch en
// esa ventana lo perdía—; si no se puede escribir, la lista de RAM no cambia y la ruta responde 500. El stock
// se descuenta con los canjes de TODOS (redeemedCount suma los slices). Familia (/api/parent/*, donde el usuario del pedido
// es el ADULTO) lee los canjes del integrante con accesos explícitos: listRedemptions(member) / deliverRedemption(id, member).
//
// Contrato HTTP (congelado; formas exactas en src/api/types.ts):
//   GET  /api/market                 → { items: MarketItem[]; ec: number }
//        items: primero los deseados (del más reciente al más viejo), después el resto por precio.
//        La UI ordena la grilla por precio; de este orden saca la recencia de la lista de deseos.
//   POST /api/market/redeem {itemId} → { ok, ec, redemption?, error? }    (con una prenda de ropa: la COMPRA, sin redemption)
//   GET  /api/market/redemptions     → { redemptions: Redemption[] }        (el más nuevo primero; los del chico activo; U5-A:
//                                        incluye el premio de la liga de la familia que ganó: origin 'liga-familia', itemId 0,
//                                        price 0 — grantFamilyPrize, abajo)
//   POST /api/market/wish {itemId, value?} → { wishlist: number[] }  (sin value = alternar; tope 20)
//   POST /api/market/gift {itemId, friendId} → GiftResult { ok, ec?, friend?, error? }  (regalar ropa: ver más abajo)
// Los rechazos de NEGOCIO vuelven con HTTP 200 + ok:false y un `error` legible para el chico (el
// cliente de la UI tira ApiError ante !r.ok y perdería el motivo): saldo insuficiente ("Te faltan
// N ⚡", N exacto) o premio agotado. Pedido mal formado → 400 · premio inexistente → 404 ·
// método equivocado → 405 · subruta desconocida → 404 · Tienda apagada por el padre (y el usuario activo es un chico) → 403.
// Entrega: el padre marca el canje como "entregado" desde su zona (POST /api/parent/deliver →
// deliverRedemption()). Los textos los escribe el padre: no pasan por la moderación de contenido.
// Imports cruzados con ./parent: ver la regla en su cabecera (ninguno llama al otro al cargar).
//
// ROPA DEL AVATAR (tanda W; visión §7 capa 3 "además hay ítems de plataforma (ropa de avatar, regalos para otros
// usuarios)" y capa 6, audios 26, 29, 41-42): 6 ítems de PLATAFORMA (source 'plataforma', kind 'ropa') que viajan en la
// MISMA lista de GET /api/market, cada uno con su `accessoryId` (el accesorio dibujado del cliente) y `owned`. Son el
// ESPEJO de ACCESSORIES (src/shared/components/Avatar.tsx: mismo id, nombre y precio) y sus ids viven en un rango
// reservado (900001+) que no choca con los premios del padre (parent.ts los numera desde 1). No se desean (wished
// siempre false: la lista de deseos es de los premios del padre).
//   · COMPRAR = POST /api/market/redeem {itemId} con el id de una prenda (mismo contrato): gasta EC con spendEc (tx
//     "Ropa para tu avatar: …") y la entrega es INSTANTÁNEA al guardarropas → { ok, ec } SIN `redemption` (los canjes
//     pendientes de entrega son solo para los premios del padre). Ya la tenés → 200 ok:false.
//   · EQUIPAR no pasa por acá: es el look del chico (POST /api/identity con accessory; identity.ts).
//   · REGALAR = POST /api/market/gift {itemId, friendId} → GiftResult { ok, ec?, friend?, error? }: valida que sea ropa
//     (400 si es un premio del padre, 404 si no existe), que el amigo exista y sea amigo (404; Amigos apagado → 403 al chico),
//     que no la tenga ya y el saldo (estos dos: 200 ok:false); gasta EC (tx "Regalo para <nick>: …") y el NPC se la
//     pone y agradece en su hilo (friendsFake.receiveGift: plantilla, sin modelo). `friend` = su perfil ya con la prenda.
// El GUARDARROPAS de cada usuario (qué prendas compró) es ECONOMÍA: vive en RAM con sus canjes y resetMarket(id) lo vacía
// con cada carga de página de ESE usuario (regla 9). El look PUESTO, en cambio, persiste (identity.json): tras recargar,
// Ian puede seguir con la gorra puesta y el guardarropas vacío — decisión del coordinador, flaggeada para Esteban (VISION §13).
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { SERVER_ROOT } from './config'
import { DiskWriteError, backupBeforeMigrate, quarantine, writeFileAtomic } from './durable'
import { ACCESSORY_IDS } from './identity'
import { anyParentItem, featureOn, itemOwner, policyItem, policyItems, policyMemberId, type ParentItem } from './parent'
import { perUser } from './perUser'
import { spendEc, summary } from './progress'
import { upgradeWishRaw } from './userDataMigrate'
import { DEFAULT_USER_ID, actingUser } from './users'
import { readJson, send } from './web'

type Status = 'pendiente' | 'entregado'
/** U5-A: `origin: 'liga-familia'` = el premio de la semana de la familia que ganó este chico (grantFamilyPrize): itemId 0
 *  (no es un ítem: no descuenta stock de nadie) y price 0 (no movió ⚡: ni spendEc ni movimiento en la billetera);
 *  `closedAt` = cuándo cerró la semana que lo dio. */
interface Redemption {
  id: number; itemId: number; title: string; emoji: string; price: number; ts: number; status: Status
  origin?: 'liga-familia'; closedAt?: number
}
interface Store { redemptions: Redemption[]; /** Prendas que compró ESTE usuario en esta demo (ids de accesorio) */ owned: Set<string> }

const fmt = (n: number) => n.toLocaleString('es-AR')
const OFF = { error: 'La Tienda está apagada por tu familia' }

/** Estado inicial NUEVO de cada usuario: 0 canjes y el guardarropas vacío (los premios no viven acá: son config del padre,
 *  en parent.json). El padre entrega con el integrante: deliverRedemption(id, member). */
const fresh = (): Store => ({ redemptions: [], owned: new Set() })
/** FS-BASE-B (hallazgo market.ts:90): el id de canje es un contador del PROCESO que solo crece —el reset de un usuario NO lo
 *  vuelve a 1— y arranca en los segundos del reloj (como los avisos de parent.ts: no retrocede entre procesos, así un
 *  reinicio del server tampoco reusa los ids de la corrida anterior). Antes el `seq` vivía en el slice y el F5 del chico lo
 *  reiniciaba: el «Ya se lo di» del adulto con la lista vieja (#1 = el canje A) entregaba el canje NUEVO #1 (el B). Ahora
 *  ese #1 ya no existe y deliverRedemption devuelve false ("ese canje ya no existe"). Los ids no se muestran en la UI. */
let redemptionSeq = Math.max(1, Math.floor(Date.now() / 1000))
const stores = perUser(fresh)

/** Vuelve a los valores iniciales: los canjes y el guardarropas de un usuario, o sin id los de TODOS (lo dispara POST
 *  /api/demo/reset). La lista de deseos NO se toca: es del chico y persiste. Los premios tampoco: son del padre. */
export function resetMarket(userId?: string) { stores.reset(userId) }

/* ---------- ropa del avatar: el catálogo de plataforma (ESPEJO de ACCESSORIES en Avatar.tsx) ---------- */
type AccessoryId = (typeof ACCESSORY_IDS)[number]
interface Ropa { id: number; accessoryId: AccessoryId; title: string; emoji: string; price: number; desc: string; fem: boolean; plural: boolean }
const ROPA: readonly Ropa[] = [
  { id: 900001, accessoryId: 'gorra', title: 'Gorra', emoji: '🧢', price: 80, desc: 'Roja, con visera al costado: la clásica para salir a practicar.', fem: true, plural: false },
  { id: 900002, accessoryId: 'vincha', title: 'Vincha deportiva', emoji: '🎽', price: 90, desc: 'Blanca con raya roja, para las prácticas más intensas.', fem: true, plural: false },
  { id: 900003, accessoryId: 'lazo', title: 'Moño', emoji: '🎀', price: 120, desc: 'Rosa con lunares. Le queda lindo a cualquier personaje.', fem: false, plural: false },
  { id: 900004, accessoryId: 'anteojos', title: 'Anteojos de sol', emoji: '🕶️', price: 150, desc: 'Para verte con onda en tu liga.', fem: false, plural: true },
  { id: 900005, accessoryId: 'auriculares', title: 'Auriculares', emoji: '🎧', price: 220, desc: 'Para estudiar con tu música de fondo.', fem: false, plural: true },
  { id: 900006, accessoryId: 'corona', title: 'Corona', emoji: '👑', price: 300, desc: 'La más especial: para lucir todo lo que practicaste.', fem: true, plural: false },
]
{ // el espejo con identity.ts (el set que valida el look): cada id del set se vende y no se vende nada fuera del set
  const missing = ACCESSORY_IDS.filter(id => !ROPA.some(r => r.accessoryId === id))
  if (missing.length) console.warn(`[market] prendas del set sin precio en la Tienda: ${missing.join(', ')}`)
}
const ropaItem = (id: number) => ROPA.find(r => r.id === id)
/** "la gorra", "los anteojos de sol" (para los textos). */
const theRopa = (r: Ropa) => `${r.plural ? (r.fem ? 'las' : 'los') : r.fem ? 'la' : 'el'} ${r.title.toLowerCase()}`
/** Lo que necesita el NPC para agradecer con la concordancia justa ("me LA puse", "ya LOS tengo PUESTOS"). */
const giftText = (r: Ropa) => ({ el: theRopa(r), lo: `${r.fem ? 'la' : 'lo'}${r.plural ? 's' : ''}`, puesto: `puest${r.fem ? 'a' : 'o'}${r.plural ? 's' : ''}` })
const toRopaItem = (r: Ropa) => ({
  id: r.id, title: r.title, desc: r.desc, price: r.price, emoji: r.emoji, source: 'plataforma' as const, stock: null, wished: false,
  kind: 'ropa' as const, accessoryId: r.accessoryId, owned: stores.now().owned.has(r.accessoryId),
})

/* ---------- premios (del padre) y stock derivado ---------- */
/** Premio canjeable POR EL CHICO ACTIVO: es suyo y no está archivado (con un adulto activo, ninguno). */
function activeItem(id: number): ParentItem | undefined {
  const it = policyItem(id)
  return it && !it.archived ? it : undefined
}
/** Canjes de esta demo de un premio (pendientes + entregados: los dos consumen stock), sumando los de TODOS los usuarios
 *  (un premio es de UN integrante y solo él lo canjea; sumar todo es lo seguro para el stock). */
export function redeemedCount(itemId: number): number {
  let n = 0
  for (const id of stores.ids()) for (const r of stores.of(id).redemptions) if (r.itemId === itemId) n++
  return n
}
/** Lo que queda para canjear (null = sin límite): stock configurado por el padre − canjes de esta demo. */
export const stockLeft = (it: Pick<ParentItem, 'id' | 'stock'>): number | null => (it.stock === null ? null : Math.max(0, it.stock - redeemedCount(it.id)))

/* ---------- lista de deseos: PERSISTE, POR USUARIO (wishlist.json v2; escritura atómica con debounce; patrón space.ts) ---------- */
const WISH_FILE = join(SERVER_ROOT, 'data', 'wishlist.json')
const WISH_CAP = 20 // por usuario
/** Enteros positivos, sin repetidos, con tope. Qué premio existe se mira al LEER (los premios son del
 *  padre y pueden archivarse/reactivarse; además, al cargar este módulo todavía no se consulta ./parent). */
function cleanWish(raw: unknown): number[] {
  const out: number[] = []
  for (const v of Array.isArray(raw) ? raw : []) if (typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && !out.includes(v)) out.push(v)
  return out.slice(0, WISH_CAP)
}
/** La lista de cada usuario: del más reciente al más viejo (puede guardar ids de premios archivados). */
type WishUsers = Record<string, number[]>
/** Tira si falla (durable.ts). */
const writeWishNow = (users: WishUsers) => writeFileAtomic(WISH_FILE, JSON.stringify({ version: 2, users }))
function loadWish(): WishUsers {
  if (!existsSync(WISH_FILE)) return {}
  let text: string
  let up: ReturnType<typeof upgradeWishRaw>
  try {
    text = readFileSync(WISH_FILE, 'utf8')
    up = upgradeWishRaw(JSON.parse(text), DEFAULT_USER_ID)
  } catch (e) {
    console.warn('[market] wishlist.json ilegible, arranco con las listas vacías:', e)
    quarantine(WISH_FILE, 'market') // sin copia: seguimos igual
    return {}
  }
  const users: WishUsers = {}
  for (const [id, list] of Object.entries(up.raw.users)) users[id] = cleanWish(list)
  if (up.from === 1) {
    // v1 → v2: lo de antes eran los deseos de Ian. Respaldo LITERAL (durable.ts: si ya hay un .pre-v2 con OTRO contenido,
    // va a .pre-v2-<ms>). La migración no pierde nada (todo pasa a ian), así que sigue aunque el respaldo falle.
    backupBeforeMigrate(WISH_FILE, '.pre-v2', text, 'market')
    try { writeWishNow(users) } catch (e) { console.error('[market] no pude escribir wishlist.json v2:', e) }
    console.log(`[market] wishlist.json v1 → v2: [${users[DEFAULT_USER_ID]?.join(',') ?? ''}] a «${DEFAULT_USER_ID}» (respaldo en wishlist.json.pre-v2)`)
  }
  return users
}
const wishes: WishUsers = loadWish()
/** La lista del usuario del pedido ([] si todavía no deseó nada; no crea entrada al leer). */
const wishNow = (): number[] => wishes[stores.nowId()] ?? []
/** Lo que se le muestra al chico: solo deseos de SUS premios que hoy están en la Tienda. */
const liveWish = () => wishNow().filter(id => activeItem(id) !== undefined)
/** Marca (queda primera: es la más reciente) o desmarca un premio en la lista del usuario del pedido; sin `value` alterna.
 *  Tope WISH_CAP: si se pasa, se cae el deseo más viejo. Marcar algo ya marcado no lo mueve (idempotente). DISCO PRIMERO
 *  (FS-BASE-B): si wishlist.json no se escribe, la lista no cambia y tira DiskWriteError (la ruta responde 500); como la
 *  RAM no cambió, el reintento vuelve a escribir (no cae en el "ya estaba"). */
export function setWish(itemId: number, value?: boolean): number[] {
  const list = wishNow()
  const has = list.includes(itemId)
  const want = value ?? !has
  if (want === has) return liveWish()
  const next: WishUsers = { ...wishes, [stores.nowId()]: want ? [itemId, ...list].slice(0, WISH_CAP) : list.filter(id => id !== itemId) }
  try { writeWishNow(next) } catch (e) { console.error('[market] no pude guardar wishlist.json:', e); throw new DiskWriteError(WISH_FILE, e) }
  wishes[stores.nowId()] = next[stores.nowId()]
  return liveWish()
}

/* ---------- lógica ---------- */
const toItem = (i: ParentItem) => ({ id: i.id, title: i.title, ...(i.desc ? { desc: i.desc } : {}), price: i.price, emoji: i.emoji, source: 'padre' as const, stock: stockLeft(i), wished: wishNow().includes(i.id), kind: 'premio' as const })
const toRedemption = (r: Redemption) => ({
  id: r.id, itemId: r.itemId, title: r.title, emoji: r.emoji, price: r.price, ts: r.ts, status: r.status,
  ...(r.origin ? { origin: r.origin } : {}), ...(r.closedAt !== undefined ? { closedAt: r.closedAt } : {}),
})
/** ¿Este canje es de `member`? Uno de un premio suyo (U3: el dueño sale del premio) o el premio de la liga de la familia que
 *  ganó (U5: vive en SU slice por construcción). */
const belongsTo = (r: Redemption, member: string) => r.origin === 'liga-familia' || itemOwner(r.itemId) === member

/** Premios publicados (sin los archivados): deseados primero (del más reciente al más viejo), después el resto por
 *  precio. Al final, la ropa del avatar (ítems de plataforma) por precio: la UI la muestra en su propia sección. */
export function listItems() {
  const rank = new Map(wishNow().map((id, i) => [id, i]))
  const premios = policyItems().filter(i => !i.archived).sort((a, b) => {
    const ra = rank.get(a.id) ?? -1, rb = rank.get(b.id) ?? -1
    if (ra >= 0 || rb >= 0) return ra < 0 ? 1 : rb < 0 ? -1 : ra - rb
    return a.price - b.price || a.id - b.id
  }).map(toItem)
  return [...premios, ...ROPA.map(toRopaItem)]
}
/** Los canjes de un integrante (U4: los de SU slice; U3: además, solo de premios suyos —el dueño sale del premio—, que es lo
 *  único que puede canjear). null (un adulto activo, que no tiene premios) → ninguno. Acceso EXPLÍCITO: lo usan Familia
 *  (?member) y /api/market/redemptions (con el chico activo). */
export function listRedemptions(member: string | null) {
  if (!member) return []
  return stores.of(member).redemptions.filter(r => belongsTo(r, member)).slice(0, 100).map(toRedemption)
}

/** El padre ya lo entregó (POST /api/parent/deliver?member). Busca en el slice DEL INTEGRANTE (el usuario del pedido es el
 *  adulto). Idempotente; false si el canje no existe en ese integrante (por ejemplo, porque una carga de página suya reseteó
 *  la demo, o porque es de otro integrante) o no es de un premio de `member`. U5: entrega también el premio de la liga de
 *  la familia (el MISMO "Ya se lo di"). */
export function deliverRedemption(id: number, member: string): boolean {
  const r = stores.of(member).redemptions.find(x => x.id === id)
  if (!r || !belongsTo(r, member)) return false
  if (r.status !== 'entregado') {
    r.status = 'entregado'
    console.log(`[market] canje #${r.id} de ${member} entregado: ${r.emoji} ${r.title}`)
  }
  return true
}

/** U5-A (docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §3.4): el premio de la semana de la familia que ganó `uid` queda como un canje
 *  PENDIENTE en SU slice (acceso EXPLÍCITO: el usuario del pedido es el adulto que cerró, o quien disparó el cierre real).
 *  itemId 0 y price 0: no es un ítem de la Tienda (no toca stock, canjes ni deseos de nadie) y NO mueve ⚡ (sin spendEc ni
 *  movimiento en la billetera). El padre lo entrega con el "Ya se lo di" de siempre (deliverRedemption). Lo llama
 *  leaguesFake.ts (este módulo no lo importa). Un F5 de ese chico lo borra, como cualquier canje pendiente (borde §2.7). */
export function grantFamilyPrize(uid: string, p: { emoji: string; title: string }, closedAt: number): ReturnType<typeof toRedemption> {
  const store = stores.of(uid)
  const r: Redemption = { id: redemptionSeq++, itemId: 0, title: p.title, emoji: p.emoji, price: 0, ts: Date.now(), status: 'pendiente', origin: 'liga-familia', closedAt }
  store.redemptions.unshift(r)
  console.log(`[market] premio de la liga de la familia para ${uid}: canje #${r.id} ${r.emoji} ${r.title} (sin ⚡) · pendiente de entrega`)
  return toRedemption(r)
}

type RedeemBody = { ok: boolean; ec: number; redemption?: ReturnType<typeof toRedemption>; error?: string }

/** Compra de ropa del avatar (el mismo POST /redeem): entrega INSTANTÁNEA al guardarropas, sin canje pendiente. */
function buyRopa(r: Ropa): { status: number; body: RedeemBody } {
  const store = stores.now()
  const ec = summary().ec
  if (store.owned.has(r.accessoryId)) return { status: 200, body: { ok: false, ec, error: `Ya tenés ${theRopa(r)} en tu guardarropas.` } }
  if (ec < r.price) return { status: 200, body: { ok: false, ec, error: `Te faltan ${fmt(r.price - ec)} ⚡` } }
  const paid = spendEc(r.price, `Ropa para tu avatar: ${r.title}`)
  if (!paid.ok) return { status: 200, body: { ok: false, ec: paid.ec, error: `Te faltan ${fmt(Math.max(1, r.price - paid.ec))} ⚡` } }
  store.owned.add(r.accessoryId)
  console.log(`[market] ropa de ${stores.nowId()}: ${r.emoji} ${r.title} (−${r.price} ⚡) → saldo ${paid.ec} · guardarropas: ${[...store.owned].join(', ')}`)
  return { status: 200, body: { ok: true, ec: paid.ec } }
}

/** Canje: valida premio y stock, gasta con spendEc() y deja el canje PENDIENTE de entrega (una prenda de ropa se
 *  compra y se entrega en el acto: buyRopa). Síncrono de punta a punta: no hay carrera entre el chequeo de
 *  saldo/stock y el gasto. */
export function redeem(itemId: number): { status: number; body: RedeemBody } {
  const ropa = ropaItem(itemId)
  if (ropa) return buyRopa(ropa)
  const ec = summary().ec
  const it = activeItem(itemId)
  if (!it) return { status: 404, body: { ok: false, ec, error: 'Ese premio ya no está en la Tienda.' } }
  const left = stockLeft(it)
  if (left !== null && left <= 0) return { status: 200, body: { ok: false, ec, error: 'Este premio se agotó.' } }
  if (ec < it.price) return { status: 200, body: { ok: false, ec, error: `Te faltan ${fmt(it.price - ec)} ⚡` } }
  const paid = spendEc(it.price, `Canje: ${it.title}`)
  if (!paid.ok) return { status: 200, body: { ok: false, ec: paid.ec, error: `Te faltan ${fmt(Math.max(1, it.price - paid.ec))} ⚡` } }
  const store = stores.now()
  const r: Redemption = { id: redemptionSeq++, itemId: it.id, title: it.title, emoji: it.emoji, price: it.price, ts: Date.now(), status: 'pendiente' }
  store.redemptions.unshift(r)
  console.log(`[market] canje #${r.id} de ${stores.nowId()}: ${it.emoji} ${it.title} (−${it.price} ⚡) → saldo ${paid.ec}${left !== null ? ` · quedan ${left - 1}` : ''}`)
  return { status: 200, body: { ok: true, ec: paid.ec, redemption: toRedemption(r) } }
}

type GiftBody = { ok: boolean; ec: number; error?: string; friend?: unknown }

/** Regalo de ropa a un amigo (NPC): valida prenda, amigo, que no la tenga ya y el saldo; cobra con spendEc() y el NPC
 *  se la pone y agradece en su hilo. Entre las validaciones y el cobro no hay ningún await (sin carreras). `req` viaja
 *  hasta giftCheck: el apagado de Amigos (403) rige solo si el usuario activo es un chico. */
async function gift(req: IncomingMessage, itemId: number, friendId: string): Promise<{ status: number; body: GiftBody }> {
  // friendsFake se trae al USARLO, no al cargar: con un import estático, market (al que el arranque llega temprano por
  // filters → parent → market) arrastraría chat/judge/search a evaluarse antes de que filters y parent existan.
  const friends = await import('./friendsFake')
  const ec = summary().ec
  const r = ropaItem(itemId)
  if (!r) {
    return anyParentItem(itemId)
      ? { status: 400, body: { ok: false, ec, error: 'Por ahora solo se puede regalar ropa para el avatar.' } }
      : { status: 404, body: { ok: false, ec, error: 'Ese regalo no está en la Tienda.' } }
  }
  const target = friends.giftCheck(req, friendId, r.accessoryId, theRopa(r))
  if (!target.ok) return { status: target.status, body: { ok: false, ec, error: target.error } }
  if (ec < r.price) return { status: 200, body: { ok: false, ec, error: `Te faltan ${fmt(r.price - ec)} ⚡` } }
  const paid = spendEc(r.price, `Regalo para ${target.nick}: ${r.title}`)
  if (!paid.ok) return { status: 200, body: { ok: false, ec: paid.ec, error: `Te faltan ${fmt(Math.max(1, r.price - paid.ec))} ⚡` } }
  const friend = friends.receiveGift(friendId, r.accessoryId, giftText(r))
  console.log(`[market] regalo: ${r.emoji} ${r.title} para ${target.nick} (−${r.price} ⚡) → saldo ${paid.ec}`)
  return { status: 200, body: { ok: true, ec: paid.ec, friend } }
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
  // ni canjes, ni lista de deseos. Antes que cualquier otra validación (fail-closed). Es un candado del CHICO (el de ESE
  // chico, U3): el adulto activo pasa (docs/USUARIOS.md §4).
  const me = actingUser(req)
  if (me.kind === 'child' && !featureOn('tienda', me.id)) return send(res, 403, OFF)
  const path = url.pathname.replace(/\/+$/, '')
  if (path === '/api/market') {
    if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido: usá GET.' })
    return send(res, 200, { items: listItems(), ec: summary().ec })
  }
  if (path === '/api/market/redemptions') {
    if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido: usá GET.' })
    return send(res, 200, { redemptions: listRedemptions(policyMemberId()) })
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
    try { return send(res, 200, { wishlist: setWish(itemId, typeof value === 'boolean' ? value : undefined) }) }
    catch (e) { if (e instanceof DiskWriteError) return send(res, 500, { error: 'No pude guardar tu lista de deseos. Probá de nuevo.', wishlist: liveWish() }); throw e }
  }
  if (path === '/api/market/gift') {
    if (req.method !== 'POST') return send(res, 405, { ok: false, ec: summary().ec, error: 'Método no permitido: para regalar se usa POST.' })
    let body: unknown
    try { body = await readJson(req) } catch { return send(res, 400, { ok: false, ec: summary().ec, error: 'Pedido inválido (se esperaba JSON).' }) }
    const itemId = parseItemId(body)
    if (itemId === 'falta') return send(res, 400, { ok: false, ec: summary().ec, error: 'Falta el regalo (itemId).' })
    if (itemId === null) return send(res, 400, { ok: false, ec: summary().ec, error: 'El regalo (itemId) tiene que ser un número entero positivo.' })
    const friendId = (body as Record<string, unknown>).friendId
    if (typeof friendId !== 'string' || !/^[\w-]{1,40}$/.test(friendId)) return send(res, 400, { ok: false, ec: summary().ec, error: 'Falta el amigo (friendId).' })
    const g = await gift(req, itemId, friendId)
    return send(res, g.status, g.body)
  }
  return send(res, 404, { error: 'not found' })
}
