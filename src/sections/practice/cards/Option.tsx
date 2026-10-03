import { IcCheck } from '../../../shared/components/icons';

export type OptState = 'idle' | 'sel' | 'right' | 'wrong';
export const Option = ({ label, state, none, onClick, disabled }: { label: string; state: OptState; none?: boolean; onClick: () => void; disabled?: boolean }) => (
  <button className={`opt${none ? ' none' : ''}${state !== 'idle' ? ` ${state}` : ''}`} disabled={disabled} aria-pressed={state === 'sel'} onClick={onClick}>
    <span className="box"><IcCheck /></span>{label}
  </button>
);
