import { useActivitySnapshot } from './react/useActivity'
import { type FlashcardsEngine } from './activities/flashcards'
import './learn-engine.css'
import { L } from '../shared/lib/lang'

/* Vista app-native (Tailwind) de flashcards, sobre el motor portado. Mirá el frente,
   pensá la respuesta, dala vuelta y autocalificate (¿la sabías?). Sin CSS del lab.
   PORTE SMARTY (W2): mismo DOM/textos/handlers que el POC; las clases Tailwind pasan a
   clases lrn- (learn-engine.css) sobre los tokens de Smarty. Estética fina: W3. */
export default function FlashcardsBoard({ engine }: { engine: FlashcardsEngine }) {
  const snap = useActivitySnapshot(engine)
  const playing = snap.status === 'running'
  const card = snap.current

  return (
    <div className="lrn-fc">
      <p className="lrn-count">
        {L('Tarjeta', 'Card')} {Math.min(snap.index + 1, snap.total)} / {snap.total}
      </p>
      {card ? (
        <>
          <button
            type="button"
            disabled={!playing || snap.revealed}
            onClick={() => engine.reveal()}
            className={`lrn-fc-card ${snap.revealed ? 'is-revealed' : ''}`}>
            <div className="lrn-fc-front">{card.front}</div>
            {snap.revealed ? (
              <div className="lrn-fc-back">{card.back}</div>
            ) : card.hint ? (
              <div className="lrn-fc-hint">💡 {card.hint}</div>
            ) : (
              <div className="lrn-fc-tap">{L('tocá para dar vuelta', 'tap to flip')}</div>
            )}
          </button>

          {snap.revealed ? (
            <div className="lrn-grade">
              <button
                type="button"
                disabled={!playing}
                onClick={() => engine.grade(false)}
                className="lrn-btn lrn-btn-no">
                {L('No la sabía', "Didn't know it")}
              </button>
              <button
                type="button"
                disabled={!playing}
                onClick={() => engine.grade(true)}
                className="lrn-btn lrn-btn-yes">
                {L('La sabía', 'Knew it')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!playing}
              onClick={() => engine.reveal()}
              className="lrn-btn lrn-btn-flip">
              {L('Dar vuelta', 'Flip')}
            </button>
          )}
        </>
      ) : (
        <p className="lrn-done">{L('Mazo completo ✓', 'Deck complete ✓')}</p>
      )}
      <p className="lrn-help">
        {playing ? L('Pensá la respuesta, dala vuelta y decí si la sabías.', 'Think of the answer, flip it, and say if you knew it.') : ''}
      </p>
    </div>
  )
}
