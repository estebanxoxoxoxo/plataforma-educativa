import type { FeedItem } from '../../../api/types';
import { IcResLect } from '../../../shared/components/icons';

type It = Extract<FeedItem, { kind: 'article' }>;

/** Lectura recomendada (sitio de la lista blanca). Abre el lector moderado. */
export const FeedArticleCard = ({ it, onOpen }: { it: It; onOpen: (url: string) => void }) => (
  <button className="fcard farticle" onClick={() => onOpen(it.url)}>
    <span className="fbody">
      <small className="ftag tlect"><IcResLect />Lectura · {it.reason}</small>
      <b className="ftitle">{it.title}</b>
      {it.snippet && <span className="fsnip">{it.snippet}</span>}
      <span className="fmeta">{it.source} · {it.time}</span>
    </span>
  </button>
);
