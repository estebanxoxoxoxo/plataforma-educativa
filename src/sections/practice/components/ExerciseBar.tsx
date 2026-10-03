import { IcX } from '../../../shared/components/icons';

const RING = 87.96;
export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export const ExerciseBar = ({ progress, left, total, onClose }: { progress: number; left: number; total: number; onClose: () => void }) => (
  <div className="exbar">
    <button className="x" aria-label="Salir" onClick={onClose}><IcX /></button>
    <div className="expb"><i style={{ width: `${progress}%` }} /></div>
    <span className={`timer${left <= 10 ? ' low' : ''}`} aria-label={`Quedan ${left} segundos`}>
      <svg viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth="5" />
        <circle className="tr" cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={((1 - left / total) * RING).toFixed(2)} />
      </svg>
      <b>{fmtTime(left)}</b>
    </span>
  </div>
);
