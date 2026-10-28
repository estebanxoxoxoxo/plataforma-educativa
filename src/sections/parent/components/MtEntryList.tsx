import type { MtEntry } from '../../../api/types';
import { ENTRY_TYPE_LABEL } from '../lib/mytubeAdmin';

/** Las entradas de YouTube que sumó la familia (un video, una playlist o un canal cada una) con su mantenimiento:
 *  Reingestar (vuelve a tomar el snapshot: nombre y descripciones nuevas) y Eliminar (el contenedor pide la confirmación).
 *  La usan el menú ⋮ de una tarjeta de la grilla y la vista de un canal de Familia → MyTube. Pura. */
export function MtEntryList({ entries, reingId, removing, locked, onReingest, onRemove }: {
  entries: readonly MtEntry[];
  reingId: number | null;
  removing: number | null;
  /** hay una operación en curso: no se larga otra */
  locked: boolean;
  onReingest: (e: MtEntry) => void;
  onRemove: (e: MtEntry) => void;
}) {
  return (
    <ul className="pz-mt-entries">
      {entries.map((e) => (
        <li key={e.id} className="pz-mt-entry">
          <span className="pz-yt-type">{ENTRY_TYPE_LABEL[e.type] ?? e.type}</span>
          <span className="pz-mt-entry-txt">
            <span className="pz-cell-title">{e.title}</span>
            <span className="pz-cell-sub">{e.videos} {e.videos === 1 ? 'video' : 'videos'} · {e.url}</span>
          </span>
          <span className="pz-mt-entry-act">
            <button type="button" className="pz-link" disabled={locked} onClick={() => onReingest(e)}
              title="Volver a importar: actualiza el nombre y las descripciones">{reingId === e.id ? 'Reingestando…' : 'Reingestar'}</button>
            <button type="button" className="pz-link pz-yt-del" disabled={locked} aria-label={`Eliminar ${e.title}`}
              onClick={() => onRemove(e)}>{removing === e.id ? 'Eliminando…' : 'Eliminar'}</button>
          </span>
        </li>
      ))}
    </ul>
  );
}
