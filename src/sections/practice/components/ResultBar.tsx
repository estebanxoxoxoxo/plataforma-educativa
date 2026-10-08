import { IcArrowRight, IcCheck, IcX } from '../../../shared/components/icons';

/** Pie de la ficha: mientras se responde, una ayuda + el botón; al corregir, el resultado dentro de la ficha
 *  y, si el acierto sumó, el premio real (+N ⚡: XP de la semana y Energy Coin). Sin `prize` no hay pastilla:
 *  el contenedor no lo pasa si el padre apagó la Tienda (la moneda no existe para el chico). */
export const ResultBar = ({ result, title, detail, hint, label, enabled, busy, prize, onClick }: {
  result?: 'good' | 'bad'; title?: string; detail?: string; hint: string; label: string; enabled: boolean; busy?: boolean; prize?: number; onClick: () => void;
}) => (
  <div className={`exfoot${result ? ` ${result}` : ''}`} aria-live="polite">
    {result
      ? <div className="rmsg"><span className="ric">{result === 'good' ? <IcCheck /> : <IcX />}</span><div><b>{title}</b><span>{detail}</span></div></div>
      : <span className="rhint">{hint}</span>}
    {result === 'good' && !!prize && <span className="exprize" aria-label={`Ganaste ${prize} puntos`}>+{prize} ⚡</span>}
    <button className={`act${enabled || result ? ' on' : ''}${busy ? ' busy' : ''}`} disabled={!enabled && !result} onClick={onClick}>
      {label}{(enabled || result) && !busy && <IcArrowRight />}
    </button>
  </div>
);
