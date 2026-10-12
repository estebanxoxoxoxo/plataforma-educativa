import { fmtDuration, fmtFecha } from '../lib/fmt';
import type { MtVideo } from '../../../api/types';

/** Lista de videos de a tandas (VideoList del POC: 40 y «Ver más (N restantes)» de a 60; la tanda la maneja quien la usa).
 *  `remaining` = los que quedan sin dibujar. */
export function VideoList({ videos, remaining, busy, onMore, onPlay }: {
  videos: MtVideo[]; remaining: number; busy?: boolean; onMore: () => void; onPlay: (v: MtVideo) => void;
}) {
  return (
    <div className="mt-vlist">
      {videos.map((v) => <VideoRow key={v.videoId} v={v} onPlay={() => onPlay(v)} />)}
      {remaining > 0 && (
        <button type="button" className="mt-more" disabled={busy} onClick={onMore}>Ver más ({remaining} restantes)</button>
      )}
    </div>
  );
}

/** Fila: miniatura con duración, título y "agregado {fecha}". Tocar abre el video suelto. */
export function VideoRow({ v, onPlay }: { v: MtVideo; onPlay: () => void }) {
  return (
    <button type="button" className="mt-vrow" onClick={onPlay}>
      <span className="mt-vth">
        <img src={v.thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        {!!v.duration && <i>{fmtDuration(v.duration)}</i>}
      </span>
      <span className="mt-vmeta">
        <b>{v.title}</b>
        {!!v.addedAt && <small>agregado {fmtFecha(v.addedAt)}</small>}
      </span>
    </button>
  );
}

/** Filas de espera mientras llega la primera tanda. */
export function VideoListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mt-vlist" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="mt-vrow is-sk"><span className="mt-vth mt-sk" /><span className="mt-vmeta"><i className="mt-sk" /><i className="mt-sk" /></span></div>
      ))}
    </div>
  );
}
