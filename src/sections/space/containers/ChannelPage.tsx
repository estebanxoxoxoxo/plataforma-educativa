import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import { useAsync } from '../../../hooks/useAsync';
import { VideoTile } from '../cards/VideoTile';

/** Un canal: sus videos APROBADOS (solo lo whitelisteado se ve, regla de mytube.ts de Smarty). */
export function ChannelPage() {
  const { id = '' } = useParams();
  const go = useNavigate();
  const { data, error } = useAsync(() => api.channel(id), [id]);
  const [followed, setFollowed] = useState(false);
  useEffect(() => { if (data) setFollowed(data.channel.followed); }, [data]);

  const follow = async () => {
    setFollowed((f) => !f);
    const r = await api.toggleFollow(id).catch(() => null);
    if (r) setFollowed(r.followed);
  };

  return (
    <section className="view" id="v-space">
      <button className="back" onClick={() => go('/espacio/videos')}>‹ Canales</button>
      {error && <p className="spempty">No encontré ese canal.</p>}
      {data && <>
        <div className="chhead">
          {data.channel.thumb
            ? <img className="chbigav" src={data.channel.thumb} alt="" referrerPolicy="no-referrer" />
            : <span className="chbigav">{data.channel.name[0]}</span>}
          <div className="chhead-meta">
            <h2 className="h2">{data.channel.name}</h2>
            <p className="lede">
              {data.total.toLocaleString('es-AR')} videos aprobados{data.channel.subscribers ? ` · ${data.channel.subscribers}` : ''}
            </p>
          </div>
          <button className={`chfollow big${followed ? ' on' : ''}`} onClick={follow}>{followed ? 'Siguiendo ✓' : 'Seguir'}</button>
        </div>
        <div className="vgrid">
          {data.videos.map((v) => (
            <VideoTile key={v.id} v={v} onOpen={() => go(`/buscar/video/${v.id}`, { state: { backTo: `/espacio/videos/canal/${id}`, backLabel: '‹ Canal' } })} />
          ))}
        </div>
        {data.total > data.videos.length && <p className="spnote">Mostrando {data.videos.length} de {data.total.toLocaleString('es-AR')} videos.</p>}
      </>}
    </section>
  );
}
