import type { MouseEvent } from 'react';
import type { DriveItem } from '../../../api/types';

/** Tooltip NATIVO solo para los nombres que no entran (pedido de Esteban, 30-oct: «los nombres que no entran, en hover
 *  después de un rato se muestran en tooltip»). Se decide al entrar el mouse —el ancho de la tarjeta cambia con la
 *  ventana—: si el texto está cortado (scrollWidth > clientWidth) va el title con el nombre completo y el navegador lo
 *  muestra con su demora de siempre; si entra, no hay title (repetiría lo que ya se lee). */
export const titleIfCut = (full: string) => (e: MouseEvent<HTMLElement>) => {
  const el = e.currentTarget;
  if (el.scrollWidth > el.clientWidth + 1) el.title = full;
  else el.removeAttribute('title');
};

/** El sitio de una lectura guardada, para su vista previa editorial: la fuente que mandó quien la guardó (subtitle) o, si
 *  no hay, el host de la URL sin «www.». Nada de pedirle el favicon a un tercero (sería una request a otro sitio por cada
 *  tarjeta): el host escrito ya dice de dónde es. */
export function readingSource(it: DriveItem): string | null {
  const src = it.subtitle?.trim();
  if (src) return src;
  if (it.target.type !== 'article') return null;
  try { return new URL(it.target.url).hostname.replace(/^www\./, '') || null; }
  catch { return null; }
}
