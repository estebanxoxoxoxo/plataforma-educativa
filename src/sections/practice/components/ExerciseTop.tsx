import { IcX } from '../../../shared/components/icons';

const RING = 2 * Math.PI * 9;
export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Barra superior del ejercicio: salir, paso y avance de la unidad, y el tiempo restante. */
export const ExerciseTop = ({ step, progress, left, total, onClose }: { step: number; progress: number; left: number; total: number; onClose: () => void }) => (
  <div className="extop">
    <button className="exit" onClick={onClose}><IcX />Salir</button>
    <div className="exprog">
      <small>Paso {step}</small>
      <span className="exbar"><i style={{ width: `${progress}%` }} /></span>
    </div>
    <span className={`clock${left <= 10 ? ' low' : ''}`} aria-label={`Quedan ${left} segundos`}>
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="9" className="cbg" />
        <circle cx="12" cy="12" r="9" className="cfg" strokeDasharray={RING} strokeDashoffset={((1 - left / total) * RING).toFixed(2)} />
      </svg>
      <b>{fmtTime(left)}</b>
    </span>
  </div>
);
