import type { EcTx } from '../../../api/types';
import { IcCoin } from '../../../shared/components/icons';
import { useCycle } from '../../parent/lib/cycle';
import { fmtEc, fmtFull, fmtWhen, isoOf } from '../lib/format';

/** Un movimiento de la billetera: lo ganado practicando (+N ⚡, verde) o lo gastado en un canje (−N ⚡, rojo). La fecha, en
 *  la ZONA DE LA FAMILIA (useCycle().tz), igual que «Tus canjes»: el mismo canje dice la misma hora en las dos. */
export function TxRow({ t }: { t: EcTx }) {
  const tz = useCycle().tz;
  const earn = t.kind === 'earn';
  return (
    <li className="st-tx" data-tx={t.id} data-kind={t.kind}>
      <span className={`st-tx-ico ${earn ? 'is-earn' : 'is-spend'}`} aria-hidden="true">{earn ? <IcCoin className="ec-coin" aria-hidden="true" /> : '🎁'}</span>
      <span className="st-row-main">
        <b>{t.label}</b>
        <time dateTime={isoOf(t.ts)} title={fmtFull(t.ts, tz)}>{fmtWhen(t.ts, undefined, tz)}</time>
      </span>
      <span className={`st-tx-amt ${earn ? 'is-earn' : 'is-spend'}`}>
        <span className="st-sr">{earn ? 'Ganaste ' : 'Gastaste '}</span>{earn ? '+' : '−'}{fmtEc(t.amount)} <IcCoin className="ec-coin" aria-hidden="true" />
      </span>
    </li>
  );
}
