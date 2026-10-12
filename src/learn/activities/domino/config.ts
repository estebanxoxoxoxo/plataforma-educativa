import { DEFAULT_SCORE, durationMsFor, timedScore, type ActivityMode, type ScoreConfig } from '../../activity/index'
import type { DominoContent } from './types'
import type { MathDominoParams } from './generators'

export type DominoMode = ActivityMode

/** Runtime = lo que afecta el JUEGO (no el contenido): modo, tiempo, scoring. */
export interface DominoRuntime {
  mode: DominoMode
  durationSec: number
  score: ScoreConfig
}

/** Lo que recibe el Tipo: un Ejercicio (content) + el runtime. */
export interface DominoConfig {
  content: DominoContent
  runtime: DominoRuntime
}

export const TIME_BONUS_MAX = 80

export function resolveScore(runtime: DominoRuntime): ScoreConfig {
  return timedScore(runtime.score, runtime.mode, TIME_BONUS_MAX)
}
export function resolveDurationMs(runtime: DominoRuntime): number | null {
  return durationMsFor(runtime.mode, runtime.durationSec)
}
export function makeRuntime(mode: DominoMode, durationSec: number): DominoRuntime {
  return { mode, durationSec, score: { ...DEFAULT_SCORE } }
}

// --- presets por DEFINICIÓN (params del generador + duración base) ---

export interface DominoMathPreset {
  id: string
  label: string
  math: MathDominoParams
  durationSec: number
}

export const MATH_PRESETS: DominoMathPreset[] = [
  { id: 'facil', label: 'Fácil · sumas 0–10', math: { maxValue: 10, ops: ['+'], tileCount: 6 }, durationSec: 60 },
  { id: 'medio', label: 'Medio · sumas y restas 0–12', math: { maxValue: 12, ops: ['+', '-'], tileCount: 8 }, durationSec: 75 },
  { id: 'dificil', label: 'Difícil · sumas y restas 0–20', math: { maxValue: 20, ops: ['+', '-'], tileCount: 10 }, durationSec: 90 },
]

export interface DominoPairsPreset {
  id: string
  label: string
  count: number
  durationSec: number
}

export const PAIRS_PRESETS: DominoPairsPreset[] = [
  { id: 'corto', label: 'Corto · 6 países', count: 6, durationSec: 75 },
  { id: 'largo', label: 'Largo · 9 países', count: 9, durationSec: 100 },
]
