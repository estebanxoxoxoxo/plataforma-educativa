import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import type { FolderNode } from '../../api/types';
import { IcFolderWin } from './icons';

const LAST_KEY = 'innerith.lastFolder';
const ROOT = 0;

/** Hoja "¿Dónde lo guardás?" / "Mover a…": selector de carpeta NAVEGABLE (breadcrumb + entrar a
 *  subcarpetas + crear carpeta nueva), port del FolderPicker de Smarty. Genérica: el caller decide
 *  qué hacer con la carpeta elegida (guardar un contenido, mover un ítem, mover una carpeta).
 *  Todas las carpetas muestran el MISMO ícono (estilo Windows). */
export function FolderSheet({ open, title, cta, excludeId, allowRoot = false, onPick, onClose }: {
  open: boolean;
  title: string;
  /** Texto del botón principal, ej. "Guardar acá" / "Mover acá" */ cta: string;
  /** Carpeta cuyo subárbol no se ofrece (mover una carpeta dentro de sí misma) */ excludeId?: number;
  /** Solo para mover CARPETAS: la raíz es destino válido. Los archivos siempre van adentro de una carpeta. */
  allowRoot?: boolean;
  /** Devuelve el texto del ✓ si terminó OK (la hoja lo muestra y se cierra sola) */
  onPick: (folderId: number, folderName: string) => Promise<{ done: string } | { error: string }>;
  onClose: () => void;
}) {
  const [all, setAll] = useState<FolderNode[]>([]);
  const [at, setAt] = useState(ROOT);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDone(''); setError(''); setCreating(false); setName('');
    api.driveFolders().then(({ folders }) => {
      setAll(folders);
      // Arranca en la última carpeta usada (si sigue viva); un toque para guardar seguido en el mismo lugar.
      const last = Number(localStorage.getItem(LAST_KEY) ?? ROOT) || ROOT;
      setAt(folders.some((f) => f.id === last) ? last : ROOT);
      // Sin carpetas todavía y guardando un archivo: directo a crear la primera.
      if (!folders.length && !allowRoot) setCreating(true);
    }).catch(() => setAll([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Subárbol vedado (mover una carpeta adentro de sí misma); el server también lo rechaza.
  const banned = useMemo(() => {
    const out = new Set<number>();
    if (!excludeId) return out;
    out.add(excludeId);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of all) if (out.has(f.parentId) && !out.has(f.id)) { out.add(f.id); grew = true; }
    }
    return out;
  }, [all, excludeId]);

  if (!open) return null;

  const path: FolderNode[] = [];
  for (let id = at; id !== ROOT;) {
    const f = all.find((x) => x.id === id);
    if (!f) break;
    path.unshift(f); id = f.parentId;
  }
  const here = all.filter((f) => f.parentId === at && !banned.has(f.id));
  const hereName = at === ROOT ? 'Mis carpetas' : path[path.length - 1]?.name ?? 'Carpeta';
  const rootBlocked = !allowRoot && at === ROOT; // los archivos viven adentro de carpetas

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const f = await api.createFolder(name.trim(), at);
      setAll((xs) => [...xs, { id: f.id, name: f.name, parentId: f.parentId }]);
      setAt(f.id); setCreating(false); setName('');
    } finally { setBusy(false); }
  };

  const pick = async () => {
    if (busy || banned.has(at) || rootBlocked) return;
    setBusy(true); setError('');
    try {
      const r = await onPick(at, hereName);
      if ('error' in r) { setError(r.error); return; }
      localStorage.setItem(LAST_KEY, String(at));
      setDone(r.done);
      setTimeout(onClose, 900);
    } catch {
      setError('No se pudo ahora. Probá de nuevo.');
    } finally { setBusy(false); }
  };

  return (
    <div className="shov show" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="shcard">
        {done ? <p className="shdone">✓ {done}</p> : <>
          <h3 className="shtitle">{title}</h3>
          <div className="shcrumb">
            <button className={`crumb${at === ROOT ? ' on' : ''}`} onClick={() => setAt(ROOT)}><IcFolderWin className="cfold" />Mis carpetas</button>
            {path.map((f) => <button key={f.id} className={`crumb${f.id === at ? ' on' : ''}`} onClick={() => setAt(f.id)}>{f.name}</button>)}
          </div>
          <div className="shlist">
            {here.map((f) => (
              <button key={f.id} className="shfolder" onClick={() => setAt(f.id)}>
                <span className="fem"><IcFolderWin /></span>
                <b>{f.name}</b><span className="shgo">›</span>
              </button>
            ))}
            {here.length === 0 && !creating && <p className="shempty">No hay carpetas acá adentro.</p>}
            {creating ? (
              <div className="shnew">
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()}
                  placeholder="Nombre de la carpeta" maxLength={40} />
                <div className="shbtns">
                  <button className="sbtn ghost" onClick={() => setCreating(false)}>Cancelar</button>
                  <button className="sbtn" disabled={!name.trim() || busy} onClick={create}>Crear</button>
                </div>
              </div>
            ) : (
              <button className="shadd" onClick={() => setCreating(true)}>＋ Carpeta nueva</button>
            )}
          </div>
          {rootBlocked && !creating && <p className="shhint">Los archivos viven adentro de una carpeta: entrá a una o creá una nueva.</p>}
          {error && <p className="sherr">{error}</p>}
          <div className="shbtns end">
            <button className="sbtn ghost" onClick={onClose}>Cancelar</button>
            <button className="sbtn" disabled={busy || banned.has(at) || rootBlocked} onClick={pick}>{cta} · {hereName}</button>
          </div>
        </>}
      </div>
    </div>
  );
}
