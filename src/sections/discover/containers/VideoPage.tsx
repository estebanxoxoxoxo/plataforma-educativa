import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import { useAsync } from '../../../hooks/useAsync';
import { lastSearch } from '../../../hooks/user';
import { duckForForeground, playQueue, playTrack, unduck, type BgTrack } from '../../../shared/audio/bgAudio';
import { FolderSheet } from '../../../shared/components/FolderSheet';
import { ListSheet } from '../../../shared/components/ListSheet';
import { VideoInfo } from '../components/VideoInfo';
import { VideoPlayer } from '../components/VideoPlayer';

type Nav = { backTo?: string; backLabel?: string; queue?: string[]; qi?: number; qtracks?: BgTrack[] };

export function VideoPage() {
  const { id = '' } = useParams();
  const go = useNavigate();
  const st = (useLocation().state ?? null) as Nav | null;
  const { data: v } = useAsync(() => api.video(id), [id]);
  const [followed, setFollowed] = useState(false);
  const [sheet, setSheet] = useState<'none' | 'save' | 'list'>('none');
  const pos = useRef(0); // posición actual, para el handoff a "Escuchar de fondo"
  useEffect(() => { if (v) setFollowed(v.followed); }, [v]);

  // Un video en primer plano pausa la música de fondo; al salir se reanuda (decisión A de Smarty).
  useEffect(() => { duckForForeground(); return () => unduck(); }, []);

  // Desde un curso de Aprender se vuelve al curso; si no, a la solapa Videos de la última búsqueda.
  const back = st?.backTo
    ? { to: st.backTo, label: st.backLabel ?? '‹ Volver' }
    : { to: lastSearch.url.includes('tab=') ? lastSearch.url.replace(/tab=\w+/, 'tab=videos') : lastSearch.url, label: '‹ Videos' };

  // Cola en primer plano ("Reproducir todo" de una lista): al terminar, pasa al siguiente.
  const queue = st?.queue ?? [];
  const qi = st?.qi ?? 0;
  const onEnded = queue.length && qi < queue.length - 1
    ? () => go(`/buscar/video/${queue[qi + 1]}`, { state: { ...st, qi: qi + 1 } })
    : undefined;

  const follow = async () => {
    if (!v) return;
    setFollowed((f) => !f); // optimista; se reconcilia con el server
    const r = await api.toggleFollow(v.channelId).catch(() => null);
    if (r) setFollowed(r.followed);
  };

  return (
    <section className="view" id="v-player">
      <button className="back" onClick={() => go(back.to)}>{back.label}</button>
      {queue.length > 1 && <p className="pqueue">Lista · video {qi + 1} de {queue.length}</p>}
      {v ? <>
        <VideoPlayer key={v.id} v={v} onEnded={onEnded} onTime={(t) => { pos.current = t; }} />
        <VideoInfo v={v} followed={followed} onFollow={follow}
          // Handoff al fondo (como Smarty): sigue sonando desde la MISMA posición y salimos del player.
          // Si el video vino de una lista, va la COLA ENTERA (dos salidas de la misma cola).
          onBg={() => {
            if (st?.qtracks?.length) playQueue(st.qtracks, qi, pos.current);
            else playTrack({ id: v.id, title: v.title, img: v.img }, pos.current);
            go(back.to);
          }}
          onSave={() => setSheet('save')} onList={() => setSheet('list')} />
      </> : <div className="player" />}
      {v && <FolderSheet open={sheet === 'save'} title="¿Dónde lo guardás?" cta="Guardar acá"
        onPick={async (folderId, folderName) => {
          const r = await api.saveItem({ folderId, video: { id: v.id } }).catch(() => null);
          if (!r) return { error: 'No se pudo guardar ahora.' };
          return { done: r.existed ? `Ya estaba en ${folderName}` : `Guardado en ${folderName}` };
        }} onClose={() => setSheet('none')} />}
      {v && <ListSheet open={sheet === 'list'} videoId={v.id} onClose={() => setSheet('none')} />}
    </section>
  );
}
