import { IcCheck as Check, IcX as X } from '../shared/components/icons'
import { IcMinus as Minus } from './icons'
import { useActivitySnapshot } from './react/useActivity'
import { type MultipleChoiceEngine, type MCOption } from './activities/multiplechoice'
import './learn-engine.css'

/* Vista app-native (Tailwind) del multiple choice. Submit DIFERIDO: elegís (una o varias), y
   recién al "Comprobar" se corrige y las cards se DAN VUELTA (flip 3D) mostrando el resultado.
   Indicador redondo = una sola respuesta; cuadrado = varias. Respeta prefers-reduced-motion
   (motion-reduce: el giro es instantáneo). Los efectos (confeti/chime/shake) los dispara el
   audio/visual-bridge desde los mismos eventos move:correct/wrong del motor.
   PORTE INNERITH (W2): mismo DOM/textos/handlers que el POC; Tailwind → clases lrn-
   (learn-engine.css) y lucide → íconos de Innerith. Estética fina: W3. */

type Verdict = 'hit' | 'wrongPick' | 'missed' | 'skip'

function verdictOf(opt: MCOption, chosen: boolean): Verdict {
  if (chosen && opt.correct) return 'hit'
  if (chosen && !opt.correct) return 'wrongPick'
  if (!chosen && opt.correct) return 'missed'
  return 'skip'
}

const BACK_STYLE: Record<Verdict, string> = {
  hit: 'lrn-v-hit',
  wrongPick: 'lrn-v-wrongpick',
  missed: 'lrn-v-missed',
  skip: 'lrn-v-skip',
}

function OptionCard({
  opt,
  mode,
  selected,
  committed,
  onToggle,
}: {
  opt: MCOption
  mode: 'single' | 'multi'
  selected: boolean
  committed: boolean
  onToggle: () => void
}) {
  const verdict = verdictOf(opt, selected)
  // h-full + auto-rows-fr en la grilla → TODAS las cards igualan la más alta (parejas sin importar el texto).
  // min-h alto = más cuadradas y llenan el espacio; el texto va centrado vertical y horizontalmente.
  const faceBase = 'lrn-mc-face'
  return (
    <div className="lrn-mc-opt">
      <button
        type="button"
        disabled={committed}
        onClick={onToggle}
        aria-pressed={selected}
        className="lrn-mc-flip"
        style={committed ? { transform: 'rotateY(180deg)' } : undefined}>
        {/* FRONT — seleccionable */}
        <span className={`${faceBase} lrn-mc-front ${selected ? 'is-selected' : ''}`}>
          <span className={`lrn-mc-ind ${mode === 'single' ? 'is-single' : 'is-multi'} ${selected ? 'is-on' : ''}`}>
            <Check width={14} height={14} strokeWidth={3} />
          </span>
          <span className="lrn-mc-text">{opt.text}</span>
        </span>

        {/* BACK — resultado (overlay girado) */}
        <span className={`lrn-mc-back ${faceBase} ${BACK_STYLE[verdict]}`}>
          <span className="lrn-mc-backicon">
            {verdict === 'hit' && <Check width={20} height={20} strokeWidth={3} />}
            {verdict === 'missed' && <Check width={20} height={20} strokeWidth={3} />}
            {verdict === 'wrongPick' && <X width={20} height={20} strokeWidth={3} />}
            {verdict === 'skip' && <Minus width={18} height={18} strokeWidth={3} className="lrn-mc-skipicon" />}
          </span>
          <span className="lrn-mc-text">{opt.text}</span>
          {verdict === 'missed' && <span className="lrn-mc-was">era correcta</span>}
        </span>
      </button>
    </div>
  )
}

export default function MultipleChoiceBoard({ engine }: { engine: MultipleChoiceEngine }) {
  const snap = useActivitySnapshot(engine)
  const playing = snap.status === 'running'
  const q = snap.current
  const sel = new Set(snap.selected)
  const isLast = snap.index >= snap.total - 1
  const canCommit = snap.mode === 'single' ? snap.selected.length === 1 : snap.touched
  const allSelected = q ? snap.selected.length === q.options.length : false
  const noneSelected = snap.touched && snap.selected.length === 0

  return (
    <div className="lrn-mc">
      <p className="lrn-count is-center">
        Pregunta {Math.min(snap.index + 1, snap.total)} / {snap.total}
      </p>
      {q ? (
        <>
          <h2 className="lrn-mc-prompt">{q.prompt}</h2>
          <p className="lrn-mc-modehint">
            {snap.mode === 'single' ? 'Elegí una respuesta' : 'Podés elegir varias'}
          </p>

          {/* Atajos "Todas"/"Ninguna" — sólo en múltiple, antes de comprobar. */}
          {snap.mode === 'multi' && !snap.committed && (
            <div className="lrn-mc-shortcuts">
              <button
                type="button"
                disabled={!playing}
                onClick={() => engine.selectAll()}
                className={`lrn-chip ${allSelected ? 'is-on' : ''}`}>
                Todas
              </button>
              <button
                type="button"
                disabled={!playing}
                onClick={() => engine.clear()}
                className={`lrn-chip ${noneSelected ? 'is-on' : ''}`}>
                Ninguna
              </button>
            </div>
          )}

          <div className="lrn-mc-grid">
            {q.options.map((opt) => (
              <OptionCard
                key={opt.id}
                opt={opt}
                mode={snap.mode}
                selected={sel.has(opt.id)}
                committed={snap.committed}
                onToggle={() => engine.toggle(opt.id)}
              />
            ))}
          </div>

          <div className="lrn-mc-actions">
            {!snap.committed ? (
              <button
                type="button"
                disabled={!playing || !canCommit}
                onClick={() => engine.commit()}
                className={`lrn-cta ${canCommit ? '' : 'is-off'}`}>
                Comprobar
              </button>
            ) : (
              <button
                type="button"
                disabled={!playing}
                onClick={() => engine.next()}
                className="lrn-cta">
                {isLast ? 'Terminar' : 'Continuar'} →
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="lrn-done">¡Listo! 🎉</p>
      )}
    </div>
  )
}
