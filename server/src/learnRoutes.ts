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
// bundle; el POC no cruza targets) · ACUÑADO SECO COMPLETO (deuda de W1, saldada 14-oct): cada definición se acuña con
// seed 1 —generador + PORTERO del Tipo— con el MISMO motor del cliente (src/learn/dryMint.ts → definitions.ts →
// registryCore.ts: TS puro, sin los Boards) y, si alguna falla, el rechazo es el del POC con TODAS las causas juntas:
// "La app rechaza el bundle (acuñado seco falló):\n- <defId>: <causa>" (p. ej. una tarjeta sin `back` → la causa del
// portero de flashcards). Tipo desconocido, generador desconocido y multi sin childIds salen de ese mismo código.
//
// Seed de primera vez: si no hay archivo, se importa (validado por el mismo camino) el bundle de poc-solar que deja el
// pipeline de route-lab en route-lab/jobs/poc-solar/60-route-bundle.json (route-lab/fixtures/poc-solar.json es la salida
// LLM enlatada del modo stub, NO un bundle). Si ese archivo no está (jobs/ es runtime: lo ignora el .gitignore de route-lab),
// el catálogo arranca vacío sin escribir nada, y la seed se reintenta en el próximo arranque sin archivo.
// Cuerpo del import: lector propio con tope de 16 MB — el bundle de /crear trae la portada (data URL) y el inventario con
// todas sus auditorías (en el POC la fila de Dexie no tiene tope; el readJson compartido corta a 200 KB).
//
// FS-BASE-A (desvíos de seguridad, razonados; la validación y los mensajes del POC quedan EXACTOS y en su orden):
//   · COTAS antes del acuñado seco (hallazgo learnRoutes.ts:94): el acuñado es SINCRÓNICO en el único proceso de la familia
//     y los generadores 'math' escalan con los params (Array.from({length: maxValue+1}), questionCount iteraciones): un bundle
//     de pocos bytes colgaba o tiraba el server. Cantidad de definiciones/postas/módulos, largo de las listas, anidamiento y
//     rango de los params numéricos que escalan → 400 {ok:false, error} con el motivo (un bundle de /crear nunca llega).
//     FIX-MINT (hallazgo ALTA de QA-SEGURIDAD): esos params tienen que ser NÚMEROS —un "200000000" texto pasaba la cota y
//     el generador lo coaccionaba: OOM—; los topes viven en src/learn/scaledParams.ts y los generadores los usan además de
//     tope duro (y el while de los distractores del quiz tiene tope de vueltas: `ops` vacío lo dejaba girando para siempre).
//   · LO QUE SE SIRVE A UN CHICO se re-resuelve con SU política al leer (hallazgo learnRoutes.ts:333 + faltante 3 del
//     workflow base-review-2; servedRoute): el título y la descripción de toda ruta pasan sus palabras y los nombres de la
//     lista negra; una ruta que importó OTRO CHICO (un hermano: `importedBy`, metadato ADITIVO que no se sirve) no la revisó
//     ningún adulto y pasa además la moderación completa —todo el texto de la ruta, sus definiciones y su inventario, los
//     videos solo del catálogo aprobado, los artículos solo de la lista blanca— y su portada subida (data URL) no se sirve.
//     Lo que no pasa no se lista, no se abre (/one → 404) ni hidrata sus definiciones (fail-closed); el Feed usa lo mismo
//     (servedRoutes). Con un adulto (el que cura) todo como antes. En /one las auditorías del inventario se le muestran a un
//     chico solo con sus fuentes seguras (auditView.ts).
import { existsSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { SERVER_ROOT } from './config'
import { quarantine, tryWriteFileAtomic } from './durable'
import { ensureMedals, registerMedalFacts, syncMedals } from './medals'
import { currentUser } from './requestContext'
import { send } from './web'
import { isAllowedArticleSite } from './filters'
import { userById } from './users'
import { getCatalogVideo } from './videos'
import { auditForChild, childBlocked } from './auditView'
// El motor de actividades del cliente (TS puro; ver src/learn/registryCore.ts): el acuñado seco corre con SU código.
import { dryMint } from '../../src/learn/dryMint'
import type { DefinitionRecipe } from '../../src/learn/registryCore'
import { SCALED_PARAM_MAX } from '../../src/learn/scaledParams'
import { fetchWikiThumb, wikiTarget, type WikiTarget } from './routeCover'

/* ---------- formas (espejo de las filas de Dexie del POC; route/def/meta/editorial opacos) ---------- */
type Key = string | number
interface PostaData { id?: unknown; kind?: unknown; definitionId?: unknown; [k: string]: unknown }
interface RouteData { id: Key; title?: unknown; emoji?: unknown; postas: PostaData[]; modules?: unknown; cover?: unknown; category?: unknown; [k: string]: unknown }
interface DefData { id: Key; typeId?: unknown; generatorId?: unknown; target?: unknown; params?: unknown; [k: string]: unknown }
interface Bundle { kind: unknown; schemaVersion: unknown; route: RouteData; definitions: DefData[]; requires?: unknown; meta?: unknown; review?: unknown; editorial?: unknown }
/** `createdBy` (U5-B, ADITIVO de Innerith: el POC no tiene usuarios): el id de quien importó la ruta POR PRIMERA VEZ (el
 *  hecho de la medalla «Tu primera ruta»). Metadato puro: no se sirve en ninguna respuesta ni cambia ninguna conducta del
 *  importador (validación, mensajes, reemplazo transaccional y orden quedan EXACTOS: regla suprema del porte). La seed
 *  poc-solar y las filas de antes de U5 quedan sin autor; una reimportación de la misma ruta (editarla en /crear) CONSERVA
 *  el autor que tenía (o la falta de autor).
 *  `createdAt` (revisión de U5, el MISMO criterio): CUÁNDO la armó su autor —la primera importación—, la fecha de «Tu
 *  primera ruta» ("Desde el…"): `importedAt` se pisa en cada reimportación y, tras el F5, la medalla cambiaba de fecha. Solo
 *  en las filas CON autor (la seed y las de antes de U5 no lo escriben: su forma en disco no cambia) y tampoco se sirve; una
 *  fila con autor y sin `createdAt` (de antes de este campo) lo toma de su último `importedAt` la próxima vez que se
 *  reimporta (la mejor fecha que hay) y desde ahí queda fija. */
/** `importedBy` (FS-BASE-A, ADITIVO, no se sirve): quién la importó la ÚLTIMA vez —una reimportación cambia el contenido—;
 *  decide si lo que ve un chico es de un HERMANO (sin revisar por un adulto: servedRoute). Las filas de antes no lo tienen:
 *  vale su `createdBy`. */
interface RouteRow { id: Key; enabled: boolean; origin: 'generated'; importedAt: number; route: RouteData; meta?: unknown; editorial?: unknown; createdBy?: string; createdAt?: number; importedBy?: string }
interface DefRow { id: Key; routeId: Key; target: unknown; importedAt: number; def: DefData }
type ImportOk = { ok: true; routeId: Key; title: unknown; definitions: number; postas: number }
type ImportFail = { ok: false; error: string; status?: number }

/* ---------- cotas del import (FS-BASE-A; ver la cabecera) ---------- */
export const IMPORT_LIMITS = {
  definitions: 200, postas: 300, modules: 60, arrayItems: 500, depth: 12,
  /** Los params que hacen ESCALAR a los generadores (domino/quiz 'math', 'capitales-latam'): rango permitido. FIX-MINT: la
   *  fuente es src/learn/scaledParams.ts —los generadores usan los MISMOS topes como defensa en profundidad—. */
  scaled: SCALED_PARAM_MAX as Record<string, number>,
} as const
/** Cómo se nombra en el motivo del 400 un valor que no es un número (sin repetir su contenido, que puede ser enorme). */
const kindOf = (x: unknown) => (x === null ? 'null' : Array.isArray(x) ? 'una lista' : typeof x === 'string' ? 'un texto' : typeof x === 'object' ? 'un objeto' : typeof x === 'boolean' ? 'true/false' : typeof x)
/** null = dentro de las cotas; si no, el motivo (para el 400).
 *  FIX-MINT (hallazgo ALTA de QA-SEGURIDAD, la cota de abajo): un param que escala TIENE que ser un número (de JSON:
 *  `typeof 'number'`) de 0 a su tope. Antes la cota solo miraba los números y un texto ("200000000") —o una lista
 *  ([200000000])— pasaba sin tocar: el generador lo coacciona (Math.max, `maxValue + 1`, `size < optionCount`) y un body de
 *  ~300 bytes de un CHICO bloqueaba el event loop segundos o mataba el proceso por falta de memoria. No se coacciona "12" a
 *  12: el POC nunca emite estas claves como texto (route-lab y /crear solo emiten el generador 'static'; el seed en código
 *  las tiene como números y el respaldo del POC es JSON, que conserva el tipo), así que todo lo que no es número se rechaza. */
export function checkBounds(b: Bundle): string | null {
  const L = IMPORT_LIMITS
  if (b.definitions.length > L.definitions) return `La ruta trae ${b.definitions.length} definiciones: el máximo es ${L.definitions}.`
  if (b.route.postas.length > L.postas) return `La ruta trae ${b.route.postas.length} postas: el máximo es ${L.postas}.`
  if (Array.isArray(b.route.modules) && b.route.modules.length > L.modules) return `La ruta trae ${b.route.modules.length} módulos: el máximo es ${L.modules}.`
  const walk = (v: unknown, depth: number, at: string): string | null => {
    if (depth > L.depth) return `${at}: demasiados niveles anidados (máximo ${L.depth}).`
    if (typeof v === 'number') return Number.isFinite(v) ? null : `${at}: número inválido.`
    if (Array.isArray(v)) {
      if (v.length > L.arrayItems) return `${at}: ${v.length} elementos (máximo ${L.arrayItems}).`
      for (let i = 0; i < v.length; i++) { const e = walk(v[i], depth + 1, `${at}[${i}]`); if (e) return e }
      return null
    }
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        const cap = Object.hasOwn(L.scaled, k) ? L.scaled[k] : undefined
        if (cap !== undefined) {
          if (typeof x !== 'number') return `${at}.${k}: tiene que ser un número de 0 a ${cap} (llegó ${kindOf(x)}).`
          if (!(x >= 0 && x <= cap)) return `${at}.${k} = ${x}: fuera de rango (0 a ${cap}).`
        }
        const e = walk(x, depth + 1, `${at}.${k}`)
        if (e) return e
      }
    }
    return null
  }
  for (const d of b.definitions) {
    const e = walk(d?.params, 0, `${String(d?.id)}: params`)
    if (e) return `La ruta excede los límites del importador: ${e}`
  }
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

    // FS-BASE-A: las COTAS del import, antes del acuñado seco (ver la cabecera) → 400
    const over = checkBounds(b)
    if (over) return { ok: false, status: 400, error: over }

    // ACUÑADO SECO (el del POC, con su motor): cada definición con seed 1 pasa generador + portero; junta TODAS las fallas
    const rejected = dryMint(b.definitions as unknown as DefinitionRecipe[])
    if (rejected) return { ok: false, error: rejected }
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
  return tryWriteFileAtomic(FILE, JSON.stringify(data), 'learn-routes') // FS-BASE-B: el helper común (durable.ts)
}

/** importRouteBundle del POC: valida (incluido el acuñado seco) → reemplazo transaccional por routeId. */
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
  // U5-B: el autor (ver RouteRow): el que ya tenía la fila, o quien la importa ahora si es nueva (fuera de un pedido —la
  // seed de primera vez— no hay usuario: queda sin autor). undefined no se escribe en el JSON.
  const prev = routes.get(routeId)
  const createdBy = prev ? prev.createdBy : currentUser()?.id
  // …y CUÁNDO (revisión de U5; ver RouteRow): la de la primera importación, que una reimportación conserva como al autor.
  const createdAt = createdBy === undefined ? undefined : prev ? (prev.createdAt ?? prev.importedAt) : now
  // FS-BASE-A: quién la importa AHORA (decide qué ve un hermano: servedRoute); fuera de un pedido (la seed), nadie
  const importedBy = currentUser()?.id
  nextRoutes.set(routeId, { id: routeId, enabled: true, origin: 'generated', importedAt: now, route: b.route, meta: b.meta, editorial: b.editorial, createdBy, createdAt, importedBy })
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
      quarantine(FILE, 'learn-routes') // sin copia: seguimos igual
    }
  }
  seedFirstTime()
}
try { load() } catch (e) { console.error('[learn-routes] no pude cargar el catálogo:', e) }

/* ---------- portada de las rutas de ARTÍCULO (deuda 14-oct; la lógica pura vive en routeCover.ts) ----------
   El paso 3 del routeCover del POC, en el server: una ruta SIN portada cuyo primer contenido es un artículo de Wikipedia
   toma la imagen del artículo (summary → thumbnail.source, una URL http) como `route.cover`, guardada EN LA FILA
   (persistida, sin tocar importedAt). Cuándo: al IMPORTAR (en segundo plano: el guardado no espera a Wikipedia) y, para las
   filas que ya existían, LAZY al listar (GET /api/learn-routes espera hasta COVER_WAIT_MS; lo que tarde más queda para el
   próximo) y al leer el catálogo el Feed (sin esperar). Sin imagen o con falla → sigue el emoji, y esa ruta+artículo queda
   "ya intentada" en RAM: los pedidos siguientes no vuelven a pedir (sin martillar; un reinicio del server reintenta una
   vez). Un import nuevo de la ruta siempre prueba de nuevo. Si la fila cambió mientras tanto (re-import, borrado), el
   resultado se descarta. */
const COVER_WAIT_MS = 2500
const coverTried = new Set<string>() // `${id}|${url del artículo}` ya pedidas en este proceso
const coverJobs = new WeakMap<RouteRow, Promise<void>>() // el pedido en curso de ESA versión de la fila
const coverKey = (id: Key, t: WikiTarget) => `${typeof id}:${String(id)}|${t.url}`

function ensureCover(id: Key, force = false): Promise<void> | null {
  const row = routes.get(id)
  if (!row) return null
  const t = wikiTarget(row.route)
  if (!t) return null
  const running = coverJobs.get(row)
  if (running) return running
  const key = coverKey(id, t)
  if (!force && coverTried.has(key)) return null
  coverTried.add(key)
  const job = fetchWikiThumb(t).then((thumb) => {
    if (routes.get(id) !== row) return // la ruta se re-importó o se borró mientras tanto
    if (!thumb) { console.log(`[learn-routes] portada de «${String(row.route.title)}»: el artículo no trae imagen (o no respondió): sigue el emoji`); return }
    const next = new Map(routes)
    next.set(id, { ...row, route: { ...row.route, cover: thumb } })
    if (!persist(next, defs)) return // no se pudo escribir: queda como estaba (y ya intentada)
    routes = next
    console.log(`[learn-routes] portada de «${String(row.route.title)}»: la imagen de su artículo de Wikipedia`)
  })
  coverJobs.set(row, job)
  return job
}
/** Pide las portadas que falten (las ya intentadas no) y espera hasta `waitMs` (0 = no espera). */
async function ensureCovers(waitMs: number): Promise<void> {
  const jobs = [...routes.keys()].map((id) => ensureCover(id)).filter((j): j is Promise<void> => j !== null)
  if (!jobs.length || waitMs <= 0) return
  await Promise.race([Promise.allSettled(jobs), new Promise((r) => setTimeout(r, waitMs))])
}

/* ---------- lectura para los módulos del server (W3) ---------- */
/** Una ruta del catálogo tal como la guarda la fila (opaca salvo lo que leen el feed y la economía). */
export type CatalogRoute = RouteData
/** Las rutas habilitadas del catálogo, en el orden de la clave: el useImportedRoutes() del POC
 *  (db.learnRoutes.toArray() → filter(enabled !== false) → route). De paso dispara (sin esperar) las portadas de artículo
 *  que falten: así el Feed también las muestra aunque nadie haya entrado a Aprender. */
export function catalogRoutes(): CatalogRoute[] {
  void ensureCovers(0)
  return [...routes.values()].filter((r) => r.enabled !== false).sort(byId).map((r) => r.route)
}
/** El título de una ruta (para rotular los movimientos de ⚡); undefined si no existe (p. ej. una ruta borrada). */
export function routeTitle(id: string): string | undefined {
  const t = routes.get(id)?.route.title
  return typeof t === 'string' ? t : undefined
}
/** U5-B: cuántas rutas del catálogo armó `userId` (filas con su `createdBy`; una borrada ya no cuenta). */
export function routesCreatedBy(userId: string): number {
  let n = 0
  for (const r of routes.values()) if (r.createdBy === userId) n++
  return n
}
// U5-B: el hecho de la medalla «Tu primera ruta» (y su fecha: la de CREACIÓN más vieja entre las suyas que siguen en el
// catálogo —`createdAt`; una fila de antes de ese campo, su `importedAt`—: una reimportación no la mueve).
registerMedalFacts((userId) => {
  let n = 0, first: number | null = null
  for (const r of routes.values()) {
    if (r.createdBy !== userId) continue
    n++
    const at = r.createdAt ?? r.importedAt
    if (first === null || at < first) first = at
  }
  return { routesCreated: n, firstRouteCreatedAt: first }
}, 'catálogo de rutas')

/* ---------- lo que se le sirve a un CHICO (FS-BASE-A; ver la cabecera) ---------- */
/** Claves que son ids, URLs o tipos (no texto que vea el chico): no entran al barrido de palabras. */
const NOT_TEXT = new Set(['id', 'definitionId', 'target', 'moduleId', 'url', 'videoId', 'typeId', 'generatorId', 'mode', 'kind', 'cover', 'jobId', 'captionKind', 'status', 'agrees'])
/** Todo el texto de una fila (ruta + sus definiciones + su inventario), en un solo string (memo por versión de la fila). */
const rowText = new WeakMap<RouteRow, string>()
function textOf(row: RouteRow): string {
  let t = rowText.get(row)
  if (t !== undefined) return t
  const out: string[] = []
  const walk = (v: unknown, depth: number) => {
    if (depth > 16 || out.length > 20_000) return
    if (typeof v === 'string') { if (v && !v.startsWith('data:')) out.push(v); return }
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!NOT_TEXT.has(k)) walk(x, depth + 1)
  }
  walk(row.route, 0)
  for (const d of defs.values()) if (d.routeId === row.id) walk(d.def, 0)
  walk(row.editorial, 0)
  t = out.join('\n')
  rowText.set(row, t)
  return t
}
type Reading = { url?: unknown; title?: unknown; kind?: unknown; videoId?: unknown }
/** Los contenidos de la ruta (lectura o video de cada posta y la fuente de cada módulo) siguen aprobados HOY: videos del
 *  catálogo aprobado con título que pasa las palabras, artículos de la lista blanca. */
function readingsApproved(route: RouteData): boolean {
  const reads: Reading[] = []
  for (const p of route.postas ?? []) if (p && typeof p === 'object' && p.reading && typeof p.reading === 'object') reads.push(p.reading as Reading)
  for (const m of Array.isArray(route.modules) ? route.modules : []) if (m && typeof m === 'object' && (m as { source?: unknown }).source) reads.push((m as { source: Reading }).source)
  return reads.every((r) => {
    if (r.kind === 'video' || (typeof r.videoId === 'string' && r.videoId)) {
      const v = typeof r.videoId === 'string' ? getCatalogVideo(r.videoId) : undefined
      return !!v && !childBlocked(v.title)
    }
    return typeof r.url !== 'string' || !r.url || isAllowedArticleSite(r.url)
  })
}
const isWikiImage = (u: unknown) => typeof u === 'string' && /^https?:\/\/upload\.wikimedia\.org\//.test(u)
/** ¿Lo importó por última vez OTRO chico (un hermano del que mira)? */
const bySibling = (row: RouteRow, me: string) => {
  const by = row.importedBy ?? row.createdBy
  return by !== undefined && by !== me && userById(by)?.kind === 'child'
}
/** La ruta como se le sirve al usuario del pedido: con un adulto (o sin pedido) tal cual; con un chico, re-resuelta con SU
 *  política (ver la cabecera). null = no se le sirve. */
function servedRoute(row: RouteRow): RouteData | null {
  const me = currentUser()
  if (me?.kind !== 'child') return row.route
  const r = row.route
  if (childBlocked([r.title, r.description].filter((x) => typeof x === 'string').join('\n'))) return null
  if (!bySibling(row, me.id)) return r
  if (childBlocked(textOf(row)) || !readingsApproved(r)) return null
  return r.cover !== undefined && !isWikiImage(r.cover) ? { ...r, cover: undefined } : r // la portada subida por un chico, no
}
/** Las filas habilitadas que se le sirven al usuario del pedido, en el orden de la clave. */
const servedRows = () => [...routes.values()].filter((r) => r.enabled !== false).sort(byId)
  .map((row) => ({ row, route: servedRoute(row) })).filter((x): x is { row: RouteRow; route: RouteData } => x.route !== null)
/** FS-BASE-A: catalogRoutes() con lo que ve el usuario del pedido (servedRoute): el Feed sirve ESTO. catalogRoutes() queda
 *  crudo para lo que no se muestra (la economía y los hechos de las medallas: no pueden cambiar según quién mira). */
export function servedRoutes(): CatalogRoute[] {
  void ensureCovers(0)
  return servedRows().map((x) => x.route)
}
/** El inventario de una ruta como lo ve un chico en /crear: cada auditoría solo con sus fuentes seguras (auditView.ts), o
 *  sin la auditoría si su resumen no se puede mostrar. Opaco: si no tiene la forma de /crear, va tal cual. */
function editorialFor(editorial: unknown): unknown {
  if (currentUser()?.kind !== 'child' || !editorial || typeof editorial !== 'object') return editorial
  const ed = JSON.parse(JSON.stringify(editorial)) as { modules?: Record<string, { inventory?: { facts?: { audit?: unknown }[] } }> }
  for (const m of Object.values(ed.modules ?? {})) {
    for (const f of Array.isArray(m?.inventory?.facts) ? m.inventory.facts : []) {
      if (!f || typeof f !== 'object' || !f.audit) continue
      const a = auditForChild(f.audit as { summary?: unknown; correction?: unknown; sources?: unknown })
      if (a) f.audit = a
      else delete f.audit
    }
  }
  return ed
}

/* ---------- vistas ---------- */
const countOf = (x: unknown) => (Array.isArray(x) ? x.length : 0)
function listItems() {
  // enabled !== false: el filtro de useImportedRoutes del POC (hoy sin efecto: el import siempre fuerza true).
  // FS-BASE-A: lo que se le sirve al usuario del pedido (servedRoute).
  return servedRows().map(({ row: r, route }) => ({
    id: r.id,
    title: route.title,
    emoji: route.emoji,
    category: route.category,
    cover: route.cover,
    importedAt: r.importedAt,
    postas: countOf(route.postas),
    modules: countOf(route.modules), // ADITIVO (ver encabezado)
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
    await ensureCovers(COVER_WAIT_MS) // portadas de artículo que falten (lazy; ver arriba)
    return send(res, 200, { routes: listItems() })
  }

  if (path === '/api/learn-routes/definitions') {
    if (req.method !== 'GET') return send(res, 405, { error: 'method' })
    // FS-BASE-A: solo las de las rutas que se le sirven al usuario del pedido (con un adulto: todas, como siempre)
    const served = currentUser()?.kind === 'child' ? new Set(servedRows().map((x) => x.row.id)) : null
    return send(res, 200, { definitions: [...defs.values()].filter((d) => !served || served.has(d.routeId)).sort(byId).map((d) => d.def) })
  }

  if (path === '/api/learn-routes/one') {
    if (req.method !== 'GET') return send(res, 405, { error: 'method' })
    const id = url.searchParams.get('id') ?? ''
    const row = routes.get(id)
    // FS-BASE-A: una ruta que no se le sirve al usuario del pedido no existe para él (mismo 404)
    const route = row ? servedRoute(row) : null
    if (!row || !route) return send(res, 404, { error: 'No encontré esa ruta.' })
    const definitions = [...defs.values()].filter((d) => d.routeId === row.id).sort(byId).map((d) => d.def)
    return send(res, 200, { route, definitions, editorial: editorialFor(row.editorial) })
  }

  if (path === '/api/learn-routes/import') {
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'Método no permitido: usá POST.' })
    let body: unknown
    try { body = await readBody(req) } catch (e) {
      const be = e instanceof BodyError ? e : new BodyError(400, 'Pedido inválido.')
      return send(res, be.status, { ok: false, error: be.message })
    }
    const uid = currentUser()?.id
    if (uid) ensureMedals(uid) // U5-B: el slice de medallas existe ANTES de la ruta nueva (si no, entraría al seed como vista)
    const r = importBundle((body as { bundle?: unknown } | null)?.bundle)
    if (!r.ok) {
      console.warn(`[learn-routes] import rechazado: ${r.error.split('\n')[0]}`)
      return send(res, r.status ?? 200, { ok: false, error: r.error })
    }
    console.log(`[learn-routes] import «${String(r.title)}» (${String(r.routeId)}) · ${r.postas} postas · ${r.definitions} definiciones`)
    if (uid) syncMedals(uid) // U5-B: «Tu primera ruta» (si la armó él) y su noticia en SU feed
    void ensureCover(r.routeId, true) // portada del artículo, en segundo plano (no demora el guardado)
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
