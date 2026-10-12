// Porte Smarty · Resultados de Learn — el `activityResults` del POC (Dexie v15, append-only, único
// escritor recordResult) vive acá: desvío forzado (b) del mapa §4 (IndexedDB → server) con las MISMAS
// formas. PERSISTE (decisión 4 de Esteban, 12-oct: "mismo método que el POC" = sobrevive a recargas)
// en server/data/learn-results.json, escritura atómica tmp+rename, FUERA de /api/demo/reset.
//
//   GET  /api/learn/results → { rows: ActivityResultRow[] }   (todas, orden de inserción: el
//        toArray() del POC; el cliente deriva progreso/urgencia por target, como el POC)
//   POST /api/learn/results { target, source, typeId, definitionId?, outcome, score, maxScore,
//        pct, seed?, skills?, rollup? } → { row }   (el server asigna id y finishedAt)
//
// ESQUELETO del coordinador (contrato congelado). PENDIENTE W3 (la tanda Learn colapsado):
//   · acreditar Energy Coin/XP vía progress.ts la PRIMERA vez que un target queda logrado
//     (anti-farming del demo; rollup:true NUNCA acredita — el POC lo marca justo para eso);
//   · validación fina de formas y tope de filas (el POC no tiene tope; decidir al portar).
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { SERVER_ROOT } from './config'
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
    rows.push(row)
    save()
    return send(res, 200, { row })
  }
  return send(res, 404, { error: 'No existe.' })
}
