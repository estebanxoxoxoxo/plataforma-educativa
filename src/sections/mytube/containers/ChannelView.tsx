import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import type { MtChannelDetail, MtVideo } from '../../../api/types';
import { UnderlineTabs } from '../../../shared/components/UnderlineTabs';
import { ChannelHeader } from '../components/ChannelHeader';
import { PlaylistRow } from '../components/PlaylistRow';
import { VideoList, VideoListSkeleton } from '../components/VideoList';
import { channelPath, useMtBack, videoPath } from '../lib/nav';

type CTab = 'videos' | 'playlists';
const FIRST = 40; // VideoList del POC: dibuja 40…
const MORE = 60; // …y «Ver más» suma de a 60
const POLL_MS = 1500; // mientras el server enriquece el canal (el useLiveQuery del POC se actualizaba solo)
const POLL_MAX = 120;

/** Vista de un canal (ChannelView del POC, overlay → ruta /mytube/canal/:id). Cabecera con avatar, título, @handle,
 *  Seguir/Siguiendo y la descripción curada; solapas Videos (N) — aprobados, sin duplicados ni palabras bloqueadas, en
 *  orden de ingesta, de a tandas — y Playlists (N) — las propias del canal con algo aprobado, por título, en acordeón.
 *  Todo video se abre SUELTO (sin cola), también los de una playlist (quirk fiel). */
export function ChannelView() {
  const { id = '' } = useParams();
  const go = useNavigate();
  const back = useMtBack('canales');
  const [detail, setDetail] = useState<MtChannelDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [tab, setTab] = useState<CTab>('videos');
  const [descOpen, setDescOpen] = useState(false);
  const [vids, setVids] = useState<MtVideo[] | null>(null);
  const [vTotal, setVTotal] = useState(0);
  const [vFailed, setVFailed] = useState(false);
  const [limit, setLimit] = useState(FIRST);
  const [more, setMore] = useState(false);
  const [openPl, setOpenPl] = useState<Record<string, number>>({}); // abiertas → cuántos videos dibujan
  const [plVideos, setPlVideos] = useState<Record<string, MtVideo[] | null | 'error'>>({});
  const cur = useRef(id); // para descartar respuestas de un canal anterior
  cur.current = id;

  useEffect(() => {
    setDetail(null); setFailed(false); setTab('videos'); setDescOpen(false);
    setVids(null); setVTotal(0); setVFailed(false); setLimit(FIRST); setOpenPl({}); setPlVideos({});
    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loadDetail = async (first: boolean) => {
      try {
        const d = await api.mtChannel(id);
        if (cancelled) return;
        setDetail(d);
        if (first) setFollowed(d.followed);
        if (d.pending && ++polls < POLL_MAX) timer = setTimeout(() => void loadDetail(false), POLL_MS);
      } catch {
        if (cancelled) return;
        if (first) setFailed(true);
        else if (++polls < POLL_MAX) timer = setTimeout(() => void loadDetail(false), POLL_MS);
      }
    };
    void loadDetail(true);
    api.mtChannelVideos(id, 0, FIRST).then(
      (r) => { if (!cancelled) { setVids(r.videos); setVTotal(r.total); } },
      () => { if (!cancelled) setVFailed(true); },
    );
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [id]);

  const total = detail?.total ?? vTotal;

  // Las solapas desmontan su contenido en el POC: volver a Videos arranca otra vez en 40 y Playlists vuelve cerrada.
  const changeTab = (t: CTab) => {
    if (t === tab) return;
    setTab(t); setLimit(FIRST); setOpenPl({});
  };

  const showMore = async () => {
    if (!vids || more) return;
    const next = limit + MORE;
    const want = Math.min(next, total);
    if (vids.length < want) {
      setMore(true);
      try {
        const r = await api.mtChannelVideos(id, vids.length, want - vids.length);
        if (cur.current !== id) return;
        setVids((v) => [...(v ?? []), ...r.videos]);
        setVTotal(r.total);
      } catch {
        return; // sin la tanda nueva no se corre el límite (se puede volver a tocar)
      } finally {
        setMore(false);
      }
    }
    setLimit(next);
  };

  const follow = async () => {
    if (!detail?.channel) return; // el toggleFollow del POC no hace nada si el canal no existe
    const want = !followed;
    setFollowed(want);
    const r = await api.toggleFollow(id, want).catch(() => null);
    if (cur.current !== id) return;
    setFollowed(r ? r.followed : !want);
  };

  const togglePl = (pid: string) => {
    const opening = !(pid in openPl);
    setOpenPl((o) => { const n = { ...o }; if (pid in n) delete n[pid]; else n[pid] = FIRST; return n; });
    if (opening && (plVideos[pid] === undefined || plVideos[pid] === 'error')) {
      setPlVideos((p) => ({ ...p, [pid]: null }));
      api.mtChannelPlaylist(pid).then(
        (r) => { if (cur.current === id) setPlVideos((p) => ({ ...p, [pid]: r.videos })); },
        () => { if (cur.current === id) setPlVideos((p) => ({ ...p, [pid]: 'error' })); },
      );
    }
  };

  const play = (v: MtVideo) => go(videoPath(v.videoId), { state: { backTo: channelPath(id), backLabel: '‹ Canal' } });

  return (
    <section className="view mt-view">
      <button type="button" className="back" onClick={back}>‹ Volver</button>
      {failed ? <p className="mt-empty">No pude cargar este canal ahora.</p> : !detail ? <HeaderSkeleton /> : (
        <>
          <ChannelHeader channel={detail.channel} followed={followed} descOpen={descOpen}
            onFollow={() => void follow()} onToggleDesc={() => setDescOpen((o) => !o)} />
          <UnderlineTabs key={`${total}-${detail.playlists.length}`} value={tab} onChange={changeTab}
            tabs={[{ id: 'videos', label: `Videos (${total})` }, { id: 'playlists', label: `Playlists (${detail.playlists.length})` }]}
            className="mt-tabs" tabClass="mt-tab" inkClass="mt-ink" />
          {tab === 'videos' ? (
            vFailed ? <p className="mt-empty">No pude cargar los videos ahora.</p>
              : !vids ? <VideoListSkeleton />
                : total > 0 ? <VideoList videos={vids.slice(0, limit)} remaining={total - limit} busy={more} onMore={() => void showMore()} onPlay={play} />
                  : <p className="mt-empty">Todavía no hay videos aprobados de este canal.</p>
          ) : (
            detail.playlists.length ? (
              <div className="mt-pls">
                {detail.playlists.map((p) => {
                  const pv = plVideos[p.playlistId];
                  return (
                    <PlaylistRow key={p.playlistId} title={p.title} open={p.playlistId in openPl}
                      videos={pv === 'error' || pv === undefined ? null : pv} failed={pv === 'error'}
                      limit={openPl[p.playlistId] ?? FIRST} onToggle={() => togglePl(p.playlistId)}
                      onMore={() => setOpenPl((o) => ({ ...o, [p.playlistId]: (o[p.playlistId] ?? FIRST) + MORE }))} onPlay={play} />
                  );
                })}
              </div>
            ) : detail.pending
              ? <p className="mt-empty is-wait">Buscando las playlists del canal…</p>
              : <p className="mt-empty">Este canal no tiene playlists aprobadas.</p>
          )}
        </>
      )}
    </section>
  );
}

function HeaderSkeleton() {
  return (
    <div className="mt-chhead" aria-busy="true">
      <span className="mt-chav big mt-sk" />
      <div className="mt-chmeta"><i className="mt-sk mt-sk-t" /><i className="mt-sk mt-sk-s" /></div>
    </div>
  );
}
