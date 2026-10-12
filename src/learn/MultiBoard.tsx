import { useActivitySnapshot } from './react/useActivity'
import { type MultiEngine } from './activities/multi'
import { renderBoard } from './registry'
import './learn-engine.css'

/* Vista del Tipo Multi-actividad: progreso + el tablero del HIJO actual, resuelto
   por typeId desde el REGISTRY (única fuente de verdad typeId→Board → un multi
   anidado también renderiza). Sin chrome propio — vive dentro del Runner.
   PORTE INNERITH (W2): mismo DOM/textos que el POC; Tailwind → clases lrn-. */
export default function MultiBoard({ engine }: { engine: MultiEngine }) {
  const snap = useActivitySnapshot(engine)
  const child = engine.currentChild()

  return (
    <div className="lrn-multi">
      <div className="lrn-multi-head">
        <span className="lrn-multi-title">{snap.childTitle ?? 'Repaso'}</span>
        <span className="lrn-multi-count">
          {snap.total != null ? `Ejercicio ${snap.childIndex + 1} de ${snap.total}` : `Ejercicio ${snap.childIndex + 1}`}
        </span>
      </div>
      {child && renderBoard(child.typeId, child.instance)}
    </div>
  )
}
