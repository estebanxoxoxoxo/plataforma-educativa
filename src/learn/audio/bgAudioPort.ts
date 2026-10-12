/**
 * PORTE INNERITH (W2) — puerto de la MÚSICA DE FONDO del chico para el SceneDirector.
 *
 * En el POC, `sceneDirector.ts` importa estas 5 funciones de `lib/backgroundAudio` (el singleton
 * del MiniPlayer). En Innerith ese singleton es `src/shared/audio/bgAudio.ts`, que hoy NO expone
 * `getBgState`, `setMusicVolumeTransient` ni `playMusic` con estas firmas. W2 porta el director FIEL
 * pero SIN montarlo a nada (la integración con el MiniPlayer de Innerith y las escenas es de W3):
 * por eso el director importa de acá, con las MISMAS firmas que el POC, y este puerto queda INERTE
 * (fondo "sin sonar" → `applyFondo` del director no toca nada) hasta que W3 llame a `bindBgAudio`
 * con la implementación real sobre bgAudio (que tiene que replicar la semántica del POC:
 * `setMusicVolumeTransient` comanda unMute + setVolume con el tope parental SIN persistir ni tocar
 * state.volume; `unduck` des-mutea antes de playVideo; `getBgState` = lectura no-hook del estado).
 */

/** Lo que el director lee del estado del fondo (subconjunto de `BgAudioState` del POC). */
export interface BgAudioPortState {
  playing: boolean
  /** 0-100: la preferencia del chico (el director nunca la pisa). */
  volume: number
  /** Pausada automáticamente por un primer plano (no por el chico). */
  ducked: boolean
}

export interface BgAudioPort {
  getBgState: () => BgAudioPortState
  setMusicVolumeTransient: (v: number) => void
  duckForForeground: () => void
  unduck: () => void
  playMusic: (video: { videoId: string }, fromSeconds?: number, audioOnly?: boolean) => void
}

const INERT: BgAudioPort = {
  getBgState: () => ({ playing: false, volume: 0, ducked: false }),
  setMusicVolumeTransient: () => {},
  duckForForeground: () => {},
  unduck: () => {},
  playMusic: () => {},
}

let port: BgAudioPort = INERT

/** W3: enchufa el MiniPlayer real de Innerith (sin esto, el puerto es inerte). */
export function bindBgAudio(impl: BgAudioPort): void {
  port = impl
}

// --- misma superficie (nombres y firmas) que el `lib/backgroundAudio` del POC ---
export function getBgState(): BgAudioPortState {
  return port.getBgState()
}
export function setMusicVolumeTransient(v: number): void {
  port.setMusicVolumeTransient(v)
}
export function duckForForeground(): void {
  port.duckForForeground()
}
export function unduck(): void {
  port.unduck()
}
export function playMusic(video: { videoId: string }, fromSeconds = 0, audioOnly = false): void {
  port.playMusic(video, fromSeconds, audioOnly)
}
