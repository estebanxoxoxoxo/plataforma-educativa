import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import { useAsync } from '../../../hooks/useAsync';
import { PlaylistCard } from '../cards/PlaylistCard';

/** Mis listas, dentro de Videos: colecciones ORDENADAS de videos aprobados. */
export function PlaylistsPane() {
  const go = useNavigate();
  const { data, error, reload } = useAsync(() => api.playlists(), []);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const create = async () => {
    if (!name.trim()) return;
    const l = await api.createPlaylist(name.trim());
    setCreating(false); setName('');
    reload();
    go(`/espacio/videos/lista/${l.id}`);
  };

  return (
    <>
      <div className="spctl">
        {creating ? (
          <div className="spnew grow">
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder="Nombre de la lista (ej: Música para estudiar)" maxLength={60} />
            <button className="sbtn ghost" onClick={() => setCreating(false)}>Cancelar</button>
            <button className="sbtn" disabled={!name.trim()} onClick={create}>Crear</button>
          </div>
        ) : (
          <button className="sbtn" onClick={() => setCreating(true)}>＋ Nueva lista</button>
        )}
      </div>
      {error && <p className="spempty">No pude cargar tus listas ahora.</p>}
      {data && (data.playlists.length === 0
        ? <p className="spempty">Todavía no tenés listas. Crealas desde acá o con "＋ Lista" en cualquier video.</p>
        : <div className="plgrid">{data.playlists.map((l) => <PlaylistCard key={l.id} l={l} onOpen={() => go(`/espacio/videos/lista/${l.id}`)} />)}</div>)}
    </>
  );
}
