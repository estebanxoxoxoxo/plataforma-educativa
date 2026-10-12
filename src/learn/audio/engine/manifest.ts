import type { AudioManifest, ChannelDef, MoodDef, ResolvedTarget } from './types'

export type ValidationResult =
  | { ok: true; manifest: AudioManifest }
  | { ok: false; errors: string[] }

/** Mood group a channel/mood belongs to when none is declared. */
export const DEFAULT_GROUP = 'music'

export const channelGroup = (ch: ChannelDef): string => ch.group ?? DEFAULT_GROUP
export const moodGroup = (m: MoodDef): string => m.group ?? DEFAULT_GROUP

/**
 * Los STEMS (temas): los `group` distintos que tienen al menos un canal `loop`. El transporte
 * (startStem/stopStem/crossfadeTo), el bus de crossfade y el sample-lock operan POR stem. Los
 * oneshot (FX) no forman stem: van directo al master. Orden estable (primer aparición).
 */
export function loopStems(manifest: AudioManifest): string[] {
  const stems: string[] = []
  const seen = new Set<string>()
  for (const ch of manifest.channels) {
    if (ch.mode !== 'loop') continue
    const g = channelGroup(ch)
    if (!seen.has(g)) {
      seen.add(g)
      stems.push(g)
    }
  }
  return stems
}

const inUnit = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1

export function validateManifest(manifest: AudioManifest): ValidationResult {
  const errors: string[] = []

  if (manifest.version !== 1) errors.push(`unsupported manifest version: ${manifest.version}`)
  if (!Number.isFinite(manifest.fadeTime) || manifest.fadeTime <= 0)
    errors.push(`fadeTime must be > 0, got ${manifest.fadeTime}`)
  if (manifest.channels.length === 0) errors.push('manifest declares no channels')

  const channelGroupOf = new Map<string, string>()
  for (const ch of manifest.channels) {
    if (channelGroupOf.has(ch.id)) errors.push(`duplicate channel id "${ch.id}"`)
    channelGroupOf.set(ch.id, channelGroup(ch))
    if (!ch.file) errors.push(`channel "${ch.id}" has no file`)
    if (ch.mode !== 'loop' && ch.mode !== 'oneshot')
      errors.push(`channel "${ch.id}" has invalid mode "${ch.mode}"`)
  }

  const moodById = new Map<string, MoodDef>()
  for (const mood of manifest.moods) {
    if (moodById.has(mood.id)) errors.push(`duplicate mood id "${mood.id}"`)
    moodById.set(mood.id, mood)
    const group = moodGroup(mood)
    if (mood.fadeTime !== undefined && (!Number.isFinite(mood.fadeTime) || mood.fadeTime <= 0))
      errors.push(`mood "${mood.id}" fadeTime must be > 0, got ${mood.fadeTime}`)
    for (const [channelId, target] of Object.entries(mood.channels)) {
      if (!channelGroupOf.has(channelId)) {
        errors.push(`mood "${mood.id}" references unknown channel "${channelId}"`)
      } else if (channelGroupOf.get(channelId) !== group) {
        // a mood can only address channels in its own group
        errors.push(
          `mood "${mood.id}" (group "${group}") references channel "${channelId}" from group "${channelGroupOf.get(channelId)}"`,
        )
      }
      if (target.volume !== undefined && !inUnit(target.volume))
        errors.push(`mood "${mood.id}" channel "${channelId}" volume out of [0,1]: ${target.volume}`)
      if (target.tone !== undefined && !inUnit(target.tone))
        errors.push(`mood "${mood.id}" channel "${channelId}" tone out of [0,1]: ${target.tone}`)
    }
  }

  for (const [group, moodId] of Object.entries(manifest.defaultMoods ?? {})) {
    const mood = moodById.get(moodId)
    if (!mood) errors.push(`defaultMoods["${group}"] "${moodId}" is not a declared mood`)
    else if (moodGroup(mood) !== group)
      errors.push(`defaultMoods["${group}"] "${moodId}" belongs to group "${moodGroup(mood)}"`)
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, manifest }
}

/**
 * Moods are absolute snapshots within their group, not deltas: every channel
 * IN THE MOOD'S GROUP gets a complete target, defaulting to fully open
 * ({volume: 1, tone: 1}) when the mood doesn't mention it. Channels in other
 * groups are not returned — so applying a mood to one group never disturbs
 * another group. Result is order-independent and idempotent per group.
 */
export function resolveMoodTargets(
  manifest: AudioManifest,
  moodId: string,
): Map<string, ResolvedTarget> {
  const mood = manifest.moods.find((m) => m.id === moodId)
  if (!mood) throw new Error(`unknown mood "${moodId}"`)
  const group = moodGroup(mood)
  const targets = new Map<string, ResolvedTarget>()
  for (const ch of manifest.channels) {
    if (channelGroup(ch) !== group) continue
    const t = mood.channels[ch.id]
    targets.set(ch.id, { volume: t?.volume ?? 1, tone: t?.tone ?? 1 })
  }
  return targets
}

export function resolveFadeTime(manifest: AudioManifest, mood: MoodDef): number {
  return mood.fadeTime ?? manifest.fadeTime
}
