import type { Ref } from 'react';
import type { Friend, MarketItem } from '../../../api/types';
import { Avatar, lookFor } from '../../../shared/components/Avatar';
import { IcClose } from '../../../shared/components/icons';
import { WardrobeCard, type WearState } from '../cards/WardrobeCard';
import { byPrice } from '../lib/format';

/** "Ropa para tu avatar" (visión §7: ítems de plataforma; audios 26, 29, 41-42): separada de los premios del padre.
 *  Son de Innerith: se compran con ⚡ y se ponen al instante (sin canje pendiente), o se regalan a un amigo. Si se llegó
 *  desde el detalle de un amigo ("Regalale ropa"), arriba queda a quién es el regalo. Pura: todo llega por props. */
export function WardrobeSection({ items, ec, me, stateOf, wearing, giftOn, giftFor, ref, onBuy, onWear, onGift, onClearGiftFor }: {
  /** Las prendas (kind 'ropa') */ items: MarketItem[];
  ec: number;
  me: string;
  stateOf: (item: MarketItem) => WearState;
  /** La prenda que se está poniendo (el look viaja al server) */ wearing: string | null;
  giftOn: boolean;
  /** El amigo al que se le está eligiendo un regalo (vino de su perfil) */ giftFor: Friend | null;
  ref?: Ref<HTMLElement>;
  onBuy: (item: MarketItem, btn: HTMLButtonElement) => void;
  onWear: (item: MarketItem) => void;
  onGift: (item: MarketItem, btn: HTMLButtonElement) => void;
  onClearGiftFor: () => void;
}) {
  // Sin cabecera de categoría (pedido de Esteban, 30-oct): la grilla habla sola; el nombre, para lectores de pantalla.
  return (
    <section className="st-sec st-wsec" id="st-ropa" ref={ref} tabIndex={-1} aria-label="Ropa para tu avatar">
      {giftOn && giftFor && (
        <div className="st-wfor" role="status">
          <Avatar name={giftFor.nick} color={giftFor.color} look={lookFor(giftFor.nick)} accessory={giftFor.accessory} size={36} />
          <p>Elegí qué regalarle a <b>{giftFor.nick}</b>: tocá <b>🎁 Regalar</b> en la prenda que quieras.</p>
          <button type="button" className="st-wfor-x" aria-label={`Dejar de elegir un regalo para ${giftFor.nick}`} title="Listo" onClick={onClearGiftFor}><IcClose /></button>
        </div>
      )}
      <div className="st-grid st-wgrid">
        {byPrice(items).map((it) => (
          <WardrobeCard key={it.id} item={it} ec={ec} me={me} state={stateOf(it)} wearing={wearing === it.accessoryId} giftOn={giftOn}
            onBuy={(btn) => onBuy(it, btn)} onWear={() => onWear(it)} onGift={(btn) => onGift(it, btn)} />
        ))}
      </div>
    </section>
  );
}
