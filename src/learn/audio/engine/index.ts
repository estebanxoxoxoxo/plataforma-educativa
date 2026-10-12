export { AudioEngine } from './AudioEngine'
export {
  validateManifest,
  resolveMoodTargets,
  resolveFadeTime,
  channelGroup,
  moodGroup,
  DEFAULT_GROUP,
} from './manifest'
export { toneToCutoffHz, volumeToGain, makeTanhCurve, MIN_CUTOFF_HZ, MAX_CUTOFF_HZ } from './mapping'
export { rampParam, MIN_FADE } from './ramps'
export type {
  AudioManifest,
  ChannelDef,
  ChannelLive,
  ChannelMode,
  EngineSnapshot,
  EngineStatus,
  MoodChannelTarget,
  MoodDef,
  ResolvedTarget,
} from './types'
