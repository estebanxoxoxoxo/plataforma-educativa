/**
 * Helpers de puntaje reutilizables por cualquier actividad. Soporta los dos
 * modos del POC:
 *   - precisión (sin reloj): puntaje = aciertos con multiplicador de racha.
 *   - contrarreloj: idem + un bono final proporcional al tiempo restante.
 */

export interface ScoreConfig {
  /** Puntos base por acierto. */
  base: number
  /** Puntos extra por cada acierto consecutivo (× (racha - 1)). */
  streakBonus: number
  /** Puntos restados por cada pista usada. */
  hintPenalty: number
  /**
   * Solo modo contrarreloj: pozo de bono que se reparte al terminar según el
   * tiempo restante (full si quedó todo el tiempo, 0 si se acabó). Omitido /
   * 0 → modo sin reloj.
   */
  timeBonusMax?: number
}

export const DEFAULT_SCORE: ScoreConfig = {
  base: 10,
  streakBonus: 2,
  hintPenalty: 5,
}

/** Modo común a las actividades: con o sin reloj. */
export type ActivityMode = 'untimed' | 'timed'

/** Inyecta el pozo de bono por tiempo solo en modo contrarreloj. */
export function timedScore(base: ScoreConfig, mode: ActivityMode, timeBonusMax: number): ScoreConfig {
  return { ...base, timeBonusMax: mode === 'timed' ? timeBonusMax : 0 }
}

/** Presupuesto de tiempo en ms, o null si la actividad no tiene reloj. */
export function durationMsFor(mode: ActivityMode, seconds: number): number | null {
  return mode === 'timed' ? seconds * 1000 : null
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/** Puntos por un acierto, dada la racha resultante (1 = primer acierto). */
export function pointsForCorrect(cfg: ScoreConfig, streak: number): number {
  return cfg.base + cfg.streakBonus * Math.max(0, streak - 1)
}

/** Bono final por tiempo (modo contrarreloj). 0 si no hay reloj o se acabó. */
export function timeBonus(cfg: ScoreConfig, remainingMs: number, totalMs: number): number {
  if (!cfg.timeBonusMax || totalMs <= 0) return 0
  return Math.round(cfg.timeBonusMax * clamp(remainingMs / totalMs, 0, 1))
}

/**
 * Puntaje teórico máximo: una corrida perfecta (todos aciertos, racha creciente)
 * más el pozo de tiempo. Sirve para reportar `maxScore` y normalizar progreso.
 */
export function perfectScore(cfg: ScoreConfig, moves: number): number {
  let total = 0
  for (let i = 1; i <= moves; i++) total += pointsForCorrect(cfg, i)
  return total + (cfg.timeBonusMax ?? 0)
}
