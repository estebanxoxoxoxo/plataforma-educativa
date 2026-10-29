// Videos: SOLO el catálogo aprobado por la familia (lista blanca de YouTube importada de Smarty).
// Port de smarty-poc/app/src/lib/videoSearch.ts (MiniSearch, BM25 + boosts, AND, sin prefijo, fuzzy 0.2).
// ADITIVO (28-oct): searchVideosStrict, la vía ESTRICTA del Feed (lo que lleva un "por qué" temático): mismas reglas pero
// con coincidencia léxica real. searchVideos (Buscar, chat, /api/search/videos) queda EXACTO al POC.
// Además: metadatos reales de YouTube (fecha, Me gusta, suscriptores) vía Data API, con la clave del servidor.
// CATÁLOGO APROBADO = catalog.json (base, SOLO LECTURA) + los videos que sumó la FAMILIA en Zona de padres → YouTube (viven
// en server/data/mytube.json). La capa de la familia es `familyCatalog` de mytube.ts, que se registra sola al arrancar
// llamando a setFamilyCatalog (el seam de W5). Con ella, Buscar, el reproductor, el chat, Mis listas y Drive ven los videos
// de la familia como a los del catálogo: getCatalogVideo/getVideo los resuelven y searchVideos los encuentra. OJO:
// allChannels/videosOfChannel siguen SOLO sobre el base a propósito: MyTube ya suma la familia por su cuenta (sumarla acá
// duplicaría sus conteos de canales y videos).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import MiniSearch from 'minisearch'
import { SERVER_ROOT, ov } from './config'
import { matchBlockedWord } from './filters'

export interface CatalogVideo {
  videoId: string; title: string; thumb: string; channelId: string; channelTitle: string; source: string
  description: string; duration: number; addedAt: number; tags: string[]; topics: string[]
}

const catalog: CatalogVideo[] = JSON.parse(readFileSync(join(SERVER_ROOT, 'data', 'catalog.json'), 'utf8'))
const byId = new Map(catalog.map(v => [v.videoId, v]))

/* ---------- capa de la familia (seam de mytube.ts: `familyCatalog`) ---------- */
/** Los videos de la familia con la forma del catálogo; `version()` sube con cada cambio (alta, reingesta, borrado en
 *  cascada, quitar duplicados) y el índice de búsqueda la mira para rehacer su parte. Sin capa: solo el catálogo base. */
let family: { get(id: string): CatalogVideo | undefined; all(): CatalogVideo[]; version(): number } | null = null
/** Los ids de la familia que hoy están en el índice y la versión de la capa con la que entraron (null = hay que sumarlos). */
let famIds: string[] = []
let famSynced: number | null = null
/** La llama mytube.ts al arrancar (detección en runtime: sin esta función no se registra nada). */
export function setFamilyCatalog(l: NonNullable<typeof family>): void {
  family = l
  famSynced = null
}

/** Un video del catálogo aprobado: el base y, si no está ahí, el de la familia (un videoId existe una sola vez: la ingesta
 *  de mytube.ts no re-agrega lo que ya está en el base). */
export const getCatalogVideo = (id: string): CatalogVideo | undefined => byId.get(id) ?? family?.get(id)
/** FS-BASE-B (hallazgo feedFake.ts:302): la VERSIÓN del catálogo aprobado —sube con cada alta, reingesta o baja de la capa
 *  de la familia (mytube.ts)—. El Feed la suma a la clave de sus pools cacheados: sin ella seguía sirviendo la card de un video
 *  que el padre ya des-aprobó. El base no cambia en runtime: sin capa, 0. */
export const familyCatalogVersion = (): number => (family ? family.version() : 0)
/** Tamaño del catálogo BASE (mytube.ts le suma las filas de la familia en su `total`: no cambiar sin mirar ahí). */
export const catalogSize = () => catalog.length

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ')
/** El documento del índice: el MISMO que arma el POC (videoSearch.ts buildDocs), incluida la descripción CORTADA a 140
 *  caracteres — FS-BASE-B (hallazgo videos.ts:46): el base ya llega cortado desde el import (import-smarty.mjs), pero los
 *  videos de la FAMILIA entran con la descripción completa de YouTube y una palabra después del carácter 140 los hacía
 *  aparecer donde el POC no (y movía el largo medio del campo para el BM25 de todos). */
const toDoc = (v: CatalogVideo) => ({ videoId: v.videoId, title: v.title, source: [v.source, v.channelTitle].filter(Boolean).join(' '), description: (v.description ?? '').slice(0, 140), tags: v.tags.join(' '), topics: v.topics.join(' ') })
let index: MiniSearch | null = null
function ensureIndex(): MiniSearch {
  if (!index) {
    const t0 = Date.now()
    const mi = new MiniSearch({
      idField: 'videoId', fields: ['title', 'source', 'description', 'tags', 'topics'], storeFields: ['title'],
      processTerm: t => normalize(t).trim() || null,
    })
    mi.addAll(catalog.map(toDoc))
    console.log(`[videos] índice de ${catalog.length} videos en ${Date.now() - t0} ms`)
    index = mi
  }
  syncFamily(index)
  return index
}
/** La parte de la FAMILIA del índice: se rehace cuando cambia `family.version()` (salen los ids que había y entran los de
 *  `family.all()`). Va en el MISMO índice que el base —no en uno aparte— para que el ranking BM25 sea uno solo, como en el
 *  POC (una sola tabla ytVideos, invalidateVideoIndex al cambiar), y sin reconstruir los ~95.000 del base (~5 s). */
function syncFamily(mi: MiniSearch): void {
  const ver = family ? family.version() : 0
  if (famSynced === ver) return
  mi.discardAll(famIds.filter(id => mi.has(id)))
  famIds = []
  for (const v of family?.all() ?? []) {
    if (!v.videoId || byId.has(v.videoId) || mi.has(v.videoId)) continue // un videoId, una vez (gana el base)
    mi.add(toDoc(v))
    famIds.push(v.videoId)
  }
  famSynced = ver
  if (family) console.log(`[videos] índice: ${famIds.length} video(s) de la familia (versión ${ver})`)
}

const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'u', 'que', 'con', 'en', 'a', 'al', 'por', 'para', 'sobre', 'su', 'sus', 'lo', 'le', 'les', 'se', 'mas', 'muy', 'mi', 'tu', 'necesito', 'necesitas', 'quiero', 'queres', 'quieres', 'ver', 'mira', 'mirar', 'mostrame', 'muestrame', 'mostra', 'dame', 'busca', 'buscar', 'busco', 'pone', 'poneme', 'video', 'videos', 'algo', 'cosa', 'cosas'])

/** La búsqueda del índice del POC (searchVideos de videoSearch.ts): muletillas fuera, BM25 + boosts por campo, sin
 *  prefijo, fuzzy 0.2; AND por defecto y OR para el relacionado. Devuelve los hits CRUDOS (ids en orden de relevancia). */
function searchHits(query: string, combineWith: 'AND' | 'OR') {
  const terms = normalize(query ?? '').split(/[^a-z0-9]+/).filter(t => t && !STOPWORDS.has(t))
  if (!terms.length) return []
  const boost = { title: ov.num('const.videoScoreTitle'), tags: 2.5, source: ov.num('const.videoScoreSource'), topics: 2, description: ov.num('const.videoScoreDesc') }
  return ensureIndex().search(terms.join(' '), { boost, prefix: false, fuzzy: 0.2, combineWith })
}

/* searchVideos de Smarty: sin tema concreto → nada (found:0 honesto). Filtra palabras bloqueadas en el título. */
export function searchVideos(query: string, limit = ov.num('const.videoMostrados')): CatalogVideo[] {
  return searchHits(query, 'AND')
    .map(r => getCatalogVideo(r.id as string))
    .filter((v): v is CatalogVideo => !!v && matchBlockedWord(v.title) === null)
    .slice(0, limit)
}

/* ---------- vía ESTRICTA (ADITIVA, para el FEED: fix "fuzzy del Feed", 28-oct) ----------
   searchVideos de arriba es el buscador del POC TAL CUAL (fuzzy 0.2) y así se queda: es el de Buscar y el del chat. Pero el
   Feed le pone un MOTIVO a lo que sirve ("Porque a tu familia le interesa: ballenas", "Porque estás aprendiendo niji") y con
   fuzzy ese motivo mentía: "ballenas" está a 2 letras de "gallinas" y "niji" a 1 de "fiji". Esta vía tiene las MISMAS
   reglas (muletillas fuera, AND sobre TODAS las palabras de contenido, palabras bloqueadas fuera) y además exige
   COINCIDENCIA LÉXICA REAL: cada palabra de contenido tiene que estar como palabra ENTERA (sin tildes ni mayúsculas,
   tolerando el plural simple: wordForms) en el título, los tags, los topics o el nombre del canal. La descripción NO
   cuenta (ahí es donde más se cuela lo que no es del tema). Si no hay, no hay: mejor found:0 que basura (regla del POC). */

/** Las palabras de contenido de una consulta: la MISMA regla que searchHits (normalize, corte por lo no alfanumérico,
 *  muletillas fuera). Va repetida a propósito: la vía del POC no se toca. */
const contentTerms = (query: string) => normalize(query ?? '').split(/[^a-z0-9]+/).filter(t => t && !STOPWORDS.has(t))
/** Singular/plural simple: la palabra, +s, +es y, si termina en -s / -es, sin esa terminación (dejando 3+ letras).
 *  "ballena" ↔ "ballenas", "volcán" ↔ "volcanes", "robot" ↔ "robots". FS-BASE-B (hallazgo videos.ts:113): también el plural
 *  de -z, que en castellano es -ces: "avestruz" ↔ "avestruces", "pez" ↔ "peces", "luz" ↔ "luces" (antes "avestruces" rendía
 *  0 videos con 7 en el catálogo). No hay raíces ni parecidos: "gallinas" nunca es "ballenas" y "fiji" nunca es "niji". */
export function wordForms(w: string): string[] {
  const out = new Set([w, `${w}s`, `${w}es`])
  if (w.length > 3 && w.endsWith('s')) out.add(w.slice(0, -1))
  if (w.length > 4 && w.endsWith('es')) out.add(w.slice(0, -2))
  if (w.length > 1 && w.endsWith('z')) out.add(`${w.slice(0, -1)}ces`)
  if (w.length > 4 && w.endsWith('ces')) out.add(`${w.slice(0, -3)}z`)
  return [...out]
}
/** Los campos del índice que miran los candidatos exactos ('source' es fuente + canal; el filtro final mira el canal). */
const STRICT_FIELDS = ['title', 'source', 'tags', 'topics']
/** " palabra palabra … " de título + tags + topics + canal de cada video, normalizadas (memo por objeto: los del base no
 *  cambian; los de la familia, si se rearman, son objetos nuevos y se recalculan solos). */
const strictText = new WeakMap<CatalogVideo, string>()
function strictWords(v: CatalogVideo): string {
  let s = strictText.get(v)
  if (s === undefined) {
    const raw = [v.title, ...(v.tags ?? []), ...(v.topics ?? []), v.channelTitle].filter(Boolean).join(' ')
    s = ` ${normalize(raw).split(/[^a-z0-9]+/).filter(Boolean).join(' ')} `
    strictText.set(v, s)
  }
  return s
}
const hasAllTerms = (v: CatalogVideo, forms: readonly string[][]) => {
  const s = strictWords(v)
  return forms.every(fs => fs.some(f => s.includes(` ${f} `)))
}
/** ¿El video tiene TODAS las palabras de contenido de la consulta (como palabra entera, plural simple) en su título,
 *  tags, topics o canal? Sin palabras de contenido → false (sin tema concreto no hay coincidencia). */
export function strictVideoMatch(v: CatalogVideo, query: string): boolean {
  const terms = contentTerms(query)
  return terms.length > 0 && hasAllTerms(v, terms.map(wordForms))
}
/** La vía estricta: los videos aprobados que pasan strictVideoMatch, hasta `limit`, en este orden:
 *  1) los hits del buscador del POC (fuzzy, AND) que de verdad tienen las palabras: lo que sobrevive sale en el MISMO orden
 *     que en Buscar;
 *  2) detrás, lo que el fuzzy no alcanza: búsqueda EXACTA de las formas de cada palabra (AND entre palabras, OR entre sus
 *     formas). Hace falta para el plural de palabras cortas: "volcán" → "volcanes" son 2 letras, y el fuzzy 0.2 de una
 *     palabra de 6 letras admite 1.
 *  Filtra las palabras bloqueadas en el título como searchVideos. */
export function searchVideosStrict(query: string, limit = ov.num('const.videoMostrados')): CatalogVideo[] {
  const terms = contentTerms(query)
  if (!terms.length || limit <= 0) return []
  const forms = terms.map(wordForms)
  const boost = { title: ov.num('const.videoScoreTitle'), tags: 2.5, source: ov.num('const.videoScoreSource'), topics: 2 }
  const exact = ensureIndex().search(
    { combineWith: 'AND', queries: forms.map(f => ({ combineWith: 'OR' as const, queries: f })) },
    { boost, prefix: false, fuzzy: false, fields: STRICT_FIELDS },
  )
  const out: CatalogVideo[] = []
  const seen = new Set<string>()
  for (const r of [...searchHits(query, 'AND'), ...exact]) {
    const id = r.id as string
    if (seen.has(id)) continue
    seen.add(id)
    const v = getCatalogVideo(id)
    if (!v || matchBlockedWord(v.title) !== null || !hasAllTerms(v, forms)) continue
    out.push(v)
    if (out.length >= limit) break
  }
  return out
}

/* ---------- relacionados del reproductor (relatedVideos de smarty-poc app/src/lib/videoSearch.ts, TAL CUAL) ----------
   Híbrido: primero MÁS DE ESTE CANAL (los más nuevos por addedAt) y, si faltan, SIMILARES POR TEMA (el índice con OR sobre
   título + topics + 5 tags del video, pidiendo limit × 3). Dedup, sin el video actual y con las palabras bloqueadas (de
   fábrica y de la familia) filtradas ANTES del corte: muestra hasta `limit` visibles, no menos. Sobre el catálogo aprobado
   ENTERO: el base + los videos de la familia (lo des-aprobado ya no está en ninguno de los dos). Deuda de W5, 14-oct. */
let baseByChannel: Map<string, CatalogVideo[]> | null = null
/** Los videos de un canal (base, en orden de ingesta; índice perezoso) + los de la familia: la tabla única del POC. */
function channelRows(channelId: string): CatalogVideo[] {
  if (!baseByChannel) {
    baseByChannel = new Map()
    for (const v of catalog) {
      if (!v.channelId) continue
      const arr = baseByChannel.get(v.channelId)
      if (arr) arr.push(v)
      else baseByChannel.set(v.channelId, [v])
    }
  }
  return [...(baseByChannel.get(channelId) ?? []), ...(family?.all().filter(v => v.channelId === channelId) ?? [])]
}
export function relatedVideos(video: CatalogVideo, limit: number): CatalogVideo[] {
  const out: CatalogVideo[] = []
  const seen = new Set<string>([video.videoId])
  const tryPush = (v: CatalogVideo) => {
    if (out.length >= limit || seen.has(v.videoId)) return
    if (matchBlockedWord(v.title) !== null) return
    seen.add(v.videoId); out.push(v)
  }
  // 1) Mismo canal, más recientes primero.
  if (video.channelId) {
    const sameCh = channelRows(video.channelId)
    sameCh.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))
    for (const v of sameCh) tryPush(v)
  }
  // 2) Completar con similares por tema/título (pedimos de más para descartar vistos/bloqueados). Red de seguridad del
  //    POC: si el índice falla, nos quedamos con los del mismo canal.
  if (out.length < limit) {
    try {
      const q = [video.title, ...(video.topics ?? []), ...(video.tags ?? []).slice(0, 5)].join(' ').trim()
      const hits = searchHits(q, 'OR').slice(0, limit * 3).map(h => h.id as string).filter(id => !seen.has(id))
      for (const id of hits) { const v = getCatalogVideo(id); if (v) tryPush(v) } // en orden de relevancia
    } catch (e) { console.warn('[videos] relatedVideos: índice no disponible, solo mismo canal', e) }
  }
  return out
}

/* ---------- metadatos de YouTube (Data API v3, 1 unidad por llamada; cache en memoria) ----------
   FS-BASE-B (hallazgo videos.ts:226): son COSMÉTICOS (fecha, Me gusta, suscriptores, avatar del canal: el video ya está
   aprobado y se reproduce sin ellos), así que llevan timeout corto (YT_META_TIMEOUT_MS; la API responde en ~0,3 s) y el
   reproductor pide los del video y los del canal EN PARALELO (antes en serie: con googleapis colgado, ~10 min de reproductor
   sin cargar). Y una FALLA ya no se guarda para siempre: antes un corte o la cuota diaria agotada dejaba esos videos y canales
   vacíos hasta reiniciar aunque YouTube volviera; ahora la falla vale YT_META_RETRY_MS (después se vuelve a pedir). Lo que
   YouTube respondió bien (aunque no traiga el dato) y "sin clave" se guardan como siempre. */
const YT_META_TIMEOUT_MS = 5_000
const YT_META_RETRY_MS = 10 * 60_000
interface YtMeta { publishedAt?: string; likes?: number; channelThumb?: string; subscribers?: number }
const meta = new Map<string, YtMeta>()
const chMeta = new Map<string, { thumb?: string; subscribers?: number }>()
/** Cuándo falló por última vez cada video / canal (id → ms): hasta YT_META_RETRY_MS después no se vuelve a pedir. */
const metaFailedAt = new Map<string, number>()
const chFailedAt = new Map<string, number>()
const recentlyFailed = (m: Map<string, number>, id: string) => { const t = m.get(id); return t !== undefined && Date.now() - t < YT_META_RETRY_MS }
/** 'nokey' = sin YOUTUBE_API_KEY (estado estable: se cachea vacío) · 'failed' = error, !ok o timeout (no se cachea). */
async function yt<T>(path: string, params: Record<string, string>): Promise<T | 'nokey' | 'failed'> {
  const key = (process.env.YOUTUBE_API_KEY ?? '').trim()
  if (!key) return 'nokey'
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...params, key })}`, { signal: AbortSignal.timeout(YT_META_TIMEOUT_MS) })
    return r.ok ? ((await r.json()) as T) : 'failed'
  } catch { return 'failed' }
}

/* Fecha y Me gusta de varios videos en una sola llamada (para la lista de resultados y el reproductor). */
export async function loadVideoMeta(ids: string[]): Promise<void> {
  const missing = ids.filter(id => !meta.has(id) && !recentlyFailed(metaFailedAt, id)).slice(0, 50)
  if (!missing.length) return
  const data = await yt<{ items?: { id: string; snippet?: { publishedAt?: string }; statistics?: { likeCount?: string } }[] }>('videos', { part: 'snippet,statistics', id: missing.join(','), maxResults: '50' })
  if (data === 'failed') { const now = Date.now(); for (const id of missing) metaFailedAt.set(id, now); return }
  for (const it of data === 'nokey' ? [] : data.items ?? []) meta.set(it.id, { publishedAt: it.snippet?.publishedAt, likes: it.statistics?.likeCount ? Number(it.statistics.likeCount) : undefined })
  for (const id of missing) { metaFailedAt.delete(id); if (!meta.has(id)) meta.set(id, {}) }
}
export async function loadChannelMeta(channelId: string): Promise<{ thumb?: string; subscribers?: number }> {
  if (!channelId) return {}
  if (chMeta.has(channelId)) return chMeta.get(channelId)!
  if (recentlyFailed(chFailedAt, channelId)) return {}
  const data = await yt<{ items?: { snippet?: { thumbnails?: { default?: { url?: string } } }; statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean } }[] }>('channels', { part: 'snippet,statistics', id: channelId })
  if (data === 'failed') { chFailedAt.set(channelId, Date.now()); return {} }
  chFailedAt.delete(channelId)
  const it = data === 'nokey' ? undefined : data.items?.[0]
  const m = { thumb: it?.snippet?.thumbnails?.default?.url, subscribers: it?.statistics && !it.statistics.hiddenSubscriberCount && it.statistics.subscriberCount ? Number(it.statistics.subscriberCount) : undefined }
  chMeta.set(channelId, m)
  return m
}

/* ---------- canales (MyTube): vistas sobre el catálogo aprobado, como mytube.ts de Smarty ---------- */
export interface ChannelSummary { id: string; name: string; videos: number; cover: string }
let channels: ChannelSummary[] | null = null
/** Canales con ≥1 video aprobado, ordenados por cantidad (son ~150; se memoiza). */
export function allChannels(): ChannelSummary[] {
  if (channels) return channels
  const by = new Map<string, { name: string; n: number; cover: string }>()
  for (const v of catalog) {
    if (!v.channelId) continue
    const e = by.get(v.channelId)
    if (e) e.n++
    else by.set(v.channelId, { name: v.channelTitle || v.source, n: 1, cover: v.thumb || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg` })
  }
  return (channels = [...by.entries()].map(([id, e]) => ({ id, name: e.name, videos: e.n, cover: e.cover })).sort((a, b) => b.videos - a.videos))
}

/** Videos aprobados de un canal, dedup por videoId y sin palabras bloqueadas (regla de mytube.ts). */
export function videosOfChannel(channelId: string): CatalogVideo[] {
  const seen = new Set<string>()
  return catalog.filter(v => v.channelId === channelId && !!v.videoId && !seen.has(v.videoId) && (seen.add(v.videoId), true) && matchBlockedWord(v.title) === null)
}

/* ---------- formato para la UI (types.ts VideoResult / Video) ---------- */
const mmss = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}` : `${Math.floor(s / 60)}`) + `:${String(Math.floor(s % 60)).padStart(2, '0')}`
const fecha = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '') : '')
const compact = (n: number) => new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

export function toVideoResult(v: CatalogVideo) {
  return {
    id: v.videoId, img: v.thumb || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`, title: v.title,
    subtitle: v.description ? v.description.replace(/\s+/g, ' ').trim() : v.source,
    duration: v.duration ? mmss(v.duration) : '', channel: v.channelTitle || v.source, date: fecha(meta.get(v.videoId)?.publishedAt),
  }
}

export async function getVideo(id: string) {
  const v = getCatalogVideo(id) // base o familia
  if (!v || matchBlockedWord(v.title) !== null) return null // solo videos aprobados
  const [, ch] = await Promise.all([loadVideoMeta([id]), loadChannelMeta(v.channelId)]) // en paralelo (FS-BASE-B)
  const m = meta.get(id) ?? {}
  return {
    ...toVideoResult(v), channelId: v.channelId, durationSec: v.duration, reviewed: true, verified: false,
    subscribers: ch.subscribers != null ? `${compact(ch.subscribers)} de suscriptores` : '',
    likes: m.likes != null ? compact(m.likes) : '', channelThumb: ch.thumb,
    // Relacionados del POC (Video.related, contrato 14-oct): hasta 12, ya filtrados.
    related: relatedVideos(v, 12).map(toVideoResult),
  }
}
