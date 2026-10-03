import { forwardRef, type CSSProperties } from 'react';
import type { NodeType } from '../../../api/types';
import { TYPES } from '../lib/exerciseTypes';

export const JourneyNode = forwardRef<HTMLButtonElement, { type: NodeType; state: 'done' | 'current' | 'locked'; x: number; y: number; onClick: () => void }>(
  ({ type, state, x, y, onClick }, ref) => {
    const T = TYPES[type];
    const style = { left: `calc(50% + ${x}px)`, top: y, '--c': T.c, '--d': T.d } as CSSProperties;
    return (
      <button ref={ref} className={`node t-${type} ${state}${type === 'skip' ? ' skip' : ''}`} style={style}
        disabled={state === 'locked'} aria-label={`${T.l ?? 'Hito'} (${state === 'done' ? 'completado' : state === 'current' ? 'actual' : 'bloqueado'})`} onClick={onClick}>
        <T.G />
        <span className="tip">{type === 'skip' ? '¿SALTAR AQUÍ?' : 'EMPEZAR'}</span>
      </button>
    );
  },
);
