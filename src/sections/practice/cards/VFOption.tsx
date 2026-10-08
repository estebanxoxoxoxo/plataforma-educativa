import { IcCheck, IcX } from '../../../shared/components/icons';
import type { OptState } from './Option';

/** Opción de verdadero o falso: un tile grande con su ícono. */
export const VFOption = ({ value, state, onClick, disabled }: { value: boolean; state: OptState; onClick: () => void; disabled?: boolean }) => (
  <button className={`vfopt ${value ? 'yes' : 'no'}${state !== 'idle' ? ` ${state}` : ''}`} disabled={disabled} aria-pressed={state === 'sel'} onClick={onClick}>
    <span className="vfic">{value ? <IcCheck /> : <IcX />}</span>
    {value ? 'Verdadero' : 'Falso'}
  </button>
);
