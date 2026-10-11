// Zona del padre (v2): "recuperar el control: el padre programa la plataforma" (VISION §10; audios 8, 21-22, 34-35,
// 55-56, 66). "Si el papá dice no tiene que existir el Energy Coin, no existe" (22). La v2 es la CONFIGURACIÓN VIVA:
// lo que el padre elige acá se aplica al chico en el acto, en el server (no es un filtro de pantalla):
//   · Temas NEGROS de la familia → los jueces los suman a la lista negra de fábrica (judge.ts, friendsFake.ts y el veto de
//     medios de chat.ts: blackTopicsAll), el feed saca lo que pega con alguno (feedFake.ts: topicHit) y su nombre se corta
//     además como frase exacta en búsquedas, títulos, chat y mensajes (filters.matchBlockedWord: familyBlockedTerms).
//   · Temas BLANCOS de la familia → "las sugerencias del padre" (audio 8: guían, no dirigen): el feed los prioriza sin
//     volverse monotema y el chat los propone (whiteTopicsAll).
//   · Palabras de la familia → se SUMAN a las de fábrica en matchBlockedWord (búsquedas, títulos, chat, Amigos…).
//   · Topes de volumen → GET /api/parent/limits (público) → bgAudio/MiniPlayer del chico (como settings.maxVol* de Smarty).
//   · Presets (audios 56/66: "grandes presets, no mil detalles") → aplican de una vez on-off + temas + palabras + topes.
//   · Avisos (notifyParent) → crisis (CON el texto del chico: decisión de Esteban 11-oct), contacto y bloqueos repetidos.
//
// Contrato HTTP (congelado; formas en src/api/types.ts). TODAS las rutas piden la sesión abierta por el PIN (cabecera
// X-Parent-Token) MENOS tres: POST unlock (el portón) y GET features / GET limits (las lee la UI del chico). Sin token,
// con uno inventado o vencido → 401 (la UI vuelve al portón).
//   POST /api/parent/unlock {pin}                 → {ok, token?, waitSeconds?}            (público)
//   GET  /api/parent/features                     → ParentFeatures                         (público)
//   GET  /api/parent/limits                       → ParentVolume (topes del MiniPlayer)    (público)
//   POST /api/parent/features {key,on}            → ParentFeatures (grandes on-off; persisten: son config del padre)
//   GET  /api/parent/activity                     → ParentActivity (XP/EC, "seguí practicando", guardados, canjes, premios, protecciones)
//   POST /api/parent/items {NewMarketItem}        → MarketItem (publicar premio)
//   POST /api/parent/items/update {id,...patch}   → {ok}   (acepta `archived: false` = reactivar)
//   POST /api/parent/items/archive {id}           → {ok}
//   POST /api/parent/deliver {id}                 → {ok}   (canje entregado; {ok:false} si no existe)
//   GET  /api/parent/config                       → ParentConfig {topics, words:{extra,builtin}, volume, preset}
//   POST /api/parent/topics {white?, black?}      → ParentTopics  (cada lista que viene REEMPLAZA a la anterior)
//   POST /api/parent/words {extra}                → ParentWords   (reemplaza la lista de la familia)
//   POST /api/parent/volume {maxMusic?, maxNoise?}→ ParentVolume
//   GET  /api/parent/alerts                       → {alerts: ParentAlert[]}  (el más nuevo primero)
//   POST /api/parent/alerts/seen {id}             → {ok}
//   GET  /api/parent/presets                      → {presets: ParentPreset[], current}
//   POST /api/parent/presets/apply {id}           → {ok, config, features}
// EXTENSIONES ADITIVAS (no rompen el contrato; pendientes de formalizar en types.ts por el coordinador):
//   · GET /api/parent/activity suma `items` y `protections` (v1; ya formalizados como opcionales).
//   · GET /api/parent/presets: cada preset trae además `spec` = qué deja configurado (features, temas, palabras,
//     topes) para que el panel muestre qué prende y qué apaga sin duplicar la definición en el cliente.
//   · POST /api/parent/lock (con token) → {ok}: "Cerrar zona de padres" invalida la sesión también en el server.
//
// SESIÓN: token aleatorio de 32 bytes que vive SOLO en RAM (acá se guarda su sha256, nunca el token) y en la memoria de
// la pestaña del padre (api.setParentToken). Vence a los 15 min sin pedidos (deslizante: cada pedido autorizado la
// estira). Reiniciar el server las cierra todas. Tope de sesiones abiertas a la vez: se cae la más vieja.
//
// PERSISTENCIA: server/data/parent.json = CONFIG del padre (regla 9: la config persiste; la ECONOMÍA no): on-off,
// premios, temas, palabras de la familia, topes de volumen y el preset aplicado. Los canjes, el saldo y el stock
// consumido siguen en RAM (market.ts / progress.ts). Los AVISOS también viven en RAM (no se registran en
// /api/demo/reset: se pierden solo si se reinicia el server). Escritura atómica (tmp + rename, como space.ts) e
// INMEDIATA, sin debounce a propósito: son pocos cambios y un reinicio de tsx watch justo después no puede perderlos.
// La primera vez (sin archivo) se escribe el seed: todo prendido + los premios demo. Un parent.json de la v1 (sin los
// campos nuevos) MIGRA en el acto: temas vacíos, sin palabras, topes en 100 y sin preset. Archivo ilegible → arranca
// CERRADO (todo apagado, sin premios; copia en .roto-*), como en la v1.
//
// PIN DE LA ZONA DE PADRES: en parent.json va SOLO su hash (sha256 hex), nunca el texto. POST /api/parent/unlock compara
// en tiempo constante y responde IGUAL (200 {ok:false}) para un PIN mal formado o incorrecto. Rate-limit suave en RAM:
// 5 fallidos seguidos → 30 s de espera ({ok:false, waitSeconds}); se resetea con un acierto, con el reinicio del server
// o con resetUnlockAttempts() (registrado en POST /api/demo/reset).
//
// IMPORTS CRUZADOS: market.ts y filters.ts leen de acá (featureOn, premios, palabras/temas de la familia) y acá se lee
// de market.ts (canjes en RAM), de space.ts y de videos.ts (que a su vez importan filters.ts). Es seguro porque NINGUNO
// llama al otro en el nivel superior del módulo (solo dentro de funciones): el orden de evaluación da igual. Mantener
// esa regla: nada de llamadas a market/filters/space/videos al cargar este módulo, ni de ellos hacia acá.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { SERVER_ROOT, blackTopics, config, ov, whiteTopics, whitelistSites } from './config'
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
/** Temas de la familia: los blancos se promueven (sugerencias), los negros se filtran en serio. */
export interface ParentTopics { white: string[]; black: string[] }
/** Topes de volumen (0-100) que la música y los ruidos de fondo del chico no pueden superar. */
export interface ParentVolume { maxMusic: number; maxNoise: number }
export type AlertKind = 'crisis' | 'contacto' | 'bloqueos'
interface ParentStore {
  version: 2; seq: number; features: ParentFeatures; items: ParentItem[]; /** sha256 hex del PIN */ pinHash: string
  topics: ParentTopics; /** palabras bloqueadas de la familia (se suman a las de fábrica) */ extraWords: string[]
  volume: ParentVolume; /** id del preset aplicado; null = configuración propia (se editó algo a mano) */ preset: string | null
}

const FILE = join(SERVER_ROOT, 'data', 'parent.json')
const LIMITS = { title: 60, desc: 140, price: 100_000, stock: 9_999 } as const
/** Topes de las listas de la familia (temas por lista, palabras) y largo máximo de cada término. */
const TERMS = { topics: 30, words: 100, topicLen: 60, wordLen: 40 } as const

/* PIN del demo: 123456 — default PÚBLICO tipo admin/admin, elegido y dicho abiertamente por Esteban para
   la demo (NO tiene nada que ver con el PIN del respaldo de Smarty, que no se guarda ni se menciona).
   Es el seed de parent.json y la migración de un parent.json viejo sin pinHash. Acá y en disco va solo
   el hash. TODO (versión futura): cambiar el PIN desde el panel. */
const DEMO_PIN_HASH = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92' // = sha256 del PIN del demo
const isPinHash = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)

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
/** Apodo del chico (de la config de Smarty) para los textos del padre. Definido antes de load(): lo usa la validación. */
const kidName = () => config.apodo || 'tu hijo'
const noTopics = (): ParentTopics => ({ white: [], black: [] })
const fullVolume = (): ParentVolume => ({ maxMusic: 100, maxNoise: 100 })

/* ---------- presets (audios 56 y 66: "grandes presets, no mil detalles") ----------
   Honestos sobre lo que EXISTE: cada uno deja configurado exactamente lo que el server aplica (los cuatro on-off,
   temas, palabras de la familia y topes de volumen). Aplicar uno REEMPLAZA todo eso; editar cualquier cosa a mano
   después lo deja en null ("configuración propia"). Los temas del clásico conservador son los de la familia demo
   (familia conservadora que hace homeschooling: VISION §1) y se SUMAN a la protección de fábrica de Smarty. */
interface PresetDef { id: string; name: string; desc: string; features: ParentFeatures; topics: ParentTopics; words: string[]; volume: ParentVolume }
const PRESETS: readonly PresetDef[] = [
  {
    id: 'primeros-pasos', name: 'Primeros pasos (3 a 6 años)',
    desc: 'Para los más chicos: mirar, escuchar y aprender. Sin chat, sin amigos, sin ligas ni Tienda; la música y los ruidos llegan como mucho a la mitad del volumen.',
    features: allFeatures(false), topics: { white: ['animales', 'canciones infantiles'], black: [] }, words: [], volume: { maxMusic: 50, maxNoise: 50 },
  },
  {
    id: 'clasico-conservador', name: 'Clásico conservador',
    desc: 'Todo prendido, con los temas que una familia conservadora no quiere ver en la plataforma (se suman a la protección de fábrica) y la Biblia y la historia como sugerencias.',
    features: allFeatures(true),
    topics: { white: ['Biblia', 'historia'], black: ['ideología de género', 'política partidaria', 'activismo climático', 'Halloween', 'brujería'] },
    words: [], volume: fullVolume(),
  },
  {
    id: 'explorador-completo', name: 'Explorador completo',
    desc: 'Todo prendido y sin filtros extra de la familia: queda la protección de fábrica de Innerith.',
    features: allFeatures(true), topics: noTopics(), words: [], volume: fullVolume(),
  },
]

function seed(): ParentStore {
  const now = Date.now()
  return {
    version: 2, seq: SEED_ITEMS.length + 1, features: allFeatures(true),
    items: SEED_ITEMS.map((s, i) => ({ id: i + 1, ...s, archived: false, createdAt: now })), pinHash: DEMO_PIN_HASH,
    topics: noTopics(), extraWords: [], volume: fullVolume(), preset: null,
  }
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

/* Términos de la familia (temas y palabras). Se comparan como los compara el filtro de palabras: sin tildes, sin
   mayúsculas y con los espacios colapsados (ese es también el criterio para "repetido" y para "está en las dos listas"). */
const keyOf = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
/** Palabras tan comunes que, bloqueadas, dejarían al chico sin casi nada (búsquedas, títulos, chat). */
const TOO_COMMON = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'u', 'a', 'al', 'en', 'con', 'por', 'para', 'que', 'se', 'su', 'sus', 'lo', 'le', 'les', 'mi', 'tu', 'es', 'no', 'si', 'me', 'te', 'ya', 'muy', 'mas', 'como', 'pero', 'the', 'and', 'of', 'to'])
/** Conectores que no cuentan para decidir de qué trata un tema ("ideología de género" = ideología + género). */
const TOPIC_STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'e', 'o', 'u', 'a', 'al', 'en', 'con', 'por', 'para', 'sobre', 'su', 'sus', 'lo', 'que', 'sin'])
const topicWords = (topic: string) => keyOf(topic).split(/[^a-z0-9]+/).filter(w => w && !TOPIC_STOP.has(w))

function checkTerm(v: unknown, what: 'tema' | 'palabra'): Check<string> {
  const max = what === 'tema' ? TERMS.topicLen : TERMS.wordLen
  const t = typeof v === 'string' ? cleanText(v) : ''
  if (t.length < 2 || t.length > max) return fail(`Cada ${what} tiene que tener entre 2 y ${max} caracteres${t ? ` («${t.slice(0, 50)}»)` : ''}.`)
  if ((t.match(/[\p{L}\p{N}]/gu) ?? []).length < 2) return fail(`«${t}» no ${what === 'tema' ? 'es un tema válido' : 'es una palabra válida'}: tiene que tener letras.`)
  if (what === 'palabra' && TOO_COMMON.has(keyOf(t))) return fail(`«${t}» es demasiado común: bloquearía casi todo lo que lee ${kidName()}.`)
  if (what === 'tema' && !topicWords(t).length) return fail(`«${t}» no dice de qué tema se trata.`)
  return { ok: true, value: t }
}
/** Lista de la API: TODO tiene que ser válido (si no, 400 con el motivo). Sin repetidos (gana el primero). */
function checkTerms(v: unknown, what: 'tema' | 'palabra', max: number): Check<string[]> {
  if (!Array.isArray(v)) return fail(what === 'tema' ? 'Los temas tienen que venir en una lista.' : 'Las palabras tienen que venir en una lista.')
  if (v.length > max * 3) return fail(`Hasta ${max} ${what === 'tema' ? 'temas por lista' : 'palabras'}.`)
  const out: string[] = [], seen = new Set<string>()
  for (const raw of v) {
    const c = checkTerm(raw, what)
    if (!c.ok) return c
    const k = keyOf(c.value)
    if (!seen.has(k)) { seen.add(k); out.push(c.value) }
  }
  return out.length <= max ? { ok: true, value: out } : fail(`Hasta ${max} ${what === 'tema' ? 'temas por lista' : 'palabras'}.`)
}
/** Lista leída de disco: lo inválido o repetido se saltea con un aviso (no tumba el resto). */
function sanitizeTerms(v: unknown, what: 'tema' | 'palabra', max: number): string[] {
  const out: string[] = [], seen = new Set<string>()
  for (const raw of Array.isArray(v) ? v : []) {
    const c = checkTerm(raw, what)
    if (!c.ok) { console.warn(`[parent] ${what} inválido en parent.json, lo salteo: ${JSON.stringify(raw).slice(0, 80)}`); continue }
    const k = keyOf(c.value)
    if (!seen.has(k) && out.length < max) { seen.add(k); out.push(c.value) }
  }
  return out
}
function sanitizeTopics(v: unknown): ParentTopics {
  const r = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const black = sanitizeTerms(r.black, 'tema', TERMS.topics)
  const inBlack = new Set(black.map(keyOf))
  // Un tema no puede estar en las dos listas; si pasó (archivo editado a mano), gana la negra (fail-closed).
  return { white: sanitizeTerms(r.white, 'tema', TERMS.topics).filter(t => !inBlack.has(keyOf(t))), black }
}
function checkVolume(v: unknown, label: string): Check<number> {
  const n = toInt(v)
  return n !== null && n >= 0 && n <= 100 ? { ok: true, value: n } : fail(`${label} tiene que ser un número entero entre 0 y 100.`)
}
function sanitizeVolume(v: unknown): ParentVolume {
  const r = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const one = (x: unknown) => { const c = checkVolume(x, 'tope'); return c.ok ? c.value : 100 } // sin dato válido = sin tope (como Smarty)
  return { maxMusic: one(r.maxMusic), maxNoise: one(r.maxNoise) }
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
  return {
    version: 2, seq, features, items,
    // Sin pinHash válido (parent.json de antes del PIN) → el del PIN del demo; load() lo deja escrito.
    pinHash: isPinHash(r.pinHash) ? r.pinHash : DEMO_PIN_HASH,
    // v2 (aditivos con default: un parent.json de la v1 no los tiene y migra así)
    topics: sanitizeTopics(r.topics),
    extraWords: sanitizeTerms(r.extraWords, 'palabra', TERMS.words),
    volume: sanitizeVolume(r.volume),
    preset: typeof r.preset === 'string' && PRESETS.some(p => p.id === r.preset) ? r.preset : null,
  }
}
const V2_FIELDS = ['topics', 'extraWords', 'volume', 'preset'] as const
function load(): ParentStore {
  if (!existsSync(FILE)) {
    const s = seed()
    writeAtomic(s) // primera vez: queda escrito ya, no espera a un cambio
    console.log('[parent] parent.json creado: funcionalidades prendidas + premios demo del padre + PIN del demo (hash)')
    return s
  }
  try {
    const raw: unknown = JSON.parse(readFileSync(FILE, 'utf8'))
    const s = sanitize(raw)
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const missing = V2_FIELDS.filter(k => !(k in r))
    if (!isPinHash(r.pinHash) || missing.length || r.version !== 2) {
      writeAtomic(s) // migración en el acto
      console.log(`[parent] parent.json migrado a la v2${missing.length ? ` (campos nuevos con su valor por defecto: ${missing.join(', ')})` : ''}${isPinHash(r.pinHash) ? '' : ' + hash del PIN del demo'}`)
    }
    return s
  } catch (e) {
    // Fail-closed: sin la config del padre no se prende nada opcional. Se guarda copia del roto. El PIN
    // vuelve al del demo (si no, nadie podría entrar a la Zona de padres a prender las cosas de nuevo).
    console.error('[parent] parent.json ilegible → arranco CERRADO (todo apagado, sin premios); copia en .roto-*:', e)
    try { renameSync(FILE, `${FILE}.roto-${Date.now()}`) } catch { /* sin copia: seguimos igual */ }
    const s: ParentStore = { version: 2, seq: 1, features: allFeatures(false), items: [], pinHash: DEMO_PIN_HASH, topics: noTopics(), extraWords: [], volume: fullVolume(), preset: null }
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
/** Palabras bloqueadas de la familia (se suman a las de fábrica en filters.matchBlockedWord y en el veto de medios del chat). */
export const familyWords = (): readonly string[] => store.extraWords
/** Lo que filters.matchBlockedWord corta POR DEFECTO además de las palabras de fábrica: las palabras de la familia y el
 *  nombre de cada tema NEGRO de la familia como frase exacta (así un tema negro tampoco aparece en búsquedas, títulos,
 *  Mi espacio, ejercicios, el chat o los mensajes a amigos; el sentido del tema lo vigilan además los jueces). */
export function familyBlockedTerms(): string[] {
  return store.topics.black.length ? [...store.extraWords, ...store.topics.black] : store.extraWords
}
/** Temas de la familia (copias): el feed los usa para filtrar (negros) y priorizar (blancos). */
export const familyTopics = (): ParentTopics => ({ white: [...store.topics.white], black: [...store.topics.black] })
type Topic = ReturnType<typeof blackTopics>[number]
function withFamily(base: Topic[], extra: string[], kind: Topic['kind']): Topic[] {
  if (!extra.length) return base
  const have = new Set(base.map(t => keyOf(t.name)))
  return [...base, ...extra.filter(n => !have.has(keyOf(n))).map((name): Topic => ({ kind, name, description: '', critical: false }))]
}
/** Lista NEGRA que vigilan los jueces (entrada/salida del chat, lector, mensajes entre amigos): la de fábrica (Smarty) +
 *  la de la familia, sin repetidos. Reemplaza a config.blackTopics() en sus consumidores. */
export const blackTopicsAll = (): Topic[] => withFamily(blackTopics(), store.topics.black, 'negra')
/** Lista BLANCA (lo que el chat propone y a dónde redirige): la de fábrica + las sugerencias de la familia. */
export const whiteTopicsAll = (): Topic[] => withFamily(whiteTopics(), store.topics.white, 'blanca')
/** Topes de volumen vigentes (también los sirve GET /api/parent/limits, público). */
export const volumeLimits = (): ParentVolume => ({ ...store.volume })

/** ¿El texto "pega" con alguno de estos temas? Determinístico (sin modelo) para el feed: todas las palabras con
 *  contenido del tema tienen que aparecer en el texto como palabra entera, sin tildes ni mayúsculas y tolerando el
 *  plural ("volcanes" pega con "volcán" y con "Volcanes de Argentina"; "ideología de género" pide las dos).
 *  Devuelve el tema que pegó (o null). Bloquear de más acá es seguro: es lo que la familia pidió que no aparezca. */
export function topicHit(text: string, topics: readonly string[]): string | null {
  if (!text || !topics.length) return null
  const hay = ` ${keyOf(text).replace(/[^a-z0-9]+/g, ' ').trim()} `
  const stem = (w: string) => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)
  const has = (w: string) => { const s = stem(w); return hay.includes(` ${s} `) || hay.includes(` ${s}s `) || hay.includes(` ${s}es `) }
  for (const t of topics) {
    const ws = topicWords(t)
    if (ws.length && ws.every(has)) return t
  }
  return null
}

/* ---------- avisos al padre (RAM) ---------- */
interface Alert { id: number; ts: number; kind: AlertKind; text: string; source: string; seen: boolean }
const alerts: Alert[] = [] // del más viejo al más nuevo
let alertSeq = 1
const MAX_ALERTS = 100
/** Bloqueos repetidos: cuántos hacen un aviso ("insistió") y en qué ventana. El umbral es el del sondeo de Smarty
 *  (const.sondeoUmbral: N redirecciones en una sesión → evento 'sondeo' para el padre). */
const BLOCK_WINDOW_MS = 10 * 60_000
const blockTimes = new Map<string, number[]>()
const blockThreshold = () => Math.max(2, Math.round(ov.num('const.sondeoUmbral')) || 3)
const quote = (s: string, n: number) => { const t = cleanText(s); return t.length > n ? `${t.slice(0, n - 1)}…` : t }

/** Aviso para el padre (Zona de padres → Avisos). Lo llaman los ganchos de friendsFake.ts y chat.ts.
 *  - kind 'crisis': `text` = lo que el chico escribió, y el aviso lo MUESTRA entero (decisión de Esteban, 11-oct-2026:
 *    "que se vea con toda la info"; revierte la cuarentena del aviso que había elegido la tanda P — la cuarentena del
 *    CONTEXTO del chat sigue intacta, esto es solo el panel del padre).
 *  - kind 'contacto': `text` = el mensaje que el Moderador frenó (link, teléfono, otra app, encuentros, datos personales).
 *  - kind 'bloqueos': cada llamada es UN mensaje frenado; el aviso sale recién al juntar `const.sondeoUmbral` en la
 *    misma fuente dentro de 10 minutos ("insistió"), y el contador vuelve a cero.
 *  `source` = dónde pasó, en minúscula para ir dentro de una oración ("el chat con el asistente"). Nunca tira. */
export function notifyParent(kind: AlertKind, text: string, source: string): void {
  try {
    const src = quote(String(source ?? ''), 80) || 'Innerith'
    const kid = kidName()
    let body: string
    if (kind === 'crisis') {
      const said = quote(String(text ?? ''), 220)
      body = `Hubo un mensaje de crisis en ${src}.${said ? ` ${kid} escribió: «${said}».` : ''} Se le mostró el mensaje de contención de la familia, que lo invita a hablarlo con un adulto de confianza. Hablalo con ${kid} con calma cuanto antes.`
    } else if (kind === 'contacto') {
      const said = quote(String(text ?? ''), 140)
      body = `${kid} quiso pasar un dato de contacto o seguir la charla fuera de Innerith en ${src}${said ? `: «${said}»` : ''}. El Moderador lo frenó y el mensaje no llegó.`
    } else {
      const now = Date.now()
      const recent = (blockTimes.get(src) ?? []).filter(t => now - t < BLOCK_WINDOW_MS)
      recent.push(now)
      if (recent.length < blockThreshold()) { blockTimes.set(src, recent); return }
      blockTimes.delete(src)
      const said = quote(String(text ?? ''), 100)
      body = `${kid} insistió: el Moderador frenó ${recent.length} mensajes suyos en ${src} en pocos minutos (palabras, insultos o temas que la familia no quiere). Ninguno llegó.${said ? ` El último: «${said}».` : ''}`
    }
    alerts.push({ id: alertSeq++, ts: Date.now(), kind, text: body, source: src, seen: false })
    if (alerts.length > MAX_ALERTS) alerts.splice(0, alerts.length - MAX_ALERTS)
    console.log(`[parent] AVISO ${kind.toUpperCase()} en ${src}`) // nunca se loguea lo que escribió el chico
  } catch (e) { console.error('[parent] no pude registrar el aviso:', e) }
}
const alertList = () => alerts.slice().reverse().map(a => ({ ...a }))

/* ---------- sesión de la Zona de padres (RAM) ---------- */
const SESSION_MS = 15 * 60_000
const MAX_SESSIONS = 20
const sessions = new Map<string, number>() // sha256(token) hex → vence (epoch ms)
const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest()
const tokenKey = (t: string) => sha256(t).toString('hex')
function openSession(): string {
  const now = Date.now()
  for (const [k, exp] of sessions) if (exp <= now) sessions.delete(k)
  while (sessions.size >= MAX_SESSIONS) { const oldest = sessions.keys().next().value; if (oldest === undefined) break; sessions.delete(oldest) }
  const token = randomBytes(32).toString('base64url')
  sessions.set(tokenKey(token), now + SESSION_MS)
  return token
}
const tokenOf = (req: IncomingMessage): string | null => {
  const t = req.headers['x-parent-token']
  return typeof t === 'string' && t.length >= 20 && t.length <= 200 ? t : null
}
/** ¿Trae una sesión válida? Si sí, la estira otros 15 minutos (deslizante). */
function touchSession(req: IncomingMessage): boolean {
  const t = tokenOf(req)
  if (!t) return false
  const k = tokenKey(t), exp = sessions.get(k)
  if (exp === undefined) return false
  if (exp <= Date.now()) { sessions.delete(k); return false }
  sessions.set(k, Date.now() + SESSION_MS)
  return true
}
function closeSession(req: IncomingMessage) { const t = tokenOf(req); if (t) sessions.delete(tokenKey(t)) }

/* ---------- PIN de la Zona de padres ---------- */
const MAX_FAILS = 5
const WAIT_MS = 30_000
let fails = 0 // fallidos seguidos (RAM)
let waitUntil = 0
/** Vuelve a cero el rate-limit del PIN (lo llama un acierto y POST /api/demo/reset). */
export function resetUnlockAttempts() { fails = 0; waitUntil = 0 }
/** Mismo camino para TODO lo que no sea el PIN (mal formado, vacío, otro tipo o incorrecto): hash +
 *  comparación en tiempo constante, y la misma respuesta. Nunca se loguea lo que vino. */
function tryUnlock(pin: unknown): { ok: boolean; token?: string; waitSeconds?: number } {
  const now = Date.now()
  if (now < waitUntil) return { ok: false, waitSeconds: Math.ceil((waitUntil - now) / 1000) }
  const ok = timingSafeEqual(sha256(typeof pin === 'string' ? pin.slice(0, 64) : ''), Buffer.from(store.pinHash, 'hex'))
  if (ok) { resetUnlockAttempts(); return { ok: true, token: openSession() } }
  if (++fails < MAX_FAILS) return { ok: false }
  fails = 0
  waitUntil = now + WAIT_MS
  console.warn(`[parent] ${MAX_FAILS} PIN incorrectos seguidos: espera de ${WAIT_MS / 1000} s`)
  return { ok: false, waitSeconds: WAIT_MS / 1000 }
}

/* ---------- lógica ---------- */
/** Editar algo a mano deja la configuración como "propia" (sin preset aplicado). */
function touchedByHand() { if (store.preset !== null) { console.log(`[parent] cambio a mano: el preset «${store.preset}» deja de estar aplicado`); store.preset = null } }

function setFeature(key: FeatureKey, on: boolean): boolean {
  if (store.features[key] === on) return true
  store.features[key] = on
  touchedByHand()
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

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i])
/** Temas: cada lista que viene reemplaza a la anterior. Un tema no puede estar en las dos (400 con el motivo). */
function setTopics(b: Input): Check<ParentTopics> {
  if (!('white' in b) && !('black' in b)) return fail('No vino ninguna lista de temas (white o black).')
  const next: ParentTopics = { white: store.topics.white, black: store.topics.black }
  if ('white' in b) { const c = checkTerms(b.white, 'tema', TERMS.topics); if (!c.ok) return c; next.white = c.value }
  if ('black' in b) { const c = checkTerms(b.black, 'tema', TERMS.topics); if (!c.ok) return c; next.black = c.value }
  const inBlack = new Set(next.black.map(keyOf))
  const both = next.white.find(t => inBlack.has(keyOf(t)))
  if (both) return fail(`«${both}» no puede estar en las dos listas: sacalo de una primero.`)
  if (sameList(next.white, store.topics.white) && sameList(next.black, store.topics.black)) return { ok: true, value: familyTopics() }
  store.topics = { white: [...next.white], black: [...next.black] }
  touchedByHand()
  console.log(`[parent] temas de la familia → blancos: ${store.topics.white.length} · negros: ${store.topics.black.length}`)
  return save() ? { ok: true, value: familyTopics() } : fail('No pude guardar los temas. Probá de nuevo.')
}
function setWords(b: Input): Check<string[]> {
  const c = checkTerms(b.extra, 'palabra', TERMS.words)
  if (!c.ok) return c
  if (sameList(c.value, store.extraWords)) return { ok: true, value: [...store.extraWords] }
  store.extraWords = c.value
  touchedByHand()
  console.log(`[parent] palabras de la familia → ${store.extraWords.length} (se suman a las ${config.blockedWords.length} de fábrica)`)
  return save() ? { ok: true, value: [...store.extraWords] } : fail('No pude guardar las palabras. Probá de nuevo.')
}
function setVolume(b: Input): Check<ParentVolume> {
  if (!('maxMusic' in b) && !('maxNoise' in b)) return fail('No vino ningún tope (maxMusic o maxNoise).')
  const next = { ...store.volume }
  if ('maxMusic' in b) { const c = checkVolume(b.maxMusic, 'El tope de la música'); if (!c.ok) return c; next.maxMusic = c.value }
  if ('maxNoise' in b) { const c = checkVolume(b.maxNoise, 'El tope de los ruidos'); if (!c.ok) return c; next.maxNoise = c.value }
  if (next.maxMusic === store.volume.maxMusic && next.maxNoise === store.volume.maxNoise) return { ok: true, value: volumeLimits() }
  store.volume = next
  touchedByHand()
  console.log(`[parent] topes de volumen → música ${next.maxMusic} · ruidos ${next.maxNoise}`)
  return save() ? { ok: true, value: volumeLimits() } : fail('No pude guardar los topes. Probá de nuevo.')
}

const wordsView = () => ({ extra: [...store.extraWords], builtin: config.blockedWords.length })
const configView = () => ({ topics: familyTopics(), words: wordsView(), volume: volumeLimits(), preset: store.preset })
const presetView = (p: PresetDef) => ({
  id: p.id, name: p.name, desc: p.desc,
  // aditivo (ver cabecera): lo que deja configurado, para que el panel muestre qué prende y qué apaga
  spec: { features: { ...p.features }, topics: { white: [...p.topics.white], black: [...p.topics.black] }, words: [...p.words], volume: { ...p.volume } },
})
function applyPreset(id: unknown): { ok: true; preset: PresetDef } | { ok: false; status: number; error: string } {
  const p = PRESETS.find(x => x.id === id)
  if (!p) return { ok: false, status: 400, error: 'Ese preset no existe.' }
  store.features = { ...p.features }
  store.topics = { white: [...p.topics.white], black: [...p.topics.black] }
  store.extraWords = [...p.words]
  store.volume = { ...p.volume }
  store.preset = p.id
  console.log(`[parent] preset «${p.name}» aplicado: ${FEATURE_KEYS.map(k => `${k} ${p.features[k] ? 'on' : 'OFF'}`).join(' · ')} · temas ${p.topics.white.length}+/${p.topics.black.length}- · palabras ${p.words.length} · topes ${p.volume.maxMusic}/${p.volume.maxNoise}`)
  return save() ? { ok: true, preset: p } : { ok: false, status: 500, error: 'No pude guardar el preset. Probá de nuevo.' }
}

/** Lo que ya protege el backend real: lo de fábrica SIEMPRE + lo que sumó la familia (solo lectura en el panel). */
function protections() {
  return {
    /** Sitios de la lista blanca activos (los únicos de donde se leen artículos). */ sites: whitelistSites().length,
    /** Videos del catálogo aprobado (buscador, chat, Mi espacio y Aprender salen de acá). */ videos: catalogSize(),
    /** Palabras bloqueadas: de fábrica + de la familia (búsquedas, títulos, chat, mensajes, ejercicios). */ blockedWords: config.blockedWords.length + store.extraWords.length,
    /** Temas de la lista negra que vigila el revisor automático: de fábrica + de la familia. */ blockedTopics: blackTopicsAll().length,
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
    // aditivos de la v1 (ya formalizados en types.ts)
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
const GETS = new Set(['/api/parent/features', '/api/parent/limits', '/api/parent/activity', '/api/parent/config', '/api/parent/alerts', '/api/parent/presets'])
const POSTS = new Set([
  '/api/parent/unlock', '/api/parent/lock', '/api/parent/features', '/api/parent/items', '/api/parent/items/update', '/api/parent/items/archive',
  '/api/parent/deliver', '/api/parent/topics', '/api/parent/words', '/api/parent/volume', '/api/parent/alerts/seen', '/api/parent/presets/apply',
])
const NO_SESSION = { error: 'La sesión de la Zona de padres venció o no es válida: ingresá el PIN de nuevo.' }

export async function parentRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const path = url.pathname.replace(/\/+$/, '')
  const method = req.method ?? 'GET'
  if (!GETS.has(path) && !POSTS.has(path)) return send(res, 404, { error: 'not found' })

  // --- Públicas: las dos que lee la UI del chico, y el portón. ---
  if (method === 'GET' && path === '/api/parent/features') return send(res, 200, features())
  if (method === 'GET' && path === '/api/parent/limits') return send(res, 200, volumeLimits())
  if (method === 'POST' && path === '/api/parent/unlock') {
    // Un cuerpo ilegible es un PIN mal formado más: mismo camino, misma respuesta (200 {ok:false}).
    let pin: unknown
    try { pin = (await readJson<Record<string, unknown> | null>(req))?.pin } catch { pin = undefined }
    return send(res, 200, tryUnlock(pin))
  }

  // --- Todo lo demás: con la sesión abierta por el PIN (fail-closed). ---
  if (!touchSession(req)) return send(res, 401, NO_SESSION)

  if (method === 'GET') {
    switch (path) {
      case '/api/parent/activity': return send(res, 200, activity())
      case '/api/parent/config': return send(res, 200, configView())
      case '/api/parent/alerts': return send(res, 200, { alerts: alertList() })
      case '/api/parent/presets': return send(res, 200, { presets: PRESETS.map(presetView), current: store.preset })
    }
    return send(res, 405, { error: 'Método no permitido: usá POST.' })
  }
  if (method !== 'POST' || !POSTS.has(path)) return send(res, 405, { error: 'Método no permitido.' })
  if (path === '/api/parent/lock') { closeSession(req); return send(res, 200, { ok: true }) }

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
    case '/api/parent/topics': {
      const r = setTopics(b)
      return r.ok ? send(res, 200, r.value) : send(res, 400, { error: r.error })
    }
    case '/api/parent/words': {
      const r = setWords(b)
      return r.ok ? send(res, 200, { extra: r.value, builtin: config.blockedWords.length }) : send(res, 400, { error: r.error })
    }
    case '/api/parent/volume': {
      const r = setVolume(b)
      return r.ok ? send(res, 200, r.value) : send(res, 400, { error: r.error })
    }
    case '/api/parent/alerts/seen': {
      const id = parseId(b)
      const a = id === null ? undefined : alerts.find(x => x.id === id)
      if (a) a.seen = true
      return send(res, 200, { ok: !!a })
    }
    case '/api/parent/presets/apply': {
      const r = applyPreset(b.id)
      return r.ok ? send(res, 200, { ok: true, config: configView(), features: features() }) : send(res, r.status, { ok: false, error: r.error })
    }
  }
  return send(res, 404, { error: 'not found' })
}
