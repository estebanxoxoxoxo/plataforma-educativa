import { useState, type Ref } from 'react';
import type { Redemption } from '../../../api/types';
import { RedemptionRow } from '../cards/RedemptionRow';

const SHOW = 5;

/** "Tus canjes": lo canjeado, del más nuevo al más viejo, con su estado de entrega.
 *  `list === null` = no se pudo cargar (el resto de la Tienda sigue andando). */
export function RedemptionsPanel({ list, fresh, ref }: { list: Redemption[] | null; fresh: number | null; ref?: Ref<HTMLElement> }) {
  const [all, setAll] = useState(false);
  const pend = list?.filter((r) => r.status === 'pendiente').length ?? 0;
  const rows = list ? (all ? list : list.slice(0, SHOW)) : [];
  return (
    <section className="st-panel" id="st-canjes" ref={ref} tabIndex={-1} aria-labelledby="st-canjes-h">
      <header className="st-panel-head">
        <h3 id="st-canjes-h">Tus canjes</h3>
        {pend > 0 && <small>{pend === 1 ? '1 espera que papá o mamá te lo den' : `${pend} esperan que papá o mamá te los den`}</small>}
      </header>
      {list === null ? (
        <p className="st-panel-empty">No pude cargar tus canjes ahora. Probá recargando en un ratito.</p>
      ) : list.length === 0 ? (
        <div className="st-panel-empty">
          <p>Todavía no canjeaste nada.</p>
          <small>Cuando canjees un premio aparece acá, pendiente hasta que papá o mamá te lo den.</small>
        </div>
      ) : (
        <ul className="st-list">{rows.map((r) => <RedemptionRow key={r.id} r={r} fresh={r.id === fresh} />)}</ul>
      )}
      {list && list.length > SHOW && (
        <button type="button" className="st-more" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? 'Ver menos' : `Ver todos (${list.length})`}
        </button>
      )}
    </section>
  );
}
