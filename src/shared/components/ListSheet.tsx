import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { Playlist } from '../../api/types';
import { useReturnFocus, useVeil } from '../../sections/store/lib/sheet';
import { IcListMusic } from './icons';

/** Hoja "Agregar a una lista": listas del chico + crear una nueva (molde del ListPicker de LISTAS.md).
 *  Solo referencia videoIds ya aprobados; el server valida contra el catálogo.
 *  Como el ListPicker del POC: las listas que YA tienen el video vienen marcadas con ✓ y no se pueden tocar
 *  (`api.playlists(videoId)` → `has`, deuda 14-oct). */
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
    api.playlists(videoId).then(({ playlists }) => setLists(playlists)).catch(() => setLists([]));
  }, [open, videoId]);
  const veil = useVeil(onClose, false, open);
  useReturnFocus(undefined, open); // al cerrar, el foco vuelve a quien la abrió (antes quedaba en <body>)

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
    <div className="shov show" role="dialog" aria-modal="true" onMouseDown={veil}>
      <div className="shcard">
        {done ? <p className="shdone">✓ {done}</p> : <>
          <h3 className="shtitle">Agregar a una lista</h3>
          <div className="shlist">
            {lists === null && <p className="shempty">Cargando…</p>}
            {lists?.map((l) => {
              const yaEsta = !!added[l.id] || !!l.has; // el `yaEsta` del ListPicker del POC
              return (
                <button key={l.id} className="shfolder" disabled={yaEsta} onClick={() => add(l)}
                  aria-label={yaEsta ? `${l.name}: ya tiene este video` : undefined}>
                  {l.cover ? <img className="fem cover" src={l.cover} alt="" referrerPolicy="no-referrer" /> : <span className="fem"><IcListMusic /></span>}
                  <b>{l.name}</b><small>{l.count} {l.count === 1 ? 'video' : 'videos'}</small>
                  {yaEsta && <span className="shyes" aria-hidden="true">✓</span>}
                </button>
              );
            })}
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
