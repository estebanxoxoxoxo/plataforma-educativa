import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import { useAsync } from '../../../hooks/useAsync';
import { IcFolderWin, IcRestore } from '../../../shared/components/icons';
import { titleIfCut } from '../lib/drive';
import { L } from '../../../shared/lib/lang';

/** Papelera: lo borrado se puede restaurar (con todo su contenido) o borrar definitivo.
 *  Nada se pierde sin querer — regla del Drive de Smarty. */
export function TrashPage() {
  const go = useNavigate();
  const { data, reload } = useAsync(() => api.driveTrash(), []);
  const [confirm, setConfirm] = useState<string | null>(null); // "folder-3" | "item-7"

  const row = (kind: 'folder' | 'item', id: number, icon: ReactNode, title: string, sub?: string) => {
    const key = `${kind}-${id}`;
    return (
      <div key={key} className="trow">
        <span className="tico">{icon}</span>
        <div className="tmeta"><b onMouseEnter={titleIfCut(title)}>{title}</b>{sub && <small>{sub}</small>}</div>
        <button className="sbtn ghost" onClick={async () => { await api.restore(kind, id); reload(); }}><IcRestore />{L('Restaurar', 'Restore')}</button>
        {confirm === key
          ? <button className="sbtn danger" onClick={async () => { setConfirm(null); await api.purge(kind, id); reload(); }}>{L('¿Seguro? Sí, borrar', 'Sure? Yes, delete')}</button>
          : <button className="sbtn ghost danger" onClick={() => setConfirm(key)}>{L('Borrar definitivo', 'Delete forever')}</button>}
      </div>
    );
  };

  return (
    <section className="view" id="v-space">
      <div className="sphead">
        <div>
          <h2 className="h2">{L('Papelera', 'Trash')}</h2>
          <p className="lede">{L('Lo que mandaste acá se puede restaurar. “Borrar definitivo” no tiene vuelta atrás.', 'What you sent here can be restored. “Delete forever” can’t be undone.')}</p>
        </div>
        <button className="sbtn ghost" onClick={() => go('/espacio/carpetas')}>{L('‹ Volver a Carpetas', '‹ Back to Folders')}</button>
      </div>
      {data && <>
        {data.folders.length === 0 && data.items.length === 0 && <p className="spempty">{L('La papelera está vacía.', 'The trash is empty.')}</p>}
        <div className="tlist">
          {data.folders.map((f) => row('folder', f.id, <IcFolderWin className="tfold" />, f.name, L('Carpeta (con todo lo de adentro)', 'Folder (with everything inside)')))}
          {data.items.map((it) => row('item', it.id, it.type === 'video' ? '🎬' : it.type === 'articulo' ? '📖' : '🖼️', it.title, it.subtitle))}
        </div>
      </>}
    </section>
  );
}
