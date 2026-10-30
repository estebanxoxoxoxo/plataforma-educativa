import { fmtDuration, fmtFecha } from '../lib/fmt';
import type { MtVideo } from '../../../api/types';

/** Lista de videos de a tandas (VideoList del POC: 40 y «Ver más (N restantes)» de a 60; la tanda la maneja quien la usa).
 *  `remaining` = los que quedan sin dibujar. Desde el 30-oct (pedido de Esteban: todas las cards de video del mismo tamaño)
 *  es una GRILLA de la tarjeta común (.mt-card), la misma de Canales y Mis listas; antes eran filas. La reusa Familia. */
export function VideoList({ videos, remaining, busy, onMore, onPlay }: {
  videos: MtVideo[]; remaining: number; busy?: boolean; onMore: () => void; onPlay: (v: MtVideo) => void;
}) {
  return (
    <div className="mt-vlist">
      {videos.map((v) => <VideoCard key={v.videoId} v={v} onPlay={() => onPlay(v)} />)}
      {remaining > 0 && (
        <button type="button" className="mt-more" disabled={busy} onClick={onMore}>Ver más ({remaining} restantes)</button>
      )}
    </div>
  );
}

/** Tarjeta: miniatura a sangre con duración, título y "agregado {fecha}". Tocar abre el video suelto. */
export function VideoCard({ v, onPlay }: { v: MtVideo; onPlay: () => void }) {
  return (
    <button type="button" className="mt-card" onClick={onPlay}>
      <span className="mt-cmedia">
        <img className="mt-cimg" src={v.thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        {!!v.duration && <i className="mt-dur">{fmtDuration(v.duration)}</i>}
      </span>
      <span className="mt-cbody">
        <b>{v.title}</b>
        {!!v.addedAt && <small>agregado {fmtFecha(v.addedAt)}</small>}
      </span>
    </button>
  );
}

/** Tarjetas de espera mientras llega la primera tanda. */
export function VideoListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mt-vlist" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => <CardSkeleton key={i} />)}
    </div>
  );
}

/** Una tarjeta de espera con la forma exacta de .mt-card (la usan también Canales). */
export function CardSkeleton() {
  return <span className="mt-card is-sk"><span className="mt-cmedia mt-sk" /><span className="mt-cbody"><i className="mt-sk" /><i className="mt-sk" /></span></span>;
}
