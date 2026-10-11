import type { CSSProperties } from 'react';
import type { MarketItem } from '../../../api/types';
import { accessoryById, putOnLabel, wornLabel, yoursLabel } from '../../../shared/components/Avatar';
import { MyAvatar } from '../../../shared/components/ProfileCard';
import { faltan, fmtEc, missingFor, pctOf, sourceText, tintFor } from '../lib/format';

/** En qué está una prenda para el chico: comprar · ponérsela (ya es suya) · puesta (la tiene ahora). */
export type WearState = 'comprar' | 'poner' | 'puesta';

/** Una prenda de la ropa del avatar (ítem de plataforma): la vista previa es el avatar de Ian CON la prenda puesta
 *  ("así te quedaría"), el precio en ⚡ y el botón según su estado: Comprar (o "Te faltan N ⚡") → Ponérsela →
 *  ✓ Puesta. Debajo, "🎁 Regalar" (si Amigos está prendido). Pura: comprar, equipar y regalar los resuelve el contenedor. */
export function WardrobeCard({ item, ec, me, state, wearing, giftOn, onBuy, onWear, onGift }: {
  item: MarketItem;
  ec: number;
  /** Nombre de Ian (las iniciales del avatar si no tiene personaje) */ me: string;
  state: WearState;
  /** Se la está poniendo (el look viaja al server) */ wearing: boolean;
  /** Se puede regalar (Amigos prendido por la familia) */ giftOn: boolean;
  onBuy: (btn: HTMLButtonElement) => void;
  onWear: () => void;
  onGift: (btn: HTMLButtonElement) => void;
}) {
  const acc = accessoryById(item.accessoryId);
  const missing = missingFor(item.price, ec);
  const pct = pctOf(ec, item.price);
  const titleId = `st-item-${item.id}`;
  return (
    <article className={`st-card st-wcard${state === 'puesta' ? ' is-worn' : ''}`} data-item={item.id} data-acc={item.accessoryId} data-state={state}
      tabIndex={-1} aria-labelledby={titleId}>
      <div className="st-art st-wart" style={{ '--tint': tintFor(item.id) } as CSSProperties}>
        <MyAvatar name={me} size={78} accessory={item.accessoryId} />
      </div>
      <div className="st-info">
        <span className="st-from">{sourceText(item.source)}</span>
        <h4 className="st-name" id={titleId}>{item.title}</h4>
        {item.desc && <p className="st-desc">{item.desc}</p>}
      </div>
      <div className="st-meta">
        <span className="st-price"><span aria-hidden="true">⚡</span> {fmtEc(item.price)}<span className="st-sr"> Energy Coins</span></span>
        {/* solo si de verdad está en el guardarropas (tras recargar, la puesta puede no estar: el look persiste, las compras no) */}
        {item.owned && <span className="st-wtag" title="Está en tu guardarropas">✓ {acc ? yoursLabel(acc) : 'Es tuya'}</span>}
      </div>
      <div className="st-wbtns">
        {state === 'puesta' ? (
          <button type="button" className="st-btn is-worn" disabled>✓ {acc ? wornLabel(acc) : 'Puesta'}</button>
        ) : state === 'poner' ? (
          <button type="button" className={`st-btn st-btn--wear${wearing ? ' is-busy' : ''}`} disabled={wearing} aria-busy={wearing} onClick={onWear}>
            {wearing ? <><span className="st-spin" aria-hidden="true" />Poniendo…</> : acc ? putOnLabel(acc) : 'Ponérsela'}
          </button>
        ) : missing > 0 ? (
          <button type="button" className="st-btn is-short" disabled style={{ '--pct': `${Math.max(6, pct)}%` } as CSSProperties}>{faltan(missing)}</button>
        ) : (
          <button type="button" className="st-btn" onClick={(e) => onBuy(e.currentTarget)}>Comprar</button>
        )}
        {giftOn && (
          <button type="button" className="st-btn st-btn--ghost st-gift" disabled={missing > 0} title={missing > 0 ? faltan(missing) : `Regalarle ${item.title.toLowerCase()} a un amigo`}
            onClick={(e) => onGift(e.currentTarget)}>
            <span aria-hidden="true">🎁</span> Regalar
          </button>
        )}
      </div>
    </article>
  );
}
