import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import { useAsync } from '../../../hooks/useAsync';
import { ListCard, NewListCard } from '../cards/ListCard';
import { NameSheet } from '../components/Sheets';
import { listPath, type MtDetailState } from '../lib/nav';

/** Mis listas (MisListas del POC): primero «Nueva lista», después las listas de la más nueva a la más vieja. Usa el CRUD
 *  de listas que ya existe (/api/space/playlists*). Crear una la abre. */
export function ListsPane() {
  const go = useNavigate();
  const { data, error } = useAsync(() => api.playlists(), []);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const open = (id: number) => go(listPath(id), { state: { fromMyTube: true } satisfies MtDetailState });

  const create = async (name: string) => {
    if (busy) return;
    setBusy(true); setFailed(false);
    try {
      const l = await api.createPlaylist(name);
      setCreating(false);
      open(l.id);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="mt-empty">No pude cargar tus listas ahora.</p>;
  return (
    <>
      {failed && <p className="mt-empty" role="alert">No pude crear la lista. Probá de nuevo.</p>}
      <div className="mt-lgrid" aria-busy={!data}>
        <NewListCard onClick={() => setCreating(true)} />
        {data?.playlists.map((l) => <ListCard key={l.id} l={l} onOpen={() => open(l.id)} />)}
      </div>
      {creating && <NameSheet busy={busy} onSubmit={(n) => void create(n)} onClose={() => setCreating(false)} />}
    </>
  );
}
