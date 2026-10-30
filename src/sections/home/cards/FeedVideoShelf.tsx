import type { VideoResult } from '../../../api/types';
import { IcArrowRight, IcPlay } from '../../../shared/components/icons';
import { imgSrc } from '../../../shared/lib/img';
import { WhyChip } from '../components/FeedBits';
import { IcPlayLine } from '../components/feedIcons';
import type { ShelfItem } from '../lib/extras';

/** Bloque de VIDEOS (estilo D del mock v6): un lugar del hilo = una grilla de videos del catálogo aprobado + el total del
 *  tema y "Ver todos →" (el buscador de videos con ese tema). Tocar un video abre el reproductor. El «por qué», en su pie
 *  abajo a la derecha (FEED-3). Pura. */
export function FeedVideoShelf({ it, onOpen, onAll }: { it: ShelfItem; onOpen: (v: VideoResult) => void; onAll: () => void }) {
  return (
    <section className="hf-shelf" aria-labelledby="hf-shelf-t">
      <div className="hf-shelf-h">
        <IcPlayLine />
        <h3 id="hf-shelf-t">{it.title}</h3>
        <span className="hf-co" title={`${it.total} videos de este tema en Buscar`}>{it.total}</span>
        <span className="hf-sp" />
        <button type="button" className="hf-tl" onClick={onAll}>Ver todos<IcArrowRight aria-hidden="true" /></button>
      </div>
      <ul className="hf-vgrid">
        {it.videos.map((v) => (
          <li key={v.id}>
            <button type="button" className="hf-vid" aria-label={`Mirar «${v.title}»`} onClick={() => onOpen(v)}>
              <span className="hf-vthumb">
                <img src={imgSrc(v.img)} alt="" referrerPolicy="no-referrer" loading="lazy" />
                <span className="hf-vpl" aria-hidden="true"><IcPlay /></span>
                {v.duration && <b className="hf-dur">{v.duration}</b>}
              </span>
              <span className="hf-vt">{v.title}</span>
              <span className="hf-vm">{v.channel}</span>
            </button>
          </li>
        ))}
      </ul>
      {/* FEED-3: el «por qué» sale de la cabecera a un pie propio, abajo a la derecha (como en todas las cards) */}
      <div className="hf-shelf-f"><WhyChip reason={it.reason} /></div>
    </section>
  );
}
