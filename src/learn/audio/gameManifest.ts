import type { AudioManifest } from './engine'

/* Manifest del AudioEngine para Learn. Ids de canal = nombres de evento (chime/
   buzz/...) → el audioBridge conecta sin traducir. Los WAV CC0 (Kenney) viven en
   app/public/learn-audio/ (Vercel los sirve; el lab usaba un middleware).
   PORTE INNERITH (W2): los mismos 9 WAV, copiados tal cual a public/learn/audio/ (solo cambia el path). */
export const gameManifest: AudioManifest = {
  version: 1,
  baseUrl: '/learn/audio/',
  fadeTime: 0.8,
  channels: [
    { id: 'chime', file: 'fx-button.wav', mode: 'oneshot' }, // acierto
    { id: 'chime-hi', file: 'fx-forcefield.wav', mode: 'oneshot' }, // acierto con racha
    { id: 'buzz', file: 'fx-impact.wav', mode: 'oneshot' }, // error
    { id: 'hint', file: 'fx-servo.wav', mode: 'oneshot' }, // pista
    { id: 'fanfare', file: 'fx-door-open.wav', mode: 'oneshot' }, // ganar
    { id: 'fail', file: 'fx-door-close.wav', mode: 'oneshot' }, // perder/rendirse
    { id: 'bed', file: 'stem-amb-wind.wav', mode: 'loop', sync: false, group: 'ambient' }, // cama
    // TEMP demo — 2 temas para escuchar el crossfade (se sacan al armar el SceneDirector / meter música real)
    { id: 'temaA', file: 'demo-theme-a.wav', mode: 'loop', group: 'temaA' },
    { id: 'temaB', file: 'demo-theme-b.wav', mode: 'loop', group: 'temaB' },
  ],
  moods: [
    { id: 'play', group: 'ambient', channels: { bed: { volume: 0.4, tone: 0.9 } } },
    { id: 'tense', group: 'ambient', fadeTime: 0.4, channels: { bed: { volume: 0.75, tone: 0.5 } } },
    { id: 'win', group: 'ambient', fadeTime: 1.0, channels: { bed: { volume: 0.2 } } },
    { id: 'lose', group: 'ambient', fadeTime: 1.0, channels: { bed: { volume: 0.2, tone: 0.4 } } },
  ],
}
