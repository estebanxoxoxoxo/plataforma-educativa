// Formas ADITIVAS del Feed v6 que todavía no están en src/api/types.ts (pendientes de formalizar por el coordinador).
import type { FeedItem } from '../../../api/types';

/** La grilla de videos + `topic` (ADITIVO, lo manda server/src/feedFake.ts): el tema de la grilla, para que "Ver todos"
 *  lleve al buscador de videos con ese tema. */
export type ShelfItem = Extract<FeedItem, { kind: 'videos' }> & { topic?: string };

/** "Ver todos →" de la grilla: /buscar?tab=videos con el tema (o sin q, si el server no lo mandó). */
export const shelfAllUrl = (it: ShelfItem) => (it.topic ? `/buscar?q=${encodeURIComponent(it.topic)}&tab=videos` : '/buscar?tab=videos');
