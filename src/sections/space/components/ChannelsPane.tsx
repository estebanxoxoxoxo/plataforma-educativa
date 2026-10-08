import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import { useAsync } from '../../../hooks/useAsync';
import { ChannelCard } from '../cards/ChannelCard';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Canales (MyTube), dentro de Videos: los seguidos arriba y "Para descubrir" como una sola
 *  línea tipo footer. Es una VISTA sobre el catálogo aprobado (regla de Smarty). */
export function ChannelsPane() {
  const go = useNavigate();
  const { data, error, setData } = useAsync(() => api.channels(), []);
  const [q, setQ] = useState('');

  const { followed, rest } = useMemo(() => {
    const all = data?.channels ?? [];
    const match = q.trim() ? all.filter((c) => norm(c.name).includes(norm(q))) : all;
    return { followed: match.filter((c) => c.followed), rest: match.filter((c) => !c.followed) };
  }, [data, q]);

  const toggle = async (id: string) => {
    if (!data) return;
    // Optimista: se reconcilia con la respuesta del server.
    setData({ channels: data.channels.map((c) => (c.id === id ? { ...c, followed: !c.followed } : c)) });
    const r = await api.toggleFollow(id).catch(() => null);
    if (r) setData({ channels: data.channels.map((c) => (c.id === id ? { ...c, followed: r.followed } : c)) });
  };

  const open = (id: string) => go(`/espacio/videos/canal/${id}`);

  return (
    <>
      <div className="spctl">
        <input className="spsearch" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un canal…" aria-label="Buscar un canal" />
      </div>
      {error && <p className="spempty">No pude cargar los canales ahora.</p>}
      {data && <>
        {followed.length > 0 && <>
          <h3 className="splbl">Los que seguís</h3>
          <div className="chgrid">{followed.map((c) => <ChannelCard key={c.id} c={c} onOpen={() => open(c.id)} onFollow={() => toggle(c.id)} />)}</div>
        </>}
        {followed.length === 0 && rest.length === 0 && <p className="spempty">Ningún canal se llama así.</p>}
        {/* Para descubrir: UNA sola línea tipo footer (se desplaza a lo ancho), bajo lo tuyo. */}
        {rest.length > 0 && (
          <div className="chfoot">
            <span className="chfoot-lbl">Para descubrir</span>
            <div className="chfoot-row">
              {rest.map((c) => (
                <div key={c.id} className="chchip" role="button" tabIndex={0}
                  onClick={() => open(c.id)} onKeyDown={(e) => e.key === 'Enter' && open(c.id)}>
                  <img className="chchip-th" src={c.cover} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  <b>{c.name}</b>
                  <small>{c.videos.toLocaleString('es-AR')}</small>
                  <button className="chchip-f" aria-label={`Seguir ${c.name}`} onClick={(e) => { e.stopPropagation(); toggle(c.id); }}>＋</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </>}
    </>
  );
}
