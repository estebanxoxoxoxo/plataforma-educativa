import { forwardRef } from 'react';
import { IcCheck, IcLock, IcMedal } from '../../../shared/components/icons';
import type { StepState } from './StepCard';

/** Hito al final de una sección: una insignia con nombre, que se reclama al llegar. */
export const MilestoneCard = forwardRef<HTMLSpanElement, { badge: string; xp: number; state: StepState; last: boolean; onClaim: () => void }>(
  ({ badge, xp, state, last, onClaim }, ref) => (
    <li className={`step milestone ${state}${last ? ' last' : ''}`}>
      <span className="rail" aria-hidden><span className="dot" ref={ref}>{state === 'done' ? <IcCheck /> : state === 'locked' ? <IcLock /> : null}</span></span>
      <div className="mcardx">
        <span className="medal"><IcMedal /></span>
        <span className="stxt">
          <small>Insignia de la sección</small>
          <b>{badge}</b>
          <span className="mdesc">{state === 'done' ? `Ganada · +${xp} XP` : state === 'current' ? `¡Llegaste! Reclamala y sumá +${xp} XP` : 'Completá todos los ejercicios de la sección para ganarla'}</span>
        </span>
        {state === 'current' && <button className="claim" onClick={onClaim}>Reclamar insignia</button>}
        {state === 'done' && <span className="sdone"><IcCheck />Ganada</span>}
      </div>
    </li>
  ),
);
