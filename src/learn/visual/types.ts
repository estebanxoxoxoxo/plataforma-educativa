/** Contrato del sistema visual de actividades (ver ACTIVIDADES.md). Espejo del
 *  AudioSink: la actividad emite eventos; el visualBridge los traduce a efectos. */

export type FxMood = 'play' | 'tense' | 'win' | 'lose'
export type BurstKind = 'spark' | 'confetti'
export type FxTone = 'good' | 'bad' | 'win'

export interface BurstOptions {
  kind?: BurstKind
  x?: number
  y?: number
  intensity?: number
}

export interface PopOptions {
  text: string
  x?: number
  y?: number
  tone?: Exclude<FxTone, 'win'>
}

export interface VisualSink {
  burst: (opts?: BurstOptions) => void
  flash: (tone: FxTone) => void
  shake: (intensity?: number) => void
  pop: (opts: PopOptions) => void
  setBackground: (mood: FxMood) => void
}

export const noopVisualSink: VisualSink = {
  burst: () => {},
  flash: () => {},
  shake: () => {},
  pop: () => {},
  setBackground: () => {},
}
