import type { CSSProperties } from 'react';
import { IcX } from '../../../shared/components/icons';
import { fmtTime } from '../../practice/components/ExerciseTop';

const RING = 2 * Math.PI * 9;

/** Barra de arriba de la sesión, con la misma gramática que la ficha de Practicar (reusa sus clases .extop/.exbar/
 *  .clock): salir, "Carta 3 de 10" con el avance del mazo y el reloj. La barra crece desde donde quedó la carta
 *  anterior (`from`) aunque la carta se vuelva a montar. */
export const RecallTop = ({ pos, total, progress, from, left, seconds, onClose }: {
  pos: number; total: number; progress: number; from: number; left: number; seconds: number; onClose: () => void;
}) => (
  <div className="extop rc-top">
    <button className="exit" onClick={onClose}><IcX />Salir</button>
    <div className="exprog">
      <small>Carta {pos} de {total}</small>
      <span className="exbar"><i className="rc-grow" style={{ width: `${progress}%`, '--from': `${from}%`, '--to': `${progress}%` } as CSSProperties} /></span>
    </div>
    <span className={`clock${left <= 10 ? ' low' : ''}`} aria-label={`Quedan ${left} segundos`}>
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="9" className="cbg" />
        <circle cx="12" cy="12" r="9" className="cfg" strokeDasharray={RING} strokeDashoffset={((1 - left / seconds) * RING).toFixed(2)} />
      </svg>
      <b>{fmtTime(left)}</b>
    </span>
  </div>
);
