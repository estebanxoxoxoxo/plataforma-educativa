import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import { useAsync } from '../../../hooks/useAsync';
import { playQueue } from '../../../shared/audio/bgAudio';
import { IcDownSm, IcHeadphones, IcPlay, IcUpSm, IcClose } from '../../../shared/components/icons';
import { DotMenu } from '../components/DotMenu';

/** Una lista: videos EN ORDEN con reordenar/quitar + las dos salidas de la MISMA cola
 *  (REPRODUCCION.md): primer plano con auto-avance, o audio de fondo con el MiniPlayer. */
export function PlaylistPage() {
  const { id = '0' } = useParams();
  const lid = Number(id) || 0;
  const go = useNavigate();
  const { data, error, reload } = useAsync(() => api.playlist(lid), [lid]);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  const back = { backTo: `/espacio/videos/lista/${lid}`, backLabel: '‹ Mi lista' };
  const navState = () => ({
    ...back,
    queue: data!.videos.map((v) => v.id),
    // qtracks: para que "Escuchar de fondo" desde el player se lleve la cola entera.
    qtracks: data!.videos.map((v) => ({ id: v.id, title: v.title, img: v.img })),
  });
  const playAll = () => {
    if (!data?.videos.length) return;
    go(`/buscar/video/${data.videos[0].id}`, { state: { ...navState(), qi: 0 } });
  };
  const listen = () => {
    if (!data?.videos.length) return;
    playQueue(data.videos.map((v) => ({ id: v.id, title: v.title, img: v.img })));
  };
  const rename = async () => {
    if (!name.trim()) return;
    await api.renamePlaylist(lid, name.trim());
    setRenaming(false); reload();
  };

  return (
    <section className="view" id="v-space">
      <button className="back" onClick={() => go('/espacio/videos?tab=listas')}>‹ Mis listas</button>
      {error && <p className="spempty">No encontré esa lista.</p>}
      {data && <>
        <div className="sphead">
          <div>
            {renaming
              ? <div className="spnew tight">
                  <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && rename()} maxLength={60} />
                  <button className="sbtn ghost" onClick={() => setRenaming(false)}>Cancelar</button>
                  <button className="sbtn" disabled={!name.trim()} onClick={rename}>Guardar</button>
                </div>
              : <h2 className="h2">{data.name}</h2>}
            <p className="lede">{data.videos.length} {data.videos.length === 1 ? 'video' : 'videos'} · siempre del catálogo aprobado</p>
          </div>
          <div className="sphead-acts">
            <button className="sbtn" disabled={!data.videos.length} onClick={playAll}><IcPlay />Reproducir todo</button>
            <button className="sbtn ghost" disabled={!data.videos.length} onClick={listen}><IcHeadphones />Escuchar de fondo</button>
            <DotMenu actions={[
              { label: 'Renombrar', onClick: () => { setName(data.name); setRenaming(true); } },
              { label: confirmDel ? '¿Seguro? Sí, borrar la lista' : 'Borrar la lista', danger: true,
                onClick: async () => {
                  if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); return; }
                  await api.deletePlaylist(lid); go('/espacio/videos?tab=listas');
                } },
            ]} />
          </div>
        </div>

        {data.videos.length === 0 && <p className="spempty">Esta lista está vacía. Agregá videos con “＋ Lista” desde cualquier video.</p>}
        <div className="plrows">
          {data.videos.map((v, i) => (
            <div key={v.id} className="plrow">
              <span className="pln">{i + 1}</span>
              <span className="plthumb" role="button" tabIndex={0}
                onClick={() => go(`/buscar/video/${v.id}`, { state: { ...navState(), qi: i } })}
                onKeyDown={(e) => e.key === 'Enter' && go(`/buscar/video/${v.id}`, { state: { ...navState(), qi: i } })}>
                <img src={v.img} alt="" loading="lazy" referrerPolicy="no-referrer" />
                {v.duration && <i>{v.duration}</i>}
              </span>
              <div className="plmeta"><b>{v.title}</b><small>{v.channel}</small></div>
              <div className="plbtns">
                <button aria-label="Subir" disabled={i === 0} onClick={async () => { await api.playlistSwap(lid, v.id, data.videos[i - 1].id); reload(); }}><IcUpSm /></button>
                <button aria-label="Bajar" disabled={i === data.videos.length - 1} onClick={async () => { await api.playlistSwap(lid, v.id, data.videos[i + 1].id); reload(); }}><IcDownSm /></button>
                <button aria-label="Quitar de la lista" className="del" onClick={async () => { await api.playlistRemove(lid, v.id); reload(); }}><IcClose /></button>
              </div>
            </div>
          ))}
        </div>
      </>}
    </section>
  );
}
