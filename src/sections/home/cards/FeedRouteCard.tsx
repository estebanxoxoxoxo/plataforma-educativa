import type { FeedItem } from '../../../api/types';
import { IcArrowRight } from '../../../shared/components/icons';
import { imgSrc } from '../../../shared/lib/img';

type It = Extract<FeedItem, { kind: 'route' }>;

/** Ruta/curso recomendado (por los temas de interés o porque la compartió un amigo). Abre el curso en Aprender.
 *  `fresh` = acaba de entrar (animación de entrada). */
export const FeedRouteCard = ({ it, onOpen, fresh }: { it: It; onOpen: (courseId: string) => void; fresh?: boolean }) => (
  <button className={`fcard froute${fresh ? ' fnew' : ''}`} onClick={() => onOpen(it.course.id)}>
    <span className="fart" style={{ background: `linear-gradient(135deg,${it.course.bg[0]},${it.course.bg[1]})` }}>
      <img src={imgSrc(it.course.img)} alt="" loading="lazy" />
    </span>
    <span className="fbody">
      <small className="ftag troute">Ruta recomendada</small>
      <b className="ftitle">{it.course.name}</b>
      <span className="fmeta">{it.course.units} unidades · {it.reason}</span>
    </span>
    <span className="fgo">Ver ruta<IcArrowRight /></span>
  </button>
);
