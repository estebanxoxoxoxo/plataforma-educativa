export { multipleChoiceModule } from './module'
export { MultipleChoiceEngine, MC_ID, MC_VERSION, scoreQuestion } from './engine'
export { staticMultipleChoiceGenerator, type StaticMultipleChoiceParams } from './generators'
export {
  makeMultipleChoiceRuntime,
  resolveScore,
  resolveDurationMs,
  QUESTION_POINTS,
  TIME_BONUS_MAX,
  DEMO_MC,
  type MultipleChoiceConfig,
  type MultipleChoiceRuntime,
  type MultipleChoiceMode,
} from './config'
export type { MCMode, MCOption, MCQuestion, MultipleChoiceContent, MultipleChoiceSnapshot } from './types'
