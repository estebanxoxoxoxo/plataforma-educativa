import type { EcTx } from '../../../api/types';
import { fmtEc, fmtFull, fmtWhen, isoOf } from '../lib/format';

/** Un movimiento de la billetera: lo ganado practicando (+N ⚡, verde) o lo gastado en un canje (−N ⚡, rojo). */
export function TxRow({ t }: { t: EcTx }) {
  const earn = t.kind === 'earn';
  return (
    <li className="st-tx" data-tx={t.id} data-kind={t.kind}>
      <span className={`st-tx-ico ${earn ? 'is-earn' : 'is-spend'}`} aria-hidden="true">{earn ? '⚡' : '🎁'}</span>
      <span className="st-row-main">
        <b>{t.label}</b>
        <time dateTime={isoOf(t.ts)} title={fmtFull(t.ts)}>{fmtWhen(t.ts)}</time>
      </span>
      <span className={`st-tx-amt ${earn ? 'is-earn' : 'is-spend'}`}>
        <span className="st-sr">{earn ? 'Ganaste ' : 'Gastaste '}</span>{earn ? '+' : '−'}{fmtEc(t.amount)} ⚡
      </span>
    </li>
  );
}
