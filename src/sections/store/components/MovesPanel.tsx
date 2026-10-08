import { useState } from 'react';
import type { EcTx } from '../../../api/types';
import { TxRow } from '../cards/TxRow';

const SHOW = 6;

/** "Movimientos" de la billetera (secundario): lo ganado practicando y lo gastado en canjes.
 *  `tx === null` = no se pudo cargar. */
export function MovesPanel({ tx }: { tx: EcTx[] | null }) {
  const [all, setAll] = useState(false);
  const rows = tx ? (all ? tx : tx.slice(0, SHOW)) : [];
  return (
    <section className="st-panel st-panel--moves" aria-labelledby="st-moves-h">
      <header className="st-panel-head">
        <h3 id="st-moves-h">Movimientos</h3>
        <small>Lo que ganaste y lo que gastaste</small>
      </header>
      {tx === null ? (
        <p className="st-panel-empty">No pude cargar los movimientos ahora.</p>
      ) : tx.length === 0 ? (
        <p className="st-panel-empty">Todavía no hay movimientos: practicá y vas a ver acá tus primeros ⚡.</p>
      ) : (
        <ul className="st-list">{rows.map((t) => <TxRow key={t.id} t={t} />)}</ul>
      )}
      {tx && tx.length > SHOW && (
        <button type="button" className="st-more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? 'Ver menos' : `Ver todos (${tx.length})`}
        </button>
      )}
    </section>
  );
}
