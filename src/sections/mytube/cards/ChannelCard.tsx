import type { MtChannelCard } from '../../../api/types';

/** Tarjeta de un canal seguido (MyTube.tsx del POC): avatar, título y "N videos". Sin botón de seguir: se sigue y se deja
 *  de seguir adentro del canal o desde el reproductor. El número va tal cual (también "1 videos", como el POC).
 *  La reusa la grilla de Familia → MyTube (tanda F2, la MISMA presentación que ve el chico): ahí `counting` = el número
 *  todavía no llegó (se pide al verse la tarjeta) y en su lugar va "… videos". El MyTube del chico no lo pasa.
 *  Desde el 30-oct (pedido de Esteban: «todas las cards de video del mismo tamaño y la imagen sin padding») es la tarjeta
 *  de video común (.mt-card): arriba la franja 16:9 A SANGRE —el mismo avatar, ampliado y desenfocado, de fondo— con el
 *  avatar redondo al medio (un avatar cuadrado recortado a 16:9 cortaba logos y caras), y abajo título y "N videos". */
export function ChannelCard({ c, onOpen, counting = false }: { c: MtChannelCard; onOpen: () => void; counting?: boolean }) {
  return (
    <button type="button" className="mt-card mt-chcard" onClick={onOpen}>
      <span className="mt-cmedia mt-chmedia">
        {c.thumb && <img className="mt-cimg mt-chbg" src={c.thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />}
        {c.thumb
          ? <img className="mt-chav" src={c.thumb} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          : <span className="mt-chav" />}
      </span>
      <span className="mt-cbody">
        <b>{c.title}</b>
        {counting ? <small aria-label="Contando videos">… videos</small> : <small>{c.videos} videos</small>}
      </span>
    </button>
  );
}
