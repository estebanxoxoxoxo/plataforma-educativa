import type { FeedItem } from '../../../api/types';
import { FeedCard } from '../components/FeedCard';
import { IcBookLine } from '../components/feedIcons';

type It = Extract<FeedItem, { kind: 'article' }>;

/** Lectura recomendada (sitio de la lista blanca) como card estándar: abre el lector moderado. Debajo del título, el
 *  copete (`snippet`, dos renglones como mucho): con el título solo el chico no sabe de qué trata antes de abrirla. Sin
 *  copete (o en blanco) no se dibuja nada: la card queda como siempre, sin hueco.
 *  La media (tanda V2 "la media manda"): la MISMA columna que el video y la ruta, pero sin foto — la lectura no trae imagen
 *  y robarla del sitio sería mentir —: un tratamiento editorial con el degradé de la familia, el libro grande y la FUENTE
 *  en chiquito (lo que la media cuenta es verdad). En el teléfono la media es un azulejo chico sin la fuente, y la fuente
 *  vuelve al meta: por eso va en los dos lugares y home.css muestra uno solo por ancho (el otro con display:none, que
 *  también lo saca del árbol de accesibilidad: el lector de pantalla la oye una vez). Pura. */
export const FeedArticleCard = ({ it, onOpen, onLess }: { it: It; onOpen: (url: string) => void; onLess: () => void }) => {
  const snippet = it.snippet?.trim();
  const source = it.source?.trim();
  return (
    <FeedCard family="lectura" icon={<IcBookLine />} label="Lectura" time={it.time} reason={it.reason} onLess={onLess} link
      thumb={(
        <span className="hf-th is-read">
          <IcBookLine />
          {source && <span className="hf-th-src">{source}</span>}
        </span>
      )}
      title={it.title}
      meta={source}
      extra={snippet ? <p className="hf-sn">{snippet}</p> : undefined}
      action={<button type="button" className="hf-cta is-quiet hf-stretch" aria-label={`Leer «${it.title}»`} onClick={() => onOpen(it.url)}>Leer</button>}
    />
  );
};
