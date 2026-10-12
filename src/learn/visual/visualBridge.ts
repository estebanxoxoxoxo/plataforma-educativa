import type { ActivityEvent } from '../activity'
import type { VisualSink } from './types'

/* Puente eventos-de-actividad → efectos visuales. Mismo patrón que el audio: se
   suscribe al mismo onEvent, así un evento dispara fondo + destello juntos. */

const TENSE_AT_MS = 5000

export function createVisualBridge(sink: VisualSink): (event: ActivityEvent) => void {
  let tense = false
  return (event) => {
    switch (event.kind) {
      case 'started':
        tense = false
        sink.setBackground('play')
        break
      case 'move:correct':
        sink.burst({
          kind: event.streak >= 3 ? 'confetti' : 'spark',
          intensity: Math.min(1 + (event.streak - 1) * 0.2, 2.2),
        })
        sink.pop({ text: `+${event.points}`, tone: 'good' })
        sink.flash('good')
        break
      case 'move:wrong':
        sink.shake(1)
        sink.flash('bad')
        break
      case 'hint':
        sink.pop({ text: '💡', tone: 'good' })
        break
      case 'tick':
        if (!tense && event.remainingMs != null && event.remainingMs <= TENSE_AT_MS) {
          tense = true
          sink.setBackground('tense')
        }
        break
      case 'finished':
        if (event.result.outcome === 'completed') {
          sink.setBackground('win')
          sink.flash('win')
          sink.burst({ kind: 'confetti', intensity: 2.2, y: 0.3 })
        } else {
          sink.setBackground('lose')
        }
        break
      case 'paused':
      case 'resumed':
      case 'signal':
        break
    }
  }
}
