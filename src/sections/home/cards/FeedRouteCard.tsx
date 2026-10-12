import type { FeedItem } from '../../../api/types';
import { imgSrc } from '../../../shared/lib/img';
import { FeedCard } from '../components/FeedCard';
import { IcRouteLine } from '../components/feedIcons';

type It = Extract<FeedItem, { kind: 'route' }>;

/** Ruta recomendada (por los intereses del chico o porque la compartió un amigo: lo dice su "por qué") como card
 *  estándar: abre la ruta en Aprender. Desde la tanda W3 son rutas del CATÁLOGO de Learn: `img` = su portada (data URL
 *  subida en /crear o la miniatura del primer video) o '' → la miniatura cae al emoji de la ruta (`emoji`, ADITIVO del
 *  feed fake hasta que el coordinador lo formalice en types.ts) sobre su fondo; `units` = sus postas. Pura. */
export const FeedRouteCard = ({ it, onOpen, onLess }: { it: It; onOpen: (courseId: string) => void; onLess: () => void }) => {
  const c = it.course as It['course'] & { emoji?: string };
  const src = c.img ? (/^(data:|https?:\/\/)/.test(c.img) ? c.img : imgSrc(c.img)) : '';
  return (
    <FeedCard family="ruta" icon={<IcRouteLine />} label="Ruta" time={it.time} reason={it.reason} onLess={onLess} link
      thumb={(
        <span className="hf-th is-art" style={{ background: `linear-gradient(135deg,${c.bg[0]},${c.bg[1]})` }}>
          {src ? <img src={src} alt="" loading="lazy" /> : <span aria-hidden="true" style={{ fontSize: 28, lineHeight: 1 }}>{c.emoji ?? '🧭'}</span>}
        </span>
      )}
      title={c.name}
      meta={`${c.units} ${c.units === 1 ? 'posta' : 'postas'}`}
      action={<button type="button" className="hf-cta is-quiet hf-stretch" aria-label={`Ver la ruta «${c.name}»`} onClick={() => onOpen(c.id)}>Ver ruta</button>}
    />
  );
};
