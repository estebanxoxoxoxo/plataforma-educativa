import type { MtChannelCard } from '../../../api/types';

/** Tarjeta de un canal seguido (MyTube.tsx del POC): avatar, título y "N videos". Sin botón de seguir: se sigue y se deja
 *  de seguir adentro del canal o desde el reproductor. El número va tal cual (también "1 videos", como el POC).
 *  La reusa la grilla de Familia → MyTube (tanda F2, la MISMA presentación que ve el chico): ahí `counting` = el número
 *  todavía no llegó (se pide al verse la tarjeta) y en su lugar va "… videos". El MyTube del chico no lo pasa. */
export function ChannelCard({ c, onOpen, counting = false }: { c: MtChannelCard; onOpen: () => void; counting?: boolean }) {
  return (
    <button type="button" className="mt-chcard" onClick={onOpen}>
      {c.thumb
        ? <img className="mt-chav" src={c.thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        : <span className="mt-chav" />}
      <b>{c.title}</b>
      {counting ? <small aria-label="Contando videos">… videos</small> : <small>{c.videos} videos</small>}
    </button>
  );
}
