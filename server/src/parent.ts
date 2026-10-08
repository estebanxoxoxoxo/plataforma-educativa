// Zona del padre (v1): "recuperar el control: el padre programa la plataforma" (VISION §10; audios 8,
// 21-22, 34-35, 55-56, 66). "Si el papá dice no tiene que existir el Energy Coin, no existe" (22).
// Contrato HTTP (congelado; formas en src/api/types.ts):
//   GET  /api/parent/features            → ParentFeatures (grandes on-off; persisten: son config del padre)
//   POST /api/parent/features {key,on}   → ParentFeatures
//   GET  /api/parent/activity            → ParentActivity (XP/EC, "seguí practicando", guardados con su carpeta, canjes)
//   POST /api/parent/items {NewMarketItem}        → MarketItem (publicar premio)
//   POST /api/parent/items/update {id,...patch}   → {ok}
//   POST /api/parent/items/archive {id}           → {ok}
//   POST /api/parent/deliver {id}                 → {ok} (marcar canje entregado; {ok:false} si no existe)
// EXTENSIONES ADITIVAS (no rompen el contrato; pendientes de formalizar en types.ts por el coordinador):
//   · GET /api/parent/activity suma `items` (TODOS los premios del padre, archivados incluidos, con
//     `left` = lo que queda para canjear y `redeemed` = canjes de esta demo) y `protections` (lo que ya
//     filtra el backend: sitios/videos aprobados, palabras y temas bloqueados, modo de dominios,
//     policyVersion). El cliente congelado no tiene otra forma de listar archivados ni de leer /api/health.
//   · POST /api/parent/items/update acepta además `archived: boolean` (false = REACTIVAR un archivado).
//
// PERSISTENCIA: server/data/parent.json = CONFIG del padre (regla 9: la config persiste; la ECONOMÍA no):
// los on-off y los premios publicados (con su stock configurado y si están archivados). Los CANJES, el
// saldo y el stock consumido siguen en RAM (market.ts / progress.ts) y vuelven al seed con cada carga.
// Escritura atómica (tmp + rename, como space.ts) e INMEDIATA, sin debounce a propósito: son pocos
// cambios y es config del padre; un reinicio del server (tsx watch) justo después no puede perderla.
// La primera vez (sin archivo) se escribe el seed: todo prendido + los premios demo que antes vivían
// en market.ts. Archivo ilegible → arranca CERRADO (todo apagado, sin premios; copia en .roto-*).
//
// ENFORCEMENT (fail-closed): featureOn() lo consultan los módulos del server. tienda=false → todo
// /api/market* responde 403 (market.ts). chat/ligas/amigos: por ahora el portón es del cliente (menú y
// rutas); el 403 de POST /api/chat necesita un toque en index.ts (pendiente del coordinador).
//
// IMPORTS CRUZADOS parent ↔ market: market.ts lee de acá los premios y featureOn(); acá se leen de
// market.ts los canjes (RAM). Es seguro porque NINGUNO de los dos llama al otro en el nivel superior
// del módulo (solo dentro de funciones): el orden de evaluación da igual. Mantener esa regla.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { SERVER_ROOT, blackTopics, config, whitelistSites } from './config'
import { deliverRedemption, listRedemptions, redeemedCount, stockLeft } from './market'
import { summary } from './progress'
import { allSavedForParent } from './space'
import { catalogSize } from './videos'
import { readJson, send } from './web'

/* ---------- modelo ---------- */
export const FEATURE_KEYS = ['tienda', 'ligas', 'amigos', 'chat'] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]
export type ParentFeatures = Record<FeatureKey, boolean>
/** Premio publicado por el padre. `stock` = cupo de canjes que él configuró (null = sin límite): lo
 *  consumido sale de los canjes en RAM (market.stockLeft). Archivado ≠ borrado: no se ve en la Tienda
 *  pero queda acá y se puede reactivar. */
export interface ParentItem {
  id: number; emoji: string; title: string; desc?: string; price: number; stock: number | null
  archived: boolean; createdAt: number; updatedAt?: number
}
interface ParentStore { version: 1; seq: number; features: ParentFeatures; items: ParentItem[] }

const FILE = join(SERVER_ROOT, 'data', 'parent.json')
const LIMITS = { title: 60, desc: 140, price: 100_000, stock: 9_999 } as const

/* Seed DEMO "del padre" (se escribe la PRIMERA vez que no hay parent.json; antes vivía en market.ts).
   Es lo que el papá de Ian publicaría para arrancar. Precios calibrados a una cosecha semanal de
   ~1.200 ⚡: lo cotidiano sale 100–250, una salida 400, un libro 600 y hay UNA meta grande para ahorrar
   varias semanas. stock null = sin límite. Los ids 1..8 se conservan (la lista de deseos los usa). */
const SEED_ITEMS: Pick<ParentItem, 'emoji' | 'title' | 'desc' | 'price' | 'stock'>[] = [
  { emoji: '🎮', title: '30 minutos de videojuegos', desc: 'Media hora de tu juego favorito, cuando terminás las tareas.', price: 150, stock: null },
  { emoji: '🍿', title: 'Elegís la película del viernes', desc: 'Noche de peli en familia: esta vez la elección es tuya.', price: 250, stock: null },
  { emoji: '🍦', title: 'Salida por un helado', desc: 'Vamos juntos a la heladería y elegís los gustos.', price: 400, stock: null },
  { emoji: '🚲', title: '1 hora de bici en la plaza', desc: 'Salimos a andar juntos. ¡Llevá el casco!', price: 200, stock: null },
  { emoji: '📚', title: 'Un libro nuevo que elijas', desc: 'Vamos a la librería y te llevás el que más te guste.', price: 600, stock: null },
  { emoji: '🦉', title: '30 minutos más despierto', desc: 'Te acostás media hora más tarde un viernes o un sábado.', price: 350, stock: 2 },
  { emoji: '🛏️', title: 'Día sin tender la cama', desc: 'Por un día la cama se queda como está. ¡Nadie te dice nada!', price: 100, stock: null },
  { emoji: '🎢', title: 'Un día en el parque de diversiones', desc: 'La gran salida: un día entero de juegos. ¡Es para ahorrar!', price: 3000, stock: 1 },
]
const allFeatures = (on: boolean): ParentFeatures => ({ tienda: on, ligas: on, amigos: on, chat: on })
function seed(): ParentStore {
  const now = Date.now()
  return { version: 1, seq: SEED_ITEMS.length + 1, features: allFeatures(true), items: SEED_ITEMS.map((s, i) => ({ id: i + 1, ...s, archived: false, createdAt: now })) }
}

/* ---------- validación (compartida por el archivo leído de disco y por la API) ---------- */
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const KEYCAP = String.fromCodePoint(0x20e3) // 1️⃣ y familia: no son Extended_Pictographic
const cleanText = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim()
const toInt = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*\d{1,9}\s*$/.test(v) ? Number(v) : NaN
  return Number.isSafeInteger(n) ? n : null
}
type Check<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
function checkTitle(v: unknown): Check<string> {
  const t = typeof v === 'string' ? cleanText(v) : ''
  return t.length >= 2 && t.length <= LIMITS.title ? { ok: true, value: t } : fail(`El título tiene que tener entre 2 y ${LIMITS.title} caracteres.`)
}
function checkDesc(v: unknown): Check<string | undefined> {
  if (v === undefined || v === null) return { ok: true, value: undefined }
  if (typeof v !== 'string') return fail('La descripción tiene que ser texto.')
  const t = cleanText(v)
  return t.length <= LIMITS.desc ? { ok: true, value: t || undefined } : fail(`La descripción admite hasta ${LIMITS.desc} caracteres.`)
}
function checkPrice(v: unknown): Check<number> {
  const n = toInt(v)
  return n !== null && n >= 1 && n <= LIMITS.price ? { ok: true, value: n } : fail('El precio tiene que ser un número entero entre 1 y 100.000.')
}
function checkEmoji(v: unknown): Check<string> {
  const t = typeof v === 'string' ? v.trim() : ''
  const n = [...graphemes.segment(t)].length
  const pictographic = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(t) || t.includes(KEYCAP)
  return n >= 1 && n <= 2 && t.length <= 16 && pictographic ? { ok: true, value: t } : fail('Elegí un emoji para el premio (por ejemplo 🎮).')
}
function checkStock(v: unknown): Check<number | null> {
  if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) return { ok: true, value: null }
  const n = toInt(v)
  return n !== null && n >= 0 && n <= LIMITS.stock ? { ok: true, value: n } : fail('El stock tiene que ser un número entero (o vacío = sin límite).')
}

/* ---------- persistencia ---------- */
function writeAtomic(s: ParentStore): boolean {
  try { writeFileSync(FILE + '.tmp', JSON.stringify(s, null, 2)); renameSync(FILE + '.tmp', FILE); return true }
  catch (e) { console.error('[parent] no pude guardar parent.json:', e); return false }
}
/** Lee parent.json validando todo. Lo que falta o vino mal en `features` queda APAGADO (fail-closed). */
function sanitize(raw: unknown): ParentStore {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const rf = (r.features && typeof r.features === 'object' ? r.features : {}) as Record<string, unknown>
  const features = allFeatures(false)
  for (const k of FEATURE_KEYS) {
    if (typeof rf[k] === 'boolean') features[k] = rf[k] as boolean
    else console.warn(`[parent] parent.json sin "${k}" válido: queda APAGADO hasta que el padre lo prenda`)
  }
  const items: ParentItem[] = []
  for (const it of Array.isArray(r.items) ? r.items : []) {
    const o = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>
    const id = toInt(o.id), title = checkTitle(o.title), desc = checkDesc(o.desc), price = checkPrice(o.price), emoji = checkEmoji(o.emoji), stock = checkStock(o.stock)
    if (id === null || id < 1 || items.some(x => x.id === id) || !title.ok || !desc.ok || !price.ok || !emoji.ok || !stock.ok) {
      console.warn('[parent] premio inválido en parent.json, lo salteo:', JSON.stringify(it).slice(0, 160)); continue
    }
    const updatedAt = toInt(o.updatedAt)
    items.push({
      id, emoji: emoji.value, title: title.value, ...(desc.value ? { desc: desc.value } : {}), price: price.value, stock: stock.value,
      archived: o.archived === true, createdAt: toInt(o.createdAt) ?? Date.now(), ...(updatedAt ? { updatedAt } : {}),
    })
  }
  const seq = Math.max(toInt(r.seq) ?? 1, ...items.map(i => i.id + 1), 1)
  return { version: 1, seq, features, items }
}
function load(): ParentStore {
  if (!existsSync(FILE)) {
    const s = seed()
    writeAtomic(s) // primera vez: queda escrito ya, no espera a un cambio
    console.log('[parent] parent.json creado: funcionalidades prendidas + premios demo del padre')
    return s
  }
  try { return sanitize(JSON.parse(readFileSync(FILE, 'utf8'))) }
  catch (e) {
    // Fail-closed: sin la config del padre no se prende nada opcional. Se guarda copia del roto.
    console.error('[parent] parent.json ilegible → arranco CERRADO (todo apagado, sin premios); copia en .roto-*:', e)
    try { renameSync(FILE, `${FILE}.roto-${Date.now()}`) } catch { /* sin copia: seguimos igual */ }
    const s: ParentStore = { version: 1, seq: 1, features: allFeatures(false), items: [] }
    writeAtomic(s) // si no, el próximo arranque vería "sin archivo" y sembraría todo prendido
    return s
  }
}
const store: ParentStore = load()
const save = () => writeAtomic(store)

/* ---------- API para los módulos del server (imports, no HTTP) ---------- */
/** ¿Esta funcionalidad está prendida? Fail-closed: clave desconocida → false. */
export const featureOn = (key: FeatureKey): boolean => store.features[key] === true
export const features = (): ParentFeatures => ({ ...store.features })
/** Todos los premios del padre (archivados incluidos), como copias. */
export const parentItems = (): ParentItem[] => store.items.map(i => ({ ...i }))
export function parentItem(id: number): ParentItem | undefined {
  const it = store.items.find(i => i.id === id)
  return it ? { ...it } : undefined
}

/* ---------- lógica ---------- */
function setFeature(key: FeatureKey, on: boolean): boolean {
  if (store.features[key] === on) return true
  store.features[key] = on
  console.log(`[parent] ${key} → ${on ? 'prendida' : 'APAGADA'}`)
  return save()
}

type Input = Record<string, unknown>
function addItem(b: Input): Check<ParentItem> {
  const title = checkTitle(b.title); if (!title.ok) return title
  const desc = checkDesc(b.desc); if (!desc.ok) return desc
  const price = checkPrice(b.price); if (!price.ok) return price
  const emoji = checkEmoji(b.emoji); if (!emoji.ok) return emoji
  const stock = checkStock(b.stock); if (!stock.ok) return stock
  const it: ParentItem = { id: store.seq++, emoji: emoji.value, title: title.value, ...(desc.value ? { desc: desc.value } : {}), price: price.value, stock: stock.value, archived: false, createdAt: Date.now() }
  store.items.push(it)
  console.log(`[parent] premio #${it.id} publicado: ${it.emoji} ${it.title} (${it.price} ⚡${it.stock !== null ? ` · stock ${it.stock}` : ''})`)
  return save() ? { ok: true, value: { ...it } } : fail('No pude guardar el premio. Probá de nuevo.')
}
/** Edición parcial: solo los campos que vienen. `desc: ''` la borra · `stock: null|''` = sin límite ·
 *  `archived: false` reactiva (true archiva). 'missing' = ese premio no existe. */
function updateItem(id: number, b: Input): Check<true> | 'missing' {
  const it = store.items.find(i => i.id === id)
  if (!it) return 'missing'
  const next: ParentItem = { ...it }
  let touched = false
  if ('title' in b) { const c = checkTitle(b.title); if (!c.ok) return c; next.title = c.value; touched = true }
  if ('desc' in b) { const c = checkDesc(b.desc ?? ''); if (!c.ok) return c; if (c.value) next.desc = c.value; else delete next.desc; touched = true }
  if ('price' in b) { const c = checkPrice(b.price); if (!c.ok) return c; next.price = c.value; touched = true }
  if ('emoji' in b) { const c = checkEmoji(b.emoji); if (!c.ok) return c; next.emoji = c.value; touched = true }
  if ('stock' in b) { const c = checkStock(b.stock); if (!c.ok) return c; next.stock = c.value; touched = true }
  if ('archived' in b) { if (typeof b.archived !== 'boolean') return fail('archived tiene que ser true o false.'); next.archived = b.archived; touched = true }
  if (!touched) return fail('No vino ningún cambio para guardar.')
  next.updatedAt = Date.now()
  store.items[store.items.indexOf(it)] = next
  console.log(`[parent] premio #${next.id} editado: ${next.emoji} ${next.title} · ${next.price} ⚡ · stock ${next.stock ?? '∞'}${next.archived ? ' · ARCHIVADO' : ''}`)
  return save() ? { ok: true, value: true } : fail('No pude guardar el cambio. Probá de nuevo.')
}

/** Lo que ya protege el backend real (solo lectura en la v1 del panel). */
function protections() {
  return {
    /** Sitios de la lista blanca activos (los únicos de donde se leen artículos). */ sites: whitelistSites().length,
    /** Videos del catálogo aprobado (buscador, chat, Mi espacio y Aprender salen de acá). */ videos: catalogSize(),
    /** Palabras bloqueadas (búsquedas, títulos, chat, ejercicios). */ blockedWords: config.blockedWords.length,
    /** Temas de la lista negra que vigila el revisor automático (artículos y chat). */ blockedTopics: blackTopics().length,
    /** Modo de dominios para artículos: 'blanca' (solo la lista) · 'negra' · 'hibrido'. */ domainMode: config.articulosModo,
    policyVersion: config.policyVersion,
  }
}

function activity() {
  const s = summary()
  return {
    xpWeek: s.xpWeek, ec: s.ec, streakDays: s.streakDays, continue: s.continue,
    saved: allSavedForParent(),
    redemptions: listRedemptions(),
    // extensiones aditivas (ver cabecera)
    items: store.items.map(i => ({
      id: i.id, emoji: i.emoji, title: i.title, ...(i.desc ? { desc: i.desc } : {}), price: i.price,
      stock: i.stock, left: stockLeft(i), redeemed: redeemedCount(i.id), archived: i.archived, createdAt: i.createdAt,
    })),
    protections: protections(),
  }
}

/** id válido = entero positivo (número o string de dígitos). */
const parseId = (b: Input): number | null => { const n = toInt(b.id); return n !== null && n > 0 ? n : null }

/* ---------- rutas ---------- */
const KNOWN = new Set(['/api/parent/features', '/api/parent/activity', '/api/parent/items', '/api/parent/items/update', '/api/parent/items/archive', '/api/parent/deliver'])

export async function parentRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const path = url.pathname.replace(/\/+$/, '')
  const method = req.method ?? 'GET'
  if (!KNOWN.has(path)) return send(res, 404, { error: 'not found' })

  if (method === 'GET') {
    if (path === '/api/parent/features') return send(res, 200, features())
    if (path === '/api/parent/activity') return send(res, 200, activity())
    return send(res, 405, { error: 'Método no permitido: usá POST.' })
  }
  if (method !== 'POST' || path === '/api/parent/activity') return send(res, 405, { error: 'Método no permitido.' })

  let b: Input
  try {
    const raw = await readJson<unknown>(req)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('no es un objeto')
    b = raw as Input
  } catch { return send(res, 400, { ok: false, error: 'Pedido inválido (se esperaba un objeto JSON).' }) }

  switch (path) {
    case '/api/parent/features': {
      const key = b.key
      if (typeof key !== 'string' || !(FEATURE_KEYS as readonly string[]).includes(key)) return send(res, 400, { error: `key tiene que ser una de: ${FEATURE_KEYS.join(', ')}.` })
      if (typeof b.on !== 'boolean') return send(res, 400, { error: 'on tiene que ser true o false.' })
      if (!setFeature(key as FeatureKey, b.on)) return send(res, 500, { error: 'No pude guardar el cambio. Probá de nuevo.' })
      return send(res, 200, features())
    }
    case '/api/parent/items': {
      const r = addItem(b)
      if (!r.ok) return send(res, 400, { error: r.error })
      const it = r.value
      // Forma MarketItem (lo que vería el chico): recién publicado → stock completo y fuera de la lista de deseos.
      return send(res, 200, { id: it.id, title: it.title, ...(it.desc ? { desc: it.desc } : {}), price: it.price, emoji: it.emoji, source: 'padre', stock: it.stock, wished: false })
    }
    case '/api/parent/items/update':
    case '/api/parent/items/archive': {
      const id = parseId(b)
      if (id === null) return send(res, 400, { ok: false, error: 'Falta el premio (id entero positivo).' })
      const patch: Input = path.endsWith('/archive') ? { archived: true } : Object.fromEntries(Object.entries(b).filter(([k]) => k !== 'id'))
      const r = updateItem(id, patch)
      if (r === 'missing') return send(res, 200, { ok: false, error: 'Ese premio no existe.' })
      return r.ok ? send(res, 200, { ok: true }) : send(res, 400, { ok: false, error: r.error })
    }
    case '/api/parent/deliver': {
      const id = parseId(b)
      if (id === null) return send(res, 400, { ok: false, error: 'Falta el canje (id entero positivo).' })
      return send(res, 200, { ok: deliverRedemption(id) })
    }
  }
  return send(res, 404, { error: 'not found' })
}
