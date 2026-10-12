import { useActivitySnapshot } from './react/useActivity'
import { type QuizEngine } from './activities/quiz'
import './learn-engine.css'

/* Vista app-native (Tailwind) del quiz, sobre el motor portado. Elegí la respuesta;
   si fallás, esa opción se descarta y seguís en la misma pregunta. Sin CSS del lab.
   PORTE INNERITH (W2): mismo DOM/textos/handlers que el POC; Tailwind → clases lrn-
   (learn-engine.css). Estética fina: W3. */
export default function QuizBoard({ engine }: { engine: QuizEngine }) {
  const snap = useActivitySnapshot(engine)
  const playing = snap.status === 'running'
  const q = snap.current

  return (
    <div className="lrn-quiz">
      <p className="lrn-count">
        Pregunta {Math.min(snap.index + 1, snap.total)} / {snap.total}
      </p>
      {q ? (
        <>
          <div className="lrn-quiz-prompt">
            {q.prompt}
          </div>
          <div className="lrn-quiz-grid">
            {q.options.map((opt) => {
              const ruled = snap.ruledOut.includes(opt)
              return (
                <button
                  key={opt}
                  disabled={!playing || ruled}
                  onClick={() => engine.answer(opt)}
                  className={`lrn-quiz-opt ${ruled ? 'is-ruled' : ''}`}>
                  {opt}
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <p className="lrn-done">¡Quiz completo! 🎉</p>
      )}
      <p className="lrn-help">
        {playing ? 'Tocá la respuesta correcta. Si fallás, esa opción se descarta.' : ''}
      </p>
    </div>
  )
}
