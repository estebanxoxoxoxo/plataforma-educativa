import type { ChatMedia } from '../../../api/types';

type Art = NonNullable<ChatMedia['articles']>[number];
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

/** Un artículo de un sitio aprobado que el chat sugiere leer, como fila del grupo «Artículos» (la ArticleRow del POC:
 *  inicial del sitio, sitio, título y resumen). Abre el lector moderado. */
export const ChatArticleCard = ({ a, onOpen }: { a: Art; onOpen: (url: string) => void }) => {
  const h = host(a.url);
  return (
    <button type="button" className="mg-art" onClick={() => onOpen(a.url)}>
      <span className="mg-fav" aria-hidden="true">{(h[0] ?? '?').toUpperCase()}</span>
      <span className="mg-atx">
        <small>{h}</small>
        <b>{a.title}</b>
        {a.snippet && <span>{a.snippet}</span>}
      </span>
    </button>
  );
};
