import type { ReactNode } from 'react';
import { LnBook, LnFilm, LnImages } from './icons';

/** Los tres tipos de medio de Buscar y del Chat. (En la URL de Buscar, «Artículos» sigue siendo `pages`.) */
export type MediaKind = 'videos' | 'images' | 'articles';
const META: Record<MediaKind, { label: string; Icon: (p: { className?: string }) => ReactNode }> = {
  videos: { label: 'Videos', Icon: LnFilm },
  images: { label: 'Imágenes', Icon: LnImages },
  articles: { label: 'Artículos', Icon: LnBook },
};
/** «Ver los 5 videos» · «Ver las 7 imágenes» · «Ver los 4 artículos» (y su singular). */
export function moreLabel(kind: MediaKind, n: number): string {
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
  const { label, Icon } = META[kind];
  return (
    <section className={`mg mg--${kind}`} aria-label={title ?? label}>
      <header className="mg-h"><Icon className="mg-ic" /><span>{title ?? label}</span></header>
      {children}
      {more != null && more > 3 && onMore && (
        <button type="button" className="mg-more" onClick={onMore} aria-expanded={expanded}>
          <Icon className="mg-ic" />{expanded ? 'Ver menos' : moreLabel(kind, more)}
        </button>
      )}
    </section>
  );
}
