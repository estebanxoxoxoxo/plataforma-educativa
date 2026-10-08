// Qué tarjetas del feed se muestran según los on-off del padre (Zona de padres: lib/features.ts).
// El filtrado es VISUAL: el server (feedFake) sigue mandando todo; acá se ocultan las noticias de lo que
// la familia apagó. Sin datos todavía (null), lo social queda oculto (fail-closed).
import type { FeedItem, ParentFeatures } from '../../../api/types';

/** Mínimo de tarjetas visibles que tiene que aportar cada página: si los flags dejan menos, el feed
 *  pide la siguiente solo (el feed nunca queda vacío por los flags). */
export const MIN_VISIBLE = 3;

/** Las noticias de amigos que en realidad son de ligas (medallas, ascensos). */
const LEAGUE_ICONS: ReadonlySet<string> = new Set(['league', 'medal']);

export function feedItemVisible(it: FeedItem, f: ParentFeatures | null): boolean {
  if (it.kind === 'league') return f?.ligas === true;
  if (it.kind === 'friend') return f?.amigos === true && (!LEAGUE_ICONS.has(it.icon) || f.ligas === true);
  return true; // recomendaciones de contenido: no dependen de ningún on-off
}
