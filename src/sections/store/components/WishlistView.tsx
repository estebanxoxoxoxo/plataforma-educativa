import type { MarketItem } from '../../../api/types';
import { RewardCard } from '../cards/RewardCard';
import { fmtEc } from '../lib/format';
import { Heart, HeartInline } from './Heart';

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
      <a className="back st-back" href="/tienda" onClick={(e) => { e.preventDefault(); onBack(); }}>‹ Tienda</a>
      <header className="st-head">
        <h2 className="h2">Tu lista de deseos</h2>
        <p className="lede">
          {n > 0
            ? <>{n === 1 ? '1 premio' : `${n} premios`} que marcaste con <HeartInline />, del más nuevo al más viejo. Tenés <b className="st-lede-ec">{fmtEc(ec)} ⚡</b></>
            : 'Acá guardás los premios que más querés.'}
        </p>
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
          <p className="st-wv-empty-t">Tocá el <HeartInline /> de un premio para armar tu lista de deseos.</p>
          <button type="button" className="st-btn" onClick={onBack}>Ver los premios</button>
        </div>
      )}
    </>
  );
}
