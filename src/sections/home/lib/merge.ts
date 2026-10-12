// La píldora "N novedades ↑" del Feed v6: lo fresco entra cuando el chico la toca. Se vuelve a pedir la PRIMERA página y
// lo que no estaba a la vista entra ARRIBA (debajo del hero); lo que ya estaba se queda en su lugar, refrescado con lo
// último del server (tiempos, reacciones, el resumen con la mezcla nueva, el hero si cambió la ruta en curso). Lo que
// venía en la primera página anterior y el server YA NO manda se va (p. ej. la tarjeta de la liga vieja después de un
// cierre, o algo de una funcionalidad que la familia apagó), salvo lo que el chico está viendo como "ver menos" (`keep`).
// Lo de las páginas siguientes no viaja en la primera: se queda. La grilla de videos no "entra" nunca como novedad: si
// existe, se refresca en su lugar. Puro: lo usa el contenedor (FeedPage).
import type { FeedItem } from '../../../api/types';

export function mergeFresh(cur: readonly FeedItem[], page1: readonly FeedItem[], prevPage1: ReadonlySet<string>, keep: ReadonlySet<string>): { items: FeedItem[]; added: FeedItem[] } {
  const have = new Set(cur.map((it) => it.id));
  const byId = new Map(page1.map((it) => [it.id, it] as const));
  const hero = page1.find((it) => it.kind === 'next');
  const sum = page1.find((it) => it.kind === 'summary');
  const kept = cur
    .filter((it) => it.kind === 'next' || it.kind === 'summary' || !prevPage1.has(it.id) || byId.has(it.id) || keep.has(it.id))
    .map((it) => (it.kind === 'next' ? hero ?? it : it.kind === 'summary' ? sum ?? it : byId.get(it.id) ?? it));
  const added = page1.filter((it) => !have.has(it.id) && it.kind !== 'next' && it.kind !== 'summary' && it.kind !== 'videos');
  const at = kept[0]?.kind === 'next' ? 1 : 0;
  return { items: [...kept.slice(0, at), ...added, ...kept.slice(at)], added };
}
