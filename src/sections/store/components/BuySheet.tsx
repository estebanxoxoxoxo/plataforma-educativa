import { useRef, type CSSProperties } from 'react';
import { IcCoin } from '../../../shared/components/icons';
import type { MarketItem } from '../../../api/types';
import { accessoryArticle, accessoryById, putOnLabel, yoursLabel } from '../../../shared/components/Avatar';
import { MyAvatar } from '../../../shared/components/ProfileCard';
import { fmtEc, tintFor } from '../lib/format';
import { useSheetKeys, useVeil } from '../lib/sheet';

export type BuyState =
  | { item: MarketItem; phase: 'confirm' | 'busy' }
  | { item: MarketItem; phase: 'done'; ec: number }
  | { item: MarketItem; phase: 'error'; message: string };

const BURST = ['#F2A81D', '#2B8420', '#3A5BD9', '#F26B3A', '#8A5CF5', '#13A39A', '#E5487A', '#FFC23D'];

/** Hoja de compra de ropa (patrón .shov/.shcard, como la de canje): ¿Comprás la gorra por N ⚡? → Comprando… (nada
 *  optimista: es una transacción) → ¡Es tuya! (entrega instantánea al guardarropas, sin canje pendiente) con
 *  "Ponérsela ahora" / "Después". Con iniciales, ponérsela pide elegir un personaje primero. Pura. */
export function BuySheet({ s, ec, me, canWear, onConfirm, onWear, onClose }: {
  s: BuyState;
  /** Saldo actual (para "después te quedan…") */ ec: number;
  /** Nombre de Ian (avatar de la vista previa) */ me: string;
  /** Tiene un personaje (con iniciales la ropa no se usa: primero elige uno) */ canWear: boolean;
  onConfirm: () => void;
  onWear: () => void;
  onClose: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const busy = s.phase === 'busy';
  useSheetKeys(card, s.phase, busy, onClose);
  const veil = useVeil(onClose, busy);
  const { item } = s;
  const acc = accessoryById(item.accessoryId);
  const name = acc ? accessoryArticle(acc) : item.title.toLowerCase();
  /** "la" / "lo" / "los" (te la ponés, ponétela) */
  const pron = acc ? `${acc.fem ? 'la' : 'lo'}${acc.plural ? 's' : ''}` : 'la';
  const tint = { '--tint': tintFor(item.id) } as CSSProperties;
  const after = ec - item.price;
  const art = (dim = false) => (
    <div className={`st-sheet-art st-wsheet-art${dim ? ' is-dim' : ''}`} style={tint}>
      <MyAvatar name={me} size={80} accessory={item.accessoryId} />
      {s.phase === 'done' && <span className="st-burst" aria-hidden="true">{BURST.map((c, i) => <i key={c} style={{ '--c': c, '--a': `${i * 45}deg` } as CSSProperties} />)}</span>}
    </div>
  );
  const yours = `¡${acc ? yoursLabel(acc) : 'Es tuya'}!`;

  return (
    <div className="shov st-ov" onMouseDown={veil}>
      <div className="shcard st-sheet" ref={card} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="st-buy-t" aria-describedby="st-buy-d" data-sheet="ropa">
        {s.phase === 'done' ? (
          <div className="st-done" role="status">
            {art()}
            <h3 className="st-done-t" id="st-buy-t">🎉 {yours}</h3>
            <p className="st-done-p" id="st-buy-d">Ya está en tu guardarropas.</p>
            <p className="st-done-bal">
              <span>Compraste {name} por {fmtEc(item.price)} <IcCoin className="ec-coin" aria-hidden="true" /></span>{' '}
              <span>Te quedan <b>{fmtEc(s.ec)} <IcCoin className="ec-coin" aria-hidden="true" /></b></span>
            </p>
            <div className="st-sheet-btns">
              <button type="button" className="st-btn st-btn--ghost" onClick={onClose}>Después</button>
              <button type="button" className="st-btn" data-autofocus onClick={onWear}>
                {canWear ? `${acc ? putOnLabel(acc) : 'Ponérsela'} ahora` : 'Elegir personaje'}
              </button>
            </div>
            {!canWear && <p className="st-wsheet-note">Con iniciales la ropa no se ve: elegí un personaje y ponéte{pron}.</p>}
          </div>
        ) : s.phase === 'error' ? (
          <>
            {art(true)}
            <h3 className="st-sheet-q" id="st-buy-t">No se pudo comprar</h3>
            <p className="st-sheet-err" id="st-buy-d" role="alert">{s.message}</p>
            <div className="st-sheet-btns">
              <button type="button" className="st-btn st-btn--ghost" data-autofocus onClick={onClose}>Entendido</button>
            </div>
          </>
        ) : (
          <>
            {art()}
            <h3 className="st-sheet-q" id="st-buy-t">¿Comprás {name} por {fmtEc(item.price)} <IcCoin className="ec-coin" aria-hidden="true" />?</h3>
            <p className="st-sheet-sub" id="st-buy-d">
              {after >= 0 && <><span>Después te quedan <b>{fmtEc(after)} <IcCoin className="ec-coin" aria-hidden="true" /></b></span>{' '}</>}
              <span>Va directo a tu guardarropas: te {pron} ponés cuando quieras.</span>
            </p>
            <div className="st-sheet-btns">
              <button type="button" className="st-btn st-btn--ghost" data-autofocus={busy ? undefined : true} disabled={busy} onClick={onClose}>Cancelar</button>
              <button type="button" className={`st-btn${busy ? ' is-busy' : ''}`} disabled={busy} aria-busy={busy} onClick={onConfirm}>
                {busy ? <><span className="st-spin" aria-hidden="true" />Comprando…</> : 'Comprar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
