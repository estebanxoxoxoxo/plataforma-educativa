import type { Playlist } from '../../../api/types';
import { IcListMusic } from '../../../shared/components/icons';

/** Tarjeta de una lista de reproducción del chico (cover = thumb del primer video). */
export function PlaylistCard({ l, onOpen }: { l: Playlist; onOpen: () => void }) {
  return (
    <div className="plcard" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <span className="plcover">
        {l.cover ? <img src={l.cover} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <IcListMusic />}
        <i>{l.count} {l.count === 1 ? 'video' : 'videos'}</i>
      </span>
      <b>{l.name}</b>
    </div>
  );
}
