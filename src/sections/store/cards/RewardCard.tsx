import { useState, type CSSProperties } from 'react';
import type { MarketItem } from '../../../api/types';
import { Heart } from '../components/Heart';
import { faltan, fmtEc, isSoldOut, missingFor, pctOf, sourceText, stockText, tintFor } from '../lib/format';

/** Premio de la Tienda: emoji grande, de quién es, precio en ⚡, stock si es finito, el corazón de la
 *  lista de deseos y el botón de canje — o por qué todavía no se puede (te faltan N ⚡ / agotado).
 *  Con `progress` (vista "Tu lista de deseos") suma la fila "Te faltan N ⚡ / ¡Ya te alcanza!" con su
 *  barra; ahí el botón deshabilitado dice solo "Canjear" para no repetir el faltante.
 *  Pura: el canje y el deseo los resuelve el contenedor. */
export function RewardCard({ item, ec, wished, progress = false, onRedeem, onWish }: {
  item: MarketItem;
  ec: number;
  /** Está en la lista de deseos (lo que muestra la UI, ya con el toggle optimista) */ wished: boolean;
  /** Mostrar el progreso del saldo hacia el precio (vista de deseos) */ progress?: boolean;
  onRedeem: (btn: HTMLButtonElement) => void;
  onWish: () => void;
}) {
  const [pop, setPop] = useState(false);
  const out = isSoldOut(item);
  const missing = missingFor(item.price, ec);
  const pct = pctOf(ec, item.price);
  return (
    <article className={`st-card${out ? ' is-out' : ''}`} data-item={item.id} tabIndex={-1} aria-labelledby={`st-item-${item.id}`}>
      <div className="st-art" style={{ '--tint': tintFor(item.id) } as CSSProperties}>
        <span className="st-emoji" aria-hidden="true">{item.emoji}</span>
        {out && <span className="st-badge-out">Agotado</span>}
        <button
          type="button"
          className={`st-heart${wished ? ' is-on' : ''}${pop ? ' is-pop' : ''}`}
          aria-pressed={wished}
          aria-label={`Lista de deseos: ${item.title}`}
          title={wished ? 'Sacar de tu lista de deseos' : 'Agregar a tu lista de deseos'}
          onClick={(e) => { e.stopPropagation(); setPop(!wished); onWish(); }}
          onAnimationEnd={() => setPop(false)}
        >
          <Heart filled={wished} />
        </button>
      </div>
      <div className="st-info">
        <span className="st-from">{sourceText(item.source)}</span>
        <h4 className="st-name" id={`st-item-${item.id}`}>{item.title}</h4>
        {item.desc && <p className="st-desc">{item.desc}</p>}
      </div>
      <div className="st-meta">
        <span className="st-price"><span aria-hidden="true">⚡</span> {fmtEc(item.price)}<span className="st-sr"> Energy Coins</span></span>
        {item.stock !== null && !out && <span className="st-stock">{stockText(item.stock)}</span>}
      </div>
      {progress && (
        <div className={`st-prog${out ? ' is-out' : missing === 0 ? ' is-ok' : ''}`}>
          <span className="st-prog-bar" aria-hidden="true"><i style={{ width: `${out ? 0 : pct}%` }} /></span>
          <span className="st-prog-m">{out ? 'Agotado' : missing === 0 ? '¡Ya te alcanza!' : faltan(missing)}</span>
        </div>
      )}
      {out ? (
        <button type="button" className="st-btn" disabled>Agotado</button>
      ) : missing > 0 ? (
        progress
          ? <button type="button" className="st-btn" disabled>Canjear</button>
          : <button type="button" className="st-btn is-short" disabled style={{ '--pct': `${Math.max(6, pct)}%` } as CSSProperties}>{faltan(missing)}</button>
      ) : (
        <button type="button" className="st-btn" onClick={(e) => onRedeem(e.currentTarget)}>Canjear</button>
      )}
    </article>
  );
}
