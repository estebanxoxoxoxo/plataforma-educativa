import type { FeedItem } from '../../../api/types';
import { FeedCard } from '../components/FeedCard';
import { IcBookLine } from '../components/feedIcons';

type It = Extract<FeedItem, { kind: 'article' }>;

/** Lectura recomendada (sitio de la lista blanca) como card estándar: abre el lector moderado. Pura. */
export const FeedArticleCard = ({ it, onOpen, onLess }: { it: It; onOpen: (url: string) => void; onLess: () => void }) => (
  <FeedCard family="lectura" icon={<IcBookLine />} label="Lectura" time={it.time} reason={it.reason} onLess={onLess} link
    thumb={<span className="hf-th is-icon" aria-hidden="true"><IcBookLine /></span>}
    title={it.title}
    meta={it.source}
    action={<button type="button" className="hf-cta is-quiet hf-stretch" aria-label={`Leer «${it.title}»`} onClick={() => onOpen(it.url)}>Leer</button>}
  />
);
