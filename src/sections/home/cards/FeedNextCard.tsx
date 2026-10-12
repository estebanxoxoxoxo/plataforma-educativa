import type { FeedItem } from '../../../api/types';
import { IcArrowRight, IcSpark } from '../../../shared/components/icons';
import { Coins, WhyChip } from '../components/FeedBits';
import { IcRouteLine } from '../components/feedIcons';

type It = Extract<FeedItem, { kind: 'next' }>;

/** "Fijado · tu siguiente paso" (estilo B del mock v6): el PRIMER lugar del hilo, SIEMPRE la siguiente mejor acción de
 *  aprendizaje (jamás comercio). Raya del acento a la izquierda, título en serif, UNA acción sólida + su "por qué". Pura. */
export const FeedNextCard = ({ it, onGo }: { it: It; onGo: (to: string) => void }) => (
  <section className="hf-next" aria-labelledby="hf-next-t">
    <span className="hf-next-ic" aria-hidden="true"><IcRouteLine /></span>
    <div className="hf-next-tx">
      <p className="hf-k"><IcSpark aria-hidden="true" />Fijado · tu siguiente paso</p>
      <h3 className="hf-next-t" id="hf-next-t">{it.title}</h3>
      <p className="hf-next-mt"><Coins text={it.meta} /></p>
      <div className="hf-row">
        <button type="button" className="hf-cta" onClick={() => onGo(it.action.to)}>{it.action.label}<IcArrowRight aria-hidden="true" /></button>
        <WhyChip reason={it.reason} />
      </div>
    </div>
  </section>
);
