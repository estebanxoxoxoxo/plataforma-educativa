import type { CSSProperties } from 'react';
import type { RecallAnswerResult } from '../../../api/types';
import { IcArrowRight } from '../../../shared/components/icons';
import { levelOf, RANK } from '../lib/levels';
import { LevelBadge } from './LevelBadge';

/** Cómo quedó la carta después de responder: el nivel de antes → el de ahora (el nuevo entra con un saltito) y la
 *  barra de fuerza que se mueve de un valor al otro. Sin retos: si costó, "va a volver pronto". */
export function StrengthChange({ fact }: { fact: RecallAnswerResult['fact'] }) {
  const before = Math.max(0, Math.min(100, fact.strength - fact.delta));
  const from = levelOf(before), to = fact.level;
  const changed = from !== to;
  const up = RANK[to] > RANK[from];
  const title = up ? '¡Subió de nivel!'
    : changed || fact.delta < 0 ? 'Va a volver pronto para que la afiances'
    : to === 'firme' ? '¡Sigue firme!' // también una firme que ya estaba en 100 (delta 0)
    : fact.delta > 0 ? 'Se está afianzando'
    : 'Así está esta carta';
  const tone = up ? 'up' : fact.delta < 0 ? 'down' : fact.delta > 0 ? 'gain' : 'same';
  return (
    <div className={`rc-change rc-change--${tone}`}>
      <div className="rc-change-head">
        <b>{title}</b>
        <span className="rc-change-lvls">
          {changed && <><LevelBadge level={from} className="rc-lv--old" /><IcArrowRight className="rc-change-arrow" aria-hidden="true" /></>}
          <LevelBadge level={to} pop={changed || fact.delta !== 0} />
        </span>
      </div>
      <span className={`rc-meter rc-meter--${to}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fact.strength} aria-label="Qué tan firme está esta carta">
        <i className="rc-grow" style={{ width: `${fact.strength}%`, '--from': `${before}%`, '--to': `${fact.strength}%` } as CSSProperties} />
      </span>
    </div>
  );
}
