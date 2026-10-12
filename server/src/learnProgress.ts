// Porte Smarty · Learn (tanda W3): la derivación del progreso del POC (smarty-poc app/src/lib/learn.ts:
// progressByTarget · resolveRoute · routeProgress) del lado del SERVER, para lo que necesita "por dónde va el chico" sin
// pasar por la vista: el hero del feed fake ("Seguí con <ruta>" · "Vas X de Y postas") y el "Está practicando" de la Zona
// de padres (progress.summary().continue). Es la MISMA regla que dibuja el camino (src/sections/learn/lib/learn.ts):
//   · el progreso es 100% DERIVADO de las filas de resultados, por TARGET (cualquier partida lo mueve: la posta, un replay,
//     el recall, otra ruta con el mismo target);
//   · posta lograda = su target tiene ≥1 intento (sin umbral) o bestPct ≥ passThreshold (con umbral) — sin mirar el
//     outcome: rendirse también cuenta (quirk 1 del informe 02, fiel al POC);
//   · desbloqueo lineal GLOBAL; las postas de repaso (kind 'recall') nunca se logran ni bloquean y no cuentan en el avance.
// Puro: sin estado ni I/O (las filas y las rutas las pasa quien llama).

export interface TargetStat { attempts: number; bestPct: number }
export type PostaState = 'done' | 'available' | 'locked'
interface RowLike { target: string; pct: number; source?: string; finishedAt?: number }
interface PostaLike { kind?: unknown; target?: unknown; passThreshold?: unknown }
interface RouteLike { id: unknown; title?: unknown; emoji?: unknown; postas: readonly PostaLike[] }

/** progressByTarget del POC: intentos y mejor % por target (sobre TODAS las filas, sin mirar outcome ni rollup). */
export function progressByTarget(rows: readonly RowLike[]): Map<string, TargetStat> {
  const m = new Map<string, TargetStat>()
  for (const r of rows) {
    const cur = m.get(r.target) ?? { attempts: 0, bestPct: 0 }
    cur.attempts += 1
    cur.bestPct = Math.max(cur.bestPct, r.pct)
    m.set(r.target, cur)
  }
  return m
}

/** resolveRoute del POC (solo el estado: las estrellas no las necesita nadie del server). */
export function resolveStates(route: RouteLike, byTarget: Map<string, TargetStat>): { posta: PostaLike; state: PostaState }[] {
  let prevDone = true
  return route.postas.map((posta) => {
    if (posta.kind === 'recall') return { posta, state: prevDone ? 'available' : 'locked' }
    const stat = typeof posta.target === 'string' ? byTarget.get(posta.target) : undefined
    const threshold = typeof posta.passThreshold === 'number' ? posta.passThreshold : null
    const done = !!stat && (threshold != null ? stat.bestPct >= threshold : stat.attempts > 0)
    const state: PostaState = done ? 'done' : prevDone ? 'available' : 'locked'
    prevDone = done
    return { posta, state }
  })
}

/** routeProgress del POC: logradas / postas que no son de repaso. */
export function routeProgress(route: RouteLike, byTarget: Map<string, TargetStat>): { done: number; total: number } {
  const acts = resolveStates(route, byTarget).filter((v) => v.posta.kind !== 'recall')
  return { done: acts.filter((v) => v.state === 'done').length, total: acts.length }
}

/** Una ruta con su avance real y cuándo se jugó por última vez (0 = nunca). */
export interface RouteRun { id: string; title: string; emoji: string; done: number; total: number; lastAt: number }

/** Avance + última actividad de cada ruta, en el orden del catálogo. La actividad de una ruta = las filas grabadas desde
 *  ella (source `ruta:<id>/…`) o a uno de sus targets (así un repaso de la raíz —source 'active-recall'— también cuenta). */
export function routeRuns(routes: readonly RouteLike[], rows: readonly RowLike[]): RouteRun[] {
  const byTarget = progressByTarget(rows)
  return routes.map((route) => {
    const id = String(route.id)
    const targets = new Set(route.postas.map((p) => p.target).filter((t): t is string => typeof t === 'string'))
    let lastAt = 0
    for (const r of rows) {
      if (targets.has(r.target) || (typeof r.source === 'string' && r.source.startsWith(`ruta:${id}/`))) lastAt = Math.max(lastAt, r.finishedAt ?? 0)
    }
    const { done, total } = routeProgress(route, byTarget)
    return { id, title: typeof route.title === 'string' ? route.title : id, emoji: typeof route.emoji === 'string' ? route.emoji : '', done, total, lastAt }
  })
}

/** La ruta EN CURSO: la de actividad más reciente que todavía tiene postas pendientes (null si ninguna jugada la tiene). */
export function routeInProgress(runs: readonly RouteRun[]): RouteRun | null {
  return runs.filter((r) => r.lastAt > 0 && r.done < r.total).sort((a, b) => b.lastAt - a.lastAt)[0] ?? null
}

/** La última ruta jugada (terminada o no): lo que el padre ve en "Está practicando". */
export function lastPlayedRoute(runs: readonly RouteRun[]): RouteRun | null {
  return runs.filter((r) => r.lastAt > 0).sort((a, b) => b.lastAt - a.lastAt)[0] ?? null
}
