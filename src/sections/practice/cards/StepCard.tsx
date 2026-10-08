import { forwardRef, type CSSProperties } from 'react';
import type { NodeType } from '../../../api/types';
import { IcArrowRight, IcBolt, IcCheck, IcClock, IcLock } from '../../../shared/components/icons';
import { TYPES } from '../lib/exerciseTypes';

export type StepState = 'done' | 'current' | 'locked';

/** Un paso del recorrido: punto sobre el riel + tarjeta con tipo, de qué trata, tiempo, XP y estado.
 *  Toda la tarjeta es clickeable (salvo bloqueada). El ref apunta al punto del riel (para la animación). */
export const StepCard = forwardRef<HTMLSpanElement, {
  n: number; type: NodeType; state: StepState; prompt?: string; seconds?: number; xp: number;
  first: boolean; last: boolean; onOpen: () => void;
}>(({ n, type, state, prompt, seconds, xp, first, last, onOpen }, ref) => {
  const T = TYPES[type];
  const style = { '--c': T.c, '--d': T.d, '--soft': T.soft ?? '#F1F3F8' } as CSSProperties;
  return (
    <li className={`step ${state}${first ? ' first' : ''}${last ? ' last' : ''}`} style={style}>
      <span className="rail" aria-hidden><span className="dot" ref={ref}>{state === 'done' ? <IcCheck /> : state === 'locked' ? <IcLock /> : null}</span></span>
      <button className="scard" disabled={state === 'locked'} onClick={onOpen}
        aria-label={`${T.l}: ${state === 'locked' ? 'bloqueado' : prompt ?? ''}`}>
        {state === 'current' && <span className="snext">Siguiente</span>}
        <span className="sico"><T.G /></span>
        <span className="stxt">
          <small>{T.l}</small>
          <b>{state === 'locked' ? `Paso ${n + 1} · bloqueado` : prompt ?? T.s}</b>
          <span className="smeta">
            {seconds ? <span><IcClock />{seconds} s</span> : null}
            <span><IcBolt />+{xp} XP</span>
          </span>
        </span>
        {state === 'current' && <span className="sgo">Empezar<IcArrowRight /></span>}
        {state === 'done' && <span className="sdone"><IcCheck />Hecho</span>}
        {state === 'locked' && <IcLock className="slock" />}
      </button>
    </li>
  );
});
