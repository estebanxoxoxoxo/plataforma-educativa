import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import type { VideoResult } from '../../../api/types';
import { useAsync } from '../../../hooks/useAsync';
import { lastSearch } from '../../../hooks/user';
import { duckForForeground, playTrack, unduck } from '../../../shared/audio/bgAudio';
import { FolderSheet } from '../../../shared/components/FolderSheet';
import { ListSheet } from '../../../shared/components/ListSheet';
import { channelPath, videoPath, type MtDetailState } from '../../mytube/lib/nav';
import { VideoInfo } from '../components/VideoInfo';
import { VideoPlayer } from '../components/VideoPlayer';
import { VideoSidePanel } from '../components/VideoSidePanel';

/** Estado de la entrada del reproductor. `queue` (ids) + `qi` = la COLA de «Reproducir todo» de una lista (ListView de
 *  MyTube); `qvideos` = esos mismos videos con miniatura/título/duración para el panel «En la lista». */
type Nav = { backTo?: string; backLabel?: string; queue?: string[]; qi?: number; qvideos?: VideoResult[] };

/** Apaisado con lugar real → relacionados al costado (useWide del POC: ancho > alto y ≥ 720 px). En el POC el reproductor
 *  es un overlay a pantalla completa y mide la VENTANA; acá es una vista del área principal (al lado del menú), así que se
 *  mide el lugar que tiene la vista (su caja de contenido). */
function useWide(ref: RefObject<HTMLElement | null>): boolean {
  const [wide, setWide] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setWide(width >= 720 && width > height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return wide;
}

export function VideoPage() {
  const { id = '' } = useParams();
  const go = useNavigate();
  const loc = useLocation();
  const st = (loc.state ?? null) as Nav | null;
  const { data: v } = useAsync(() => api.video(id), [id]);
  const [followed, setFollowed] = useState(false);
  const [sheet, setSheet] = useState<'none' | 'save' | 'list'>('none');
  const pos = useRef(0); // posición actual, para el handoff a "Escuchar de fondo"
  const view = useRef<HTMLElement>(null);
  const wide = useWide(view);
  useEffect(() => { if (v) setFollowed(v.followed); }, [v]);

  // Un video en primer plano pausa la música de fondo; al salir se reanuda (decisión A de Smarty).
  useEffect(() => { duckForForeground(); return () => unduck(); }, []);

  // Al cambiar de video (relacionado o pista de la cola): arriba de todo y la posición vuelve a 0 (el POC resetea su avance).
  useEffect(() => { pos.current = 0; view.current?.scrollTo({ top: 0 }); }, [id]);

  // Desde un curso de Aprender se vuelve al curso; si no, a la solapa Videos de la última búsqueda.
  const back = st?.backTo
    ? { to: st.backTo, label: st.backLabel ?? '‹ Volver' }
    : { to: lastSearch.url.includes('tab=') ? lastSearch.url.replace(/tab=\w+/, 'tab=videos') : lastSearch.url, label: '‹ Videos' };
  const origin = { backTo: st?.backTo, backLabel: st?.backLabel };

  /* COLA en primer plano ("Reproducir todo" de una lista), EXACTA al VideoPlayer del POC: al TERMINAR o si el video NO está
     disponible (onError) pasa al siguiente; al llegar al final VUELVE AL PRINCIPIO (la lista repite siempre); saltea en
     cadena los caídos, con un freno: si dio error TODA la cola sin un solo play, se para (racha que resetea cada play
     real). Tocar una pista del panel salta a ella y sigue la cola; tocar un RELACIONADO sale del modo cola. Los cambios de
     video son en el lugar, como el overlay del POC: `replace` (Atrás y «Volver» siguen yendo a donde se abrió). */
  const queue = st?.queue ?? [];
  const inQueue = queue.length > 0 && st?.qi != null;
  const qi = st?.qi ?? 0;
  const errStreak = useRef(0);
  const goTrack = (i: number) => go(videoPath(queue[i]), { replace: true, state: { ...st, qi: i } satisfies Nav });
  const nextTrack = () => goTrack(qi + 1 < queue.length ? qi + 1 : 0);
  const onEnded = inQueue ? nextTrack : undefined;
  const onError = inQueue ? () => { if (++errStreak.current >= queue.length) return; nextTrack(); } : undefined;
  const onPlaying = () => { errStreak.current = 0; };
  const openRelated = (r: VideoResult) => go(videoPath(r.id), { replace: true, state: origin satisfies Nav });

  // Panel: la lista (cola de más de uno) o los relacionados del server.
  const qvideos = st?.qvideos ?? [];
  const enLista = inQueue && queue.length > 1 && qvideos.length === queue.length;
  const related = v?.related ?? [];

  const follow = async () => {
    if (!v) return;
    setFollowed((f) => !f); // optimista; se reconcilia con el server
    const r = await api.toggleFollow(v.channelId).catch(() => null);
    if (r) setFollowed(r.followed);
  };

  // Chip del canal → su vista en MyTube: la ÚNICA puerta a un canal que el chico no sigue (como el POC). Su «Volver» trae
  // de vuelta a este video con el state con el que se abrió (su propio «Volver» y su cola), como cerrar el overlay del POC.
  // Sin channelId el chip no es botón.
  const openChannel = v?.channelId
    ? () => go(channelPath(v.channelId), { state: { backTo: loc.pathname + loc.search, backLabel: '‹ Volver', backState: st ?? undefined } satisfies MtDetailState })
    : undefined;

  return (
    <section className={`view${wide ? ' pwide' : ''}`} id="v-player" ref={view}>
      <button className="back" onClick={() => go(back.to)}>{back.label}</button>
      {queue.length > 1 && <p className="pqueue">Lista · video {qi + 1} de {queue.length}</p>}
      <div className="pmain">
        {v ? <>
          <VideoPlayer key={v.id} v={v} onEnded={onEnded} onError={onError} onPlaying={onPlaying} onTime={(t) => { pos.current = t; }} />
          <VideoInfo v={v} followed={followed} onFollow={follow} onChannel={openChannel}
            // Handoff al fondo (como el POC: playMusic(current, pos)): SOLO este video, desde la MISMA posición, y salimos
            // del player. Aunque venga de una lista: la cola entera la manda el «Escuchar de fondo» de la vista de la lista.
            onBg={() => {
              playTrack({ id: v.id, title: v.title, img: v.img }, pos.current);
              go(back.to);
            }}
            onSave={() => setSheet('save')} onList={() => setSheet('list')} />
        </> : <div className="player" />}
      </div>
      {v && (enLista
        ? <VideoSidePanel mode="list" videos={qvideos} current={qi} onPick={goTrack} />
        : <VideoSidePanel mode="related" videos={related} current={-1} onPick={(i) => openRelated(related[i])} />)}
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
