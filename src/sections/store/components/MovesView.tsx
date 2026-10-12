import type { EcTx } from '../../../api/types';
import { TxRow } from '../cards/TxRow';

/** "Tus movimientos" (/tienda?vista=movimientos): página propia, como la lista de deseos (pedido 12-oct:
 *  las tablas salieron de la vista principal). Todo lo ganado practicando y lo gastado en canjes, regalos
 *  y ropa, del más nuevo al más viejo, completo (acá no se trunca). `tx === null` = no se pudo cargar. */
export function MovesView({ tx, onBack }: { tx: EcTx[] | null; onBack: () => void }) {
  return (
    <>
      <a className="back st-back" href="/tienda" onClick={(e) => { e.preventDefault(); onBack(); }}>‹ Tienda</a>
      <header className="st-head">
        <h2 className="h2">Tus movimientos</h2>
        <p className="lede">Lo que ganaste y lo que gastaste, de lo más nuevo a lo más viejo.</p>
      </header>
      {tx === null ? (
        <p className="st-page-empty">No pude cargar los movimientos ahora. Probá recargando en un ratito.</p>
      ) : tx.length === 0 ? (
        <p className="st-page-empty">Todavía no hay movimientos: practicá y vas a ver acá tus primeros ⚡.</p>
      ) : (
        <ul className="st-list st-list--page">{tx.map((t) => <TxRow key={t.id} t={t} />)}</ul>
      )}
    </>
  );
}
