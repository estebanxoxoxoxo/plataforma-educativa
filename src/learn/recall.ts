import type { ActivityResultRow } from '../api/types'

/* Active recall — capa de datos + urgencia (ACTIVIDADES.md §7). Lee el store de
   maestría (db.activityResults) y calcula QUÉ conviene repasar: por FALLAS (te fue
   mal la última vez) y por ESPACIADO (hace mucho que no lo practicás → curva de
   olvido). Funciones PURAS con `now` inyectado (testeables). La fórmula es afinable;
   acá se fija la estructura. El paso 3b/3c consumen `dueTargets`. */

/* PORTE INNERITH (W4, decisión 3 de Esteban: "Active Recall se copia EXACTO"): port 1:1 de smarty-poc
   app/src/lib/recall.ts @ 47f434b. Únicos cambios: las filas vienen de NUESTRO server (`ActivityResultRow` de
   src/api/types.ts, misma forma que la fila de Dexie) y NO se porta el hook `useDueTargets` (era un
   useLiveQuery de Dexie sin ningún consumidor en el POC; en Innerith las filas las trae la sección Learn).
   `skillMastery` se porta aunque nadie lo use (fidelidad, como en el POC). */

export interface TargetMastery {
  target: string
  attempts: number
  lastPct: number // % del intento más reciente
  bestPct: number
  lastSeen: number // finishedAt más reciente
}

export interface SkillMastery {
  skill: string
  attempts: number
  correct: number
  accuracy: number // correct/attempts
  lastSeen: number
}

export interface DueTarget extends TargetMastery {
  urgency: number // ~0..1; mayor = conviene repasar más
}

// --- parámetros afinables (la lógica fina del algoritmo se revisa después) ---
const DAY = 24 * 60 * 60 * 1000
export const SPACING_WINDOW_MS = 3 * DAY // a partir de acá, "del todo due" por espaciado
const W_FAIL = 0.6 // peso de las fallas
const W_SPACE = 0.4 // peso del espaciado

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

/** Maestría por objetivo: intentos, último %, mejor %, última vez. */
export function targetMastery(rows: ActivityResultRow[]): Map<string, TargetMastery> {
  const sorted = [...rows].sort((a, b) => a.finishedAt - b.finishedAt) // asc → el último queda como lastPct
  const m = new Map<string, TargetMastery>()
  for (const r of sorted) {
    const cur = m.get(r.target) ?? { target: r.target, attempts: 0, lastPct: 0, bestPct: 0, lastSeen: 0 }
    cur.attempts += 1
    cur.lastPct = r.pct
    cur.bestPct = Math.max(cur.bestPct, r.pct)
    cur.lastSeen = Math.max(cur.lastSeen, r.finishedAt)
    m.set(r.target, cur)
  }
  return m
}

/** Maestría fina por skill, agregando los tallies de cada resultado. */
export function skillMastery(rows: ActivityResultRow[]): Map<string, SkillMastery> {
  const m = new Map<string, SkillMastery>()
  for (const r of rows) {
    if (!r.skills) continue
    for (const [skill, t] of Object.entries(r.skills)) {
      const cur = m.get(skill) ?? { skill, attempts: 0, correct: 0, accuracy: 0, lastSeen: 0 }
      cur.attempts += t.attempts
      cur.correct += t.correct
      cur.lastSeen = Math.max(cur.lastSeen, r.finishedAt)
      m.set(skill, cur)
    }
  }
  for (const s of m.values()) s.accuracy = s.attempts > 0 ? s.correct / s.attempts : 0
  return m
}

/** Urgencia de un objetivo = fallas (1 - último %) + espaciado (tiempo sin practicar). */
export function targetUrgency(m: TargetMastery, now: number): number {
  const failFactor = clamp01(1 - m.lastPct)
  const spaceFactor = clamp01((now - m.lastSeen) / SPACING_WINDOW_MS)
  return W_FAIL * failFactor + W_SPACE * spaceFactor
}

export interface DueOptions {
  /** Solo objetivos dentro de estos targets (ej. los de UNA ruta para el recall in-route). */
  scope?: Iterable<string>
  /** Umbral mínimo de urgencia para considerarlo due. */
  minUrgency?: number
  /** Tope de resultados. */
  limit?: number
}

/** Objetivos YA vistos, ordenados por urgencia desc. El recall toma de acá su secuencia. */
export function dueTargets(rows: ActivityResultRow[], now: number, opts: DueOptions = {}): DueTarget[] {
  const scope = opts.scope ? new Set(opts.scope) : null
  const out: DueTarget[] = []
  for (const m of targetMastery(rows).values()) {
    if (scope && !scope.has(m.target)) continue
    const urgency = targetUrgency(m, now)
    if (opts.minUrgency != null && urgency < opts.minUrgency) continue
    out.push({ ...m, urgency })
  }
  out.sort((a, b) => b.urgency - a.urgency)
  return opts.limit != null ? out.slice(0, opts.limit) : out
}
