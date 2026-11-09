import type { MarketItem } from '../../../api/types';
import { RewardCard } from '../cards/RewardCard';
import { Heart, HeartInline } from './Heart';
import { L } from '../../../shared/lib/lang';

/** "Tu lista de deseos" (/tienda?vista=deseos): los premios que el chico marcó con ❤, del más nuevo al
 *  más viejo, como tarjetas completas con el progreso del saldo hacia cada uno. Pura: el canje y el
 *  deseo los resuelve el contenedor (la misma hoja de canje que en la Tienda). */
export function WishlistView({ items, ec, onBack, onRedeem, onWish }: {
  /** Deseados, en el orden de la lista (más reciente primero) */ items: MarketItem[];
  /** Saldo actual (del server) */ ec: number;
  onBack: () => void;
  onRedeem: (item: MarketItem, btn: HTMLButtonElement) => void;
  onWish: (item: MarketItem) => void;
}) {
  const n = items.length;
  return (
    <>
      <a className="back st-back" href="/tienda" onClick={(e) => { e.preventDefault(); onBack(); }}>{L('‹ Tienda', '‹ Store')}</a>
      <header className="st-head">
        <h2 className="h2">{L('Tu lista de deseos', 'Your wishlist')}</h2>
        {/* Con premios, sin subtítulo (pedido de Esteban, 30-oct: quitar el «N premios que marcaste… Tenés N ⚡»). */}
        {n === 0 && <p className="lede">{L('Acá guardás los premios que más querés.', 'Keep the prizes you want most here.')}</p>}
      </header>
      {n > 0 ? (
        <div className="st-grid" data-view="deseos">
          {items.map((it) => (
            <RewardCard key={it.id} item={it} ec={ec} wished progress onRedeem={(btn) => onRedeem(it, btn)} onWish={() => onWish(it)} />
          ))}
        </div>
      ) : (
        <div className="st-wv-empty">
          <span className="st-wv-empty-ic" aria-hidden="true"><Heart filled={false} /></span>
          <p className="st-wv-empty-t">{L('Tocá el', 'Tap the')} <HeartInline /> {L('de un premio para armar tu lista de deseos.', 'on a prize to build your wishlist.')}</p>
          <button type="button" className="st-btn" onClick={onBack}>{L('Ver los premios', 'See the prizes')}</button>
        </div>
      )}
    </>
  );
}
