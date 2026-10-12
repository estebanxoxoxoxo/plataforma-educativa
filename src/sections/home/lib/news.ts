// Las NOTICIAS que atraviesan el hilo (estilo C del mock v6): lo de las LIGAS — la tarjeta de la liga de la semana y las
// medallas, ascensos y la carrera de la tabla (propias y de los amigos). El resto de lo social (rachas, insignias, rutas
// compartidas) va como card estándar con su avatar y sus reacciones.
import type { FeedItem } from '../../../api/types';
import { MEDAL_INFO, type Medal } from '../../leagues/lib/cycle';

type Friend = Extract<FeedItem, { kind: 'friend' }>;
export type NewsItem = Extract<FeedItem, { kind: 'league' }> | (Friend & { icon: 'medal' | 'league' });
export const isNews = (it: FeedItem): it is NewsItem =>
  it.kind === 'league' || (it.kind === 'friend' && (it.icon === 'medal' || it.icon === 'league'));

const MEDAL_BY_EMOJI = new Map((Object.keys(MEDAL_INFO) as Medal[]).map((m) => [MEDAL_INFO[m].emoji, m] as const));
/** Un emoji (con su selector de variante o sus uniones ZWJ). */
const PICTO = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}️?)*/gu;
const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/ ([:;,.!?])/g, '$1').trim();

/** La cara de la noticia: el emoji grande (la medalla si la nombra; si no, el último emoji del texto; si no, una copa) y
 *  el texto SIN ese emoji (ya va grande al lado). `atStart` = solo cuenta una medalla al principio (la tarjeta de la liga:
 *  "🥈 ¡La semana pasada saliste 2º…"). */
export function newsFace(text: string, atStart = false): { emoji: string; medal: Medal | null; text: string } {
  const medal = [...MEDAL_BY_EMOJI.keys()].find((e) => (atStart ? text.startsWith(e) : text.includes(e)));
  if (medal) return { emoji: medal, medal: MEDAL_BY_EMOJI.get(medal) ?? null, text: tidy(text.replace(medal, '')) };
  const all = atStart ? [] : text.match(PICTO) ?? [];
  const last = all[all.length - 1];
  if (!last) return { emoji: '🏆', medal: null, text: tidy(text) };
  const i = text.lastIndexOf(last);
  return { emoji: last, medal: null, text: tidy(text.slice(0, i) + text.slice(i + last.length)) };
}
