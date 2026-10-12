/** Framework de actividades didácticas — superficie pública (sin React). */
export { ActivityCore, type CoreOptions } from './core'
export { createActivity, type ActivityHandle, type CreateActivityOptions } from './host'
export { Emitter, type Listener } from './events'
export { mulberry32, shuffle } from './rng'
export {
  DEFAULT_SCORE,
  clamp,
  pointsForCorrect,
  perfectScore,
  timeBonus,
  timedScore,
  durationMsFor,
  type ScoreConfig,
  type ActivityMode,
} from './scoring'
export type {
  ActivityContext,
  ActivityEvent,
  ActivityIdentity,
  ActivityInstance,
  ActivityMeta,
  ActivityModule,
  ActivityOutcome,
  ActivityResult,
  ActivityStats,
  ActivityStatus,
  CommonSnapshot,
  SkillTally,
} from './types'
