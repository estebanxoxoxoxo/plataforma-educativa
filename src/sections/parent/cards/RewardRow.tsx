import { fmtNum, stockLabel } from '../lib/format';
import type { ParentItemView } from '../lib/types';

/** Fila de la tabla de premios del padre: emoji (chico), título y descripción, precio, stock, estado y
 *  acciones. Publicado → Editar / Archivar · Archivado → Reactivar. Pura. */
export function RewardRow({ it, busy, fresh, onEdit, onArchive, onRestore }: {
  it: ParentItemView;
  busy: boolean;
  /** Recién publicado o editado: se resalta un momento. */ fresh: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const out = !it.archived && it.left !== null && it.left <= 0;
  return (
    <tr className={`pz-tr${it.archived ? ' is-archived' : ''}${fresh ? ' is-fresh' : ''}`} data-item={it.id}>
      <td className="pz-td-emo"><span className="pz-emo" aria-hidden="true">{it.emoji}</span></td>
      <td className="pz-td-main">
        <span className="pz-cell-title">{it.title}</span>
        {it.desc && <span className="pz-cell-sub" title={it.desc}>{it.desc}</span>}
      </td>
      <td className="pz-td-num"><span className="pz-price"><span aria-hidden="true">⚡</span> {fmtNum(it.price)}<span className="pz-sr"> Energy Coins</span></span></td>
      <td className={`pz-td-stock${out ? ' is-out' : ''}`}>{stockLabel(it)}</td>
      <td><span className={`pz-state ${it.archived ? 'is-archived' : 'is-live'}`}>{it.archived ? 'Archivado' : 'Publicado'}</span></td>
      <td className="pz-td-act">
        {it.archived ? (
          <button type="button" className="pz-link" disabled={busy} onClick={onRestore}>Reactivar</button>
        ) : (
          <>
            <button type="button" className="pz-link" disabled={busy} onClick={onEdit} aria-label={`Editar ${it.title}`}>Editar</button>
            <button type="button" className="pz-link pz-link--quiet" disabled={busy} onClick={onArchive} aria-label={`Archivar ${it.title}`}>Archivar</button>
          </>
        )}
      </td>
    </tr>
  );
}
