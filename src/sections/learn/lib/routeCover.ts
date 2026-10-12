import type { LearnRoute } from './learn';

/* Portada de una ruta para el mosaico de Learn. Prioridad:
   1. override MANUAL (route.cover = data URL subido por el creador, ya recortado 16:9),
   2. miniatura del video (si el primer contenido es un video de YouTube — sync, gratis),
   3. imagen principal del artículo (Wikipedia summary API, CORS-OK — async, cacheada),
   4. null → el mosaico cae al emoji.
   La portada solo VENDE la ruta visualmente (no indica el tipo de contenido: una ruta puede
   mezclar artículos y videos). Todo client-side; no toca route-lab ni el modelo persistido. */

/* PORTE INNERITH (W3): port de smarty-poc app/src/lib/routeCover.ts (lo que usa el mosaico; `mqThumb`/`cropToCover` ya
   los portó /crear en sections/create/lib/routeCover.ts). RECORTE (alcance fijado por el brief de la tanda, documentado):
   el paso 3 —la imagen del artículo vía la API summary de Wikipedia, pedida DESDE EL NAVEGADOR y cacheada en
   localStorage— no se porta: en Innerith la UI no sale a la red fuera de `api` y esa imagen no pasa por ninguna
   moderación. Una ruta cuyo primer contenido es un artículo cae al emoji (paso 4). */

/** Miniatura del video. maxresdefault (1280×720, 16:9 nítida) — NO usar hqdefault (480×360,
 *  4:3 con barras negras). Si el video no tiene maxres, el consumidor cae a mqdefault (mqThumb). */
export function ytThumb(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}

type Content = { url?: string; title?: string; kind?: string; videoId?: string };

/** Primer contenido de la ruta: el source del 1er módulo, o el reading de la 1ª posta que lo tenga. */
export function firstContent(route: LearnRoute): Content | undefined {
  const m = route.modules?.[0]?.source;
  if (m && (m.url || m.videoId)) return m;
  return route.postas.find((p) => p.reading)?.reading;
}

/** Portada resuelta (o null → emoji): la manual, o la miniatura maxres del primer contenido si es un video. */
export function routeCover(route: LearnRoute): string | null {
  if (route.cover) return route.cover;
  const first = firstContent(route);
  return first?.kind === 'video' && first.videoId ? ytThumb(first.videoId) : null;
}

/** maxresdefault no siempre existe → caer a mqdefault (16:9 seguro); recién ahí al emoji (null). */
export function nextCoverOnError(src: string | null): string | null {
  return src && src.includes('/maxresdefault.jpg') ? src.replace('/maxresdefault.jpg', '/mqdefault.jpg') : null;
}
