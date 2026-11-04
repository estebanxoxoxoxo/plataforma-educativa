import { useActivitySnapshot } from './react/useActivity'
import { type MultiEngine } from './activities/multi'
import { renderBoard } from './registry'
import './learn-engine.css'

/* Vista del Tipo Multi-actividad: progreso + el tablero del HIJO actual, resuelto
   por typeId desde el REGISTRY (única fuente de verdad typeId→Board → un multi
   anidado también renderiza). Sin chrome propio — vive dentro del Runner.
   PORTE SMARTY (W2): mismo DOM/textos que el POC; Tailwind → clases lrn-. */
export default function MultiBoard({ engine }: { engine: MultiEngine }) {
  const snap = useActivitySnapshot(engine)
  const child = engine.currentChild()

  return (
    <div className="lrn-multi">
      <div className="lrn-multi-head">
        {/* subtitle (aditivo 4-nov): en el recall, el CURSO del que viene la pregunta */}
        <span className="lrn-multi-left">
          {snap.childSubtitle && <span className="lrn-multi-course">{snap.childSubtitle}</span>}
          <span className="lrn-multi-title">{snap.childTitle ?? 'Repaso'}</span>
        </span>
        <span className="lrn-multi-count">
          {snap.total != null ? `Ejercicio ${snap.childIndex + 1} de ${snap.total}` : `Ejercicio ${snap.childIndex + 1}`}
        </span>
      </div>
      {child && renderBoard(child.typeId, child.instance)}
    </div>
  )
}
