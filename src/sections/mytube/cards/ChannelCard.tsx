import type { MtChannelCard } from '../../../api/types';

/** Tarjeta de un canal seguido (MyTube.tsx del POC): avatar, título y "N videos". Sin botón de seguir: se sigue y se deja
 *  de seguir adentro del canal o desde el reproductor. El número va tal cual (también "1 videos", como el POC). */
export function ChannelCard({ c, onOpen }: { c: MtChannelCard; onOpen: () => void }) {
  return (
    <button type="button" className="mt-chcard" onClick={onOpen}>
      {c.thumb
        ? <img className="mt-chav" src={c.thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        : <span className="mt-chav" />}
      <b>{c.title}</b>
      <small>{c.videos} videos</small>
    </button>
  );
}
