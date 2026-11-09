import type { EcTx } from '../../../api/types';
import { IcCoin } from '../../../shared/components/icons';
import { TxRow } from '../cards/TxRow';
import { L } from '../../../shared/lib/lang';

/** "Tus movimientos" (/tienda?vista=movimientos): página propia, como la lista de deseos (pedido 12-oct:
 *  las tablas salieron de la vista principal). Todo lo ganado practicando y lo gastado en canjes, regalos
 *  y ropa, del más nuevo al más viejo, completo (acá no se trunca). `tx === null` = no se pudo cargar. */
export function MovesView({ tx, onBack }: { tx: EcTx[] | null; onBack: () => void }) {
  return (
    <>
      <a className="back st-back" href="/tienda" onClick={(e) => { e.preventDefault(); onBack(); }}>{L('‹ Tienda', '‹ Store')}</a>
      <header className="st-head">
        <h2 className="h2">{L('Tus movimientos', 'Your activity')}</h2>
        <p className="lede">{L('Lo que ganaste y lo que gastaste, de lo más nuevo a lo más viejo.', 'What you earned and what you spent, newest first.')}</p>
      </header>
      {tx === null ? (
        <p className="st-page-empty">{L('No pude cargar los movimientos ahora. Probá recargando en un ratito.', 'I couldn’t load your activity right now. Try reloading in a little bit.')}</p>
      ) : tx.length === 0 ? (
        <p className="st-page-empty">{L('Todavía no hay movimientos: practicá y vas a ver acá tus primeros', 'No activity yet: practice and you’ll see your first')} <IcCoin className="ec-coin" aria-hidden="true" />.</p>
      ) : (
        <ul className="st-list st-list--page">{tx.map((t) => <TxRow key={t.id} t={t} />)}</ul>
      )}
    </>
  );
}
