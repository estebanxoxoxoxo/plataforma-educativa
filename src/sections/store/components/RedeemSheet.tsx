import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { IcCoin } from '../../../shared/components/icons';
import type { MarketItem } from '../../../api/types';
import { fmtEc, tintFor } from '../lib/format';
import { useVeil } from '../lib/sheet';
import { L, isEn } from '../../../shared/lib/lang';

export type SheetState =
  | { item: MarketItem; phase: 'confirm' | 'busy' }
  | { item: MarketItem; phase: 'done'; ec: number }
  | { item: MarketItem; phase: 'error'; message: string };

const BURST = ['#F2A81D', '#2B8420', '#3A5BD9', '#F26B3A', '#8A5CF5', '#13A39A', '#E5487A', '#FFC23D'];

/** Hoja de canje (patrón global .shov/.shcard): ¿Canjeás N <IcCoin className="ec-coin" aria-hidden="true" /> por X? → Canjeando… (spinner; NADA
 *  optimista: es una transacción) → ¡Canjeado! / No se pudo. Pura: la transacción la hace el contenedor. */
export function RedeemSheet({ s, ec, onConfirm, onClose }: {
  s: SheetState;
  /** Saldo actual (para "después te quedan…") */ ec: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const busy = s.phase === 'busy';
  const live = useRef({ busy, onClose });
  useLayoutEffect(() => { live.current = { busy, onClose }; });

  // Foco: al abrir, "Cancelar" (en una transacción, el default seguro); al terminar, el botón de cierre;
  // mientras va al server, la hoja misma (así el Tab no se escapa al resto de la página).
  useEffect(() => {
    const c = card.current;
    if (c) (c.querySelector<HTMLElement>('[data-autofocus]') ?? c).focus();
  }, [s.phase]);

  // Teclado: Esc cierra (salvo mientras canjea) y Tab queda adentro de la hoja.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = card.current;
      if (!c) return;
      if (e.key === 'Escape') { e.preventDefault(); if (!live.current.busy) live.current.onClose(); return; }
      if (e.key !== 'Tab') return;
      const els = [...c.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')];
      if (!els.length) { e.preventDefault(); c.focus(); return; }
      const first = els[0], last = els[els.length - 1], at = document.activeElement;
      const leaving = e.shiftKey ? at === first || at === c || !c.contains(at) : at === last || !c.contains(at);
      if (leaving) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const veil = useVeil(onClose, busy);
  const { item } = s;
  const tint = { '--tint': tintFor(item.id) } as CSSProperties;
  const after = ec - item.price;

  return (
    <div className="shov st-ov" onMouseDown={veil}>
      <div className="shcard st-sheet" ref={card} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="st-sheet-t" aria-describedby="st-sheet-d">
        {s.phase === 'done' ? (
          <div className="st-done" role="status">
            <div className="st-sheet-art" style={tint}>
              <span aria-hidden="true">{item.emoji}</span>
              <span className="st-burst" aria-hidden="true">
                {BURST.map((c, i) => <i key={c} style={{ '--c': c, '--a': `${i * 45}deg` } as CSSProperties} />)}
              </span>
            </div>
            <h3 className="st-done-t" id="st-sheet-t">{L('Canjeado ✓', 'Redeemed ✓')}</h3>
            <p className="st-done-p" id="st-sheet-d">{L('Quedó pendiente: avisale a tu familia.', 'It’s pending: let your family know.')}</p>
            <p className="st-done-bal">
              <span>{isEn() ? <>You redeemed {item.title} for</> : <>Canjeaste {item.title} por</>} {fmtEc(item.price)} <IcCoin className="ec-coin" aria-hidden="true" /></span>{' '}
              <span>{L('Te quedan', 'You have')} <b>{fmtEc(s.ec)} <IcCoin className="ec-coin" aria-hidden="true" /></b></span>
            </p>
            <div className="st-sheet-btns">
              <button type="button" className="st-btn" data-autofocus onClick={onClose}>{L('Listo', 'Done')}</button>
            </div>
          </div>
        ) : s.phase === 'error' ? (
          <>
            <div className="st-sheet-art is-dim" style={tint}><span aria-hidden="true">{item.emoji}</span></div>
            <h3 className="st-sheet-q" id="st-sheet-t">{L('No se pudo canjear', 'Couldn’t redeem it')}</h3>
            <p className="st-sheet-err" id="st-sheet-d" role="alert">{s.message}</p>
            <div className="st-sheet-btns">
              <button type="button" className="st-btn st-btn--ghost" data-autofocus onClick={onClose}>{L('Entendido', 'Got it')}</button>
            </div>
          </>
        ) : (
          <>
            <div className="st-sheet-art" style={tint}><span aria-hidden="true">{item.emoji}</span></div>
            <h3 className="st-sheet-q" id="st-sheet-t">{L('¿Canjeás', 'Redeem')} {fmtEc(item.price)} <IcCoin className="ec-coin" aria-hidden="true" /> {L('por', 'for')} {item.title}?</h3>
            <p className="st-sheet-sub" id="st-sheet-d">
              {after >= 0 && <><span>{L('Después te quedan', 'After that you’ll have')} <b>{fmtEc(after)} <IcCoin className="ec-coin" aria-hidden="true" /></b></span>{' '}</>}
              <span>{L('Queda pendiente hasta que tus papás te lo den.', 'It stays pending until your parents give it to you.')}</span>
            </p>
            <div className="st-sheet-btns">
              <button type="button" className="st-btn st-btn--ghost" data-autofocus={busy ? undefined : true} disabled={busy} onClick={onClose}>{L('Cancelar', 'Cancel')}</button>
              <button type="button" className={`st-btn${busy ? ' is-busy' : ''}`} disabled={busy} aria-busy={busy} onClick={onConfirm}>
                {busy ? <><span className="st-spin" aria-hidden="true" />{L('Canjeando…', 'Redeeming…')}</> : L('Canjear', 'Redeem')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
