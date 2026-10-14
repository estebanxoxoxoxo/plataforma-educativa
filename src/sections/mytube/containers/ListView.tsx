import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, api } from '../../../api';
import type { PlaylistDetail, VideoResult } from '../../../api/types';
import { playQueue, type BgTrack } from '../../../shared/audio/bgAudio';
import { IcClose, IcDots, IcDownSm, IcHeadphones, IcPlay, IcUpSm } from '../../../shared/components/icons';
import { ConfirmSheet } from '../../create/components/ConfirmSheet';
import { ListActionSheet, NameSheet } from '../components/Sheets';
import { listPath, useMtBack, videoPath } from '../lib/nav';

type Sheet = 'none' | 'menu' | 'rename' | 'confirm';

/** Vista de una lista del chico (ListView del POC, overlay → ruta /mytube/lista/:id). Los videos vienen re-resueltos y
 *  en el orden de la lista (sin des-aprobados ni palabras bloqueadas). «Reproducir todo» abre el reproductor con la lista
 *  como cola; «Escuchar de fondo» manda la cola entera al audio de fondo y cierra la vista; ↑/↓ intercambian con el
 *  vecino VISIBLE (por videoId) y ✕ quita. Tocar un video lo reproduce SUELTO. ⋮ → Renombrar / Borrar lista. */
export function ListView() {
  const { id = '0' } = useParams();
  const lid = Number(id) || 0;
  const go = useNavigate();
  const close = useMtBack('listas');
  const [data, setData] = useState<PlaylistDetail | null>(null);
  const [missing, setMissing] = useState(false); // no existe: el POC muestra «Lista» vacía y sin menú
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState<Sheet>('none');
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  /** Relee la lista (después de cada cambio: lo que se ve es lo que guardó el server). Sin tapar lo que ya hay. */
  const load = useCallback(async () => {
    const my = ++seq.current;
    try {
      const d = await api.playlist(lid);
      if (my === seq.current) { setData(d); setMissing(false); setFailed(false); }
    } catch (e) {
      if (my !== seq.current) return;
      if (e instanceof ApiError && e.status === 404) { setData(null); setMissing(true); } else setFailed(true);
    }
  }, [lid]);
  useEffect(() => { setData(null); setMissing(false); setFailed(false); setSheet('none'); void load(); }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch { /* la relectura muestra lo que quedó */ }
    await load();
    setBusy(false);
  };

  const videos = data?.videos ?? [];
  const name = data?.name ?? 'Lista';
  const tracks: BgTrack[] = videos.map((v) => ({ id: v.id, title: v.title, img: v.img }));
  const back = { backTo: listPath(lid), backLabel: '‹ Mi lista' };
  // La cola del reproductor: ids + los videos (miniatura/título/duración) para su panel «En la lista», como el POC.
  const playAll = () => go(videoPath(videos[0].id), { state: { ...back, queue: videos.map((v) => v.id), qi: 0, qvideos: videos } });
  const listen = () => { playQueue(tracks, 0, 0); close(); };
  const play = (v: VideoResult) => go(videoPath(v.id), { state: back });

  return (
    <section className="view mt-view">
      <button type="button" className="back" onClick={close}>‹ Volver</button>
      <div className="mt-lhead">
        <h2>{name}</h2>
        {data && <button type="button" className="mt-dots" aria-label="Opciones de la lista" onClick={() => setSheet('menu')}><IcDots /></button>}
      </div>
      {failed && !data ? <p className="mt-empty">No pude cargar esta lista ahora.</p> : (data || missing) && (
        <>
          {videos.length > 0 && (
            <div className="mt-acts">
              <button type="button" className="mt-btn" onClick={playAll}><IcPlay />Reproducir todo</button>
              <button type="button" className="mt-btn mt-btn--soft" onClick={listen}><IcHeadphones />Escuchar de fondo</button>
            </div>
          )}
          {videos.length === 0 ? (
            <p className="mt-none">Esta lista está vacía.<br />Agregá videos desde el reproductor con <b>＋ Lista</b>.</p>
          ) : (
            <div className="mt-lrows" aria-busy={busy}>
              {videos.map((v, i) => (
                <div key={v.id} className="mt-lrow">
                  <button type="button" className="mt-lplay" onClick={() => play(v)}>
                    <span className="mt-lth"><img src={v.img} alt="" loading="lazy" referrerPolicy="no-referrer" /></span>
                    <b>{v.title}</b>
                  </button>
                  <span className="mt-ord">
                    <button type="button" className="mt-ib" aria-label="Subir" disabled={i === 0 || busy}
                      onClick={() => void act(() => api.playlistSwap(lid, v.id, videos[i - 1].id))}><IcUpSm /></button>
                    <button type="button" className="mt-ib" aria-label="Bajar" disabled={i === videos.length - 1 || busy}
                      onClick={() => void act(() => api.playlistSwap(lid, v.id, videos[i + 1].id))}><IcDownSm /></button>
                  </span>
                  <button type="button" className="mt-ib del" aria-label="Quitar de la lista" disabled={busy}
                    onClick={() => void act(() => api.playlistRemove(lid, v.id))}><IcClose /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {sheet === 'menu' && data && (
        <ListActionSheet name={data.name} onRename={() => setSheet('rename')} onDelete={() => setSheet('confirm')} onClose={() => setSheet('none')} />
      )}
      {sheet === 'rename' && data && (
        <NameSheet title="Renombrar lista" cta="Guardar" initial={data.name} busy={busy} onClose={() => setSheet('none')}
          onSubmit={(n) => void act(async () => { await api.renamePlaylist(lid, n); setSheet('none'); })} />
      )}
      {sheet === 'confirm' && data && (
        <ConfirmSheet text={`¿Borrar la lista "${data.name}"? Los videos no se borran.`} confirmLabel="Borrar lista" danger
          onAnswer={(yes) => {
            setSheet('none');
            if (yes) void api.deletePlaylist(lid).then(close, () => void load());
          }} />
      )}
    </section>
  );
}
