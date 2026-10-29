import type { FeedItem } from '../../../api/types';
import { imgSrc } from '../../../shared/lib/img';
import { FeedCard } from '../components/FeedCard';
import { IcRouteLine } from '../components/feedIcons';

type It = Extract<FeedItem, { kind: 'route' }>;

/** Ruta recomendada (por los intereses del chico o porque la compartió un amigo: lo dice su "por qué") como card
 *  estándar: abre la ruta en Aprender. Desde la tanda W3 son rutas del CATÁLOGO de Learn: `img` = su portada (data URL
 *  subida en /crear o la miniatura del primer video) o '' → la miniatura cae al emoji de la ruta (`emoji`) sobre su
 *  fondo; `units` = sus postas.
 *  `done` (ADITIVO, tanda "Cards del feed"): las postas ya hechas. Empezada → "2 de 5 postas" y una barra fina con los
 *  colores de la portada (decorativa: el meta ya lo dice); completa → "✓ Completa · 5 postas", sin barra; sin empezar o
 *  sin el dato → "5 postas", como siempre. Un `done` roto (negativo, de más, no número) se acota: la card no se rompe.
 *  La media es un MINI-HERO (tanda V2): la misma columna que el video (220×124 en escritorio, a todo el ancho en el
 *  teléfono) con el degradé de la ruta de fondo — que es también el fallback si la portada no carga — y encima la portada
 *  o, sin portada, el emoji grande. Pura. */
export const FeedRouteCard = ({ it, onOpen, onLess }: { it: It; onOpen: (courseId: string) => void; onLess: () => void }) => {
  const c = it.course;
  const src = c.img ? (/^(data:|https?:\/\/)/.test(c.img) ? c.img : imgSrc(c.img)) : '';
  const word = c.units === 1 ? 'posta' : 'postas';
  const done = typeof c.done === 'number' && Number.isFinite(c.done) ? Math.min(Math.max(Math.floor(c.done), 0), c.units) : 0;
  const full = c.units > 0 && done === c.units;
  const going = done > 0 && !full;
  return (
    <FeedCard family="ruta" icon={<IcRouteLine />} label="Ruta" time={it.time} reason={it.reason} onLess={onLess} link
      thumb={(
        <span className="hf-th is-art" style={{ backgroundImage: `linear-gradient(135deg,${c.bg[0]},${c.bg[1]})` }}>
          {src ? <img src={src} alt="" loading="lazy" /> : <span className="hf-th-em" aria-hidden="true">{c.emoji ?? '🧭'}</span>}
        </span>
      )}
      title={c.name}
      meta={full
        ? <><span className="hf-ok" aria-hidden="true">✓</span> Completa · {c.units} {word}</>
        : going ? `${done} de ${c.units} ${word}` : `${c.units} ${word}`}
      extra={going ? (
        <span className="hf-prog" aria-hidden="true">
          <i style={{ width: `${Math.round((done / c.units) * 100)}%`, background: `linear-gradient(90deg,${c.bg[0]},${c.bg[1]})` }} />
        </span>
      ) : undefined}
      action={<button type="button" className="hf-cta is-quiet hf-stretch" aria-label={`Ver la ruta «${c.name}»`} onClick={() => onOpen(c.id)}>Ver ruta</button>}
    />
  );
};
