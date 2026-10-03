import { IcCheck, IcX } from '../../../shared/components/icons';
import type { OptState } from './Option';

export const VFOption = ({ value, state, onClick, disabled }: { value: boolean; state: OptState; onClick: () => void; disabled?: boolean }) => (
  <button className={`opt${state !== 'idle' ? ` ${state}` : ''}`} disabled={disabled} aria-pressed={state === 'sel'} onClick={onClick}>
    {value ? <><IcCheck />Verdadero</> : <><IcX />Falso</>}
  </button>
);
