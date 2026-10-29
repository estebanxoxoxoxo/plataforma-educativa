import type { FeedItem, VideoResult } from '../../../api/types';
import { IcPlay, IcResVideo } from '../../../shared/components/icons';
import { imgSrc } from '../../../shared/lib/img';
import { FeedCard } from '../components/FeedCard';

type It = Extract<FeedItem, { kind: 'video' }>;

/** Video recomendado (del catálogo aprobado) como card estándar: tocarla en cualquier lado abre el reproductor. La media
 *  MANDA (tanda V2): 16:9 grande — columna de 220 en escritorio, a todo el ancho arriba en el teléfono — con el mismo
 *  disco de play del estante encima (decorativo: la acción ya dice «Mirar») y la duración en su etiqueta. 16:9 y no 4:3
 *  como el mock: la de YouTube trae bandas negras arriba y abajo. Pura. */
export const FeedVideoCard = ({ it, onOpen, onLess }: { it: It; onOpen: (v: VideoResult) => void; onLess: () => void }) => (
  <FeedCard family="video" icon={<IcResVideo />} label="Video" time={it.time} reason={it.reason} onLess={onLess} link
    thumb={(
      <span className="hf-th is-video">
        <img src={imgSrc(it.video.img)} alt="" referrerPolicy="no-referrer" loading="lazy" />
        <span className="hf-vpl" aria-hidden="true"><IcPlay /></span>
        {it.video.duration && <b className="hf-dur">{it.video.duration}</b>}
      </span>
    )}
    title={it.video.title}
    meta={it.video.channel}
    action={<button type="button" className="hf-cta is-quiet hf-stretch" aria-label={`Mirar «${it.video.title}»`} onClick={() => onOpen(it.video)}>Mirar</button>}
  />
);
