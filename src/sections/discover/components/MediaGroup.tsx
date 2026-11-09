import type { ReactNode } from 'react';
import { LnBook, LnFilm, LnImages } from './icons';
import { isEn, L } from '../../../shared/lib/lang';

/** Los tres tipos de medio de Buscar y del Chat. (En la URL de Buscar, «Artículos» sigue siendo `pages`.) */
export type MediaKind = 'videos' | 'images' | 'articles';
// Función y no constante: las etiquetas se resuelven en cada render (L() lee el idioma actual).
const meta = (kind: MediaKind): { label: string; Icon: (p: { className?: string }) => ReactNode } => ({
  videos: { label: L('Videos', 'Videos'), Icon: LnFilm },
  images: { label: L('Imágenes', 'Images'), Icon: LnImages },
  articles: { label: L('Artículos', 'Articles'), Icon: LnBook },
})[kind];
/** «Ver los 5 videos» · «Ver las 7 imágenes» · «Ver los 4 artículos» (y su singular). */
export function moreLabel(kind: MediaKind, n: number): string {
  if (isEn()) return `See ${n === 1 ? `the ${kind === 'videos' ? 'video' : kind === 'images' ? 'image' : 'article'}` : `all ${n} ${kind}`}`;
  if (kind === 'images') return `Ver ${n === 1 ? 'la imagen' : `las ${n} imágenes`}`;
  return `Ver ${n === 1 ? (kind === 'videos' ? 'el video' : 'el artículo') : `los ${n} ${kind === 'videos' ? 'videos' : 'artículos'}`}`;
}

/** El grupo por tipo del POC (VideoGroup / ImageGallery / ArticleGroup de smarty-poc, tanda BUSCARCHAT): contenedor suave,
 *  cabecera fina con ícono + etiqueta, la previa (la arma quien llama: los primeros 3) y, si hay más, un botón a lo ancho
 *  «Ver los N …». En Buscar → Todo el botón lleva a la solapa del tipo (como el POC: onMore → goTab); en el Chat expande
 *  ahí mismo (`expanded` cambia el texto a «Ver menos»). Puro. */
export function MediaGroup({ kind, title, more, expanded, onMore, children }: {
  kind: MediaKind; title?: string; more?: number; expanded?: boolean; onMore?: () => void; children: ReactNode;
}) {
  const { label, Icon } = meta(kind);
  return (
    <section className={`mg mg--${kind}`} aria-label={title ?? label}>
      <header className="mg-h"><Icon className="mg-ic" /><span>{title ?? label}</span></header>
      {children}
      {more != null && more > 3 && onMore && (
        <button type="button" className="mg-more" onClick={onMore} aria-expanded={expanded}>
          <Icon className="mg-ic" />{expanded ? L('Ver menos', 'See less') : moreLabel(kind, more)}
        </button>
      )}
    </section>
  );
}
