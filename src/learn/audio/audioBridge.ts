import type { ActivityEvent } from '../activity'

/* Puente eventos-de-actividad → audio. Mismo patrón que el visual: se suscribe al
   mismo onEvent y traduce a llamadas del AudioSink (que delega en el engine
   singleton). Los ids coinciden con los canales del gameManifest. */

export interface AudioSink {
  triggerFx: (id: string, opts?: { volume?: number }) => void
  setMood: (id: string) => void
}

const TENSE_AT_MS = 5000

export function createAudioBridge(sink: AudioSink): (event: ActivityEvent) => void {
  let tense = false
  return (event) => {
    switch (event.kind) {
      case 'started':
        tense = false
        sink.setMood('play')
        break
      case 'move:correct':
        sink.triggerFx(event.streak >= 3 ? 'chime-hi' : 'chime', { volume: 0.9 })
        break
      case 'move:wrong':
        sink.triggerFx('buzz', { volume: 0.7 })
        break
      case 'hint':
        sink.triggerFx('hint')
        break
      case 'tick':
        if (!tense && event.remainingMs != null && event.remainingMs <= TENSE_AT_MS) {
          tense = true
          sink.setMood('tense')
        }
        break
      case 'finished':
        sink.setMood(event.result.outcome === 'completed' ? 'win' : 'lose')
        sink.triggerFx(event.result.outcome === 'completed' ? 'fanfare' : 'fail')
        break
      case 'paused':
      case 'resumed':
      case 'signal':
        break
    }
  }
}
