import type { FeedItem } from '../../../api/types';
import { imgSrc } from '../../../shared/lib/img';
import { FeedCard } from '../components/FeedCard';
import { IcRouteLine } from '../components/feedIcons';

type It = Extract<FeedItem, { kind: 'route' }>;

/** Ruta/curso recomendado (por los intereses del chico o porque la compartió un amigo: lo dice su "por qué") como card
 *  estándar: abre el curso en Aprender. Pura. */
export const FeedRouteCard = ({ it, onOpen, onLess }: { it: It; onOpen: (courseId: string) => void; onLess: () => void }) => (
  <FeedCard family="ruta" icon={<IcRouteLine />} label="Ruta" time={it.time} reason={it.reason} onLess={onLess} link
    thumb={(
      <span className="hf-th is-art" style={{ background: `linear-gradient(135deg,${it.course.bg[0]},${it.course.bg[1]})` }}>
        <img src={imgSrc(it.course.img)} alt="" loading="lazy" />
      </span>
    )}
    title={it.course.name}
    meta={`${it.course.units} unidades`}
    action={<button type="button" className="hf-cta is-quiet hf-stretch" aria-label={`Ver la ruta «${it.course.name}»`} onClick={() => onOpen(it.course.id)}>Ver ruta</button>}
  />
);
