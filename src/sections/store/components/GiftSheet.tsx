import { useRef, type CSSProperties } from 'react';
import type { Friend, MarketItem } from '../../../api/types';
import { Avatar, accessoryArticle, accessoryById, lookFor } from '../../../shared/components/Avatar';
import { faltan, fmtEc, missingFor, tintFor } from '../lib/format';
import { useSheetKeys, useVeil } from '../lib/sheet';

export type GiftState =
  | { item: MarketItem; phase: 'pick' | 'busy'; friendId: string | null }
  | { item: MarketItem; phase: 'done'; friend: Friend; ec: number }
  | { item: MarketItem; phase: 'error'; message: string; friendId: string | null; retry: boolean };

const BURST = ['#F2A81D', '#2B8420', '#3A5BD9', '#F26B3A', '#8A5CF5', '#13A39A', '#E5487A', '#FFC23D'];

/** Hoja de regalo (audios 29 y 41-42: "los noviecitos regalándose cosas"): elegís a qué amigo —cada uno con su avatar;
 *  al elegirlo, arriba se ve cómo le quedaría— → Regalar (gasta ⚡: nada optimista) → el amigo ya la tiene PUESTA y
 *  te va a escribir para agradecerte ("Ver su mensaje" abre su conversación en el dock). Al que ya la tiene puesta no
 *  se le puede regalar otra vez. Pura: el regalo lo hace el contenedor (api.giftToFriend). */
export function GiftSheet({ s, ec, friends, failed, onPick, onConfirm, onBack, onChat, onRetry, onClose }: {
  s: GiftState;
  /** Saldo actual */ ec: number;
  /** Amigos aceptados (null = cargando) */ friends: Friend[] | null;
  failed: boolean;
  onPick: (friendId: string) => void;
  onConfirm: () => void;
  /** Volver a elegir (tras un rechazo de negocio) */ onBack: () => void;
  onChat: (friendId: string) => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const busy = s.phase === 'busy';
  useSheetKeys(card, s.phase, busy, onClose);
  const veil = useVeil(onClose, busy);
  const { item } = s;
  const acc = accessoryById(item.accessoryId);
  const name = acc ? accessoryArticle(acc) : item.title.toLowerCase();
  const lo = acc ? `${acc.fem ? 'la' : 'lo'}${acc.plural ? 's' : ''}` : 'la';
  const puesto = acc ? `puest${acc.fem ? 'a' : 'o'}${acc.plural ? 's' : ''}` : 'puesta';
  const tint = { '--tint': tintFor(item.id) } as CSSProperties;
  const missing = missingFor(item.price, ec);
  const picked = s.phase === 'pick' || s.phase === 'busy' ? friends?.find((f) => f.id === s.friendId) ?? null : null;

  if (s.phase === 'done') {
    const f = s.friend;
    return (
      <div className="shov st-ov" onMouseDown={veil}>
        <div className="shcard st-sheet st-gsheet" ref={card} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="st-gift-t" aria-describedby="st-gift-d" data-sheet="regalo">
          <div className="st-done" role="status">
            <div className="st-sheet-art st-wsheet-art" style={tint}>
              <Avatar name={f.nick} color={f.color} look={lookFor(f.nick)} accessory={f.accessory} size={80} />
              <span className="st-burst" aria-hidden="true">{BURST.map((c, i) => <i key={c} style={{ '--c': c, '--a': `${i * 45}deg` } as CSSProperties} />)}</span>
            </div>
            <h3 className="st-done-t" id="st-gift-t">🎁 ¡{f.nick} ya {lo} tiene {puesto}!</h3>
            <p className="st-done-p" id="st-gift-d">Te va a escribir para darte las gracias.</p>
            <p className="st-done-bal">
              <span>Le regalaste {name} por {fmtEc(item.price)} ⚡</span>{' '}
              <span>Te quedan <b>{fmtEc(s.ec)} ⚡</b></span>
            </p>
            <div className="st-sheet-btns">
              <button type="button" className="st-btn st-btn--ghost" onClick={onClose}>¡Genial!</button>
              <button type="button" className="st-btn st-btn--gift" data-autofocus onClick={() => onChat(f.id)}>Ver su mensaje</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (s.phase === 'error') {
    return (
      <div className="shov st-ov" onMouseDown={veil}>
        <div className="shcard st-sheet st-gsheet" ref={card} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="st-gift-t" aria-describedby="st-gift-d" data-sheet="regalo">
          <div className="st-sheet-art is-dim" style={tint}><span aria-hidden="true">{item.emoji}</span></div>
          <h3 className="st-sheet-q" id="st-gift-t">No se pudo regalar</h3>
          <p className="st-sheet-err" id="st-gift-d" role="alert">{s.message}</p>
          <div className="st-sheet-btns">
            {s.retry && <button type="button" className="st-btn st-btn--ghost" onClick={onBack}>Elegir otro amigo</button>}
            <button type="button" className="st-btn st-btn--ghost" data-autofocus onClick={onClose}>Entendido</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shov st-ov" onMouseDown={veil}>
      <div className="shcard st-sheet st-gsheet" ref={card} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="st-gift-t" aria-describedby="st-gift-d" data-sheet="regalo">
        <div className="st-sheet-art st-wsheet-art" style={tint} key={picked?.id ?? 'nadie'}>
          {picked
            ? <Avatar name={picked.nick} color={picked.color} look={lookFor(picked.nick)} accessory={item.accessoryId} size={80} />
            : <span aria-hidden="true">{item.emoji}</span>}
        </div>
        <h3 className="st-sheet-q" id="st-gift-t">¿A quién le regalás {name}?</h3>
        <p className="st-sheet-sub" id="st-gift-d">
          <span>{picked ? `Así le quedaría a ${picked.nick}.` : `Se ${lo} pone al toque y te escribe para agradecerte.`}</span>{' '}
          {missing === 0 && <span>Cuesta {fmtEc(item.price)} ⚡ · después te quedan <b>{fmtEc(ec - item.price)} ⚡</b></span>}
        </p>

        {failed && !friends ? (
          <div className="st-gempty">
            <p>No pude cargar a tus amigos ahora.</p>
            <button type="button" className="st-btn st-btn--ghost" onClick={onRetry}>Reintentar</button>
          </div>
        ) : !friends ? (
          <div className="st-glist" role="status" aria-label="Cargando a tus amigos">
            {[0, 1, 2].map((i) => <span key={i} className="st-gfr st-gfr--sk"><i /><b /></span>)}
          </div>
        ) : friends.length === 0 ? (
          <p className="st-gempty">Todavía no tenés amigos en Innerith. Cuando aceptes una solicitud, vas a poder regalarles ropa.</p>
        ) : (
          <fieldset className="st-glist" disabled={busy}>
            <legend className="st-sr">Elegí a qué amigo</legend>
            {friends.map((f) => {
              const has = f.accessory === item.accessoryId;
              return (
                <label key={f.id} className={`st-gfr${has ? ' is-has' : ''}`} data-friend={f.id}>
                  <input type="radio" name="st-gift-to" value={f.id} checked={s.friendId === f.id} disabled={has} onChange={() => onPick(f.id)} />
                  <Avatar name={f.nick} color={f.color} look={lookFor(f.nick)} accessory={f.accessory} />
                  <span className="st-gfr-nm"><b>{f.nick}</b><small>{has ? `Ya ${lo} tiene ${puesto}` : f.status}</small></span>
                  <span className="st-gfr-ok" aria-hidden="true" />
                </label>
              );
            })}
          </fieldset>
        )}

        <div className="st-sheet-btns">
          <button type="button" className="st-btn st-btn--ghost" data-autofocus={busy ? undefined : true} disabled={busy} onClick={onClose}>Cancelar</button>
          {missing > 0 ? (
            <button type="button" className="st-btn" disabled>{faltan(missing)}</button>
          ) : (
            <button type="button" className={`st-btn st-btn--gift${busy ? ' is-busy' : ''}`} disabled={busy || !picked} aria-busy={busy} onClick={onConfirm}>
              {busy ? <><span className="st-spin" aria-hidden="true" />Regalando…</> : <>Regalar · {fmtEc(item.price)} ⚡</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
