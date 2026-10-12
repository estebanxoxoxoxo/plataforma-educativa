export { quizModule } from './module'
export { QuizEngine, QUIZ_ID, QUIZ_VERSION } from './engine'
export {
  mathQuizGenerator,
  factQuizGenerator,
  evalOp,
  type MathQuizParams,
  type FactQuizParams,
  type Operation,
} from './generators'
export {
  MATH_PRESETS,
  FACT_PRESETS,
  makeQuizRuntime,
  resolveScore,
  resolveDurationMs,
  TIME_BONUS_MAX,
  type QuizConfig,
  type QuizRuntime,
  type QuizMode,
  type QuizMathPreset,
  type QuizFactPreset,
} from './config'
export type { Question, QuizContent, QuizSnapshot } from './types'
