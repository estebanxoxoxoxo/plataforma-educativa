import { durationMsFor, timedScore, type ActivityMode, type ScoreConfig } from '../../activity/index'
import type { MCQuestion } from './types'

export type MultipleChoiceMode = ActivityMode

/** Runtime = lo que afecta el JUEGO (no el contenido): modo, tiempo, scoring. */
export interface MultipleChoiceRuntime {
  mode: MultipleChoiceMode
  durationSec: number
  score: ScoreConfig
}

/** Lo que recibe el Tipo: un Ejercicio (content) + el runtime. */
export interface MultipleChoiceConfig {
  content: { questions: MCQuestion[] }
  runtime: MultipleChoiceRuntime
}

/** Puntos por pregunta a pleno; el crédito parcial otorga `fraction × esto`. Puntaje PLANO
 *  (sin bono de racha) para que el crédito parcial sea legible y maxScore = nPreguntas × esto. */
export const QUESTION_POINTS = 10
export const TIME_BONUS_MAX = 100

/** Score plano: base = QUESTION_POINTS, streakBonus 0, sin penalización de pista. */
function baseScore(): ScoreConfig {
  return { base: QUESTION_POINTS, streakBonus: 0, hintPenalty: 0 }
}

export function resolveScore(runtime: MultipleChoiceRuntime): ScoreConfig {
  return timedScore(runtime.score, runtime.mode, TIME_BONUS_MAX)
}
export function resolveDurationMs(runtime: MultipleChoiceRuntime): number | null {
  return durationMsFor(runtime.mode, runtime.durationSec)
}
export function makeMultipleChoiceRuntime(mode: MultipleChoiceMode, durationSec: number): MultipleChoiceRuntime {
  return { mode, durationSec, score: baseScore() }
}

/* Set de ejemplo (contenido benévolo estilo "artículo wiki") — es lo que route-lab emitirá
   desde los facts de un contenido → params { questions } del generador `static`. Mezcla
   'single' y 'multi' para ejercitar ambos modos + los atajos "Todas"/"Ninguna". */
export const DEMO_MC: MCQuestion[] = [
  {
    id: 'mc1',
    mode: 'single',
    skill: 'sistema-solar.planetas',
    prompt: '¿Cuál es el planeta más grande del sistema solar?',
    options: [
      { id: 'a', text: 'Júpiter', correct: true },
      { id: 'b', text: 'Saturno', correct: false },
      { id: 'c', text: 'la Tierra', correct: false },
      { id: 'd', text: 'Marte', correct: false },
    ],
  },
  {
    id: 'mc2',
    mode: 'multi',
    skill: 'sistema-solar.gigantes',
    prompt: '¿Cuáles de estos son planetas gigantes gaseosos?',
    options: [
      { id: 'a', text: 'Júpiter', correct: true },
      { id: 'b', text: 'Saturno', correct: true },
      { id: 'c', text: 'Mercurio', correct: false },
      { id: 'd', text: 'la Tierra', correct: false },
    ],
  },
  {
    id: 'mc3',
    mode: 'single',
    skill: 'sistema-solar.sol',
    prompt: '¿Qué es el Sol?',
    options: [
      { id: 'a', text: 'una estrella', correct: true },
      { id: 'b', text: 'un planeta', correct: false },
      { id: 'c', text: 'un satélite', correct: false },
      { id: 'd', text: 'un cometa', correct: false },
    ],
  },
]
