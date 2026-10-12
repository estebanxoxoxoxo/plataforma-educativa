import { IcListMusic } from '../../../shared/components/icons';
import type { MtVideo } from '../lib/mytubeApi';
import { VideoList } from './VideoList';

/** nombreLista del POC: «Lista X (12 videos)» (el título de una entrada 'playlist') → «X». */
export function nombreLista(t: string): string {
  return t.replace(/^Lista\s+/, '').replace(/\s*\(\d+\+?\s*videos?\)\s*$/i, '').trim() || t;
}

/** Una playlist del canal, en acordeón (PlaylistRow del POC). Abierta muestra SOLO sus videos aprobados y sin palabras
 *  bloqueadas, en el orden que los trae el server (por videoId: quirk fiel del POC); tocar uno lo abre SUELTO, no como
 *  cola. `videos` null = todavía cargando; `failed` = no se pudieron traer (cerrar y volver a abrir reintenta). */
export function PlaylistRow({ title, open, videos, failed = false, limit, onToggle, onMore, onPlay }: {
  title: string; open: boolean; videos: MtVideo[] | null; failed?: boolean; limit: number;
  onToggle: () => void; onMore: () => void; onPlay: (v: MtVideo) => void;
}) {
  return (
    <div className={`mt-pl${open ? ' is-open' : ''}`}>
      <button type="button" className="mt-pl-head" aria-expanded={open} onClick={onToggle}>
        <IcListMusic />
        <span className="mt-pl-t">{nombreLista(title)}</span>
        <span className="mt-pl-car" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-pl-body">
          {failed
            ? <p className="mt-pl-msg">No pude cargar esta lista ahora.</p>
            : videos === null
            ? <p className="mt-pl-msg">Cargando…</p>
            : videos.length
              ? <VideoList videos={videos.slice(0, limit)} remaining={videos.length - limit} onMore={onMore} onPlay={onPlay} />
              : <p className="mt-pl-msg">Sin videos aprobados en esta lista.</p>}
        </div>
      )}
    </div>
  );
}
