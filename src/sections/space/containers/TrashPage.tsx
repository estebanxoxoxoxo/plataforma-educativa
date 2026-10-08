import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import { useAsync } from '../../../hooks/useAsync';
import { IcFolderWin, IcRestore } from '../../../shared/components/icons';

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
        <div className="tmeta"><b>{title}</b>{sub && <small>{sub}</small>}</div>
        <button className="sbtn ghost" onClick={async () => { await api.restore(kind, id); reload(); }}><IcRestore />Restaurar</button>
        {confirm === key
          ? <button className="sbtn danger" onClick={async () => { setConfirm(null); await api.purge(kind, id); reload(); }}>¿Seguro? Sí, borrar</button>
          : <button className="sbtn ghost danger" onClick={() => setConfirm(key)}>Borrar definitivo</button>}
      </div>
    );
  };

  return (
    <section className="view" id="v-space">
      <div className="sphead">
        <div>
          <h2 className="h2">Papelera</h2>
          <p className="lede">Lo que mandaste acá se puede restaurar. “Borrar definitivo” no tiene vuelta atrás.</p>
        </div>
        <button className="sbtn ghost" onClick={() => go('/espacio/carpetas')}>‹ Volver a Carpetas</button>
      </div>
      {data && <>
        {data.folders.length === 0 && data.items.length === 0 && <p className="spempty">La papelera está vacía. ✨</p>}
        <div className="tlist">
          {data.folders.map((f) => row('folder', f.id, <IcFolderWin className="tfold" />, f.name, 'Carpeta (con todo lo de adentro)'))}
          {data.items.map((it) => row('item', it.id, it.type === 'video' ? '🎬' : it.type === 'articulo' ? '📖' : '🖼️', it.title, it.subtitle))}
        </div>
      </>}
    </section>
  );
}
