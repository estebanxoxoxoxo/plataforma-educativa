import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { MarketItem } from '../../../api/types';
import { fmtEc, tintFor } from '../lib/format';

export type SheetState =
  | { item: MarketItem; phase: 'confirm' | 'busy' }
  | { item: MarketItem; phase: 'done'; ec: number }
  | { item: MarketItem; phase: 'error'; message: string };

const BURST = ['#F2A81D', '#2B8420', '#3A5BD9', '#F26B3A', '#8A5CF5', '#13A39A', '#E5487A', '#FFC23D'];

/** Hoja de canje (patrón global .shov/.shcard): ¿Canjeás N ⚡ por X? → Canjeando… (spinner; NADA
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

  const { item } = s;
  const tint = { '--tint': tintFor(item.id) } as CSSProperties;
  const after = ec - item.price;

  return (
    <div className="shov st-ov" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="shcard st-sheet" ref={card} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="st-sheet-t" aria-describedby="st-sheet-d">
        {s.phase === 'done' ? (
          <div className="st-done" role="status">
            <div className="st-sheet-art" style={tint}>
              <span aria-hidden="true">{item.emoji}</span>
              <span className="st-burst" aria-hidden="true">
                {BURST.map((c, i) => <i key={c} style={{ '--c': c, '--a': `${i * 45}deg` } as CSSProperties} />)}
              </span>
            </div>
            <h3 className="st-done-t" id="st-sheet-t">🎉 ¡Canjeado!</h3>
            <p className="st-done-p" id="st-sheet-d">Quedó pendiente: avisale a papá o mamá.</p>
            <p className="st-done-bal">
              <span>Canjeaste {item.title} por {fmtEc(item.price)} ⚡</span>{' '}
              <span>Te quedan <b>{fmtEc(s.ec)} ⚡</b></span>
            </p>
            <div className="st-sheet-btns">
              <button type="button" className="st-btn" data-autofocus onClick={onClose}>¡Genial!</button>
            </div>
          </div>
        ) : s.phase === 'error' ? (
          <>
            <div className="st-sheet-art is-dim" style={tint}><span aria-hidden="true">{item.emoji}</span></div>
            <h3 className="st-sheet-q" id="st-sheet-t">No se pudo canjear</h3>
            <p className="st-sheet-err" id="st-sheet-d" role="alert">{s.message}</p>
            <div className="st-sheet-btns">
              <button type="button" className="st-btn st-btn--ghost" data-autofocus onClick={onClose}>Entendido</button>
            </div>
          </>
        ) : (
          <>
            <div className="st-sheet-art" style={tint}><span aria-hidden="true">{item.emoji}</span></div>
            <h3 className="st-sheet-q" id="st-sheet-t">¿Canjeás {fmtEc(item.price)} ⚡ por {item.title}?</h3>
            <p className="st-sheet-sub" id="st-sheet-d">
              {after >= 0 && <><span>Después te quedan <b>{fmtEc(after)} ⚡</b></span>{' '}</>}
              <span>Queda pendiente hasta que papá o mamá te lo den.</span>
            </p>
            <div className="st-sheet-btns">
              <button type="button" className="st-btn st-btn--ghost" data-autofocus={busy ? undefined : true} disabled={busy} onClick={onClose}>Cancelar</button>
              <button type="button" className={`st-btn${busy ? ' is-busy' : ''}`} disabled={busy} aria-busy={busy} onClick={onConfirm}>
                {busy ? <><span className="st-spin" aria-hidden="true" />Canjeando…</> : 'Canjear'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
