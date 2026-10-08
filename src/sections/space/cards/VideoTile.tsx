import type { VideoResult } from '../../../api/types';

/** Mini-tarjeta de video para las grillas de canal / lista (thumb 16:9 + duración + título). */
export function VideoTile({ v, onOpen }: { v: VideoResult; onOpen: () => void }) {
  return (
    <div className="vtile" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <span className="vth">
        <img src={v.img} alt="" loading="lazy" referrerPolicy="no-referrer" />
        {v.duration && <i>{v.duration}</i>}
      </span>
      <b>{v.title}</b>
      <small>{v.channel}{v.date ? ` · ${v.date}` : ''}</small>
    </div>
  );
}
