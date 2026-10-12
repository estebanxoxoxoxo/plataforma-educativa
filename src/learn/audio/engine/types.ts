export type ChannelMode = 'loop' | 'oneshot'

export interface ChannelDef {
  id: string
  /** Resolved against manifest.baseUrl. */
  file: string
  mode: ChannelMode
  /**
   * Loop channels only. `true` (default) → part of the sample-locked stem
   * group: must share one exact buffer length and start together. `false` →
   * an independent loop (e.g. an ambience bed) of any length that loops on its
   * own. Moods still control it like any channel.
   */
  sync?: boolean
  /**
   * Mood group this channel belongs to (default 'music'). Each group has its
   * own moods and its own current mood, set independently — so e.g. the music
   * bed and the ambience bed can change mood separately.
   */
  group?: string
}

export interface MoodChannelTarget {
  /** 0..1 perceptual volume; omitted → 1. */
  volume?: number
  /** 0..1 lowpass openness (1 = fully open); omitted → 1. */
  tone?: number
}

export interface MoodDef {
  id: string
  label?: string
  /**
   * Mood group (default 'music'). The mood only addresses channels in this
   * group, and selecting it sets this group's current mood independently.
   */
  group?: string
  /** Seconds; overrides manifest.fadeTime for this mood. */
  fadeTime?: number
  channels: Record<string, MoodChannelTarget>
}

export interface AudioManifest {
  version: 1
  /** Prefix for channel files, e.g. "audio/". Relative to the page base. */
  baseUrl?: string
  /** Global default fade duration in seconds. */
  fadeTime: number
  channels: ChannelDef[]
  moods: MoodDef[]
  /** Initial mood per group, e.g. { music: 'explore', ambient: 'breeze' }. */
  defaultMoods?: Record<string, string>
}

/** Fully-resolved per-channel automation target (every channel present). */
export interface ResolvedTarget {
  volume: number
  tone: number
}

export type EngineStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'running'
  | 'error'
  | 'disposed'

export interface EngineSnapshot {
  status: EngineStatus
  /** Current mood per group, e.g. { music: 'combat', ambient: 'breeze' }. */
  currentMoods: Record<string, string | null>
  /** Stems (temas) that are currently sounding. */
  runningStems: string[]
  /** The stem in the "theme slot" that crossfadeTo manages (null if none). */
  currentStem: string | null
  contextState: AudioContextState | null
  error: string | null
}

export interface ChannelLive {
  gain: number
  cutoffHz: number
  targetVolume: number
  targetTone: number
}
