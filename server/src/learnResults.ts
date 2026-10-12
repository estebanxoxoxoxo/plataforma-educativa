// Porte Smarty · Resultados de Learn — el `activityResults` del POC (Dexie v15, append-only, único
// escritor recordResult) vive acá: desvío forzado (b) del mapa §4 (IndexedDB → server) con las MISMAS
// formas. PERSISTE (decisión 4 de Esteban, 12-oct: "mismo método que el POC" = sobrevive a recargas)
// en server/data/learn-results.json, escritura atómica tmp+rename, FUERA de /api/demo/reset.
//
//   GET  /api/learn/results → { rows: ActivityResultRow[] }   (todas, orden de inserción: el
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
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { SERVER_ROOT } from './config'
import { catalogRoutes, routeTitle } from './learnRoutes'
import { lastPlayedRoute, routeRuns } from './learnProgress'
import { addXp, registerContinue } from './progress'
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

function load(): ActivityResultRow[] {
  if (!existsSync(FILE)) return []
  try { return JSON.parse(readFileSync(FILE, 'utf8')) as ActivityResultRow[] } catch { return [] }
}
let rows: ActivityResultRow[] = load()
let seq = rows.reduce((m, r) => Math.max(m, r.id), 0) + 1

function save(): void {
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(rows))
  renameSync(tmp, FILE)
}

/** Las filas (solo lectura) para los módulos del server que derivan progreso: el feed fake. */
export function resultRows(): readonly ActivityResultRow[] { return rows }

// "Seguí practicando" de la Zona de padres (progress.summary().continue): la última ruta jugada, con su avance real.
registerContinue(() => {
  const r = lastPlayedRoute(routeRuns(catalogRoutes(), rows))
  return r ? { courseId: r.id, title: r.title, done: r.done, total: r.total } : null
})

/** Cómo se lee el movimiento en "Tus movimientos" de la Tienda: la ruta de donde salió (o el repaso de la raíz). */
function txLabel(source: string): string {
  if (source === 'active-recall') return 'Active recall'
  const m = /^ruta:(.+?)\/posta:/.exec(source)
  const title = m ? routeTitle(m[1]) : undefined
  return title ? `Ruta: ${title}` : 'Aprender'
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

const OUTCOMES = new Set(['completed', 'timeout', 'aborted'])

export async function learnResultsRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (url.pathname === '/api/learn/results' && req.method === 'GET') return send(res, 200, { rows })
  if (url.pathname === '/api/learn/results' && req.method === 'POST') {
    let b: Record<string, unknown>
    try { b = (await readBody(req)) as Record<string, unknown> } catch { return send(res, 400, { error: 'Body inválido.' }) }
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
    // ¿Es la PRIMERA vez que este target se completa? (se mira ANTES de sumar la fila nueva)
    const pays = row.outcome === 'completed' && !row.rollup &&
      !rows.some((r) => r.target === row.target && r.outcome === 'completed' && !r.rollup)
    rows.push(row)
    save()
    if (pays) {
      const p = addXp(LEARN_EC, txLabel(row.source))
      if (p.xp > 0) {
        console.log(`[learn] +${p.xp} ⚡/XP · primera vez completado: ${row.target} (${row.source})`)
        return send(res, 200, { row, awarded: { ec: p.xp, xp: p.xp } })
      }
    }
    return send(res, 200, { row })
  }
  return send(res, 404, { error: 'No existe.' })
}
