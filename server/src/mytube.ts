// MyTube (porte Smarty, tanda W5) — la capa que el catálogo plano de Innerith no tiene: ENTIDADES de canal (handle,
// descripción curada, avatar), PLAYLISTS propias de cada canal y la INGESTA del padre. Port EXACTO de smarty-poc @ develop
// (app/src/lib/mytube.ts + youtube.ts + la solapa YouTube de zones/admin/pages.tsx; informe docs/porte-smarty/03 §1).
// Desvíos forzados del mapa §4: (a) la key de YouTube y la de OpenAI viven en server/.env (el POC las tenía en Ajustes del
// navegador); (b) las tablas Dexie `youtube`/`ytVideos`/`ytChannels`/`ytPlaylists` viven acá con sus MISMAS formas.
//
// PERSISTENCIA: server/data/mytube.json (escritura atómica tmp+rename, SINCRÓNICA después de cada cambio: el watcher de
// tsx reinicia el proceso y un debounce perdería escrituras). Es CATÁLOGO de la familia (regla 9 de docs/AGENTS.md):
// persiste y NO entra en /api/demo/reset. Semilla = sin familia: { entries: [], videos: [], videoCap: 500 } + la caché de
// enriquecimiento que se vaya juntando.
//
// EL CATÁLOGO QUE VE MYTUBE = catálogo global (server/data/catalog.json, 94.923 videos, SOLO LECTURA: catalog.json no se
// toca) + las filas de la familia (store.videos, con entryId). Se SUMAN al servir (merge en estos endpoints). Un videoId
// existe una sola vez: la ingesta no re-agrega lo que ya está en cualquiera de los dos (saveVideos del POC).
// `familyCatalog` (abajo) es la capa de los videos de la familia, ENCHUFADA en videos.ts (consolidación 12-oct):
// este módulo se registra solo al arrancar vía `setFamilyCatalog` (detección en runtime). Buscar, el reproductor, el
// chat, Mis listas y Drive ven el catálogo ampliado; allChannels/videosOfChannel siguen solo sobre el base porque
// MyTube hace su propio merge (sumarlos acá duplicaría conteos).
//
// Contrato HTTP (formas espejo del POC, FORMALIZADAS en src/api/types.ts como Mt*; cliente = api.mt*):
//   Lado chico
//   GET  /api/mytube/channels → { channels: [{ channelId, title, thumb?, videos }] }
//        SOLO los canales que sigue el USUARIO ACTIVO (U4: cada uno los suyos, space.ts) Y tienen ≥1 video aprobado
//        (followedChannels del POC), ordenados por
//        channelId (el anyOf de Dexie: orden de clave, NO alfabético — quirk fiel). `videos` cuenta TODAS las filas del canal
//        SIN descontar los títulos con palabras bloqueadas (channelVideoCounts del POC, quirk fiel). Si a un seguido le falta
//        la metadata (avatar/título), se trae on-demand en UNA llamada channels.list (lotes de 50) y queda en caché.
//   GET  /api/mytube/channel?id= → { channel: { channelId, title, handle?, desc?, thumb? } | null, followed, total,
//        playlists: [{ playlistId, title }], pending }
//        `total` = videos aprobados del canal sin duplicados y sin palabras bloqueadas ("Videos (N)").
//        `playlists` = las propias del canal con ≥1 video aprobado (sin mirar palabras: channelPlaylists del POC), por título.
//        ENRIQUECIMIENTO ON-DEMAND (primera apertura, después caché): metadata (channels.list) → descripción curada
//        (limpiarDesc + resumen del modelo juez; no se pisa una descripción que ya existe, p. ej. editada por el padre) →
//        playlists propias (playlists.list + playlistItems, guardadas enteras y filtradas a lo aprobado AL SERVIR). Corre en
//        segundo plano: `pending: true` mientras tanto (el cliente vuelve a pedir; equivale al useLiveQuery del POC). Las
//        playlists propias se sincronizan SOLO donde el POC lo hacía: canales de la familia que entraron como 'canal' (al
//        agregar/reingestar/completar) y canales del catálogo base que en el POC eran una entrada «Canal …» (su `source`).
//        `channel: null` = no existe (sin videos aprobados ni entidad): la vista muestra «Canal» vacío, como el POC.
//   GET  /api/mytube/channel/videos?id=&offset=&limit= → { videos: MtVideo[], total }
//        En orden de ingesta (catálogo base y después la familia, por id de fila). La vista los pide de a tandas: 40 y
//        «Ver más» de a 60 (el POC cargaba todo y dibujaba de a tandas; acá la tanda viaja paginada).
//   GET  /api/mytube/channel/playlist?id= → { videos: MtVideo[] }  (404 si no existe)
//        Los videos aprobados de UNA playlist del canal, sin palabras bloqueadas y sin duplicados, ORDENADOS POR videoId
//        (el anyOf de Dexie no respeta el orden de la playlist: bug del POC portado tal cual, informe 03 §6).
//   MtVideo = { videoId, title, thumb, duration?, addedAt?, channelId?, channelTitle? } (subconjunto de YtVideo del POC).
//
//   Lado padre — TODOS con la SESIÓN del portón (X-Parent-Token, el mismo chequeo de parent.ts: hasParentSession; deuda
//   saldada 14-oct; con un ADULTO activo la sesión es implícita, docs/USUARIOS.md §4): sin sesión → 401 { error: 'Solo para
//   un adulto de la familia.' } (tanda B1: texto neutro, como el de Mentores; ya no habla de PIN ni de "sesión vencida")
//   GET  /api/mytube/admin/state → { entries: [{ id, type, url, title, videos, channelId?, createdAt }], total, videoCap }
//        `total` = videos aprobados (catálogo base + filas de la familia, el db.ytVideos.count() del POC).
//   GET  /api/mytube/admin/channels → { channels: [{ channelId, title, handle?, thumb?, desc, followed }] }
//        Todas las entidades + todos los canales con videos aprobados, por channelId (el toArray() de ytChannels). U4:
//        `followed` = lo sigue ALGÚN integrante de la familia (el panel es de la familia).
//   POST /api/mytube/admin/add { url }       → { ok: true, added, title } | { ok: false, error }   (UNA url por pedido;
//        el lote lo recorre la pantalla de a una, con progreso, como el POC). error = el código del POC (URL_INVALIDA,
//        YA_EXISTE, SIN_VIDEOS, SIN_KEY_YOUTUBE, YT_API_<status>, CANAL_NO_ENCONTRADO) o el mensaje de la falla.
//   POST /api/mytube/admin/reingest { id }   → { ok: true, added, title } | { ok: false, error }
//   POST /api/mytube/admin/remove { id }     → { ok: true }   (en cascada: ver removeYtEntry)
//   POST /api/mytube/admin/backfill          → { ok: true, completados, canales } | { ok: false, error }
//   POST /api/mytube/admin/dedup             → { ok: true, removed } | { ok: false, error }
//   POST /api/mytube/admin/cap { cap }       → { ok: true, videoCap }   (Number(cap) || 0, como «Guardar ajustes»)
//   POST /api/mytube/admin/channel-desc { channelId, desc } → { ok }
//   GET  /api/mytube/admin/usage → { ytUnits, ytCalls, llmCalls, since }  (diagnóstico de cuota desde el arranque; sin UI)
//
// Quirks del POC portados TAL CUAL (decisión 12-oct): orden de Canales por channelId; conteo de Canales sin descontar
// palabras bloqueadas; «1 videos»; playlists del canal ordenadas por videoId; tocar un video de una playlist lo abre
// SUELTO (cliente); cada video tiene UN entryId → borrar una entrada borra también los videos que comparte con otra que
// llegó después (la segunda no los re-agrega); reingestar no borra lo que ya no está en la fuente; `followed` se pierde
// si el canal se queda sin videos (U4: en TODOS los espacios); una descripción vacía guardada por el padre se vuelve a curar en la próxima ingesta.
// Desvíos (además de los forzados a/b): el catálogo base es de SOLO LECTURA → reingestar no refresca filas del catálogo
// base (solo las de la familia) y «Completar canales» completa datos faltantes solo en filas de la familia (el base ya los
// trae); un canal del catálogo base sin entidad toma el título del catálogo como respaldo (el POC caía al channelId); y
// editar la descripción de un canal que todavía no tiene entidad la crea (en el POC todo canal con videos ya la tenía).
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { MODELS, SERVER_ROOT } from './config'
import { matchBlockedWord } from './filters'
import { complete } from './llm'
import { hasParentSession } from './parent'
import * as space from './space'
import * as videosModule from './videos'
import { allChannels, catalogSize, getCatalogVideo, videosOfChannel, type CatalogVideo } from './videos'
import { readJson, send } from './web'

/* ---------- formas (espejo de las tablas Dexie del POC, app/src/db.ts) ---------- */
type EntryType = 'video' | 'playlist' | 'canal'
/** Tabla `youtube`: un permiso del padre. */
interface YtEntry {
  id: number; type: EntryType; url: string; title: string; videoIds: string[]
  status: 'activo' | 'pendiente'; channelId?: string; createdAt: number
}
/** Tabla `ytVideos` (SOLO las filas de la familia; las del catálogo base viven en catalog.json). */
interface YtVideo {
  id: number; videoId: string; title: string; thumb: string; entryId: number
  description?: string; channelId?: string; channelTitle?: string; duration?: number; addedAt?: number
  tags?: string[]; categoryId?: string; topics?: string[]
}
/** Tabla `ytChannels` sin `followed` (el seguir es de CADA USUARIO desde U4: vive en server/data/space.json v2, space.ts).
 *  `metaAt`/`descTriedAt`/`playlistsAt`/`*TriedAt` = caché del enriquecimiento on-demand de Innerith (no existen en el POC). */
interface YtChannel {
  channelId: string; title: string; handle?: string; descRaw?: string; desc?: string; thumb?: string; createdAt: number
  metaAt?: number; metaTriedAt?: number; descTriedAt?: number; playlistsAt?: number; playlistsTriedAt?: number
}
/** Tabla `ytPlaylists`: las playlists PROPIAS de un canal (o la de una entrada 'playlist'), con TODOS sus videoIds. */
interface YtPlaylist { playlistId: string; channelId: string; title: string; thumb?: string; videoIds: string[]; createdAt: number }
interface Store {
  version: 1
  entrySeq: number; videoSeq: number
  /** settings.videoCapPorEntrada del POC: 500 por defecto, 0 = sin tope. */
  videoCap: number
  entries: YtEntry[]; videos: YtVideo[]; channels: YtChannel[]; playlists: YtPlaylist[]
}
/** Lo que viaja a la UI del chico (subconjunto de YtVideo). */
export interface MtVideo { videoId: string; title: string; thumb: string; duration?: number; addedAt?: number; channelId?: string; channelTitle?: string }

/** Orden de clave de IndexedDB para strings (unidades de código, NO localeCompare): el de anyOf/toArray en Dexie. */
const cmpKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/* ---------- persistencia ---------- */
const FILE = join(SERVER_ROOT, 'data', 'mytube.json')
const seed = (): Store => ({ version: 1, entrySeq: 1, videoSeq: 1, videoCap: 500, entries: [], videos: [], channels: [], playlists: [] })
function load(): Store {
  try {
    if (existsSync(FILE)) {
      const raw = JSON.parse(readFileSync(FILE, 'utf8')) as Partial<Store>
      return {
        version: 1,
        entrySeq: Number(raw.entrySeq) || 1, videoSeq: Number(raw.videoSeq) || 1,
        videoCap: typeof raw.videoCap === 'number' ? raw.videoCap : 500,
        entries: Array.isArray(raw.entries) ? raw.entries : [],
        videos: Array.isArray(raw.videos) ? raw.videos : [],
        channels: Array.isArray(raw.channels) ? raw.channels : [],
        playlists: Array.isArray(raw.playlists) ? raw.playlists : [],
      }
    }
  } catch (e) {
    console.warn('[mytube] mytube.json ilegible: guardo una copia y arranco con la semilla:', e)
    try { renameSync(FILE, FILE + '.broken-' + Date.now()) } catch { /* sin copia */ }
  }
  return seed()
}
const store: Store = load()
const channels = new Map(store.channels.map(c => [c.channelId, c]))
const playlists = new Map(store.playlists.map(p => [p.playlistId, p]))

function save(): void {
  store.channels = [...channels.values()].sort((a, b) => cmpKey(a.channelId, b.channelId))
  store.playlists = [...playlists.values()]
  try { writeFileSync(FILE + '.tmp', JSON.stringify(store)); renameSync(FILE + '.tmp', FILE) }
  catch (e) { console.error('[mytube] no pude guardar mytube.json:', e) }
}
if (!existsSync(FILE)) save()

/* ---------- índices de las filas de la familia (se rehacen después de cada cambio) ---------- */
let famById = new Map<string, YtVideo>()
let famByChannel = new Map<string, YtVideo[]>()
let famVersion = 0
function reindex(): void {
  // Auto-sanado del arranque (dedupYtVideosIfNeeded del POC): filas repetidas por videoId → queda la de id más alto.
  const keep = new Map<string, YtVideo>()
  for (const v of store.videos) {
    if (!v.videoId) continue
    const prev = keep.get(v.videoId)
    if (!prev || v.id > prev.id) keep.set(v.videoId, v)
  }
  if (keep.size !== store.videos.length) {
    console.log(`[mytube] ${store.videos.length - keep.size} fila(s) duplicada(s) por videoId: quedó la más nueva`)
    store.videos = store.videos.filter(v => keep.get(v.videoId) === v)
    save()
  }
  store.videos.sort((a, b) => a.id - b.id)
  famById = keep
  famByChannel = new Map()
  for (const v of store.videos) {
    if (!v.channelId) continue
    const arr = famByChannel.get(v.channelId)
    if (arr) arr.push(v)
    else famByChannel.set(v.channelId, [v])
  }
  famVersion++
}
reindex()

/* ---------- el catálogo que ve MyTube: base (videos.ts, solo lectura) + familia ---------- */
let globalChannels: Map<string, videosModule.ChannelSummary> | null = null
const globalChannel = (cid: string) => (globalChannels ??= new Map(allChannels().map(c => [c.id, c]))).get(cid)
const catalogTitle = (cid: string): string | undefined => globalChannel(cid)?.name || famByChannel.get(cid)?.find(v => v.channelTitle)?.channelTitle
const entryTitle = (entryId: number) => store.entries.find(e => e.id === entryId)?.title ?? ''

function fromRow(r: YtVideo): MtVideo {
  return { videoId: r.videoId, title: r.title, thumb: r.thumb, duration: r.duration || undefined, addedAt: r.addedAt || undefined, channelId: r.channelId || undefined, channelTitle: r.channelTitle || undefined }
}
function fromCatalog(v: CatalogVideo): MtVideo {
  return { videoId: v.videoId, title: v.title, thumb: v.thumb || thumb(v.videoId), duration: v.duration || undefined, addedAt: v.addedAt || undefined, channelId: v.channelId || undefined, channelTitle: v.channelTitle || undefined }
}
/** ¿Está aprobado? (= hay una fila en ytVideos del POC). La fila de la familia gana si existiera en los dos. */
function approvedVideo(videoId: string): MtVideo | undefined {
  const r = famById.get(videoId)
  if (r) return fromRow(r)
  const g = getCatalogVideo(videoId)
  return g ? fromCatalog(g) : undefined
}
const isApproved = (videoId: string) => famById.has(videoId) || !!getCatalogVideo(videoId)
/** Filas del canal (index channelId del POC: las cuenta TODAS, sin mirar palabras). */
const channelRowCount = (cid: string) => (globalChannel(cid)?.videos ?? 0) + (famByChannel.get(cid)?.length ?? 0)
/** Un canal existe / es seguible si tiene ≥1 video aprobado (regla central de mytube.ts del POC). */
const hasContent = (cid: string) => channelRowCount(cid) > 0

/** channelVideos del POC (dedup por videoId, orden de ingesta) + el filtro de palabras de la vista, aplicado al servir. */
function channelVideos(cid: string): MtVideo[] {
  const seen = new Set<string>()
  const out: MtVideo[] = []
  for (const v of videosOfChannel(cid)) { // catálogo base: ya sin duplicados ni palabras bloqueadas, en orden
    if (seen.has(v.videoId)) continue
    seen.add(v.videoId); out.push(fromCatalog(v))
  }
  for (const r of famByChannel.get(cid) ?? []) {
    if (!r.videoId || seen.has(r.videoId)) continue
    seen.add(r.videoId)
    if (matchBlockedWord(r.title) === null) out.push(fromRow(r))
  }
  return out
}

/** channelPlaylists del POC: las del canal con ≥1 videoId aprobado (sin mirar palabras), por título. */
function channelPlaylists(cid: string): YtPlaylist[] {
  return [...playlists.values()]
    .filter(p => p.channelId === cid && p.videoIds.some(isApproved))
    .sort((a, b) => a.title.localeCompare(b.title, 'es-AR'))
}

/** Los videos de una playlist como los dibuja el PlaylistRow del POC: anyOf (→ ORDEN POR videoId, no el de la playlist),
 *  dedup por videoId y sin palabras bloqueadas. */
function playlistVideos(pl: YtPlaylist): MtVideo[] {
  const ids = [...new Set(pl.videoIds)].sort(cmpKey)
  const out: MtVideo[] = []
  for (const id of ids) {
    const v = approvedVideo(id)
    if (v && matchBlockedWord(v.title) === null) out.push(v)
  }
  return out
}

/* ---------- capa para el seam de videos.ts (ver el encabezado) ---------- */
function toCatalogVideo(r: YtVideo): CatalogVideo {
  return {
    videoId: r.videoId, title: r.title, thumb: r.thumb, channelId: r.channelId ?? '', channelTitle: r.channelTitle ?? '',
    source: entryTitle(r.entryId), description: r.description ?? '', duration: r.duration ?? 0, addedAt: r.addedAt ?? 0,
    tags: r.tags ?? [], topics: r.topics ?? [],
  }
}
export const familyCatalog = {
  get: (videoId: string): CatalogVideo | undefined => { const r = famById.get(videoId); return r ? toCatalogVideo(r) : undefined },
  all: (): CatalogVideo[] => store.videos.map(toCatalogVideo),
  version: () => famVersion,
}
;(videosModule as unknown as { setFamilyCatalog?: (layer: typeof familyCatalog) => void }).setFamilyCatalog?.(familyCatalog)

/* ---------- YouTube Data v3 (port de youtube.ts del POC; la key es del server) ---------- */
const usage = { ytUnits: 0, ytCalls: 0, llmCalls: 0, since: Date.now() }
export type YtRef = { type: 'video'; id: string } | { type: 'playlist'; id: string } | { type: 'canal'; handle: string }

/* Una playlist "real" (importable) tiene id con prefijo PL/UU/OL/FL. Los mixes/auto-listas (RD radio, LM, WL watch later,
   LL liked) NO son importables: cuando aparecen en un &list= los tratamos como video. */
export function esPlaylistReal(list: string): boolean {
  return /^(PL|UU|OL|FL)/.test(list)
}

/** parseYtUrl del POC, TAL CUAL: youtu.be / watch?v= / shorts / embed / playlist?list= / @handle; &list= con PL/UU/OL/FL =
 *  playlist. NO acepta /channel/UC…, /c/ ni /user/. */
export function parseYtUrl(input: string): YtRef | null {
  const s = input.trim()
  let u: URL
  try { u = new URL(s.startsWith('http') ? s : `https://${s}`) } catch { return null }
  const host = u.hostname.replace(/^www\.|^m\./, '')
  const list = u.searchParams.get('list')
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0]
    // Link de video dentro de una playlist real → preferimos la playlist.
    if (list && esPlaylistReal(list)) return { type: 'playlist', id: list }
    return id ? { type: 'video', id } : null
  }
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return null
  if (u.pathname === '/playlist' && list) return { type: 'playlist', id: list }
  // /watch?v=VID&list=PL... → preferimos la playlist real sobre el video.
  if (list && esPlaylistReal(list)) return { type: 'playlist', id: list }
  const v = u.searchParams.get('v')
  if (v) return { type: 'video', id: v }
  if (u.pathname.startsWith('/shorts/')) return { type: 'video', id: u.pathname.split('/')[2] }
  if (u.pathname.startsWith('/embed/')) return { type: 'video', id: u.pathname.split('/')[2] }
  if (u.pathname.startsWith('/@')) return { type: 'canal', handle: u.pathname.slice(1).split('/')[0] }
  return null
}

async function oembedTitle(videoId: string): Promise<string> {
  try {
    const r = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`, { signal: AbortSignal.timeout(15000) })
    const j = (await r.json()) as { title?: string }
    return j.title || videoId
  } catch {
    return videoId
  }
}

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`

interface ApiItem { videoId: string; title: string; description: string; channelId?: string; channelTitle?: string; duration?: number; tags?: string[]; categoryId?: string; topics?: string[] }

/* topicDetails.topicCategories son URLs de Wikipedia (…/wiki/Association_football). Nos quedamos con el último segmento,
   decodificado y sin guiones bajos → "Association football". Dedup. */
function cleanTopics(urls: string[]): string[] {
  const out = new Set<string>()
  for (const u of urls) {
    const seg = (u.split('/wiki/')[1] ?? u.split('/').pop() ?? '')
    const name = decodeURIComponent(seg).replace(/_/g, ' ').trim()
    if (name) out.add(name)
  }
  return [...out]
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

/* ISO-8601 (PT#H#M#S) → segundos. */
function parseDuration(iso: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '')
  if (!m) return 0
  return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0))
}

async function ytApi(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const key = (process.env.YOUTUBE_API_KEY ?? '').trim()
  if (!key) throw new Error('SIN_KEY_YOUTUBE')
  usage.ytCalls++; usage.ytUnits++ // las 5 operaciones que se usan cuestan 1 unidad de cuota cada una
  console.log(`[mytube] YT ${path} (${params.id ? `${params.id.split(',').length} id(s)` : params.playlistId ? `lista ${params.playlistId}` : params.channelId ? `canal ${params.channelId}` : params.forHandle ? params.forHandle : ''}${params.pageToken ? ' · página siguiente' : ''}) · ${usage.ytUnits} u. desde el arranque`)
  const r = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...params, key })}`, { signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(`YT_API_${r.status}`)
  return (await r.json()) as Record<string, unknown>
}

/* videos.list (batch de 50): duración + canal + título por videoId. */
type VideoDetail = { duration: number; channelId: string; channelTitle: string; title: string; tags: string[]; categoryId: string; topics: string[] }
async function videoDetails(ids: string[]): Promise<Map<string, VideoDetail>> {
  const map = new Map<string, VideoDetail>()
  for (const grupo of chunk([...new Set(ids)], 50)) {
    const j = await ytApi('videos', { part: 'snippet,contentDetails,topicDetails', id: grupo.join(',') }) as {
      items?: { id?: string; snippet?: { title?: string; channelId?: string; channelTitle?: string; tags?: string[]; categoryId?: string }; contentDetails?: { duration?: string }; topicDetails?: { topicCategories?: string[] } }[]
    }
    for (const it of j.items ?? []) {
      if (!it.id) continue
      map.set(it.id, {
        duration: parseDuration(it.contentDetails?.duration ?? ''),
        channelId: it.snippet?.channelId ?? '',
        channelTitle: it.snippet?.channelTitle ?? '',
        title: it.snippet?.title ?? '',
        tags: it.snippet?.tags ?? [],
        categoryId: it.snippet?.categoryId ?? '',
        topics: cleanTopics(it.topicDetails?.topicCategories ?? []),
      })
    }
  }
  return map
}

/* channels.list (batch de 50): metadata de cada canal. */
type ChannelMeta = { title: string; description: string; handle: string; thumb: string }
async function channelMeta(ids: string[]): Promise<Map<string, ChannelMeta>> {
  const map = new Map<string, ChannelMeta>()
  for (const grupo of chunk([...new Set(ids.filter(Boolean))], 50)) {
    const j = await ytApi('channels', { part: 'snippet', id: grupo.join(',') }) as {
      items?: { id?: string; snippet?: { title?: string; description?: string; customUrl?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } } } }[]
    }
    for (const it of j.items ?? []) {
      if (!it.id) continue
      const s = it.snippet
      map.set(it.id, {
        title: s?.title ?? '',
        description: s?.description ?? '',
        handle: s?.customUrl ?? '',
        thumb: s?.thumbnails?.medium?.url ?? s?.thumbnails?.default?.url ?? '',
      })
    }
  }
  return map
}

/* Tope de videos a importar por canal/playlist (settings.videoCapPorEntrada). 0 = SIN TOPE → bajamos todo. La cuota de la
   Data API es BARATA (1 unidad por página de 50, no por video). numOr del POC: negativo o no numérico → 500. */
function capSetting(): number {
  const n = store.videoCap
  return Number.isFinite(n) && n >= 0 ? n : 500
}
function videoCap(): number {
  const c = capSetting()
  return c > 0 ? c : Infinity
}

/* "+" en el título solo si el snapshot se CORTÓ por el tope (no en sin-tope). */
const cuenta = (n: number, max: number) => (Number.isFinite(max) && n >= max ? `${max}+` : String(n))

/* La Data API devuelve como máximo 50 ítems por página; paginamos con nextPageToken acumulando hasta `max`. */
async function playlistItems(playlistId: string, max = videoCap()): Promise<ApiItem[]> {
  const out: ApiItem[] = []
  let pageToken: string | undefined
  do {
    const params: Record<string, string> = { part: 'snippet', playlistId, maxResults: '50' }
    if (pageToken) params.pageToken = pageToken
    const j = await ytApi('playlistItems', params) as {
      items?: { snippet?: { title?: string; description?: string; resourceId?: { videoId?: string }; videoOwnerChannelId?: string; videoOwnerChannelTitle?: string } }[]
      nextPageToken?: string
    }
    const page = (j.items ?? [])
      .map(i => ({
        videoId: i.snippet?.resourceId?.videoId ?? '',
        title: i.snippet?.title ?? '',
        description: i.snippet?.description ?? '',
        channelId: i.snippet?.videoOwnerChannelId,
        channelTitle: i.snippet?.videoOwnerChannelTitle,
      }))
      .filter(i => i.videoId && i.title !== 'Private video' && i.title !== 'Deleted video')
    out.push(...page)
    pageToken = j.nextPageToken
  } while (pageToken && out.length < max)
  return out.slice(0, max)
}

/* Nombre + canal dueño de la playlist (playlists.list, 1 unidad). Si falla, valores vacíos y el caller cae al título
   genérico. El channelId agrupa la lista bajo su canal en MyTube. */
async function playlistMeta(playlistId: string): Promise<{ title: string; channelId: string }> {
  try {
    const j = await ytApi('playlists', { part: 'snippet', id: playlistId }) as { items?: { snippet?: { title?: string; channelId?: string } }[] }
    const s = j.items?.[0]?.snippet
    return { title: s?.title ?? '', channelId: s?.channelId ?? '' }
  } catch {
    return { title: '', channelId: '' }
  }
}

async function channelUploads(handle: string, max = videoCap()): Promise<{ items: ApiItem[]; channelTitle: string; channelId: string }> {
  const j = await ytApi('channels', { part: 'snippet,contentDetails', forHandle: handle }) as {
    items?: { id?: string; snippet?: { title?: string }; contentDetails?: { relatedPlaylists?: { uploads?: string } } }[]
  }
  const ch = j.items?.[0]
  const uploads = ch?.contentDetails?.relatedPlaylists?.uploads
  if (!uploads) throw new Error('CANAL_NO_ENCONTRADO')
  return { items: await playlistItems(uploads, max), channelTitle: ch?.snippet?.title ?? handle, channelId: ch?.id ?? '' }
}

/* Toma el snapshot ACTUAL (items + título + canal-dueño) de una referencia ya parseada (alta y reingesta). */
async function snapshotFromRef(ref: YtRef): Promise<{ items: ApiItem[]; title: string; channelId: string }> {
  const max = videoCap()
  if (ref.type === 'video') {
    const title = await oembedTitle(ref.id)
    return { items: [{ videoId: ref.id, title, description: '' }], title, channelId: '' }
  }
  if (ref.type === 'playlist') {
    const [items, meta] = await Promise.all([playlistItems(ref.id, max), playlistMeta(ref.id)])
    return {
      items,
      title: meta.title ? `Lista ${meta.title} (${cuenta(items.length, max)} videos)` : `Playlist (${cuenta(items.length, max)} videos)`,
      channelId: meta.channelId,
    }
  }
  const r = await channelUploads(ref.handle, max)
  return { items: r.items, title: `Canal ${r.channelTitle} (${cuenta(r.items.length, max)} videos)`, channelId: r.channelId }
}

/* Limpia la descripción cruda de un canal: saca URLs, mails, handles/hashtags y líneas de promoción típicas (suscribite,
   redes, sponsors). Lo que ve el niño después de curar. */
function limpiarDesc(raw: string): string {
  return raw
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '')
    .replace(/[#@][\w.]+/g, '')
    .replace(/^.*\b(subscrib|suscrib|business inquir|contacto comercial|sponsor|patreon|merch|instagram|tiktok|twitter|facebook|discord|whatsapp|telegram)\b.*$/gim, '')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/* Descripción curada del canal para el niño: limpia + resumen kid-friendly con el modelo "juez" (MODELS.juez del POC).
   Sin key de OpenAI o si falla → cae a la limpia recortada a 400. */
async function curarDescripcion(title: string, raw: string): Promise<string> {
  const limpia = limpiarDesc(raw)
  if (!(process.env.OPENAI_API_KEY ?? '').trim()) return limpia.slice(0, 400)
  try {
    usage.llmCalls++
    console.log(`[mytube] LLM descripción curada de «${title}» · ${usage.llmCalls} llamada(s) desde el arranque`)
    const { text } = await complete({
      model: MODELS.juez,
      system: 'Resumís en 1-2 oraciones, en español rioplatense y tono cálido para un niño de 9-12 años, de qué trata un canal de YouTube. Sin links, sin promociones, sin pedir suscripciones. Si no hay info útil, devolvé una frase neutra y breve.',
      messages: [{ role: 'user', content: `Canal: ${title}\nDescripción: ${limpia || '(sin descripción)'}` }],
      maxTokens: 120,
    })
    return text.trim().slice(0, 400) || limpia.slice(0, 400)
  } catch {
    return limpia.slice(0, 400)
  }
}

/* Corre fn sobre items con a lo sumo n en paralelo (solo para no hacer esperar minutos a «Completar canales»). */
async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>): Promise<void> {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) await fn(items[i++]) }))
}

/* Upsert de los canales involucrados: trae metadata (channels.list) y, si el canal no tiene descripción, la cura. NO pisa
   la `desc` existente (respeta la edición del padre). */
async function upsertChannels(channelIds: string[]): Promise<void> {
  const ids = [...new Set(channelIds.filter(Boolean))]
  if (!ids.length) return
  const metas = await channelMeta(ids).catch(() => new Map<string, ChannelMeta>())
  await pool(ids, 4, async cid => {
    const existing = channels.get(cid)
    const m = metas.get(cid)
    const descRaw = m?.description ?? existing?.descRaw ?? ''
    const desc = existing?.desc || (await curarDescripcion(m?.title ?? existing?.title ?? catalogTitle(cid) ?? '', descRaw))
    const now = Date.now()
    channels.set(cid, {
      ...existing,
      channelId: cid,
      title: m?.title ?? existing?.title ?? catalogTitle(cid) ?? cid,
      handle: m?.handle ?? existing?.handle,
      thumb: m?.thumb ?? existing?.thumb,
      descRaw,
      desc,
      createdAt: existing?.createdAt ?? now,
      metaAt: m ? now : existing?.metaAt,
      metaTriedAt: m ? existing?.metaTriedAt : now, // YouTube no lo conoce (o falló): no reintentar enseguida on-demand
      descTriedAt: now,
    })
  })
  save()
}

/* IDs de los videos de una playlist (liviano: solo contentDetails.videoId). */
async function playlistVideoIds(playlistId: string, max = videoCap()): Promise<string[]> {
  const out: string[] = []
  let pageToken: string | undefined
  do {
    const params: Record<string, string> = { part: 'contentDetails', playlistId, maxResults: '50' }
    if (pageToken) params.pageToken = pageToken
    const j = await ytApi('playlistItems', params) as { items?: { contentDetails?: { videoId?: string } }[]; nextPageToken?: string }
    for (const i of j.items ?? []) { if (i.contentDetails?.videoId) out.push(i.contentDetails.videoId) }
    pageToken = j.nextPageToken
  } while (pageToken && out.length < max)
  return out.slice(0, max)
}

function upsertPlaylist(playlistId: string, channelId: string, title: string, thumbUrl: string | undefined, videoIds: string[]): void {
  if (!playlistId || !channelId || !videoIds.length) return
  const prev = playlists.get(playlistId)
  playlists.set(playlistId, { playlistId, channelId, title, thumb: thumbUrl, videoIds, createdAt: prev?.createdAt ?? Date.now() })
}

/* Trae las playlists PROPIAS de un canal (playlists.list) con sus videoIds y las guarda. Al servir se filtran a las que
   tengan ≥1 video aprobado. Best-effort como el POC (lo que se alcanzó a traer queda); devuelve si terminó sin error. */
async function syncChannelPlaylists(channelId: string): Promise<boolean> {
  if (!channelId) return false
  let ok = false
  try {
    let pageToken: string | undefined
    do {
      const params: Record<string, string> = { part: 'snippet,contentDetails', channelId, maxResults: '50' }
      if (pageToken) params.pageToken = pageToken
      const j = await ytApi('playlists', params) as {
        items?: { id?: string; snippet?: { title?: string; thumbnails?: { medium?: { url?: string }; default?: { url?: string } } }; contentDetails?: { itemCount?: number } }[]
        nextPageToken?: string
      }
      for (const p of j.items ?? []) {
        if (!p.id || !p.contentDetails?.itemCount) continue
        const ids = await playlistVideoIds(p.id).catch(() => [] as string[])
        upsertPlaylist(p.id, channelId, p.snippet?.title ?? '', p.snippet?.thumbnails?.medium?.url ?? p.snippet?.thumbnails?.default?.url, ids)
      }
      pageToken = j.nextPageToken
    } while (pageToken)
    ok = true
  } catch { /* best-effort */ }
  const ch = channels.get(channelId)
  if (ch) { if (ok) ch.playlistsAt = Date.now(); else ch.playlistsTriedAt = Date.now() }
  save()
  return ok
}

/* Snapshot ENRIQUECIDO: items con canal+duración, canal-dueño de la entrada, y canales upserteados. La parte de
   duración/canal-por-video y la metadata de canal son best-effort: si la API falla, se guarda lo que haya. */
async function buildSnapshot(ref: YtRef): Promise<{ items: ApiItem[]; title: string; entryChannelId: string }> {
  const snap = await snapshotFromRef(ref)
  const details = await videoDetails(snap.items.map(i => i.videoId)).catch(() => new Map<string, VideoDetail>())
  for (const it of snap.items) {
    const d = details.get(it.videoId)
    if (d) {
      it.duration = d.duration
      it.tags = d.tags; it.categoryId = d.categoryId; it.topics = d.topics
      if (!it.channelId) { it.channelId = d.channelId; it.channelTitle = d.channelTitle }
    }
  }
  let entryChannelId = snap.channelId
  if (!entryChannelId && ref.type === 'video') entryChannelId = snap.items[0]?.channelId ?? ''
  const channelIds = snap.items.map(i => i.channelId).filter(Boolean) as string[]
  if (entryChannelId) channelIds.push(entryChannelId)
  await upsertChannels(channelIds)
  return { items: snap.items, title: snap.title, entryChannelId }
}

/* Guarda los videos de una entrada. Dedup por videoId (un video = una fila, contra el catálogo ENTERO: base + familia).
   Con refresh=true (reingesta) ACTUALIZA título+descripción de las filas de la familia que ya existen; las del catálogo
   base son de solo lectura. Sin refresh (alta) las deja igual. */
function saveVideos(items: ApiItem[], entryId: number, refresh = false): void {
  for (const it of items) {
    const existing = famById.get(it.videoId)
    if (!existing && !getCatalogVideo(it.videoId)) {
      const row: YtVideo = {
        id: store.videoSeq++, videoId: it.videoId, title: it.title, thumb: thumb(it.videoId), entryId, description: it.description,
        channelId: it.channelId, channelTitle: it.channelTitle, duration: it.duration, addedAt: Date.now(),
        tags: it.tags, categoryId: it.categoryId, topics: it.topics,
      }
      store.videos.push(row)
      famById.set(row.videoId, row) // la misma entrada puede traer el mismo video dos veces
    } else if (refresh && existing) {
      Object.assign(existing, {
        title: it.title, description: it.description,
        channelId: it.channelId ?? existing.channelId, channelTitle: it.channelTitle ?? existing.channelTitle,
        duration: it.duration ?? existing.duration,
        tags: it.tags ?? existing.tags, categoryId: it.categoryId ?? existing.categoryId, topics: it.topics ?? existing.topics,
      })
    }
  }
  reindex() // los videos cambiaron (en el POC: invalidateVideoIndex)
  save()
}

/* ¿Esta fuente ya está en la lista? Compara el recurso de la URL con el de cada entrada: canal por handle,
   playlist/video por id. (Los cruces handle↔UC los limpia «Quitar duplicados», que usa el channelId ya resuelto.) */
function mismaFuente(e: YtEntry, ref: YtRef): boolean {
  if (e.type !== ref.type) return false
  const er = parseYtUrl(e.url)
  if (!er || er.type !== ref.type) return false
  if (er.type === 'canal' && ref.type === 'canal') return er.handle.toLowerCase() === ref.handle.toLowerCase()
  if (er.type !== 'canal' && ref.type !== 'canal') return er.id === ref.id
  return false
}

/* Ingest snapshot (RF-4.1): importa los videos ACTUALES; los uploads futuros no entran solos. */
async function addYtEntry(input: string): Promise<{ added: number; title: string }> {
  const ref = parseYtUrl(input)
  if (!ref) throw new Error('URL_INVALIDA')
  if (store.entries.some(e => mismaFuente(e, ref))) throw new Error('YA_EXISTE')

  const { items, title, entryChannelId } = await buildSnapshot(ref)
  if (!items.length) throw new Error('SIN_VIDEOS')

  const entry: YtEntry = {
    id: store.entrySeq++, type: ref.type, url: input.trim(), title, videoIds: items.map(i => i.videoId),
    status: 'activo', channelId: entryChannelId || undefined, createdAt: Date.now(),
  }
  store.entries.push(entry)
  saveVideos(items, entry.id)
  if (ref.type === 'canal') await syncChannelPlaylists(entryChannelId)
  else if (ref.type === 'playlist') upsertPlaylist(ref.id, entryChannelId, title, undefined, items.map(i => i.videoId))
  save()
  return { added: items.length, title }
}

/* Quita ENTRADAS duplicadas (mismo canal / playlist / video). Conserva la MÁS VIEJA —dueña de los videos: las altas
   posteriores NO re-agregan videos ya existentes— y borra las repetidas con removeYtEntry. Devuelve cuántas quitó. */
function dedupYtEntries(): number {
  const entries = store.entries.slice().sort((a, b) => a.id - b.id) // viejas primero
  const vistas = new Set<string>()
  const dups: number[] = []
  for (const e of entries) {
    const r = parseYtUrl(e.url)
    const id = e.type === 'canal'
      ? (e.channelId || (r?.type === 'canal' ? r.handle : '') || e.url.trim())
      : (r && r.type !== 'canal' ? r.id : e.url.trim())
    const key = `${e.type}:${id}`
    if (vistas.has(key)) dups.push(e.id)
    else vistas.add(key)
  }
  for (const id of dups) removeYtEntry(id)
  return dups.length
}

/* Reingesta: re-toma el snapshot de una entrada YA cargada (mismo url) y actualiza su título y las descripciones de sus
   videos. Mantiene el id/status. NO borra lo que ya no está en la fuente. */
async function reingestYtEntry(entryId: number): Promise<{ added: number; title: string }> {
  const entry = store.entries.find(e => e.id === entryId)
  if (!entry) throw new Error('ENTRADA_NO_ENCONTRADA')
  const ref = parseYtUrl(entry.url)
  if (!ref) throw new Error('URL_INVALIDA')

  const { items, title, entryChannelId } = await buildSnapshot(ref)
  if (!items.length) throw new Error('SIN_VIDEOS')

  Object.assign(entry, { title, videoIds: items.map(i => i.videoId), channelId: entryChannelId || entry.channelId })
  saveVideos(items, entryId, true)
  if (ref.type === 'canal') await syncChannelPlaylists(entryChannelId || entry.channelId || '')
  else if (ref.type === 'playlist') upsertPlaylist(ref.id, entryChannelId || entry.channelId || '', title, undefined, items.map(i => i.videoId))
  save()
  return { added: items.length, title }
}

/* «Completar canales (MyTube)»: completa canal/duración/tags/topics de las filas que les falte (las de la familia: el
   catálogo base es de solo lectura y ya los trae), upsertea TODOS los canales presentes (metadata + descripción curada
   donde falte), sincroniza las playlists de las entradas 'canal' y registra las de las entradas 'playlist'. */
async function backfillChannels(): Promise<{ completados: number; canales: number }> {
  const missing = store.videos.filter(v => !v.channelId || v.topics === undefined)
  let completados = 0
  if (missing.length) {
    const details = await videoDetails(missing.map(v => v.videoId))
    for (const v of missing) {
      const d = details.get(v.videoId)
      if (d) {
        Object.assign(v, {
          channelId: d.channelId || v.channelId, channelTitle: d.channelTitle || v.channelTitle, duration: d.duration ?? v.duration,
          tags: d.tags, categoryId: d.categoryId, topics: d.topics,
        })
        completados++
      }
    }
    reindex()
    save()
  }
  const present = [...new Set([...allChannels().map(c => c.id), ...famByChannel.keys()])]
  await upsertChannels(present)
  for (const e of store.entries.filter(x => x.type === 'canal')) {
    if (e.channelId) await syncChannelPlaylists(e.channelId)
  }
  for (const e of store.entries.filter(x => x.type === 'playlist')) {
    const ref = parseYtUrl(e.url)
    if (ref?.type === 'playlist' && e.channelId) upsertPlaylist(ref.id, e.channelId, e.title, undefined, e.videoIds)
  }
  save()
  return { completados, canales: present.length }
}

/* Borra la entrada y SUS videos (los de su entryId: TRAMPA fiel del POC, ver encabezado). Canal sin videos restantes →
   se borra con sus playlists y deja de estar seguido (en el POC `followed` vivía en el canal). */
function removeYtEntry(entryId: number): void {
  const vids = store.videos.filter(v => v.entryId === entryId)
  const channelIds = [...new Set(vids.map(v => v.channelId).filter(Boolean) as string[])]
  store.videos = store.videos.filter(v => v.entryId !== entryId)
  store.entries = store.entries.filter(e => e.id !== entryId)
  reindex() // se borraron videos → reconstruir los índices
  for (const cid of channelIds) {
    if (!hasContent(cid)) {
      channels.delete(cid)
      for (const p of [...playlists.values()]) if (p.channelId === cid) playlists.delete(p.playlistId)
      space.unfollowEverywhere(cid) // U4: deja de seguirse en TODOS los espacios (esto corre en el pedido del ADULTO)
    }
  }
  save()
}

/* ---------- enriquecimiento ON-DEMAND de un canal (caché persistida) ---------- */
const COOLDOWN_MS = 30 * 60 * 1000 // reintento de un paso que falló (cuota, red) sin martillar la API
const fresh = (t?: number) => !!t && Date.now() - t < COOLDOWN_MS

/* ¿El POC sincronizaba las playlists propias de este canal? Solo para entradas 'canal' (sus propias playlists). En el
   catálogo base eso se ve en el `source` de sus videos: «Canal <su nombre> (N videos)». Un canal que llegó por una
   «Lista …» o un video suelto (o un VEVO dentro de la entrada de otro canal) no tenía sus playlists en el POC. */
const canalSourceCache = new Map<string, boolean>()
const normName = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
function syncsOwnPlaylists(cid: string): boolean {
  if (store.entries.some(e => e.type === 'canal' && e.channelId === cid)) return true
  let v = canalSourceCache.get(cid)
  if (v === undefined) {
    v = videosOfChannel(cid).some(x => {
      const m = /^Canal (.*) \(\d+\+? videos\)$/s.exec(x.source.trim())
      return !!m && !!x.channelTitle && normName(m[1]) === normName(x.channelTitle)
    })
    canalSourceCache.set(cid, v)
  }
  return v
}

/** ¿Le falta algo que se puede traer ahora? (sin pasos fallidos recientes) */
function enrichmentNeeded(cid: string): boolean {
  const ch = channels.get(cid)
  if (!ch?.metaAt) return !fresh(ch?.metaTriedAt)
  if (!ch.desc && !ch.descTriedAt) return true
  return syncsOwnPlaylists(cid) && !ch.playlistsAt && !fresh(ch.playlistsTriedAt)
}

const inflight = new Map<string, Promise<void>>()
let running = 0
const waiting: (() => void)[] = []
async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= 2) await new Promise<void>(r => waiting.push(r))
  running++
  try { return await fn() } finally { running--; waiting.shift()?.() }
}

/** Metadata que falte para un lote de canales (una llamada channels.list cada 50; sin curar descripciones). */
async function ensureMeta(ids: string[]): Promise<void> {
  const need = ids.filter(cid => !channels.get(cid)?.metaAt && !fresh(channels.get(cid)?.metaTriedAt))
  if (!need.length) return
  let metas = new Map<string, ChannelMeta>()
  try { metas = await channelMeta(need) } catch (e) { console.warn('[mytube] channels.list falló:', (e as Error).message) }
  const now = Date.now()
  for (const cid of need) {
    const m = metas.get(cid)
    const ch = channels.get(cid)
    if (!m) { if (ch) ch.metaTriedAt = now; else channels.set(cid, { channelId: cid, title: catalogTitle(cid) ?? cid, createdAt: now, metaTriedAt: now }); continue }
    channels.set(cid, {
      ...ch, channelId: cid, title: m.title || ch?.title || catalogTitle(cid) || cid, handle: m.handle, thumb: m.thumb,
      descRaw: m.description, createdAt: ch?.createdAt ?? now, metaAt: now,
    })
  }
  save()
}

/** Metadata → descripción curada → playlists propias, de a un paso, en segundo plano (single-flight por canal). */
function enrichChannel(cid: string): void {
  if (inflight.has(cid) || !enrichmentNeeded(cid)) return
  const job = slot(async () => {
    await ensureMeta([cid])
    const ch = channels.get(cid)
    if (!ch?.metaAt) return // sin metadata no se cura (se reintenta pasado el enfriamiento)
    if (!ch.desc && !ch.descTriedAt) {
      ch.desc = await curarDescripcion(ch.title, ch.descRaw ?? '')
      ch.descTriedAt = Date.now()
      save()
    }
    if (syncsOwnPlaylists(cid) && !ch.playlistsAt && !fresh(ch.playlistsTriedAt)) await syncChannelPlaylists(cid)
  }).catch(e => console.error('[mytube] enriquecimiento de', cid, e)).finally(() => inflight.delete(cid))
  inflight.set(cid, job)
}

/* ---------- vistas del chico ---------- */
async function followedChannelCards() {
  const ids = space.followedIds().filter(hasContent)
  await ensureMeta(ids)
  return {
    channels: ids.slice().sort(cmpKey).map(cid => {
      const ch = channels.get(cid)
      return { channelId: cid, title: ch?.title || catalogTitle(cid) || cid, thumb: ch?.thumb || undefined, videos: channelRowCount(cid) }
    }),
  }
}

function channelDetail(cid: string) {
  const ch = channels.get(cid)
  const content = hasContent(cid)
  if (content) enrichChannel(cid)
  if (!ch && !content) return { channel: null, followed: false, total: 0, playlists: [], pending: false }
  return {
    channel: {
      channelId: cid, title: ch?.title || catalogTitle(cid) || cid,
      handle: ch?.handle || undefined, desc: ch?.desc || undefined, thumb: ch?.thumb || undefined,
    },
    followed: space.isFollowed(cid),
    total: channelVideos(cid).length,
    playlists: channelPlaylists(cid).map(p => ({ playlistId: p.playlistId, title: p.title })),
    pending: inflight.has(cid),
  }
}

/* ---------- panel del padre ---------- */
function adminState() {
  return {
    entries: store.entries.slice().sort((a, b) => a.id - b.id).map(e => ({
      id: e.id, type: e.type, url: e.url, title: e.title, videos: e.videoIds.length, channelId: e.channelId, createdAt: e.createdAt,
    })),
    total: catalogSize() + store.videos.length,
    videoCap: capSetting(),
  }
}

function adminChannels() {
  const ids = new Set<string>([...channels.keys(), ...allChannels().map(c => c.id), ...famByChannel.keys()])
  return {
    channels: [...ids].sort(cmpKey).map(cid => {
      const ch = channels.get(cid)
      // U4: el panel es de la familia → "lo sigue ALGÚN integrante" (cada uno sigue lo suyo en su MyTube)
      return { channelId: cid, title: ch?.title || catalogTitle(cid) || cid, handle: ch?.handle || undefined, thumb: ch?.thumb || undefined, desc: ch?.desc ?? '', followed: space.followedByAnyone(cid) }
    }),
  }
}

/* Las operaciones del padre corren de a una (en el POC las serializaba la propia pantalla). */
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn)
  queue = run.catch(() => undefined)
  return run
}
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e))

/* ---------- rutas ---------- */
export async function mytubeRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const path = url.pathname
  // Lado padre: TODO /api/mytube/admin/* pide la sesión del portón (deuda 14-oct; el cliente ya manda X-Parent-Token).
  if (path.startsWith('/api/mytube/admin/') && !hasParentSession(req)) return send(res, 401, { error: 'Solo para un adulto de la familia.' })
  const qid = (url.searchParams.get('id') ?? '').trim().slice(0, 80)
  if (req.method === 'GET') {
    if (path === '/api/mytube/channels') return send(res, 200, await followedChannelCards())
    if (path === '/api/mytube/channel') return send(res, 200, channelDetail(qid))
    if (path === '/api/mytube/channel/videos') {
      const all = channelVideos(qid)
      const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 40))
      return send(res, 200, { videos: all.slice(offset, offset + limit), total: all.length })
    }
    if (path === '/api/mytube/channel/playlist') {
      const pl = playlists.get(qid)
      return pl ? send(res, 200, { videos: playlistVideos(pl) }) : send(res, 404, { error: 'playlist' })
    }
    if (path === '/api/mytube/admin/state') return send(res, 200, adminState())
    if (path === '/api/mytube/admin/channels') return send(res, 200, adminChannels())
    if (path === '/api/mytube/admin/usage') return send(res, 200, usage)
    return send(res, 404, { error: 'not found' })
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method' })
  const b = await readJson<Record<string, unknown>>(req)
  const num = (k: string) => Number(b[k] ?? 0) || 0
  switch (path) {
    case '/api/mytube/admin/add':
      return send(res, 200, await serial(async () => {
        try { return { ok: true, ...(await addYtEntry(String(b.url ?? '').slice(0, 600))) } } catch (e) { return { ok: false, error: errText(e) } }
      }))
    case '/api/mytube/admin/reingest':
      return send(res, 200, await serial(async () => {
        try { return { ok: true, ...(await reingestYtEntry(num('id'))) } } catch (e) { return { ok: false, error: errText(e) } }
      }))
    case '/api/mytube/admin/remove':
      return send(res, 200, await serial(async () => { removeYtEntry(num('id')); return { ok: true } }))
    case '/api/mytube/admin/backfill':
      return send(res, 200, await serial(async () => {
        try { return { ok: true, ...(await backfillChannels()) } } catch (e) { return { ok: false, error: errText(e) } }
      }))
    case '/api/mytube/admin/dedup':
      return send(res, 200, await serial(async () => {
        try { return { ok: true, removed: dedupYtEntries() } } catch (e) { return { ok: false, error: errText(e) } }
      }))
    case '/api/mytube/admin/cap':
      return send(res, 200, await serial(async () => {
        store.videoCap = Number(b.cap) || 0 // «Guardar ajustes» del POC: vacío o no numérico = 0 = sin tope
        save()
        return { ok: true, videoCap: capSetting() }
      }))
    case '/api/mytube/admin/channel-desc':
      return send(res, 200, await serial(async () => {
        const cid = String(b.channelId ?? '').trim()
        if (!cid || (!channels.has(cid) && !hasContent(cid))) return { ok: false }
        const desc = String(b.desc ?? '').slice(0, 2000)
        const ch = channels.get(cid)
        if (ch) ch.desc = desc
        else channels.set(cid, { channelId: cid, title: catalogTitle(cid) ?? cid, desc, createdAt: Date.now() })
        save()
        return { ok: true }
      }))
  }
  return send(res, 404, { error: 'not found' })
}
