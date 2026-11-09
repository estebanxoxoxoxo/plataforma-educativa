import type { Redemption } from '../../../api/types';
import { IcCoin } from '../../../shared/components/icons';
import { RedemptionRow } from '../cards/RedemptionRow';
import { L } from '../../../shared/lib/lang';

/** "Tus canjes" (/tienda?vista=canjes): página propia, como la lista de deseos (pedido 12-oct: las
 *  tablas salieron de la vista principal). Lo canjeado del más nuevo al más viejo con su estado de
 *  entrega, completo (acá no se trunca). `fresh` resalta el canje recién hecho.
 *  `list === null` = no se pudo cargar. */
export function RedemptionsView({ list, fresh, onBack }: {
  list: Redemption[] | null; fresh: number | null; onBack: () => void;
}) {
  const pend = list?.filter((r) => r.status === 'pendiente').length ?? 0;
  return (
    <>
      <a className="back st-back" href="/tienda" onClick={(e) => { e.preventDefault(); onBack(); }}>{L('‹ Tienda', '‹ Store')}</a>
      <header className="st-head">
        <h2 className="h2">{L('Tus canjes', 'Your redemptions')}</h2>
        <p className="lede">
          {pend > 0
            ? pend === 1 ? L('Uno espera que tus papás te lo den.', 'One is waiting for your parents to give it to you.') : L(`${pend} esperan que tus papás te los den.`, `${pend} are waiting for your parents to give them to you.`)
            : L('Cuando canjeás un premio aparece acá, pendiente hasta que tus papás te lo den.', 'When you redeem a prize it shows up here, pending until your parents give it to you.')}
        </p>
      </header>
      {list === null ? (
        <p className="st-page-empty">{L('No pude cargar tus canjes ahora. Probá recargando en un ratito.', 'I couldn’t load your redemptions right now. Try reloading in a little bit.')}</p>
      ) : list.length === 0 ? (
        <p className="st-page-empty">{L('Todavía no canjeaste nada. Elegí un premio en la Tienda y canjealo con tus', 'You haven’t redeemed anything yet. Pick a prize in the Store and redeem it with your')} <IcCoin className="ec-coin" aria-hidden="true" />.</p>
      ) : (
        <ul className="st-list st-list--page">{list.map((r) => <RedemptionRow key={r.id} r={r} fresh={r.id === fresh} />)}</ul>
      )}
    </>
  );
}
