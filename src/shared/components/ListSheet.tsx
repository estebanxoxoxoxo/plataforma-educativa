import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { Playlist } from '../../api/types';
import { IcListMusic } from './icons';

/** Hoja "Agregar a una lista": listas del chico + crear una nueva (molde del ListPicker de LISTAS.md).
 *  Solo referencia videoIds ya aprobados; el server valida contra el catálogo. */
export function ListSheet({ open, videoId, onClose }: { open: boolean; videoId: string; onClose: () => void }) {
  const [lists, setLists] = useState<Playlist[] | null>(null);
  const [added, setAdded] = useState<Record<number, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');

  useEffect(() => {
    if (!open) return;
    setDone(''); setAdded({}); setCreating(false); setName('');
    api.playlists().then(({ playlists }) => setLists(playlists)).catch(() => setLists([]));
  }, [open]);

  if (!open) return null;

  const finish = (txt: string) => { setDone(txt); setTimeout(onClose, 900); };

  const add = async (l: Playlist) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await api.playlistAdd(l.id, videoId);
      if (r.ok) { setAdded((a) => ({ ...a, [l.id]: true })); finish(r.existed ? `Ya estaba en ${l.name}` : `Agregado a ${l.name}`); }
    } finally { setBusy(false); }
  };

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const l = await api.createPlaylist(name.trim(), videoId);
      finish(`Agregado a ${l.name}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="shov show" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="shcard">
        {done ? <p className="shdone">✓ {done}</p> : <>
          <h3 className="shtitle">Agregar a una lista</h3>
          <div className="shlist">
            {lists === null && <p className="shempty">Cargando…</p>}
            {lists?.map((l) => (
              <button key={l.id} className="shfolder" disabled={!!added[l.id]} onClick={() => add(l)}>
                {l.cover ? <img className="fem cover" src={l.cover} alt="" referrerPolicy="no-referrer" /> : <span className="fem"><IcListMusic /></span>}
                <b>{l.name}</b><small>{l.count} {l.count === 1 ? 'video' : 'videos'}</small>
              </button>
            ))}
            {lists?.length === 0 && !creating && <p className="shempty">Todavía no tenés listas.</p>}
            {creating ? (
              <div className="shnew">
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()}
                  placeholder="Nombre de la lista" maxLength={60} />
                <div className="shbtns">
                  <button className="sbtn ghost" onClick={() => setCreating(false)}>Cancelar</button>
                  <button className="sbtn" disabled={!name.trim() || busy} onClick={create}>Crear y agregar</button>
                </div>
              </div>
            ) : (
              <button className="shadd" onClick={() => setCreating(true)}>＋ Nueva lista</button>
            )}
          </div>
          <div className="shbtns end">
            <button className="sbtn ghost" onClick={onClose}>Cancelar</button>
          </div>
        </>}
      </div>
    </div>
  );
}
