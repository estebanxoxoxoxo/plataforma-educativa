import { IcArrowRight, IcCheck, IcX } from '../../../shared/components/icons';

/** Pie de la ficha: mientras se responde, una ayuda + el botón; al corregir, el resultado dentro de la ficha. */
export const ResultBar = ({ result, title, detail, hint, label, enabled, busy, onClick }: {
  result?: 'good' | 'bad'; title?: string; detail?: string; hint: string; label: string; enabled: boolean; busy?: boolean; onClick: () => void;
}) => (
  <div className={`exfoot${result ? ` ${result}` : ''}`} aria-live="polite">
    {result
      ? <div className="rmsg"><span className="ric">{result === 'good' ? <IcCheck /> : <IcX />}</span><div><b>{title}</b><span>{detail}</span></div></div>
      : <span className="rhint">{hint}</span>}
    <button className={`act${enabled || result ? ' on' : ''}${busy ? ' busy' : ''}`} disabled={!enabled && !result} onClick={onClick}>
      {label}{(enabled || result) && !busy && <IcArrowRight />}
    </button>
  </div>
);
