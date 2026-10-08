// Videos: SOLO el catálogo aprobado por la familia (lista blanca de YouTube importada de Smarty).
// Port de smarty-poc/app/src/lib/videoSearch.ts (MiniSearch, BM25 + boosts, AND, sin prefijo, fuzzy 0.2).
// Además: metadatos reales de YouTube (fecha, Me gusta, suscriptores) vía Data API, con la clave del servidor.
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
export const getCatalogVideo = (id: string) => byId.get(id)
export const catalogSize = () => catalog.length

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ')
let index: MiniSearch | null = null
function ensureIndex(): MiniSearch {
  if (index) return index
  const t0 = Date.now()
  const mi = new MiniSearch({
    idField: 'videoId', fields: ['title', 'source', 'description', 'tags', 'topics'], storeFields: ['title'],
    processTerm: t => normalize(t).trim() || null,
  })
  mi.addAll(catalog.map(v => ({ videoId: v.videoId, title: v.title, source: [v.source, v.channelTitle].filter(Boolean).join(' '), description: v.description, tags: v.tags.join(' '), topics: v.topics.join(' ') })))
  console.log(`[videos] índice de ${catalog.length} videos en ${Date.now() - t0} ms`)
  return (index = mi)
}

const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'u', 'que', 'con', 'en', 'a', 'al', 'por', 'para', 'sobre', 'su', 'sus', 'lo', 'le', 'les', 'se', 'mas', 'muy', 'mi', 'tu', 'necesito', 'necesitas', 'quiero', 'queres', 'quieres', 'ver', 'mira', 'mirar', 'mostrame', 'muestrame', 'mostra', 'dame', 'busca', 'buscar', 'busco', 'pone', 'poneme', 'video', 'videos', 'algo', 'cosa', 'cosas'])

/* searchVideos de Smarty: sin tema concreto → nada (found:0 honesto). Filtra palabras bloqueadas en el título. */
export function searchVideos(query: string, limit = ov.num('const.videoMostrados')): CatalogVideo[] {
  const terms = normalize(query ?? '').split(/[^a-z0-9]+/).filter(t => t && !STOPWORDS.has(t))
  if (!terms.length) return []
  const boost = { title: ov.num('const.videoScoreTitle'), tags: 2.5, source: ov.num('const.videoScoreSource'), topics: 2, description: ov.num('const.videoScoreDesc') }
  return ensureIndex().search(terms.join(' '), { boost, prefix: false, fuzzy: 0.2, combineWith: 'AND' })
    .map(r => byId.get(r.id as string)!)
    .filter(v => v && matchBlockedWord(v.title) === null)
    .slice(0, limit)
}

/* ---------- metadatos de YouTube (Data API v3, 1 unidad por llamada; cache en memoria) ---------- */
interface YtMeta { publishedAt?: string; likes?: number; channelThumb?: string; subscribers?: number }
const meta = new Map<string, YtMeta>()
const chMeta = new Map<string, { thumb?: string; subscribers?: number }>()
async function yt<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const key = (process.env.YOUTUBE_API_KEY ?? '').trim()
  if (!key) return null
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...params, key })}`)
    return r.ok ? ((await r.json()) as T) : null
  } catch { return null }
}

/* Fecha y Me gusta de varios videos en una sola llamada (para la lista de resultados y el reproductor). */
export async function loadVideoMeta(ids: string[]): Promise<void> {
  const missing = ids.filter(id => !meta.has(id)).slice(0, 50)
  if (!missing.length) return
  const data = await yt<{ items?: { id: string; snippet?: { publishedAt?: string }; statistics?: { likeCount?: string } }[] }>('videos', { part: 'snippet,statistics', id: missing.join(','), maxResults: '50' })
  for (const it of data?.items ?? []) meta.set(it.id, { publishedAt: it.snippet?.publishedAt, likes: it.statistics?.likeCount ? Number(it.statistics.likeCount) : undefined })
  for (const id of missing) if (!meta.has(id)) meta.set(id, {})
}
export async function loadChannelMeta(channelId: string): Promise<{ thumb?: string; subscribers?: number }> {
  if (!channelId) return {}
  if (chMeta.has(channelId)) return chMeta.get(channelId)!
  const data = await yt<{ items?: { snippet?: { thumbnails?: { default?: { url?: string } } }; statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean } }[] }>('channels', { part: 'snippet,statistics', id: channelId })
  const it = data?.items?.[0]
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
  const v = byId.get(id)
  if (!v || matchBlockedWord(v.title) !== null) return null // solo videos aprobados
  await loadVideoMeta([id])
  const ch = await loadChannelMeta(v.channelId)
  const m = meta.get(id) ?? {}
  return {
    ...toVideoResult(v), channelId: v.channelId, durationSec: v.duration, reviewed: true, verified: false,
    subscribers: ch.subscribers != null ? `${compact(ch.subscribers)} de suscriptores` : '',
    likes: m.likes != null ? compact(m.likes) : '', channelThumb: ch.thumb,
  }
}
