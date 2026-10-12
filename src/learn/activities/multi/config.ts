import { DEFAULT_SCORE, durationMsFor, timedScore, type ActivityMode, type ScoreConfig } from '../../activity/index'
import type { MultiChild } from './types'

export type MultiMode = ActivityMode

export interface MultiRuntime {
  mode: MultiMode
  durationSec: number
  score: ScoreConfig
}

export interface MultiConfig {
  /** Provee el hijo i; null = se acabó (acotado). Endless = nunca null. */
  next: (index: number) => MultiChild | null
  /** Cota para la barra de progreso (acotado). undefined/null = endless. */
  total?: number
  runtime: MultiRuntime
}

/** El multi lleva un puntaje de SESIÓN; sin bonus de tiempo por ahora. */
export const TIME_BONUS_MAX = 0

export function resolveScore(runtime: MultiRuntime): ScoreConfig {
  return timedScore(runtime.score, runtime.mode, TIME_BONUS_MAX)
}
export function resolveDurationMs(runtime: MultiRuntime): number | null {
  return durationMsFor(runtime.mode, runtime.durationSec)
}
export function makeMultiRuntime(mode: MultiMode, durationSec: number): MultiRuntime {
  return { mode, durationSec, score: { ...DEFAULT_SCORE } }
}
