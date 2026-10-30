import type { Redemption } from '../../../api/types';
import { IcCoin } from '../../../shared/components/icons';
import { RedemptionRow } from '../cards/RedemptionRow';

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
      <a className="back st-back" href="/tienda" onClick={(e) => { e.preventDefault(); onBack(); }}>‹ Tienda</a>
      <header className="st-head">
        <h2 className="h2">Tus canjes</h2>
        <p className="lede">
          {pend > 0
            ? pend === 1 ? 'Uno espera que papá o mamá te lo den.' : `${pend} esperan que papá o mamá te los den.`
            : 'Cuando canjeás un premio aparece acá, pendiente hasta que papá o mamá te lo den.'}
        </p>
      </header>
      {list === null ? (
        <p className="st-page-empty">No pude cargar tus canjes ahora. Probá recargando en un ratito.</p>
      ) : list.length === 0 ? (
        <p className="st-page-empty">Todavía no canjeaste nada. Elegí un premio en la Tienda y canjealo con tus <IcCoin className="ec-coin" aria-hidden="true" />.</p>
      ) : (
        <ul className="st-list st-list--page">{list.map((r) => <RedemptionRow key={r.id} r={r} fresh={r.id === fresh} />)}</ul>
      )}
    </>
  );
}
