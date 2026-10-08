import type { Redemption } from '../../../api/types';
import { fmtFull, fmtNum, fmtWhen, isoOf } from '../lib/format';

/** Un canje del chico visto por el padre. Pendiente → "Ya se lo di" · Entregado → tachado. Pura. */
export function DeliveryRow({ r, busy, onDeliver }: { r: Redemption; busy: boolean; onDeliver: () => void }) {
  const done = r.status === 'entregado';
  return (
    <li className={`pz-dl${done ? ' is-done' : ''}`} data-redemption={r.id}>
      <span className="pz-emo" aria-hidden="true">{r.emoji}</span>
      <span className="pz-dl-main">
        <span className="pz-dl-title">{r.title}</span>
        <span className="pz-dl-meta">
          <time dateTime={isoOf(r.ts)} title={fmtFull(r.ts)}>{fmtWhen(r.ts)}</time>
          {' · '}<span aria-hidden="true">⚡</span> {fmtNum(r.price)}<span className="pz-sr"> Energy Coins</span>
        </span>
      </span>
      {done ? (
        <span className="pz-state is-done">Entregado</span>
      ) : (
        <button type="button" className="pz-btn pz-btn--sm" disabled={busy} onClick={onDeliver} aria-label={`Ya se lo di: ${r.title}`}>Ya se lo di</button>
      )}
    </li>
  );
}
