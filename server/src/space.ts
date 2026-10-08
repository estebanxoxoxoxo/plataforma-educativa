// Mi espacio: lo que el chico acumula — carpetas (Drive), listas de reproducción y canales seguidos.
// Port de smarty-poc (app/src/lib/drive.ts, listas.ts, mytube.ts) movido al servidor: el POC guardaba
// en IndexedDB del navegador; acá la verdad vive en server/data/space.json (gitignored, como todo data/).
// Reglas que se conservan del POC:
//   · Un video guardado o listado solo REFERENCIA un videoId del catálogo aprobado; al leer se
//     re-resuelve y se descarta lo des-aprobado o con palabra bloqueada (cero moderación nueva).
//   · Borrar manda a la PAPELERA (soft-delete restaurable); nada se pierde hasta "borrar definitivo".
//   · moveFolder rechaza ciclos (mover una carpeta dentro de sí misma o de un descendiente).
//   · Un artículo solo se puede guardar si su sitio está en la lista blanca (se re-modera al abrirlo).
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SERVER_ROOT } from './config'
import { isAllowedArticleSite, matchBlockedWord } from './filters'
import { getCatalogVideo, toVideoResult, type CatalogVideo } from './videos'

export const ROOT = 0

/* Las carpetas se ven TODAS iguales (ícono único estilo Windows, pedido de Esteban 8-oct-2026);
   color/emoji quedan en el modelo como legado del POC pero la UI ya no los usa ni los setea. */
interface Folder { id: number; name: string; parentId: number; color?: string; emoji?: string; createdAt: number; trashedAt?: number }
type SavedTarget = { type: 'video'; id: string } | { type: 'article'; url: string } | { type: 'image'; url: string }
interface SavedItem {
  id: number; type: 'video' | 'articulo' | 'imagen'; title: string; img?: string; subtitle?: string
  target: SavedTarget; folderId: number; createdAt: number; trashedAt?: number
}
interface UserPlaylist { id: number; name: string; videoIds: string[]; createdAt: number; updatedAt?: number }
interface Store { seq: number; folders: Folder[]; items: SavedItem[]; playlists: UserPlaylist[]; follows: string[] }

/* ---------- persistencia (archivo único, escritura atómica con debounce) ---------- */
const FILE = join(SERVER_ROOT, 'data', 'space.json')
function load(): Store {
  try {
    if (existsSync(FILE)) {
      const raw = JSON.parse(readFileSync(FILE, 'utf8')) as Partial<Store>
      return { seq: raw.seq ?? 1, folders: raw.folders ?? [], items: raw.items ?? [], playlists: raw.playlists ?? [], follows: raw.follows ?? [] }
    }
  } catch (e) { console.warn('[space] space.json ilegible, arranco vacío:', e) }
  return { seq: 1, folders: [], items: [], playlists: [], follows: [] }
}
const store: Store = load()

/* Seed DEMO: canales que Ian ya sigue cuando el estado arranca vacío (ids del catálogo aprobado).
   Es estado inicial de demo, no lógica: en producción los follows nacen del uso del chico. */
const DEFAULT_FOLLOWS = [
  'UC-wz-hCfXLdZrfFMINaf_nA', // Mundo de las Aves
  'UCeTdhZLFZEfpHgJ-GAEV-WQ', // Aventuras con los Kratt - Scholastic
  'UCCZpm6436NiU__lcBAlEZmQ', // Smile and Learn - Español
  'UCsB1iUrIcnNZ9pUAHs3oArQ', // Cuby
  'UCrCVBjIyd3uJ6sEGHOOrBiw', // Shackleton Kids
  'UCZkAC7NHYrZUY7SjDIzhXLQ', // Wild Nature - Español
  'UCGQO3uUEXBLwDjNSlWFVMVQ', // KhanAcademyEspañol
  'UCanMxWvOoiwtjLYm08Bo8QQ', // Matemáticas profe Alex
  'UC_Myy53yTBO7ElRGg3eYLCA', // Susi Profe
  'UCXtxgWwk55kVJo9lCCZRdmg', // Veritasium en español
  'UCdwdFOhBP9CoAOlHDTmTxaw', // Un Mundo Inmenso
  'UCwmZiChSryoWQCZMIQezgTg', // BBC Earth
  'UCY1kMZp36IQSyNx_9h4mpCg', // Mark Rober
  'UCV5G678sZwW5IcF3pCfRbHQ', // La Hiperactina
  'UCmkgg5el8Fg3IX_baZyfSaQ', // Superbook
  'UCUopTW1qNbr7F2ARwgOS1dw', // Educatutos
]
if (!store.follows.length) { store.follows = DEFAULT_FOLLOWS.slice(); persist() }

let timer: ReturnType<typeof setTimeout> | null = null
function persist() {
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    try { writeFileSync(FILE + '.tmp', JSON.stringify(store)); renameSync(FILE + '.tmp', FILE) }
    catch (e) { console.error('[space] no pude guardar space.json:', e) }
  }, 250)
}
const nextId = () => { const id = store.seq++; persist(); return id }

/* Lógica tipo Windows/nube (pedido de Esteban, 8-oct-2026): en la RAÍZ viven solo CARPETAS;
   los archivos siempre están adentro de una. "General" es la carpeta por defecto cuando algo
   no tiene destino (guardados sin carpeta elegida, restauraciones cuya carpeta ya no existe). */
function ensureGeneral(): number {
  const g = store.folders.find(f => !f.trashedAt && f.parentId === ROOT && f.name === 'General')
  if (g) return g.id
  const f = { id: nextId(), name: 'General', parentId: ROOT, createdAt: Date.now() }
  store.folders.push(f); persist()
  return f.id
}
// Migración al arrancar: lo que quedó suelto en la raíz se muda a "General".
{
  const sueltos = store.items.filter(i => !i.trashedAt && (i.folderId || ROOT) === ROOT)
  if (sueltos.length) {
    const g = ensureGeneral()
    for (const i of sueltos) i.folderId = g
    persist()
    console.log(`[space] ${sueltos.length} archivo(s) sueltos en la raíz → carpeta "General"`)
  }
}

/* ---------- helpers puros (port de drive.ts) ---------- */
const liveFolders = () => store.folders.filter(f => !f.trashedAt)

/** Ruta raíz→carpeta para el breadcrumb (con corte anti-ciclo). */
function pathOf(folders: Folder[], folderId: number): Folder[] {
  const byId = new Map(folders.map(f => [f.id, f]))
  const path: Folder[] = []
  const seen = new Set<number>()
  let id = folderId
  while (id && id !== ROOT) {
    if (seen.has(id)) break
    seen.add(id)
    const f = byId.get(id)
    if (!f) break
    path.unshift(f)
    id = f.parentId || ROOT
  }
  return path
}

/** La carpeta `id` + todo su subárbol (para papelera y para vetar destinos al mover). */
function descendantIds(folders: Folder[], id: number): Set<number> {
  const childrenOf = new Map<number, number[]>()
  for (const f of folders) childrenOf.set(f.parentId, [...(childrenOf.get(f.parentId) ?? []), f.id])
  const out = new Set<number>([id])
  const stack = [id]
  while (stack.length) {
    for (const c of childrenOf.get(stack.pop()!) ?? []) if (!out.has(c)) { out.add(c); stack.push(c) }
  }
  return out
}

/** Un ítem es visible si su contenido sigue aprobado (videos: re-chequeo contra catálogo + palabras). */
function visible(i: SavedItem): boolean {
  if (i.target.type !== 'video') return true
  const v = getCatalogVideo(i.target.id)
  return !!v && matchBlockedWord(v.title) === null
}

const itemCard = (i: SavedItem) => ({ id: i.id, type: i.type, title: i.title, img: i.img, subtitle: i.subtitle, target: i.target, createdAt: i.createdAt })
function folderCard(f: Folder) {
  const live = liveFolders()
  const count = live.filter(x => x.parentId === f.id).length + store.items.filter(s => !s.trashedAt && (s.folderId || ROOT) === f.id && visible(s)).length
  return { id: f.id, name: f.name, parentId: f.parentId, count }
}

/* ---------- Drive: vistas ---------- */
export function driveView(folderId: number) {
  const live = liveFolders()
  const exists = folderId === ROOT || live.some(f => f.id === folderId)
  const at = exists ? folderId : ROOT
  return {
    path: pathOf(live, at).map(f => ({ id: f.id, name: f.name })),
    folders: live.filter(f => (f.parentId || ROOT) === at).sort((a, b) => a.name.localeCompare(b.name)).map(folderCard),
    items: store.items.filter(i => !i.trashedAt && (i.folderId || ROOT) === at && visible(i)).sort((a, b) => b.createdAt - a.createdAt).map(itemCard),
  }
}

/** Árbol plano de carpetas vivas (para el selector "Guardar en…" / "Mover a…"). */
export function folderTree() {
  return { folders: liveFolders().sort((a, b) => a.name.localeCompare(b.name)).map(f => ({ id: f.id, name: f.name, parentId: f.parentId })) }
}

/* ---------- Drive: escritura ---------- */
export function createFolder(name: string, parentId: number, color?: string, emoji?: string) {
  const f: Folder = { id: nextId(), name: name.trim().slice(0, 40) || 'Carpeta', parentId: parentId || ROOT, color, emoji, createdAt: Date.now() }
  store.folders.push(f); persist()
  return folderCard(f)
}

export function updateFolder(id: number, patch: { name?: string; color?: string; emoji?: string }): boolean {
  const f = store.folders.find(x => x.id === id && !x.trashedAt)
  if (!f) return false
  if (patch.name !== undefined) f.name = patch.name.trim().slice(0, 40) || 'Carpeta'
  if (patch.color !== undefined) f.color = patch.color
  if (patch.emoji !== undefined) f.emoji = patch.emoji
  persist(); return true
}

/** Mueve una carpeta; rechaza no-op y ciclos (port 1:1 del guard del POC). */
export function moveFolder(id: number, newParentId: number): boolean {
  if (newParentId === id) return false
  const byId = new Map(store.folders.map(f => [f.id, f]))
  if (!byId.has(id)) return false
  if ((byId.get(id)!.parentId || ROOT) === (newParentId || ROOT)) return false
  const seen = new Set<number>()
  let p = newParentId
  while (p && p !== ROOT) {
    if (p === id) return false // el destino cuelga de la carpeta → ciclo
    if (seen.has(p)) break
    seen.add(p)
    p = byId.get(p)?.parentId ?? ROOT
  }
  byId.get(id)!.parentId = newParentId || ROOT
  persist(); return true
}

export function moveItem(id: number, folderId: number): boolean {
  const it = store.items.find(x => x.id === id)
  if (!it) return false
  // Un archivo nunca va a la raíz: el destino tiene que ser una carpeta viva.
  if (!folderId || !liveFolders().some(f => f.id === folderId)) return false
  it.folderId = folderId; persist(); return true
}

/* ---------- papelera ---------- */
export function trashFolder(id: number) {
  const ids = descendantIds(store.folders, id)
  const at = Date.now()
  for (const f of store.folders) if (ids.has(f.id)) f.trashedAt = at
  for (const i of store.items) if (ids.has(i.folderId || ROOT)) i.trashedAt = at
  persist()
}
export function trashItem(id: number) {
  const it = store.items.find(x => x.id === id)
  if (it) { it.trashedAt = Date.now(); persist() }
}

/** Lo que se ve EN la papelera: borrados de nivel superior (el subárbol vuelve con su carpeta). */
export function trashView() {
  const enPapelera = new Set(store.folders.filter(f => f.trashedAt).map(f => f.id))
  return {
    folders: store.folders.filter(f => f.trashedAt && !enPapelera.has(f.parentId)).map(f => ({ id: f.id, name: f.name })),
    items: store.items.filter(i => i.trashedAt && !enPapelera.has(i.folderId || ROOT) && visible(i)).map(itemCard),
  }
}

export function restoreFolder(id: number) {
  const ids = descendantIds(store.folders, id)
  for (const f of store.folders) if (ids.has(f.id)) delete f.trashedAt
  for (const i of store.items) if (ids.has(i.folderId || ROOT)) delete i.trashedAt
  const f = store.folders.find(x => x.id === id)
  // Si el padre original ya no existe o sigue en la papelera, vuelve a la raíz (no queda huérfana).
  const padreVivo = !f || (f.parentId || ROOT) === ROOT || store.folders.some(x => x.id === f.parentId && !x.trashedAt)
  if (f && !padreVivo) f.parentId = ROOT
  persist()
}
export function restoreItem(id: number) {
  const it = store.items.find(x => x.id === id)
  if (!it) return
  delete it.trashedAt
  const f = store.folders.find(x => x.id === it.folderId)
  // Si su carpeta ya no existe, vuelve a "General" (en la raíz solo viven carpetas).
  if (!f || f.trashedAt) it.folderId = ensureGeneral()
  persist()
}
export function purgeFolder(id: number) {
  const ids = descendantIds(store.folders, id)
  store.items = store.items.filter(i => !ids.has(i.folderId || ROOT))
  store.folders = store.folders.filter(f => !ids.has(f.id))
  persist()
}
export function purgeItem(id: number) {
  store.items = store.items.filter(i => i.id !== id)
  persist()
}

/* ---------- guardar (los 3 tipos; valida contra las listas blancas) ---------- */
export type SavePayload = {
  folderId?: number
  video?: { id: string }
  article?: { url: string; title: string; source?: string }
  image?: { url: string; caption?: string; source?: string }
}
export function saveItem(p: SavePayload): { item?: ReturnType<typeof itemCard>; existed?: boolean; error?: string } {
  // Los archivos nunca quedan en la raíz: sin carpeta válida, van a "General".
  const folderId = p.folderId && liveFolders().some(f => f.id === p.folderId) ? p.folderId : ensureGeneral()
  let it: SavedItem | null = null
  if (p.video?.id) {
    const v = getCatalogVideo(p.video.id)
    if (!v || matchBlockedWord(v.title) !== null) return { error: 'Video no aprobado' }
    it = { id: 0, type: 'video', title: v.title, img: v.thumb || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`, subtitle: v.channelTitle || v.source, target: { type: 'video', id: v.videoId }, folderId, createdAt: Date.now() }
  } else if (p.article?.url) {
    const url = String(p.article.url).slice(0, 600)
    if (!isAllowedArticleSite(url)) return { error: 'Sitio fuera de la lista blanca' }
    it = { id: 0, type: 'articulo', title: String(p.article.title || url).slice(0, 200), subtitle: p.article.source?.slice(0, 80), target: { type: 'article', url }, folderId, createdAt: Date.now() }
  } else if (p.image?.url) {
    const url = String(p.image.url).slice(0, 600)
    if (!/^https:\/\//.test(url)) return { error: 'URL de imagen inválida' }
    it = { id: 0, type: 'imagen', title: String(p.image.caption || 'Imagen').slice(0, 200), img: url, subtitle: p.image.source?.slice(0, 80), target: { type: 'image', url }, folderId, createdAt: Date.now() }
  }
  if (!it) return { error: 'Nada para guardar' }
  const key = JSON.stringify(it.target)
  const prev = store.items.find(x => !x.trashedAt && JSON.stringify(x.target) === key && (x.folderId || ROOT) === folderId)
  if (prev) return { item: itemCard(prev), existed: true }
  it.id = nextId()
  store.items.push(it); persist()
  return { item: itemCard(it) }
}

/* ---------- listas de reproducción (port de listas.ts) ---------- */
function playlistCard(l: UserPlaylist) {
  const first = l.videoIds.map(getCatalogVideo).find(v => v && matchBlockedWord(v.title) === null)
  return { id: l.id, name: l.name, count: resolveList(l).length, cover: first ? first.thumb || `https://i.ytimg.com/vi/${first.videoId}/mqdefault.jpg` : undefined }
}
/** Resuelve en el ORDEN de la lista, dedup, descartando des-aprobados o bloqueados. */
function resolveList(l: UserPlaylist) {
  const seen = new Set<string>()
  const out: CatalogVideo[] = []
  for (const vid of l.videoIds) {
    if (seen.has(vid)) continue
    seen.add(vid)
    const v = getCatalogVideo(vid)
    if (v && matchBlockedWord(v.title) === null) out.push(v)
  }
  return out
}
export const playlists = () => ({ playlists: store.playlists.slice().sort((a, b) => b.createdAt - a.createdAt).map(playlistCard) })
export function playlistDetail(id: number) {
  const l = store.playlists.find(x => x.id === id)
  if (!l) return null
  return { id: l.id, name: l.name, videos: resolveList(l).map(toVideoResult) }
}
export function createPlaylist(name: string, videoId?: string) {
  const l: UserPlaylist = { id: nextId(), name: name.trim().slice(0, 60) || 'Mi lista', videoIds: [], createdAt: Date.now() }
  if (videoId && getCatalogVideo(videoId)) l.videoIds.push(videoId)
  store.playlists.push(l); persist()
  return playlistCard(l)
}
export function renamePlaylist(id: number, name: string): boolean {
  const l = store.playlists.find(x => x.id === id)
  if (!l) return false
  l.name = name.trim().slice(0, 60) || 'Mi lista'; l.updatedAt = Date.now(); persist(); return true
}
export function deletePlaylist(id: number) {
  store.playlists = store.playlists.filter(x => x.id !== id); persist()
}
export function playlistAdd(id: number, videoId: string): { ok: boolean; count?: number; existed?: boolean } {
  const l = store.playlists.find(x => x.id === id)
  if (!l || !getCatalogVideo(videoId)) return { ok: false }
  if (l.videoIds.includes(videoId)) return { ok: true, existed: true, count: resolveList(l).length }
  l.videoIds.push(videoId); l.updatedAt = Date.now(); persist()
  return { ok: true, count: resolveList(l).length }
}
export function playlistRemove(id: number, videoId: string): boolean {
  const l = store.playlists.find(x => x.id === id)
  if (!l) return false
  l.videoIds = l.videoIds.filter(v => v !== videoId); l.updatedAt = Date.now(); persist(); return true
}
/** Intercambia dos videoIds (reordenar ↑/↓ por id, no por índice visible: ver nota del POC). */
export function playlistSwap(id: number, a: string, b: string): boolean {
  const l = store.playlists.find(x => x.id === id)
  if (!l) return false
  const ia = l.videoIds.indexOf(a), ib = l.videoIds.indexOf(b)
  if (ia < 0 || ib < 0 || ia === ib) return false
  ;[l.videoIds[ia], l.videoIds[ib]] = [l.videoIds[ib], l.videoIds[ia]]
  l.updatedAt = Date.now(); persist(); return true
}

/* ---------- canales seguidos (estado del niño; el contenido viene del catálogo) ---------- */
export const isFollowed = (channelId: string) => store.follows.includes(channelId)
export function toggleFollow(channelId: string, value?: boolean): boolean {
  const on = value ?? !store.follows.includes(channelId)
  store.follows = store.follows.filter(c => c !== channelId)
  if (on) store.follows.push(channelId)
  persist()
  return on
}
export const followedIds = () => store.follows.slice()
