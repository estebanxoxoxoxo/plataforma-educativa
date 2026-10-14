// Qué tarjetas del feed se muestran según los on-off del padre (Familia: lib/features.ts; con un adulto activo, todo prendido).
// Desde el Feed v6 el server (feedFake) ya NO manda lo que la familia apagó; esto queda como red de seguridad VISUAL:
// cubre un on-off que cambia en vivo con el hilo ya cargado y, sin datos todavía (null), oculta lo social (fail-closed).
import type { FeedItem, ParentFeatures } from '../../../api/types';

/** Mínimo de tarjetas visibles de la PRIMERA página: si los flags dejan menos, el feed pide la siguiente solo (el feed
 *  nunca queda vacío por los flags). Las demás páginas las pide el chico ("Ver más de antes"). */
export const MIN_VISIBLE = 3;

/** Las noticias de amigos que en realidad son de ligas (medallas, ascensos). */
const LEAGUE_ICONS: ReadonlySet<string> = new Set(['league', 'medal']);

export function feedItemVisible(it: FeedItem, f: ParentFeatures | null): boolean {
  if (it.kind === 'league') return f?.ligas === true;
  if (it.kind === 'friend') return f?.amigos === true && (!LEAGUE_ICONS.has(it.icon) || f.ligas === true);
  return true; // recomendaciones de contenido, el hero, la grilla y el resumen: no dependen de ningún on-off
}
