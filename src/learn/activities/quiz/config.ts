import { DEFAULT_SCORE, durationMsFor, timedScore, type ActivityMode, type ScoreConfig } from '../../activity/index'
import type { QuizContent } from './types'
import type { FactQuizParams, MathQuizParams } from './generators'

export type QuizMode = ActivityMode

/** Runtime = lo que afecta el JUEGO (no el contenido): modo, tiempo, scoring. */
export interface QuizRuntime {
  mode: QuizMode
  durationSec: number
  score: ScoreConfig
}

/** Lo que recibe el Tipo: un Ejercicio (content) + el runtime. */
export interface QuizConfig {
  content: QuizContent
  runtime: QuizRuntime
}

export const TIME_BONUS_MAX = 100

export function resolveScore(runtime: QuizRuntime): ScoreConfig {
  return timedScore(runtime.score, runtime.mode, TIME_BONUS_MAX)
}
export function resolveDurationMs(runtime: QuizRuntime): number | null {
  return durationMsFor(runtime.mode, runtime.durationSec)
}
export function makeQuizRuntime(mode: QuizMode, durationSec: number): QuizRuntime {
  return { mode, durationSec, score: { ...DEFAULT_SCORE } }
}

// --- presets por DEFINICIÓN (params del generador + duración base) ---

export interface QuizMathPreset {
  id: string
  label: string
  math: MathQuizParams
  durationSec: number
}

/* TEEN-COPY (4-nov): «sumas 0–10» era de primer grado; el usuario modelo tiene 13. El generador del quiz ya sabe ×, así
   que los presets pasan a tablas y a una mezcla con números más grandes (mismas cantidades y duraciones). «Álgebra
   simple» (x + 3 = 7) necesitaría un generador nuevo: fuera de esta tanda de copy. */
export const MATH_PRESETS: QuizMathPreset[] = [
  { id: 'facil', label: 'Fácil · tablas hasta el 9', math: { questionCount: 6, maxValue: 9, ops: ['×'], optionCount: 4 }, durationSec: 45 },
  { id: 'medio', label: 'Medio · tablas hasta el 12', math: { questionCount: 8, maxValue: 12, ops: ['×'], optionCount: 4 }, durationSec: 60 },
  { id: 'dificil', label: 'Difícil · + − × hasta 20', math: { questionCount: 10, maxValue: 20, ops: ['+', '-', '×'], optionCount: 4 }, durationSec: 75 },
]

export interface QuizFactPreset {
  id: string
  label: string
  fact: FactQuizParams
  durationSec: number
}

export const FACT_PRESETS: QuizFactPreset[] = [
  { id: 'capitales', label: 'Capitales de Latinoamérica', fact: { count: 8, optionCount: 4 }, durationSec: 75 },
]
