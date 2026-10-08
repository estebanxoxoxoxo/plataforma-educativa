import type { CSSProperties } from 'react';
import type { Redemption } from '../../../api/types';
import { fmtEc, fmtFull, fmtWhen, isoOf, tintFor } from '../lib/format';

/** Un canje del chico: qué fue, cuánto costó, cuándo, y si papá o mamá ya lo entregaron. */
export function RedemptionRow({ r, fresh }: { r: Redemption; fresh?: boolean }) {
  const done = r.status === 'entregado';
  return (
    <li className={`st-row${fresh ? ' is-new' : ''}`} data-redemption={r.id}>
      <span className="st-row-emo" style={{ '--tint': tintFor(r.itemId) } as CSSProperties} aria-hidden="true">{r.emoji}</span>
      <span className="st-row-main">
        <b>{r.title}</b>
        <time dateTime={isoOf(r.ts)} title={fmtFull(r.ts)}>{fmtWhen(r.ts)}</time>
      </span>
      <span className="st-row-amt"><span aria-hidden="true">⚡</span> {fmtEc(r.price)}<span className="st-sr"> Energy Coins</span></span>
      <span className={`st-status ${done ? 'is-done' : 'is-pend'}`}>{done ? 'Entregado' : 'Pendiente'}</span>
    </li>
  );
}
