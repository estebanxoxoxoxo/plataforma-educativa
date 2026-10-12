// Porte Smarty · Rutas de Learn — el CATÁLOGO del server (tanda W1; reemplaza el stub del coordinador).
// Lo que el POC guarda en Dexie `learnRoutes` + `learnDefinitions` (smarty-poc app/src/db.ts v16, importador
// app/src/learn/import.ts) vive acá: desvío forzado (b) del mapa §4 (IndexedDB → server) con las MISMAS formas y la misma
// semántica de persistencia:
//   fila de ruta = { id, enabled: true (forzado en cada import), origin: 'generated', importedAt, route, meta?, editorial? }
//   fila de def. = { id (= def.id: clave GLOBAL, como la PK de Dexie), routeId (dueño: borrado en cascada), target, importedAt, def }
// `route`, `def`, `meta` y `editorial` se guardan OPACOS (tal cual llegan), como en Dexie.
// PERSISTE (regla 9 de docs/AGENTS.md: es CATÁLOGO, NO entra en /api/demo/reset) en server/data/learn-routes.json, escritura
// atómica tmp+rename. El import arma el estado nuevo completo y recién lo publica en RAM si quedó escrito en disco: es el
// reemplazo TRANSACCIONAL por routeId del POC (borra las definiciones de esa ruta, pisa la fila entera, pone las nuevas).
//
//   GET  /api/learn-routes          → { routes: LearnRouteListItem[] }  en el orden de la clave (el toArray() de Dexie).
//        ADITIVO: cada item suma `modules` (cuántos módulos tiene): /crear lista para editar SOLO las rutas con módulos (las
//        del pipeline viejo /routes, como la seed poc-solar, no se pueden editar), igual que el filtro del POC.
//   GET  /api/learn-routes/one?id=  → { route, definitions, editorial? }  · 404 { error: 'No encontré esa ruta.' }
//        ADITIVO: `editorial` (opaco: { modules: { [moduleId]: { captionKind?, jobId?, inventory? } } }, con el inventario de
//        facts y sus auditorías) — lo necesita la reapertura en /crear (unflatten del POC).
//   POST /api/learn-routes/import { bundle } → ImportBundleResult
//        200 { ok: true, routeId, + ADITIVO title, definitions, postas } = el ImportResult del POC (lo usa el "✓ Guardada «T» …")
//        200 { ok: false, error } con el texto EXACTO del importador del POC cuando el bundle no pasa (el cliente http()
//        descarta el cuerpo de un 4xx: la vista necesita el motivo). 500 { ok: false, error } si no se pudo escribir.
//        El bundle puede traer además `meta` y `editorial` (ADITIVOS al RouteBundle de types.ts): se guardan opacos.
//   POST /api/learn-routes/delete { id } → { ok: true }  ruta + sus definiciones; los resultados (cuando existan) QUEDAN.
//   GET  /api/learn-routes/definitions → { definitions: DefinitionRecipe[] }  (tanda W3) TODAS las definiciones del
//        catálogo (el `def` opaco de cada fila, en orden de clave) en un solo viaje: es la hidratación del motor del
//        cliente al entrar a Learn — el hydrateImportedDefinitions() del POC (db.learnDefinitions.toArray() →
//        registerImportedDefinitions(rows.map(r => r.def))).
//   Para los módulos del server (economía y feed fake de Learn, W3): catalogRoutes() / routeTitle().
//
// Validación = la del importador del POC, en su orden y con sus mensajes: kind · schemaVersion 1 · route (id + postas[]) ·
// definitions[] · integridad referencial (toda posta que no es recall y tiene definitionId apunta a una definición del
// bundle; el POC no cruza targets) · y, del ACUÑADO SECO, lo que no necesita el motor: el Tipo existe en el registry (los 5:
// domino, quiz, flashcards, multiplechoice, multi) y el generador existe para ese Tipo (multi: sus childIds), con los mismos
// mensajes que tira el registry del POC al acuñar.
// PENDIENTE W3: el acuñado seco COMPLETO del POC (buildDefinition(id, 1) de cada definición: generador + PORTERO del Tipo)
// usa el motor de actividades del cliente, que porta la tanda W2 en paralelo. Cuando el motor exista, el import lo suma acá
// (mismo mensaje: "La app rechaza el bundle (acuñado seco falló):\n- <defId>: <causa>").
//
// Seed de primera vez: si no hay archivo, se importa (validado por el mismo camino) el bundle de poc-solar que deja el
// pipeline de route-lab en route-lab/jobs/poc-solar/60-route-bundle.json (route-lab/fixtures/poc-solar.json es la salida
// LLM enlatada del modo stub, NO un bundle). Si ese archivo no está (jobs/ es runtime: lo ignora el .gitignore de route-lab),
// el catálogo arranca vacío sin escribir nada, y la seed se reintenta en el próximo arranque sin archivo.
// Cuerpo del import: lector propio con tope de 16 MB — el bundle de /crear trae la portada (data URL) y el inventario con
// todas sus auditorías (en el POC la fila de Dexie no tiene tope; el readJson compartido corta a 200 KB).
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { SERVER_ROOT } from './config'
import { send } from './web'

/* ---------- formas (espejo de las filas de Dexie del POC; route/def/meta/editorial opacos) ---------- */
type Key = string | number
interface PostaData { id?: unknown; kind?: unknown; definitionId?: unknown; [k: string]: unknown }
interface RouteData { id: Key; title?: unknown; emoji?: unknown; postas: PostaData[]; modules?: unknown; cover?: unknown; category?: unknown; [k: string]: unknown }
interface DefData { id: Key; typeId?: unknown; generatorId?: unknown; target?: unknown; params?: unknown; [k: string]: unknown }
interface Bundle { kind: unknown; schemaVersion: unknown; route: RouteData; definitions: DefData[]; requires?: unknown; meta?: unknown; review?: unknown; editorial?: unknown }
interface RouteRow { id: Key; enabled: boolean; origin: 'generated'; importedAt: number; route: RouteData; meta?: unknown; editorial?: unknown }
interface DefRow { id: Key; routeId: Key; target: unknown; importedAt: number; def: DefData }
type ImportOk = { ok: true; routeId: Key; title: unknown; definitions: number; postas: number }
type ImportFail = { ok: false; error: string; status?: number }

/* ---------- registry del POC (app/src/learn/registry.ts): Tipos y generadores registrados ---------- */
// Los 4 Tipos con generador por id (DOMINO_/QUIZ_/FLASHCARDS_/MULTIPLECHOICE_GENERATORS); `multi` no mira generatorId
// ('fixed' es convención) y en cambio exige params.childIds no vacío.
const GENERATORS: Record<string, string[]> = {
  domino: ['math', 'capitales-latam'],
  quiz: ['math', 'capitales-latam'],
  flashcards: ['static'],
  multiplechoice: ['static'],
}

/** Lo que el acuñado seco del POC (buildDefinition(d.id, 1) → TYPES[typeId].build) rechaza ANTES de llegar al motor, con
 *  su mismo mensaje. null = pasa esta parte (el generador + el portero quedan para W3: ver el encabezado). */
function registryCheck(d: DefData): string | null {
  const typeId = d.typeId
  if (typeId === 'multi') {
    const childIds = (d.params as { childIds?: unknown } | null | undefined)?.childIds
    return !Array.isArray(childIds) || childIds.length === 0 ? `[learn] multi "${String(d.id)}" sin childIds en params` : null
  }
  const gens = typeof typeId === 'string' && Object.hasOwn(GENERATORS, typeId) ? GENERATORS[typeId] : null
  // TYPES[typeId] no existe → el POC muestra el TypeError literal de V8 al llamar .build sobre undefined.
  if (!gens) return "Cannot read properties of undefined (reading 'build')"
  if (typeof d.generatorId !== 'string' || !gens.includes(d.generatorId))
    return `[learn] generador desconocido "${String(d.generatorId)}" para el Tipo "${typeId}" (hay: ${gens.join(', ')})`
  return null
}

/** Validación del importador del POC (learn/import.ts), en su orden. Lo que en el POC sale como excepción (incluido un
 *  TypeError por un dato roto) vuelve como { ok:false, error } con ese mismo mensaje. */
function validateBundle(input: unknown): { ok: true; b: Bundle } | ImportFail {
  try {
    const b = input as Bundle
    if (!b || typeof b !== 'object' || b.kind !== 'smarty-route-bundle')
      return { ok: false, error: 'No es un route-bundle de Smarty (falta kind: "smarty-route-bundle").' }
    if (b.schemaVersion !== 1)
      return { ok: false, error: `schemaVersion no soportado: ${String(b.schemaVersion)} (esta app soporta 1).` }
    if (!b.route?.id || !Array.isArray(b.route.postas))
      return { ok: false, error: 'El bundle no trae una route válida (id + postas).' }
    if (!Array.isArray(b.definitions))
      return { ok: false, error: 'El bundle no trae definitions.' }

    // integridad referencial: toda posta de actividad apunta a una definición del bundle
    const defIds = new Set(b.definitions.map((d) => d.id))
    for (const p of b.route.postas) {
      if (p.kind !== 'recall' && p.definitionId && !defIds.has(p.definitionId as Key))
        return { ok: false, error: `La posta "${String(p.id)}" apunta a una definición ausente en el bundle: "${String(p.definitionId)}".` }
    }

    // acuñado seco, parte de registry (ver registryCheck): junta TODAS las fallas, como el POC
    const failures: string[] = []
    for (const d of b.definitions) {
      const cause = registryCheck(d)
      if (cause) failures.push(`${String(d.id)}: ${cause}`)
    }
    if (failures.length)
      return { ok: false, error: `La app rechaza el bundle (acuñado seco falló):\n- ${failures.join('\n- ')}` }
    return { ok: true, b }
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? String(e) }
  }
}

/* ---------- persistencia ---------- */
const FILE = join(SERVER_ROOT, 'data', 'learn-routes.json')
/* La copia TRACKEADA del bundle (coordinador, 12-oct): route-lab/jobs/ lo ignora el .gitignore propio
   de route-lab, así que en un clon limpio aquella ruta no existe y el catálogo nacería vacío. Se
   intenta primero la copia del repo y, si no está, la del job original (mismo contenido). */
const SEED_BUNDLES = [
  join(SERVER_ROOT, 'seeds', 'poc-solar.route-bundle.json'),
  join(SERVER_ROOT, '..', 'route-lab', 'jobs', 'poc-solar', '60-route-bundle.json'),
]
const MAX_BODY = 16 * 1024 * 1024

const isKey = (k: unknown): k is Key => (typeof k === 'string' && k !== '') || (typeof k === 'number' && Number.isFinite(k))
/** Orden de claves de IndexedDB (lo que devuelve toArray() de Dexie): números antes que strings; strings por unidad UTF-16. */
const keyCmp = (a: Key, b: Key) => (typeof a === typeof b ? (a < b ? -1 : a > b ? 1 : 0) : typeof a === 'number' ? -1 : 1)
const byId = (x: { id: Key }, y: { id: Key }) => keyCmp(x.id, y.id)

let routes = new Map<Key, RouteRow>()
let defs = new Map<Key, DefRow>()

function persist(nextRoutes: Map<Key, RouteRow>, nextDefs: Map<Key, DefRow>): boolean {
  const data = { v: 1, routes: [...nextRoutes.values()].sort(byId), definitions: [...nextDefs.values()].sort(byId) }
  try {
    writeFileSync(FILE + '.tmp', JSON.stringify(data))
    renameSync(FILE + '.tmp', FILE)
    return true
  } catch (e) {
    console.error('[learn-routes] no pude escribir learn-routes.json:', e)
    return false
  }
}

/** importRouteBundle del POC: valida → (acuñado seco: ver PENDIENTE W3) → reemplazo transaccional por routeId. */
function importBundle(input: unknown): ImportOk | ImportFail {
  const v = validateBundle(input)
  if (!v.ok) return v
  const b = v.b
  const routeId = b.route.id
  // La PK de Dexie exige una clave válida (si no, la transacción falla): mismo límite acá.
  if (!isKey(routeId) || b.definitions.some((d) => !isKey(d?.id)))
    return { ok: false, error: 'No se pudo guardar: la ruta o alguna definición no tiene un id válido.' }
  const now = Date.now()
  const nextRoutes = new Map(routes)
  const nextDefs = new Map(defs)
  for (const [id, row] of defs) if (row.routeId === routeId) nextDefs.delete(id) // borra las definiciones de esa ruta
  nextRoutes.set(routeId, { id: routeId, enabled: true, origin: 'generated', importedAt: now, route: b.route, meta: b.meta, editorial: b.editorial })
  for (const d of b.definitions) nextDefs.set(d.id, { id: d.id, routeId, target: d.target, importedAt: now, def: d })
  if (!persist(nextRoutes, nextDefs)) return { ok: false, status: 500, error: 'No pude guardar la ruta en el catálogo. Probá de nuevo.' }
  routes = nextRoutes
  defs = nextDefs
  return { ok: true, routeId, title: b.route.title, definitions: b.definitions.length, postas: b.route.postas.length }
}

/** deleteImportedRoute del POC: borra las definiciones de la ruta y la ruta (una clave ausente no es error). */
function deleteRoute(id: Key): boolean {
  const nextDefs = new Map(defs)
  for (const [k, row] of defs) if (row.routeId === id) nextDefs.delete(k)
  const nextRoutes = new Map(routes)
  nextRoutes.delete(id)
  if (nextDefs.size === defs.size && nextRoutes.size === routes.size) return true
  if (!persist(nextRoutes, nextDefs)) return false
  routes = nextRoutes
  defs = nextDefs
  return true
}

function seedFirstTime(): void {
  // Las entradas son COPIAS del mismo bundle (repo primero, job original después): se usa la primera
  // que exista y listo; recién si no hay ninguna, el catálogo arranca vacío.
  const file = SEED_BUNDLES.find(f => existsSync(f))
  if (!file) {
    console.warn(`[learn-routes] sin archivo de catálogo y sin la seed (${SEED_BUNDLES[0]}): el catálogo arranca vacío`)
    return
  }
  {
    try {
      const r = importBundle(JSON.parse(readFileSync(file, 'utf8')))
      if (r.ok) console.log(`[learn-routes] seed de primera vez: «${String(r.title)}» (${String(r.routeId)}) · ${r.postas} postas · ${r.definitions} definiciones`)
      else console.warn(`[learn-routes] la seed ${file} no pasó la validación: ${r.error}`)
    } catch (e) {
      console.warn(`[learn-routes] no pude leer la seed ${file}:`, e)
    }
  }
}

function load(): void {
  if (existsSync(FILE)) {
    try {
      const raw = JSON.parse(readFileSync(FILE, 'utf8')) as { routes?: unknown; definitions?: unknown }
      if (!raw || !Array.isArray(raw.routes) || !Array.isArray(raw.definitions)) throw new Error('forma inesperada')
      routes = new Map((raw.routes as RouteRow[]).filter((r) => isKey(r?.id)).map((r) => [r.id, r]))
      defs = new Map((raw.definitions as DefRow[]).filter((d) => isKey(d?.id)).map((d) => [d.id, d]))
      return
    } catch (e) {
      console.warn('[learn-routes] learn-routes.json ilegible: lo aparto y arranco con la seed:', e)
      try { renameSync(FILE, `${FILE}.roto-${Date.now()}`) } catch { /* sin copia: seguimos igual */ }
    }
  }
  seedFirstTime()
}
try { load() } catch (e) { console.error('[learn-routes] no pude cargar el catálogo:', e) }

/* ---------- lectura para los módulos del server (W3) ---------- */
/** Una ruta del catálogo tal como la guarda la fila (opaca salvo lo que leen el feed y la economía). */
export type CatalogRoute = RouteData
/** Las rutas habilitadas del catálogo, en el orden de la clave: el useImportedRoutes() del POC
 *  (db.learnRoutes.toArray() → filter(enabled !== false) → route). */
export function catalogRoutes(): CatalogRoute[] {
  return [...routes.values()].filter((r) => r.enabled !== false).sort(byId).map((r) => r.route)
}
/** El título de una ruta (para rotular los movimientos de ⚡); undefined si no existe (p. ej. una ruta borrada). */
export function routeTitle(id: string): string | undefined {
  const t = routes.get(id)?.route.title
  return typeof t === 'string' ? t : undefined
}

/* ---------- vistas ---------- */
const countOf = (x: unknown) => (Array.isArray(x) ? x.length : 0)
function listItems() {
  return [...routes.values()].sort(byId).map((r) => ({
    id: r.id,
    title: r.route.title,
    emoji: r.route.emoji,
    category: r.route.category,
    cover: r.route.cover,
    importedAt: r.importedAt,
    postas: countOf(r.route.postas),
    modules: countOf(r.route.modules), // ADITIVO (ver encabezado)
  }))
}

class BodyError extends Error { constructor(public status: number, message: string) { super(message) } }
/** Lector del cuerpo con tope propio; junta los bytes y decodifica UNA vez (un carácter de varios bytes puede caer partido entre dos pedazos). */
async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const c of req) {
    const buf = typeof c === 'string' ? Buffer.from(c) : (c as Buffer)
    size += buf.length
    if (size > MAX_BODY) throw new BodyError(413, 'La ruta es demasiado grande para guardarla (más de 16 MB).')
    chunks.push(buf)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') }
  catch { throw new BodyError(400, 'Pedido inválido (se esperaba un objeto JSON).') }
}

/* ---------- rutas ---------- */
export async function learnRoutesRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const path = url.pathname

  if (path === '/api/learn-routes') {
    if (req.method !== 'GET') return send(res, 405, { error: 'method' })
    return send(res, 200, { routes: listItems() })
  }

  if (path === '/api/learn-routes/definitions') {
    if (req.method !== 'GET') return send(res, 405, { error: 'method' })
    return send(res, 200, { definitions: [...defs.values()].sort(byId).map((d) => d.def) })
  }

  if (path === '/api/learn-routes/one') {
    if (req.method !== 'GET') return send(res, 405, { error: 'method' })
    const id = url.searchParams.get('id') ?? ''
    const row = routes.get(id)
    if (!row) return send(res, 404, { error: 'No encontré esa ruta.' })
    const definitions = [...defs.values()].filter((d) => d.routeId === row.id).sort(byId).map((d) => d.def)
    return send(res, 200, { route: row.route, definitions, editorial: row.editorial })
  }

  if (path === '/api/learn-routes/import') {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Método no permitido: usá POST.' })
    let body: unknown
    try { body = await readBody(req) } catch (e) {
      const be = e instanceof BodyError ? e : new BodyError(400, 'Pedido inválido.')
      return send(res, be.status, { ok: false, error: be.message })
    }
    const r = importBundle((body as { bundle?: unknown } | null)?.bundle)
    if (!r.ok) {
      console.warn(`[learn-routes] import rechazado: ${r.error.split('\n')[0]}`)
      return send(res, r.status ?? 200, { ok: false, error: r.error })
    }
    console.log(`[learn-routes] import «${String(r.title)}» (${String(r.routeId)}) · ${r.postas} postas · ${r.definitions} definiciones`)
    return send(res, 200, r)
  }

  if (path === '/api/learn-routes/delete') {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Método no permitido: usá POST.' })
    let body: unknown
    try { body = await readBody(req) } catch (e) {
      const be = e instanceof BodyError ? e : new BodyError(400, 'Pedido inválido.')
      return send(res, be.status, { ok: false, error: be.message })
    }
    const id = (body as { id?: unknown } | null)?.id
    if (!isKey(id)) return send(res, 400, { ok: false, error: 'Falta la ruta (id).' })
    if (!deleteRoute(id)) return send(res, 500, { ok: false, error: 'No pude borrar la ruta. Probá de nuevo.' })
    console.log(`[learn-routes] borrada ${String(id)} (+ sus definiciones; los resultados quedan)`)
    return send(res, 200, { ok: true })
  }

  return send(res, 404, { error: 'not found' })
}
