// Mi espacio: lo que el chico acumula — carpetas (Drive), listas de reproducción y canales seguidos.
// Port de smarty-poc (app/src/lib/drive.ts, listas.ts, mytube.ts) movido al servidor: el POC guardaba
// en IndexedDB del navegador; acá la verdad vive en server/data/space.json (gitignored, como todo data/).
// Reglas que se conservan del POC:
//   · Un video guardado o listado solo REFERENCIA un videoId del catálogo aprobado; al leer se
//     re-resuelve y se descarta lo des-aprobado o con palabra bloqueada (cero moderación nueva).
//   · Borrar manda a la PAPELERA (soft-delete restaurable); nada se pierde hasta "borrar definitivo".
//   · moveFolder rechaza ciclos (mover una carpeta dentro de sí misma o de un descendiente).
//   · Un artículo solo se puede guardar si su sitio está en la lista blanca (se re-modera al abrirlo).
//
// POR USUARIO desde U4 (docs/USUARIOS.md §10): cada integrante tiene SU Mi espacio (Drive, papelera, listas y canales
// seguidos). server/data/space.json v2 = { version: 2, seq, users: { [id]: { folders, items, playlists, follows } } }; `seq`
// es de la FAMILIA (A2: un id de carpeta, archivo o lista nunca significa dos cosas, así un dato viejo de otro integrante
// —la "última carpeta" de la hoja de guardar— simplemente no existe en tu espacio). Todas las funciones de siempre
// conservan su firma y operan sobre el espacio del USUARIO DEL PEDIDO (contexto de U3); allSavedForParent(member) es el
// acceso explícito de Familia (ahí el usuario del pedido es el ADULTO) y unfollowEverywhere/followedByAnyone recorren
// todos los espacios (lo usa la ingesta de YouTube de la familia: mytube.ts). El espacio de un usuario NACE al usarse,
// con sus canales seguidos de arranque (SPACE_SEEDS: A8 — antes se re-sembraban los 16 de demo en CADA arranque con la
// lista vacía). Un v1 (el archivo de antes: el espacio de Ian) migra en el acto a users.ian (userDataMigrate.ts, puro y
// testeado; con `follows` vacío, los 16 de demo UNA vez) y el texto original queda UNA vez en space.json.pre-v2 (un checkout
// viejo leería el v2 como vacío y lo reescribiría). Ilegible —o con una `version` desconocida (FS-BASE-B)— → copia .roto-<ms>
// y arranca vacío (antes el próximo guardado lo pisaba en silencio).
// FS-BASE-B (hallazgo space.ts:128): DISCO ANTES DE RESPONDER. Antes cada mutación cambiaba la RAM, la ruta respondía 200 y
// el archivo se escribía 250 ms después en un timer que solo logueaba la falla: un reinicio de tsx watch (cada edición del
// server) o un Ctrl+C en esa ventana perdía el cambio, y con el disco fallando el chico nunca se enteraba. Ahora cada
// mutación exportada corre en una TRANSACCIÓN (tx): adentro, persist() solo marca "hay cambios"; al terminar se escribe UNA
// vez (durable.ts: tmp + fsync + rename) y, si no se pudo, la RAM vuelve a la foto de antes y tira DiskWriteError (index.ts
// responde 500 "No pude guardar…"). Sin escrituras pendientes no hace falta flush al apagar (ni handler de SIGTERM, que con
// tsx watch obligaría a salir a mano). Lo que persiste FUERA de una ruta (el nacimiento de un espacio al leer, la mudanza de
// sueltos al arrancar, unfollowEverywhere de la ingesta de YouTube) escribe en el acto y, si falla, lo loguea y queda
// pendiente para la próxima escritura.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SERVER_ROOT } from './config'
import { DiskWriteError, backupBeforeMigrate, quarantine, writeFileAtomic } from './durable'
import { isObject } from './familyMigrate'
import { isAllowedArticleSite, matchBlockedWord } from './filters'
import { ensureMedals, registerMedalFacts, syncMedals } from './medals'
import { currentUser, runAsUser } from './requestContext'
import { upgradeSpaceRaw } from './userDataMigrate'
import { DEFAULT_USER_ID, userById, users } from './users'
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
/** El Mi espacio de UN usuario. */
interface UserSpace { folders: Folder[]; items: SavedItem[]; playlists: UserPlaylist[]; follows: string[] }
interface SpaceFile { version: 2; /** próximo id: ÚNICO EN LA FAMILIA (A2) */ seq: number; users: Record<string, UserSpace> }

/* Seed DEMO: canales que Ian ya sigue cuando su espacio nace (máquina nueva; ids del catálogo aprobado).
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
/* U4 (spec §1.1, D3 del dueño): con qué canales seguidos NACE el espacio de cada usuario (solo al crearlo: A8). Luna sigue
   8 de los 16 de demo (los "de grandes"); Andrés, 2. Sin entrada → ninguno. */
const SPACE_SEEDS: Record<string, { follows: readonly string[] }> = {
  ian: { follows: DEFAULT_FOLLOWS }, // solo si ian no tiene espacio (máquina nueva): lo de siempre
  luna: { follows: ['UCXtxgWwk55kVJo9lCCZRdmg', 'UCY1kMZp36IQSyNx_9h4mpCg', 'UCwmZiChSryoWQCZMIQezgTg',
                    'UCV5G678sZwW5IcF3pCfRbHQ', 'UCGQO3uUEXBLwDjNSlWFVMVQ', 'UCdwdFOhBP9CoAOlHDTmTxaw',
                    'UCrCVBjIyd3uJ6sEGHOOrBiw', 'UCUopTW1qNbr7F2ARwgOS1dw'] },
          // Veritasium · Mark Rober · BBC Earth · La Hiperactina · Khan Academy · Un Mundo Inmenso · Shackleton Kids · Educatutos
  andres: { follows: ['UCXtxgWwk55kVJo9lCCZRdmg', 'UCGQO3uUEXBLwDjNSlWFVMVQ'] }, // Veritasium · Khan Academy
}

/* ---------- persistencia (archivo único con TODOS los espacios; disco antes de responder: ver la cabecera) ---------- */
const FILE = join(SERVER_ROOT, 'data', 'space.json')
/** Tira si falla (durable.ts). */
const writeNow = (f: SpaceFile): void => writeFileAtomic(FILE, JSON.stringify(f))
/** Una lista del archivo: si no es un array, [] con aviso (v2 editado a mano). */
function listOf<T>(v: unknown, what: string, id: string): T[] {
  if (Array.isArray(v)) return v as T[]
  if (v !== undefined) console.warn(`[space] space.json: «${what}» de «${id}» no es una lista; arranco con []`)
  return []
}
function load(): SpaceFile {
  const empty = (): SpaceFile => ({ version: 2, seq: 1, users: {} })
  if (!existsSync(FILE)) return empty() // los espacios nacen al usarse
  let text: string
  let up: ReturnType<typeof upgradeSpaceRaw>
  try {
    text = readFileSync(FILE, 'utf8')
    up = upgradeSpaceRaw(JSON.parse(text), DEFAULT_USER_ID, DEFAULT_FOLLOWS)
  } catch (e) {
    console.warn('[space] space.json ilegible, arranco vacío (copia en .roto-*):', e)
    quarantine(FILE, 'space') // sin copia: seguimos igual
    return empty()
  }
  const spaces: Record<string, UserSpace> = {}
  for (const [id, raw] of Object.entries(up.raw.users)) {
    if (!isObject(raw)) { console.warn(`[space] space.json: el espacio de «${id}» no es un objeto; lo descarto (nace de nuevo al usarse)`); continue }
    spaces[id] = {
      folders: listOf<Folder>(raw.folders, 'folders', id), items: listOf<SavedItem>(raw.items, 'items', id),
      playlists: listOf<UserPlaylist>(raw.playlists, 'playlists', id), follows: listOf<string>(raw.follows, 'follows', id),
    }
  }
  // seq de la FAMILIA: nunca por debajo del máximo id de TODOS los espacios (A2; un v2 editado a mano no reusa ids)
  let maxId = 0
  for (const u of Object.values(spaces)) for (const x of [...u.folders, ...u.items, ...u.playlists]) if (typeof x?.id === 'number') maxId = Math.max(maxId, x.id)
  const file: SpaceFile = { version: 2, seq: Math.max(Number(up.raw.seq) > 0 ? Number(up.raw.seq) : 1, maxId + 1), users: spaces }
  if (up.from === 1) {
    // v1 → v2: lo de antes era el espacio de Ian. Respaldo LITERAL (durable.ts: si ya hay un .pre-v2 con OTRO contenido, va
    // a .pre-v2-<ms>). La migración no pierde nada (todo pasa a ian), así que sigue aunque el respaldo falle.
    backupBeforeMigrate(FILE, '.pre-v2', text, 'space')
    try { writeNow(file) } catch (e) { console.error('[space] no pude escribir space.json v2:', e) }
    const ian = file.users[DEFAULT_USER_ID]
    console.log(`[space] space.json v1 → v2: el espacio de «${DEFAULT_USER_ID}» (${ian?.folders.length ?? 0} carpetas, ${ian?.items.length ?? 0} archivos, ${ian?.playlists.length ?? 0} listas, ${ian?.follows.length ?? 0} seguidos; respaldo en space.json.pre-v2)`)
  }
  return file
}
const file: SpaceFile = load()

/** Profundidad de la transacción en curso (0 = fuera de una mutación de ruta) y si hay cambios sin escribir. */
let txDepth = 0
let dirty = false
/** Escribe si hay cambios pendientes; tira DiskWriteError si no se pudo (y quedan pendientes). */
function flush(): void {
  if (!dirty) return
  try { writeNow(file) } catch (e) { throw new DiskWriteError(FILE, e) }
  dirty = false
}
function persist() {
  dirty = true
  if (txDepth > 0) return // dentro de una mutación: se escribe UNA vez al final (tx)
  try { flush() } catch (e) { console.error('[space] no pude guardar space.json (queda pendiente para la próxima escritura):', e) }
}
/** Una mutación de Mi espacio, DISCO ANTES DE RESPONDER (ver la cabecera): corre `fn`, escribe una vez y, si no se pudo,
 *  devuelve la RAM a la foto de antes y tira DiskWriteError. Anidada, se suma a la de afuera. */
function tx<T>(fn: () => T): T {
  if (txDepth > 0) return fn()
  const before = structuredClone({ seq: file.seq, users: file.users }), wasDirty = dirty
  const restore = () => { file.seq = before.seq; file.users = before.users; dirty = wasDirty }
  txDepth = 1
  let out: T
  try { out = fn() } catch (e) { txDepth = 0; restore(); throw e }
  txDepth = 0
  try { flush() } catch (e) { restore(); console.error('[space] no pude guardar space.json: el cambio NO rige', e); throw e }
  return out
}
// Todo lo que sigue va DESPUÉS de persist()/tx(): `let txDepth` es TDZ y lo que corre al cargar el módulo (el nacimiento de
// un espacio, la mudanza de sueltos) persiste.

/** El espacio de un usuario; si todavía no existe, NACE con sus canales de arranque (A8) y se guarda. */
function spaceOf(id: string): UserSpace {
  let s = file.users[id]
  if (!s) {
    s = { folders: [], items: [], playlists: [], follows: [...(SPACE_SEEDS[id]?.follows ?? [])] }
    file.users[id] = s
    persist()
    console.log(`[space] nace el espacio de «${id}» (${s.follows.length} canales seguidos de arranque)`)
  }
  return s
}
/** El espacio del USUARIO DEL PEDIDO (fuera de un pedido, el de ian). */
const sp = (): UserSpace => spaceOf(currentUser()?.id ?? DEFAULT_USER_ID)
const nextId = () => { const id = file.seq++; persist(); return id }

/* Lógica tipo Windows/nube (pedido de Esteban, 8-oct-2026): en la RAÍZ viven solo CARPETAS;
   los archivos siempre están adentro de una. "General" es la carpeta por defecto cuando algo
   no tiene destino (guardados sin carpeta elegida, restauraciones cuya carpeta ya no existe). Una por espacio. */
function ensureGeneral(s: UserSpace): number {
  const g = s.folders.find(f => !f.trashedAt && f.parentId === ROOT && f.name === 'General')
  if (g) return g.id
  const f = { id: nextId(), name: 'General', parentId: ROOT, createdAt: Date.now() }
  s.folders.push(f); persist()
  return f.id
}
// Migración al arrancar, POR ESPACIO: lo que quedó suelto en la raíz se muda a "General".
for (const [id, s] of Object.entries(file.users)) {
  const sueltos = s.items.filter(i => !i.trashedAt && (i.folderId || ROOT) === ROOT)
  if (sueltos.length) {
    const g = ensureGeneral(s)
    for (const i of sueltos) i.folderId = g
    persist()
    console.log(`[space] ${id}: ${sueltos.length} archivo(s) sueltos en la raíz → carpeta "General"`)
  }
}

/* ---------- helpers puros (port de drive.ts) ---------- */
const liveFolders = (s: UserSpace) => s.folders.filter(f => !f.trashedAt)

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

/** Las imágenes que se pueden guardar y mostrar: las de Buscar → Imágenes (images.ts: Pixabay con safesearch y Wikimedia
 *  Commons con moderación visual). Cualquier otra URL https nunca pasó por la moderación. */
const IMAGE_HOSTS = ['pixabay.com', 'upload.wikimedia.org']
const isApprovedImage = (url: string) => {
  try { const u = new URL(url); return u.protocol === 'https:' && IMAGE_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h)) } catch { return false }
}
/** Un ítem es visible si su contenido sigue aprobado HOY, con la política vigente del pedido (la del chico: U3). Videos:
 *  re-chequeo contra catálogo + palabras (como siempre). FS-BASE-A (faltante 3 del workflow base-review-2: lo persistido
 *  que NO es video se mostraba con el título que mandó el cliente al guardar, sin re-moderar): artículos → su sitio sigue en
 *  la lista blanca y el título pasa las palabras; imágenes → de un origen aprobado y el epígrafe pasa las palabras.
 *  Fail-closed: lo que hoy no pasa no se muestra (queda guardado; vuelve si la familia saca la palabra o el sitio vuelve). */
function visible(i: SavedItem): boolean {
  if (i.target.type === 'video') {
    const v = getCatalogVideo(i.target.id)
    return !!v && matchBlockedWord(v.title) === null
  }
  if (matchBlockedWord(i.title ?? '') !== null) return false
  return i.target.type === 'article' ? isAllowedArticleSite(i.target.url) : isApprovedImage(i.target.url)
}

const itemCard = (i: SavedItem) => ({ id: i.id, type: i.type, title: i.title, img: i.img, subtitle: i.subtitle, target: i.target, createdAt: i.createdAt })
function folderCard(s: UserSpace, f: Folder) {
  const live = liveFolders(s)
  const count = live.filter(x => x.parentId === f.id).length + s.items.filter(i => !i.trashedAt && (i.folderId || ROOT) === f.id && visible(i)).length
  return { id: f.id, name: f.name, parentId: f.parentId, count }
}

/* ---------- Drive: vistas ---------- */
export function driveView(folderId: number) {
  const s = sp()
  const live = liveFolders(s)
  const exists = folderId === ROOT || live.some(f => f.id === folderId)
  const at = exists ? folderId : ROOT
  return {
    path: pathOf(live, at).map(f => ({ id: f.id, name: f.name })),
    folders: live.filter(f => (f.parentId || ROOT) === at).sort((a, b) => a.name.localeCompare(b.name)).map(f => folderCard(s, f)),
    items: s.items.filter(i => !i.trashedAt && (i.folderId || ROOT) === at && visible(i)).sort((a, b) => b.createdAt - a.createdAt).map(itemCard),
  }
}

/** Árbol plano de carpetas vivas (para el selector "Guardar en…" / "Mover a…"). */
export function folderTree() {
  return { folders: liveFolders(sp()).sort((a, b) => a.name.localeCompare(b.name)).map(f => ({ id: f.id, name: f.name, parentId: f.parentId })) }
}

/** Familia → Actividad (SOLO LECTURA, tanda 4): todo lo guardado que el integrante `member` ve hoy (sin papelera y con la
 *  misma re-moderación que el Drive), del más nuevo al más viejo, con la RUTA de su carpeta
 *  ("Dinos", "General", "Dinos / Fósiles"): lo que DRIVE.md de la POC pedía mostrarle al padre. U4: acceso EXPLÍCITO (el
 *  usuario del pedido es el adulto); no hace nacer el espacio del integrante (sin espacio → nada guardado).
 *  FS-BASE-A (hallazgos space.ts:243 / parent.ts:884): la re-moderación corre COMO el integrante (runAsUser): con la
 *  política del ADULTO del pedido —solo fábrica— Actividad listaba lo que el Drive del chico ya escondía por una palabra o un
 *  tema negro de su familia. */
export function allSavedForParent(member: string): { title: string; type: SavedItem['type']; folder: string; createdAt: number }[] {
  const s = file.users[member]
  if (!s) return []
  const live = liveFolders(s)
  const list = () => s.items
    .filter(i => !i.trashedAt && visible(i))
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(i => ({ title: i.title, type: i.type, folder: pathOf(live, i.folderId || ROOT).map(f => f.name).join(' / ') || '—', createdAt: i.createdAt }))
  return userById(member) ? runAsUser(member, list) : list()
}

/** FS-BASE-A (hallazgo index.ts:212): las operaciones del Drive sobre UNA carpeta o UN archivo (POST /api/space/drive/…)
 *  exigen un id entero POSITIVO: antes un id ausente, 0 o no numérico se volvía 0 = la RAÍZ, y «borrar definitivo» de la
 *  carpeta 0 se llevaba TODO el Mi espacio del usuario (descendantIds de la raíz = el árbol entero). Mover una carpeta acepta
 *  la raíz (0) como destino, nunca un número negativo o roto. null = válido; si no, el motivo del 400. */
const SPACE_ID_OPS = new Set(['/api/space/drive/folder/update', '/api/space/drive/folder/move', '/api/space/drive/folder/trash',
  '/api/space/drive/item/move', '/api/space/drive/item/trash', '/api/space/drive/restore', '/api/space/drive/purge'])
const intOf = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,15}$/.test(v.trim()) ? Number(v) : NaN)
export function spaceIdError(pathname: string, b: Record<string, unknown>): string | null {
  if (!SPACE_ID_OPS.has(pathname)) return null
  const id = intOf(b?.id)
  if (!Number.isSafeInteger(id) || id <= 0) return 'Falta la carpeta o el archivo (id entero positivo).'
  if (pathname === '/api/space/drive/folder/move' && b.parentId !== undefined) {
    const p = intOf(b.parentId)
    if (!Number.isSafeInteger(p) || p < 0) return 'El destino tiene que ser una carpeta (id entero, 0 = la raíz).'
  }
  return null // (mover un archivo a la raíz ya responde {ok:false} en moveItem: se deja igual)
}

/* ---------- Drive: escritura ---------- */
export function createFolder(name: string, parentId: number, color?: string, emoji?: string) {
  return tx(() => {
    const s = sp()
    const f: Folder = { id: nextId(), name: name.trim().slice(0, 40) || 'Carpeta', parentId: parentId || ROOT, color, emoji, createdAt: Date.now() }
    s.folders.push(f); persist()
    return folderCard(s, f)
  })
}

export function updateFolder(id: number, patch: { name?: string; color?: string; emoji?: string }): boolean {
  return tx(() => {
    const f = sp().folders.find(x => x.id === id && !x.trashedAt)
    if (!f) return false
    if (patch.name !== undefined) f.name = patch.name.trim().slice(0, 40) || 'Carpeta'
    if (patch.color !== undefined) f.color = patch.color
    if (patch.emoji !== undefined) f.emoji = patch.emoji
    persist(); return true
  })
}

/** Mueve una carpeta; rechaza no-op y ciclos (port 1:1 del guard del POC). */
export function moveFolder(id: number, newParentId: number): boolean {
  return tx(() => {
    if (newParentId === id) return false
    const byId = new Map(sp().folders.map(f => [f.id, f]))
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
  })
}

export function moveItem(id: number, folderId: number): boolean {
  return tx(() => {
    const s = sp()
    const it = s.items.find(x => x.id === id)
    if (!it) return false
    // Un archivo nunca va a la raíz: el destino tiene que ser una carpeta viva.
    if (!folderId || !liveFolders(s).some(f => f.id === folderId)) return false
    it.folderId = folderId; persist(); return true
  })
}

/* ---------- papelera ---------- */
export function trashFolder(id: number) {
  return tx(() => {
    const s = sp()
    const ids = descendantIds(s.folders, id)
    const at = Date.now()
    for (const f of s.folders) if (ids.has(f.id)) f.trashedAt = at
    for (const i of s.items) if (ids.has(i.folderId || ROOT)) i.trashedAt = at
    persist()
  })
}
export function trashItem(id: number) {
  return tx(() => {
    const it = sp().items.find(x => x.id === id)
    if (it) { it.trashedAt = Date.now(); persist() }
  })
}

/** Lo que se ve EN la papelera: borrados de nivel superior (el subárbol vuelve con su carpeta). */
export function trashView() {
  const s = sp()
  const enPapelera = new Set(s.folders.filter(f => f.trashedAt).map(f => f.id))
  return {
    folders: s.folders.filter(f => f.trashedAt && !enPapelera.has(f.parentId)).map(f => ({ id: f.id, name: f.name })),
    items: s.items.filter(i => i.trashedAt && !enPapelera.has(i.folderId || ROOT) && visible(i)).map(itemCard),
  }
}

export function restoreFolder(id: number) {
  return tx(() => {
    const s = sp()
    const ids = descendantIds(s.folders, id)
    for (const f of s.folders) if (ids.has(f.id)) delete f.trashedAt
    for (const i of s.items) if (ids.has(i.folderId || ROOT)) delete i.trashedAt
    const f = s.folders.find(x => x.id === id)
    // Si el padre original ya no existe o sigue en la papelera, vuelve a la raíz (no queda huérfana).
    const padreVivo = !f || (f.parentId || ROOT) === ROOT || s.folders.some(x => x.id === f.parentId && !x.trashedAt)
    if (f && !padreVivo) f.parentId = ROOT
    persist()
  })
}
export function restoreItem(id: number) {
  return tx(() => {
    const s = sp()
    const it = s.items.find(x => x.id === id)
    if (!it) return
    delete it.trashedAt
    const f = s.folders.find(x => x.id === it.folderId)
    // Si su carpeta ya no existe, vuelve a "General" (en la raíz solo viven carpetas).
    if (!f || f.trashedAt) it.folderId = ensureGeneral(s)
    persist()
  })
}
/** Borrado DEFINITIVO de una carpeta (y su subárbol). FS-BASE-A: solo de una carpeta que ESTÁ en la papelera —regla 6 de
 *  AGENTS: nada se borra de verdad sin pasar por la papelera— y nunca de la raíz (index.ts ya responde 400 a un id ≤ 0).
 *  Devuelve si borró algo. */
export function purgeFolder(id: number): boolean {
  return tx(() => {
    const s = sp()
    if (!id || id === ROOT || !s.folders.some(f => f.id === id && f.trashedAt)) return false
    const ids = descendantIds(s.folders, id)
    s.items = s.items.filter(i => !ids.has(i.folderId || ROOT))
    s.folders = s.folders.filter(f => !ids.has(f.id))
    persist()
    return true
  })
}
/** Borrado DEFINITIVO de un archivo: FS-BASE-A, solo si está en la papelera. Devuelve si borró algo. */
export function purgeItem(id: number): boolean {
  return tx(() => {
    const s = sp()
    if (!s.items.some(i => i.id === id && i.trashedAt)) return false
    s.items = s.items.filter(i => i.id !== id)
    persist()
    return true
  })
}

/* ---------- guardar (los 3 tipos; valida contra las listas blancas) ---------- */
export type SavePayload = {
  folderId?: number
  video?: { id: string }
  article?: { url: string; title: string; source?: string }
  image?: { url: string; caption?: string; source?: string }
}
export function saveItem(p: SavePayload): { item?: ReturnType<typeof itemCard>; existed?: boolean; error?: string } {
  // U5-B: el slice de medallas existe ANTES del guardado nuevo (si naciera después, entraría al seed como "ya visto").
  const uid = currentUser()?.id ?? DEFAULT_USER_ID
  ensureMedals(uid)
  // FS-BASE-B: todo en una transacción (disco antes de responder) y la medalla DESPUÉS de escribir: si no se guardó, no hay
  // «Tu primer guardado» de algo que no está.
  const r = tx(() => saveItemTx(p))
  if (r.item && !r.existed && !r.error) syncMedals(uid) // U5-B: «Tu primer guardado» (y su noticia en SU feed)
  return r
}
function saveItemTx(p: SavePayload): { item?: ReturnType<typeof itemCard>; existed?: boolean; error?: string } {
  // Los archivos nunca quedan en la raíz: sin carpeta válida, van a "General".
  const s = sp()
  const folderId = p.folderId && liveFolders(s).some(f => f.id === p.folderId) ? p.folderId : ensureGeneral(s)
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
    // FS-BASE-A: solo imágenes de Buscar (orígenes moderados); una URL cualquiera nunca pasó por la moderación
    if (!isApprovedImage(url)) return { error: 'Imagen fuera de los orígenes aprobados' }
    it = { id: 0, type: 'imagen', title: String(p.image.caption || 'Imagen').slice(0, 200), img: url, subtitle: p.image.source?.slice(0, 80), target: { type: 'image', url }, folderId, createdAt: Date.now() }
  }
  // FS-BASE-A: el título que manda el cliente (artículo, epígrafe) pasa las palabras de la política vigente, como el de un video
  if (it && it.type !== 'video' && matchBlockedWord(it.title) !== null) return { error: 'No se puede guardar: tiene una palabra bloqueada' }
  if (!it) return { error: 'Nada para guardar' }
  const key = JSON.stringify(it.target)
  const prev = s.items.find(x => !x.trashedAt && JSON.stringify(x.target) === key && (x.folderId || ROOT) === folderId)
  if (prev) return { item: itemCard(prev), existed: true }
  it.id = nextId()
  s.items.push(it); persist()
  return { item: itemCard(it) }
}

/** U5-B (hecho de la medalla «Tu primer guardado»): cuánto guardó `id` en su Mi espacio —papelera INCLUIDA: mandar a la
 *  papelera no deshace el guardado; lo PURGADO ya no existe— y cuándo fue lo más viejo. Acceso explícito; no hace nacer el
 *  espacio (sin espacio → nada guardado). */
export function savedFactsOf(id: string): { savedEver: number; firstSavedAt: number | null } {
  const s = file.users[id]
  if (!s || !s.items.length) return { savedEver: 0, firstSavedAt: null }
  let first = Infinity
  for (const i of s.items) if (typeof i.createdAt === 'number' && i.createdAt < first) first = i.createdAt
  return { savedEver: s.items.length, firstSavedAt: Number.isFinite(first) ? first : null }
}
registerMedalFacts((id) => savedFactsOf(id), 'Mi espacio')

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
/** Las listas, las más nuevas primero (el orderBy('createdAt').reverse() del ListPicker del POC). Con `videoId` (GET
 *  /api/space/playlists?video=<id>, deuda 14-oct), cada una dice además si YA lo contiene (`has`: el
 *  `l.videoIds.includes(videoId)` del POC, sobre los ids guardados) — la hoja «＋ Lista» la marca con ✓. */
export const playlists = (videoId?: string | null) => ({
  playlists: sp().playlists.slice().sort((a, b) => b.createdAt - a.createdAt)
    .map(l => (videoId ? { ...playlistCard(l), has: l.videoIds.includes(videoId) } : playlistCard(l))),
})
export function playlistDetail(id: number) {
  const l = sp().playlists.find(x => x.id === id)
  if (!l) return null
  return { id: l.id, name: l.name, videos: resolveList(l).map(toVideoResult) }
}
export function createPlaylist(name: string, videoId?: string) {
  return tx(() => {
    const l: UserPlaylist = { id: nextId(), name: name.trim().slice(0, 60) || 'Mi lista', videoIds: [], createdAt: Date.now() }
    if (videoId && getCatalogVideo(videoId)) l.videoIds.push(videoId)
    sp().playlists.push(l); persist()
    return playlistCard(l)
  })
}
export function renamePlaylist(id: number, name: string): boolean {
  return tx(() => {
    const l = sp().playlists.find(x => x.id === id)
    if (!l) return false
    l.name = name.trim().slice(0, 60) || 'Mi lista'; l.updatedAt = Date.now(); persist(); return true
  })
}
export function deletePlaylist(id: number) {
  return tx(() => {
    const s = sp()
    s.playlists = s.playlists.filter(x => x.id !== id); persist()
  })
}
export function playlistAdd(id: number, videoId: string): { ok: boolean; count?: number; existed?: boolean } {
  return tx(() => {
    const l = sp().playlists.find(x => x.id === id)
    if (!l || !getCatalogVideo(videoId)) return { ok: false }
    if (l.videoIds.includes(videoId)) return { ok: true, existed: true, count: resolveList(l).length }
    l.videoIds.push(videoId); l.updatedAt = Date.now(); persist()
    return { ok: true, count: resolveList(l).length }
  })
}
export function playlistRemove(id: number, videoId: string): boolean {
  return tx(() => {
    const l = sp().playlists.find(x => x.id === id)
    if (!l) return false
    l.videoIds = l.videoIds.filter(v => v !== videoId); l.updatedAt = Date.now(); persist(); return true
  })
}
/** Intercambia dos videoIds (reordenar ↑/↓ por id, no por índice visible: ver nota del POC). */
export function playlistSwap(id: number, a: string, b: string): boolean {
  return tx(() => {
    const l = sp().playlists.find(x => x.id === id)
    if (!l) return false
    const ia = l.videoIds.indexOf(a), ib = l.videoIds.indexOf(b)
    if (ia < 0 || ib < 0 || ia === ib) return false
    ;[l.videoIds[ia], l.videoIds[ib]] = [l.videoIds[ib], l.videoIds[ia]]
    l.updatedAt = Date.now(); persist(); return true
  })
}

/* ---------- canales seguidos (de cada usuario; el contenido viene del catálogo de la familia) ---------- */
export const isFollowed = (channelId: string) => sp().follows.includes(channelId)
export function toggleFollow(channelId: string, value?: boolean): boolean {
  return tx(() => {
    const s = sp()
    const on = value ?? !s.follows.includes(channelId)
    s.follows = s.follows.filter(c => c !== channelId)
    if (on) s.follows.push(channelId)
    persist()
    return on
  })
}
export const followedIds = () => sp().follows.slice()
/** U4 (mytube.ts: la familia borró el canal de su YouTube aprobado): lo saca de TODOS los espacios. Devuelve en cuántos
 *  estaba; persiste solo si tocó algo. */
export function unfollowEverywhere(channelId: string): number {
  let n = 0
  for (const s of Object.values(file.users)) {
    if (!s.follows.includes(channelId)) continue
    s.follows = s.follows.filter(c => c !== channelId)
    n++
  }
  if (n) persist()
  return n
}
/** U4 (Familia → YouTube: el panel es de la familia): ¿lo sigue ALGÚN integrante? (solo los usuarios del seed, y solo los
 *  espacios que ya nacieron). */
export const followedByAnyone = (channelId: string): boolean =>
  users().some(u => file.users[u.id]?.follows.includes(channelId) ?? false)
