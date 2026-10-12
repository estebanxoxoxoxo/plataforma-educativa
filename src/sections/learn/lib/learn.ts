import type { ActivityResultInput, ActivityResultRow, LearnModule, LearnPosta, LearnRouteData } from '../../../api/types';
import type { ActivityResult } from '../../../learn/activity';

/* Modelo de la feature "Learn" (ver ACTIVIDADES.md). El estado de cada posta NO es
   fijo: se DERIVA de la maestría del OBJETIVO (target) acumulada en el store de
   resultados (db.activityResults). La posta solo proyecta ese objetivo; jugarla
   (o un repaso que comparta el target) actualiza el estado. */

/* PORTE INNERITH (W3): port 1:1 de smarty-poc app/src/lib/learn.ts @ 47f434b — la parte PURA (tipos, categorías,
   progressByTarget, starsForPct, resolveRoute, routeProgress) y el armado de la fila de recordResult. Los tipos son los
   del contrato (src/api/types.ts: LearnRouteData/LearnPosta/LearnModule, espejo exacto de los del POC). Lo que en el POC
   es Dexie (recordResult escribe, useLearnProgress/useImportedRoutes leen en vivo) vive en ./learnData (filas y rutas de
   NUESTRO server, desvío forzado (b) del mapa). El catálogo seed `ROUTES` del POC está VACÍO: no se porta (el catálogo
   del chico son solo las rutas generadas). Quirks fieles (informe 02 §15): rendirse = lograda (progressByTarget no mira el
   outcome), el % no es tasa de acierto en flashcards/quiz/dominó, bloqueo lineal GLOBAL, el recall puede destrabar una
   comprensión (todo es por target). */

export type PostaState = 'done' | 'available' | 'locked';

/** Posta (nodo del camino). `target` = clave de progreso; postas con el mismo target comparten maestría. */
export type Posta = LearnPosta;
/** Rótulo de un módulo de la ruta (agrupación de presentación: la pertenencia vive en Posta.moduleId). */
export type RouteModule = LearnModule;
export type LearnRoute = LearnRouteData;

/** Sugerencias de categoría (para agrupar el mosaico). UNA sola lista: la que ya portó /crear (W1). */
export { LEARN_CATEGORIES } from '../../create/lib/routeDraft';

// --- persistencia + progreso (por objetivo) ---

/** La fila que graba recordResult del POC (sin id ni finishedAt: los asigna el server, contrato ActivityResultInput). */
export function resultRowOf(input: {
  target: string;
  source: string;
  definitionId?: string;
  result: ActivityResult;
  /** true = resultado AGREGADO (outer de una multi): sus hijos ya grabaron el
   *  esfuerzo fila por fila → la economía (XP/EC) no debe contarlo doble. */
  rollup?: boolean;
}): ActivityResultInput {
  const { result } = input;
  const pct = result.maxScore > 0 ? result.score / result.maxScore : 0;
  return {
    target: input.target,
    source: input.source,
    typeId: result.activityId,
    definitionId: input.definitionId ?? result.definitionId,
    seed: result.seed, // con el generador determinista, reconstruye el Ejercicio
    outcome: result.outcome,
    score: result.score,
    maxScore: result.maxScore,
    pct,
    skills: result.skills, // maestría fina por skill (para el active recall)
    rollup: input.rollup,
  };
}

export interface TargetStat {
  attempts: number;
  bestPct: number;
}

export function progressByTarget(rows: ActivityResultRow[]): Map<string, TargetStat> {
  const m = new Map<string, TargetStat>();
  for (const r of rows) {
    const cur = m.get(r.target) ?? { attempts: 0, bestPct: 0 };
    cur.attempts += 1;
    cur.bestPct = Math.max(cur.bestPct, r.pct);
    m.set(r.target, cur);
  }
  return m;
}

export function starsForPct(pct: number): number {
  return pct >= 0.9 ? 3 : pct >= 0.7 ? 2 : pct > 0 ? 1 : 0;
}

export interface PostaView {
  posta: Posta;
  state: PostaState;
  stars: number;
}

/** Estado vivo de cada posta: lograda si su objetivo tiene ≥1 intento; disponible si
 *  la anterior está lograda (la 1ª siempre); si no, bloqueada. Estrellas = mejor %. */
export function resolveRoute(route: LearnRoute, byTarget: Map<string, TargetStat>): PostaView[] {
  let prevDone = true;
  return route.postas.map((posta) => {
    // Las postas de recall no se "logran" ni bloquean la cadena: están disponibles
    // si ya llegaste (la anterior está lograda) y dejan pasar el estado (§7.1).
    if (posta.kind === 'recall') {
      return { posta, state: prevDone ? 'available' : 'locked', stars: 0 };
    }
    const stat = byTarget.get(posta.target);
    // Validación: con passThreshold, se logra sólo si el mejor % alcanza el umbral (examen);
    // sin umbral, basta jugarla (attempts>0), el comportamiento de siempre.
    const done = !!stat && (posta.passThreshold != null ? stat.bestPct >= posta.passThreshold : stat.attempts > 0);
    const state: PostaState = done ? 'done' : prevDone ? 'available' : 'locked';
    prevDone = done;
    return { posta, state, stars: stat ? starsForPct(stat.bestPct) : 0 };
  });
}

export function routeProgress(route: LearnRoute, byTarget: Map<string, TargetStat>): { done: number; total: number } {
  // las postas de recall no cuentan para el avance (nunca "lograda")
  const acts = resolveRoute(route, byTarget).filter((v) => v.posta.kind !== 'recall');
  return { done: acts.filter((v) => v.state === 'done').length, total: acts.length };
}
