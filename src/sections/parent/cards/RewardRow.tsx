import { fmtNum, stockLabel } from '../lib/format';
import { IcCoin } from '../../../shared/components/icons';
import type { ParentItemView } from '../lib/types';
import { L } from '../../../shared/lib/lang';

/** Fila de la tabla de premios del padre: emoji (chico), título y descripción, precio, stock, estado y
 *  acciones. Publicado → Editar / Archivar · Archivado → Reactivar. Pura.
 *  Teléfono (tanda T5): la tabla se APILA (parent.css: cada fila, una tarjetita) y ahí la celda de stock muestra su
 *  `data-label` («Stock: Quedan 2 de 5»; las demás se entienden solas). Los `role` explícitos son a propósito: Safari deja
 *  de exponer como tabla una <table> a la que el CSS le cambia el display; con los roles, el lector de pantalla la sigue
 *  recorriendo como tabla (con sus encabezados) también apilada. */
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
    <tr role="row" className={`pz-tr${it.archived ? ' is-archived' : ''}${fresh ? ' is-fresh' : ''}`} data-item={it.id}>
      <td role="cell" className="pz-td-emo"><span className="pz-emo" aria-hidden="true">{it.emoji}</span></td>
      <td role="cell" className="pz-td-main">
        <span className="pz-cell-title">{it.title}</span>
        {it.desc && <span className="pz-cell-sub" title={it.desc}>{it.desc}</span>}
      </td>
      <td role="cell" className="pz-td-num" data-label={L('Precio', 'Price')}><span className="pz-price"><IcCoin className="ec-coin" aria-hidden="true" /> {fmtNum(it.price)}<span className="pz-sr"> Energy Coins</span></span></td>
      <td role="cell" className={`pz-td-stock${out ? ' is-out' : ''}`} data-label={L('Stock', 'Stock')}>{stockLabel(it)}</td>
      <td role="cell" data-label={L('Estado', 'Status')}><span className={`pz-state ${it.archived ? 'is-archived' : 'is-live'}`}>{it.archived ? L('Archivado', 'Archived') : L('Publicado', 'Published')}</span></td>
      <td role="cell" className="pz-td-act" data-label={L('Acciones', 'Actions')}>
        {it.archived ? (
          <button type="button" className="pz-link" disabled={busy} onClick={onRestore}>{L('Reactivar', 'Reactivate')}</button>
        ) : (
          <>
            <button type="button" className="pz-link" disabled={busy} onClick={onEdit} aria-label={L(`Editar ${it.title}`, `Edit ${it.title}`)}>{L('Editar', 'Edit')}</button>
            <button type="button" className="pz-link pz-link--quiet" disabled={busy} onClick={onArchive} aria-label={L(`Archivar ${it.title}`, `Archive ${it.title}`)}>{L('Archivar', 'Archive')}</button>
          </>
        )}
      </td>
    </tr>
  );
}
