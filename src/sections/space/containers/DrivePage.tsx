import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import type { DriveFolder, DriveItem } from '../../../api/types';
import { useAsync } from '../../../hooks/useAsync';
import { FolderSheet } from '../../../shared/components/FolderSheet';
import { IcFolderWin, IcNavSpace, IcTrash } from '../../../shared/components/icons';
import { DriveItemCard } from '../cards/DriveItemCard';
import { FolderCard } from '../cards/FolderCard';
import { FolderForm } from '../components/FolderForm';

/** Carpetas (Drive): lo que el chico guarda, organizado en carpetas anidadas con breadcrumb.
 *  Contenedor puro: todo sale de /api/space/drive; cada acción escribe y recarga. */
export function DrivePage() {
  const { folderId } = useParams();
  const at = Number(folderId ?? 0) || 0;
  const go = useNavigate();
  const { data, error, reload } = useAsync(() => api.drive(at), [at]);
  const [form, setForm] = useState<'none' | 'create' | { edit: DriveFolder }>('none');
  const [moving, setMoving] = useState<{ kind: 'folder' | 'item'; id: number; name: string } | null>(null);
  const [zoom, setZoom] = useState<DriveItem | null>(null);
  // La imagen ampliada se cierra también con Esc (como las otras hojas), no solo tocando afuera.
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setZoom(null); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [zoom]);

  const here = at === 0 ? '/espacio/carpetas' : `/espacio/carpetas/${at}`;
  const openItem = (it: DriveItem) => {
    if (it.target.type === 'video') go(`/buscar/video/${it.target.id}`, { state: { backTo: here, backLabel: '‹ Carpetas' } });
    else if (it.target.type === 'article') go(`/buscar/articulo/${encodeURIComponent(it.target.url)}`, { state: { backTo: here, backLabel: '‹ Carpetas' } });
    else setZoom(it);
  };

  return (
    <section className="view" id="v-space">
      <div className="sphead">
        {/* Ícono + título, sin subtítulo, como el resto de las secciones (pedido de Esteban, 30-oct). */}
        <div className="sp-title">
          <span className="sp-tico" aria-hidden="true"><IcNavSpace /></span>
          <h2 className="h2">Mi espacio</h2>
        </div>
        <div className="sphead-acts">
          <button className="sbtn ghost sp-trash" onClick={() => go('/espacio/papelera')}><IcTrash />Papelera</button>
          <button className="sbtn" onClick={() => setForm('create')}>＋ Carpeta nueva</button>
        </div>
      </div>

      {/* Las migas están SIEMPRE, también en la raíz (pedido de Esteban, 30-oct): ahí «Mis carpetas» es la actual. */}
      {data && (
        <div className="shcrumb page">
          <button className={`crumb${data.path.length === 0 ? ' on' : ''}`} onClick={() => go('/espacio/carpetas')}><IcFolderWin className="cfold" />Mis carpetas</button>
          {data.path.map((p) => (
            <button key={p.id} className={`crumb${p.id === at ? ' on' : ''}`} onClick={() => go(`/espacio/carpetas/${p.id}`)}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {error && <p className="spempty">No pude cargar tus carpetas ahora. Probemos de nuevo en un ratito.</p>}
      {/* Como Google Drive (pedido de Esteban, 30-oct): carpetas y archivos en la MISMA grilla de columnas iguales (.spgrid),
          así una carpeta y un archivo miden lo mismo y nada baila según el nombre. Adentro de una carpeta, cada bloque con
          su rótulo («Carpetas» / «Archivos»); en la raíz solo hay carpetas y el título ya lo dice. */}
      {data && <>
        {at !== 0 && data.folders.length > 0 && <h3 className="splbl">Carpetas</h3>}
        {data.folders.length > 0 && (
          <div className="spgrid">
            {data.folders.map((f) => (
              <FolderCard key={f.id} f={f}
                onOpen={() => go(`/espacio/carpetas/${f.id}`)}
                onEdit={() => setForm({ edit: f })}
                onMove={() => setMoving({ kind: 'folder', id: f.id, name: f.name })}
                onTrash={async () => { await api.trashFolder(f.id); reload(); }} />
            ))}
          </div>
        )}
        {at !== 0 && data.items.length > 0 && <h3 className="splbl">Archivos</h3>}
        {at !== 0 && data.items.length > 0 && (
          <div className="spgrid">
            {data.items.map((it) => (
              <DriveItemCard key={it.id} it={it} onOpen={() => openItem(it)}
                onMove={() => setMoving({ kind: 'item', id: it.id, name: it.title })}
                onTrash={async () => { await api.trashItem(it.id); reload(); }} />
            ))}
          </div>
        )}
        {at === 0 && data.folders.length === 0 && (
          <p className="spempty">Acá viven tus carpetas. Creá la primera con “＋ Carpeta nueva”: lo que guardes va siempre adentro de una carpeta.</p>
        )}
        {at !== 0 && data.folders.length === 0 && data.items.length === 0 && (
          <p className="spempty">Esta carpeta está vacía.</p>
        )}
      </>}

      {form === 'create' && (
        <FolderForm title="Carpeta nueva" cta="Crear"
          onSubmit={async (v) => { await api.createFolder(v.name, at); reload(); }}
          onClose={() => setForm('none')} />
      )}
      {typeof form === 'object' && (
        <FolderForm title="Renombrar carpeta" cta="Guardar" initial={{ name: form.edit.name }}
          onSubmit={async (v) => { await api.editFolder(form.edit.id, { name: v.name }); reload(); }}
          onClose={() => setForm('none')} />
      )}
      {moving && (
        <FolderSheet open title={`Mover “${moving.name}” a…`} cta="Mover acá"
          excludeId={moving.kind === 'folder' ? moving.id : undefined}
          allowRoot={moving.kind === 'folder'}
          onPick={async (dest, destName) => {
            const r = moving.kind === 'folder' ? await api.moveFolder(moving.id, dest) : await api.moveItem(moving.id, dest);
            if (!r.ok) return { error: 'Ahí no se puede (ya estaba, o es la misma carpeta).' };
            reload();
            return { done: `Movido a ${destName}` };
          }}
          onClose={() => setMoving(null)} />
      )}
      {zoom && (
        <div className="shov show" onClick={() => setZoom(null)}>
          <figure className="szoom"><img src={zoom.img} alt={zoom.title} referrerPolicy="no-referrer" /><figcaption>{zoom.title}</figcaption></figure>
        </div>
      )}
    </section>
  );
}
