import type { Redemption } from '../../../api/types';
import { IcCoin } from '../../../shared/components/icons';
import { useCycle } from '../lib/cycle';
import { fmtDay, fmtFull, fmtNum, fmtWhen, isoOf } from '../lib/format';

/** Un canje del chico visto por el padre. Pendiente → "Ya se lo di" · Entregado → tachado.
 *  U5 (spec §3.4.5): el premio de la semana de la LIGA DE LA FAMILIA llega como un canje con `origin: 'liga-familia'`
 *  (itemId 0, price 0: no es un ítem de la Tienda ni movió ⚡); en lugar del "⚡ 0" dice "🏆 De la liga de la familia ·
 *  cerró el 28 oct" y se entrega con el MISMO "Ya se lo di". Las fechas, en la ZONA DE LA FAMILIA (useCycle().tz, la misma
 *  pared que la barra superior; QA-U5-E: antes, la del navegador → «cerró el 1 nov» con la barra en «lun 2 nov»). */
export function DeliveryRow({ r, busy, onDeliver }: { r: Redemption; busy: boolean; onDeliver: () => void }) {
  const tz = useCycle().tz;
  const done = r.status === 'entregado';
  const closedAt = r.closedAt ?? r.ts;
  return (
    <li className={`pz-dl${done ? ' is-done' : ''}`} data-redemption={r.id} data-origin={r.origin}>
      <span className="pz-emo" aria-hidden="true">{r.emoji}</span>
      <span className="pz-dl-main">
        <span className="pz-dl-title">{r.title}</span>
        <span className="pz-dl-meta">
          {r.origin === 'liga-familia' ? (
            <>
              <span aria-hidden="true">🏆</span> De la liga de la familia · cerró el{' '}
              <time dateTime={isoOf(closedAt)} title={fmtFull(closedAt, tz)}>{fmtDay(closedAt, tz)}</time>
            </>
          ) : (
            <>
              <time dateTime={isoOf(r.ts)} title={fmtFull(r.ts, tz)}>{fmtWhen(r.ts, undefined, tz)}</time>
              {' · '}<IcCoin className="ec-coin" aria-hidden="true" /> {fmtNum(r.price)}<span className="pz-sr"> Energy Coins</span>
            </>
          )}
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
