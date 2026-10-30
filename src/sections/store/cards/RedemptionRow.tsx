import type { CSSProperties } from 'react';
import { IcCoin } from '../../../shared/components/icons';
import type { Redemption } from '../../../api/types';
import { useCycle } from '../../parent/lib/cycle';
import { fmtEc, fmtFull, fmtWhen, isoOf, tintFor } from '../lib/format';

/** Un canje del chico: qué fue, cuánto costó, cuándo, y si papá o mamá ya lo entregaron.
 *  U5: el premio de la semana de la liga de la familia (`origin: 'liga-familia'`) llega como un canje más, pero no costó ⚡
 *  (price 0, no es un ítem): en lugar del precio dice "🏆 Lo ganaste en la liga de la familia".
 *  La fecha, en la ZONA DE LA FAMILIA (useCycle().tz: la pared de la barra superior; QA-U5-E). */
export function RedemptionRow({ r, fresh }: { r: Redemption; fresh?: boolean }) {
  const tz = useCycle().tz;
  const done = r.status === 'entregado';
  const league = r.origin === 'liga-familia';
  return (
    <li className={`st-row${fresh ? ' is-new' : ''}${league ? ' stfp-row' : ''}`} data-redemption={r.id} data-origin={r.origin}>
      <span className="st-row-emo" style={{ '--tint': league ? '#FFF1CC' : tintFor(r.itemId) } as CSSProperties} aria-hidden="true">{r.emoji}</span>
      <span className="st-row-main">
        <b>{r.title}</b>
        {league
          ? <span className="stfp-orig"><span aria-hidden="true">🏆</span> Lo ganaste en la liga de la familia</span>
          : null}
        <time dateTime={isoOf(r.ts)} title={fmtFull(r.ts, tz)}>{fmtWhen(r.ts, undefined, tz)}</time>
      </span>
      {!league && <span className="st-row-amt"><IcCoin className="ec-coin" aria-hidden="true" /> {fmtEc(r.price)}<span className="st-sr"> Energy Coins</span></span>}
      <span className={`st-status ${done ? 'is-done' : 'is-pend'}`}>{done ? 'Entregado' : 'Pendiente'}</span>
    </li>
  );
}
