import { IcCheck, IcNone, IcX } from '../../../shared/components/icons';

export type OptState = 'idle' | 'sel' | 'right' | 'wrong';

/** Opción de multiple choice: letra (A, B, C…) + texto. "Ninguna" ocupa todo el ancho. */
export const Option = ({ letter, label, state, none, onClick, disabled }: {
  letter?: string; label: string; state: OptState; none?: boolean; onClick: () => void; disabled?: boolean;
}) => (
  <button className={`opt${none ? ' none' : ''}${state !== 'idle' ? ` ${state}` : ''}`} disabled={disabled} aria-pressed={state === 'sel'} onClick={onClick}>
    <span className="key">{state === 'right' ? <IcCheck /> : state === 'wrong' ? <IcX /> : none ? <IcNone /> : letter}</span>
    <span className="olabel">{label}</span>
  </button>
);
