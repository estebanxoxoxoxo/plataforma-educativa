// Porte Smarty · Resultados de Learn — el `activityResults` del POC (Dexie v15, append-only, único
// escritor recordResult) vive acá: desvío forzado (b) del mapa §4 (IndexedDB → server) con las MISMAS
// formas. PERSISTE (decisión 4 de Esteban, 12-oct: "mismo método que el POC" = sobrevive a recargas)
// en server/data/learn-results.json, escritura atómica tmp+rename, FUERA de /api/demo/reset.
//
//   GET  /api/learn/results → { rows: ActivityResultRow[] }   (las del usuario ACTIVO —U4—, orden de inserción: el
//        toArray() del POC; el cliente deriva progreso/urgencia por target, como el POC)
//   POST /api/learn/results { target, source, typeId, definitionId?, outcome, score, maxScore,
//        pct, seed?, skills?, rollup? } → { row, awarded? }   (el server asigna id y finishedAt)
//
// Esqueleto del coordinador (contrato congelado), completado en la tanda W3:
//   · ECONOMÍA INNERITH (desvío aprobado: el POC no tiene XP/EC). Una fila `completed`, que NO es `rollup`, y que es la
//     PRIMERA `completed` de ese target acredita LEARN_EC ⚡ + LEARN_EC XP vía progress.addXp() y responde `awarded`.
//     Replays, abortadas/timeout y los agregados de un multi (`rollup:true`, que el POC marca justo para que la economía
//     no cuente dos veces el esfuerzo de los hijos) NO pagan. La "primera" se mira sobre las filas PERSISTIDAS: tras un
//     F5 la economía vuelve al seed (RAM, regla 9) y los targets ya completados no vuelven a pagar (anti-farming).
//     TARIFA: Practicar pagaba por ejercicio (abierta 15 · opción múltiple 10 · V/F 5) y +30 por la insignia de cerrar
//     cada unidad. La posta es la unidad de trabajo de Learn (una actividad entera: 2-8 preguntas o cartas), así que
//     paga lo de cerrar una unidad: 30 ⚡ / 30 XP (≈ 3 ejercicios de opción múltiple), el "+30 ⚡" que ya prometía el feed.
//   · Validación de formas: la del esqueleto (campos requeridos + outcome conocido; pct acotado a [0,1]). Sin tope de
//     filas, como el POC (Dexie no lo tiene).
//   · Además registra en progress.ts el "seguí practicando" (summary().continue) derivado de estas filas.
//
// POR USUARIO desde U4 (docs/USUARIOS.md §10): cada integrante tiene SUS filas (su progreso, sus estrellas, la urgencia de
// su recall, su "seguí con…"). GET/POST son del usuario ACTIVO (actingUser(req)); "la primera vez que se completa un
// target" se mira sobre las filas DE ESE USUARIO (Luna cobra su primera vez aunque Ian ya la haya hecho; el anti-farming
// sigue, por persona). Archivo v2: { version: 2, users: { [id]: ActivityResultRow[] } }; los ids de fila son ÚNICOS EN LA
// FAMILIA (seq = 1 + el máximo sobre TODAS las filas de TODOS: A2 de la spec). Un v1 (el array de antes: las filas de Ian)
// migra en el acto a users.ian (userDataMigrate.ts, puro y testeado) y el texto original queda UNA vez en
// learn-results.json.pre-v2 (un checkout viejo reventaría al leer el v2). Ilegible → copia .roto-<ms> y arranca vacío (antes
// el próximo guardado lo pisaba en silencio); se escribe recién con el próximo POST.
//
// FS-BASE-A (hallazgos learnResults.ts:134 y :174): el cuerpo se lee con TOPE (MAX_BODY → 413; antes juntaba todo en memoria
// del proceso de la familia) y la fila nueva entra a RAM recién cuando quedó en DISCO: si writeFile falla se deshace (la RAM
// vuelve a lo de antes, el seq no retrocede: un id nunca significa dos cosas) y responde 500 sin pagar. Antes la fila quedaba
// en RAM como «ya completado»: el reintento del cliente (learnData.ts reintenta los 5xx) no cobraba nunca y la partida quedaba
// DUPLICADA en disco con la próxima escritura buena.
import { existsSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { SERVER_ROOT } from './config'
import { backupBeforeMigrate, quarantine, writeFileAtomic } from './durable'
import { isObject } from './familyMigrate'
import { catalogRoutes, routeTitle } from './learnRoutes'
import { lastPlayedRoute, routeRuns } from './learnProgress'
import { learnFactsFrom } from './medalRules'
import { ensureMedals, registerMedalFacts, syncMedals } from './medals'
import { addXp, registerContinue } from './progress'
import { currentUser } from './requestContext'
import { upgradeLearnRaw } from './userDataMigrate'
import { DEFAULT_USER_ID, actingUser } from './users'
import { send } from './web'

export interface ActivityResultRow {
  id: number
  target: string
  source: string
  typeId: string
  definitionId?: string
  outcome: 'completed' | 'timeout' | 'aborted'
  score: number
  maxScore: number
  pct: number
  finishedAt: number
  skills?: Record<string, { attempts: number; correct: number }>
  seed?: number
  rollup?: boolean
}

/** ⚡ y XP (1:1, progress.addXp) por la PRIMERA partida completada de cada target. Ver la tarifa en el encabezado. */
export const LEARN_EC = 30

const FILE = join(SERVER_ROOT, 'data', 'learn-results.json')

/** Las filas de cada usuario (RAM = el archivo entero; se escribe completo en cada POST). */
const byUser = new Map<string, ActivityResultRow[]>()

/** Tira si falla (durable.ts, FS-BASE-B: tmp + fsync + rename). */
function writeFile(): void { writeFileAtomic(FILE, JSON.stringify({ version: 2, users: Object.fromEntries(byUser) })) }

function load(): void {
  if (!existsSync(FILE)) return
  let text: string
  let up: ReturnType<typeof upgradeLearnRaw>
  try {
    text = readFileSync(FILE, 'utf8')
    up = upgradeLearnRaw(JSON.parse(text), DEFAULT_USER_ID)
  } catch (e) {
    console.warn('[learn] learn-results.json ilegible, arranco sin resultados (copia en .roto-*):', e)
    quarantine(FILE, 'learn') // sin copia: seguimos igual (el próximo POST escribe uno nuevo)
    return
  }
  for (const [id, list] of Object.entries(up.raw.users)) {
    if (!Array.isArray(list)) { console.warn(`[learn] learn-results.json: las filas de «${id}» no son una lista; las descarto`); continue }
    const ok = list.filter((r): r is ActivityResultRow => isObject(r) && typeof r.id === 'number' && typeof r.target === 'string')
    if (ok.length < list.length) console.warn(`[learn] learn-results.json: descarto ${list.length - ok.length} fila(s) de «${id}» sin id o target`)
    byUser.set(id, ok)
  }
  if (up.from === 1) {
    // v1 → v2: lo de antes era de Ian. Respaldo LITERAL (durable.ts: si ya hay un .pre-v2 con OTRO contenido, va a
    // .pre-v2-<ms>; nunca se saltea en silencio). La migración no pierde nada (todo pasa a ian), así que sigue aunque falle.
    backupBeforeMigrate(FILE, '.pre-v2', text, 'learn')
    try { writeFile() } catch (e) { console.error('[learn] no pude escribir learn-results.json v2:', e) }
    console.log(`[learn] learn-results.json v1 → v2: ${byUser.get(DEFAULT_USER_ID)?.length ?? 0} fila(s) a «${DEFAULT_USER_ID}» (respaldo en learn-results.json.pre-v2)`)
  }
}
load()
/** Próximo id de fila: ÚNICO EN LA FAMILIA (1 + el máximo sobre las filas de todos). */
let seq = [...byUser.values()].flat().reduce((m, r) => Math.max(m, r.id), 0) + 1

/** Las filas de un usuario (solo lectura; [] si todavía no jugó). */
export function resultRowsOf(userId: string): readonly ActivityResultRow[] { return byUser.get(userId) ?? [] }
/** Las filas (solo lectura) DEL USUARIO DEL PEDIDO, para los módulos del server que derivan progreso: el feed fake (hero,
 *  rutas). Fuera de un pedido, las de ian. */
export function resultRows(): readonly ActivityResultRow[] { return resultRowsOf(currentUser()?.id ?? DEFAULT_USER_ID) }

// "Seguí practicando" de un usuario (progress.summaryOf(id).continue: la barra, Familia → Actividad): la última ruta que
// jugó, con su avance real.
registerContinue((userId) => {
  const r = lastPlayedRoute(routeRuns(catalogRoutes(), resultRowsOf(userId)))
  return r ? { courseId: r.id, title: r.title, done: r.done, total: r.total } : null
})
// U5-B: los hechos de Learn de las medallas (primera-posta, diez-objetivos, ruta-completa, posta-perfecta, primer-repaso),
// derivados de SUS filas persistidas y del catálogo vigente (medalRules.learnFactsFrom, puro).
registerMedalFacts((userId) => learnFactsFrom(resultRowsOf(userId), catalogRoutes()), 'Learn')

/** Cómo se lee el movimiento en "Tus movimientos" de la Tienda: la ruta de donde salió (o el repaso de la raíz). */
function txLabel(source: string): string {
  if (source === 'active-recall') return 'Active recall'
  const m = /^ruta:(.+?)\/posta:/.exec(source)
  const title = m ? routeTitle(m[1]) : undefined
  return title ? `Ruta: ${title}` : 'Aprender'
}

/** Tope del cuerpo de un resultado (una fila son unos cientos de bytes; `skills` no llega a KB). */
export const MAX_BODY = 64 * 1024
class TooBig extends Error {}
async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const c of req) {
    const buf = typeof c === 'string' ? Buffer.from(c) : (c as Buffer)
    size += buf.length
    if (size > MAX_BODY) throw new TooBig()
    chunks.push(buf)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

const OUTCOMES = new Set(['completed', 'timeout', 'aborted'])

export async function learnResultsRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (url.pathname === '/api/learn/results' && req.method === 'GET') return send(res, 200, { rows: resultRowsOf(actingUser(req).id) })
  if (url.pathname === '/api/learn/results' && req.method === 'POST') {
    let b: Record<string, unknown>
    try { b = (await readBody(req)) as Record<string, unknown> } catch (e) {
      return e instanceof TooBig ? send(res, 413, { error: 'El resultado es demasiado grande.' }) : send(res, 400, { error: 'Body inválido.' })
    }
    if (!b || typeof b !== 'object' || Array.isArray(b)) return send(res, 400, { error: 'Body inválido.' })
    if (typeof b.target !== 'string' || !b.target || typeof b.source !== 'string' || typeof b.typeId !== 'string' ||
      typeof b.outcome !== 'string' || !OUTCOMES.has(b.outcome) ||
      typeof b.score !== 'number' || typeof b.maxScore !== 'number' || typeof b.pct !== 'number') {
      return send(res, 400, { error: 'Faltan campos del resultado.' })
    }
    const row: ActivityResultRow = {
      id: seq++,
      target: b.target,
      source: b.source,
      typeId: b.typeId,
      definitionId: typeof b.definitionId === 'string' ? b.definitionId : undefined,
      outcome: b.outcome as ActivityResultRow['outcome'],
      score: b.score,
      maxScore: b.maxScore,
      pct: Math.max(0, Math.min(1, b.pct)),
      finishedAt: Date.now(),
      skills: b.skills && typeof b.skills === 'object' ? (b.skills as ActivityResultRow['skills']) : undefined,
      seed: typeof b.seed === 'number' ? b.seed : undefined,
      rollup: b.rollup === true || undefined,
    }
    // ¿Es la PRIMERA vez que ESTE USUARIO completa este target? (sobre SUS filas, ANTES de sumar la nueva)
    const me = actingUser(req).id
    const mine = byUser.get(me) ?? []
    const pays = row.outcome === 'completed' && !row.rollup &&
      !mine.some((r) => r.target === row.target && r.outcome === 'completed' && !r.rollup)
    // U5-B: el slice de medallas existe ANTES de la fila nueva (si naciera después, esta posta entraría al seed como "ya
    // vista" y no habría medalla nueva); el sync va antes de responder, en las dos ramas (cubre también tres-dias y
    // de-vuelta, que mueve addXp adentro de este mismo pedido).
    ensureMedals(me)
    // FS-BASE-A: a disco PRIMERO; la RAM cambia solo si quedó escrita (si no, se deshace y 500: el reintento cobra y no duplica)
    const had = byUser.has(me)
    byUser.set(me, [...mine, row])
    try { writeFile() } catch (e) {
      if (had) byUser.set(me, mine)
      else byUser.delete(me)
      console.error('[learn] no pude guardar learn-results.json (la fila no quedó):', e)
      return send(res, 500, { error: 'No pude guardar el resultado. Probá de nuevo.' })
    }
    if (pays) {
      // addXp cae en el usuario del pedido (el contexto de U3: es `me`)
      const p = addXp(LEARN_EC, txLabel(row.source))
      if (p.xp > 0) {
        console.log(`[learn] +${p.xp} ⚡/XP a ${me} · primera vez completado: ${row.target} (${row.source})`)
        syncMedals(me)
        return send(res, 200, { row, awarded: { ec: p.xp, xp: p.xp } })
      }
    }
    syncMedals(me)
    return send(res, 200, { row })
  }
  return send(res, 404, { error: 'No existe.' })
}
