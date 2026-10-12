export { multiModule } from './module'
export { MultiEngine, MULTI_ID, MULTI_VERSION, CHILD_FINISHED, isChildFinished, type ChildFinishedData } from './engine'
export {
  makeMultiRuntime,
  resolveScore,
  resolveDurationMs,
  TIME_BONUS_MAX,
  type MultiConfig,
  type MultiRuntime,
  type MultiMode,
} from './config'
export type { MultiChild, MultiSnapshot } from './types'
