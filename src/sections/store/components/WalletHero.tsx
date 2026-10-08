import { useEffect, useRef, useState } from 'react';
import { fmtEc } from '../lib/format';
import { HeartInline } from './Heart';

const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Muestra `value` contando desde el valor anterior (el saldo "baja" o "sube" a la vista). */
function useCountTo(value: number, ms = 650) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current, delta = value - start;
    if (!delta) return;
    if (reduceMotion()) { from.current = value; setShown(value); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const v = k === 1 ? value : Math.round(start + delta * (1 - Math.pow(1 - k, 3)));
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** Billetera de Energy Coin: a la izquierda el saldo grande y de dónde sale el ⚡; a la derecha los
 *  accesos: "Tu lista de deseos (N)" (siempre, con su contador) y el aviso de canjes pendientes.
 *  Pura: todo llega por props. */
export function WalletHero({ ec, wishCount, pending, onPractice, onWishes, onPending }: {
  /** Saldo que devolvió el server (nunca un cálculo optimista) */ ec: number;
  /** Cuántos premios hay en la lista de deseos (ya con el toggle optimista) */ wishCount: number;
  /** Canjes pendientes de entrega */ pending: number;
  onPractice: () => void;
  onWishes: () => void;
  onPending: () => void;
}) {
  const shown = useCountTo(ec);
  return (
    <section className="st-hero" aria-labelledby="st-hero-k">
      <div className="st-hero-main">
        <span className="st-kicker" id="st-hero-k">Tu billetera</span>
        <p className="st-bal">
          <span className="st-bal-bolt" aria-hidden="true">⚡</span>
          <b className="st-bal-num" data-ec={ec}>{fmtEc(shown)}</b>
        </p>
        <span className="st-unit">Energy Coins</span>
        <p className="st-earn">
          Los ganás practicando.{' '}
          <a className="st-link" href="/practicar" onClick={(e) => { e.preventDefault(); onPractice(); }}>Ir a Practicar →</a>
        </p>
      </div>

      <div className="st-hero-side">
        <a className="st-pill st-pill--wish" href="/tienda?vista=deseos" data-count={wishCount}
          onClick={(e) => { e.preventDefault(); onWishes(); }}>
          <HeartInline /> Tu lista de deseos ({wishCount}) →
        </a>
        {pending > 0 && (
          <button type="button" className="st-pill st-pill--pend" onClick={onPending}>
            📦 {pending === 1 ? '1 canje pendiente' : `${pending} canjes pendientes`} de entrega →
          </button>
        )}
      </div>
    </section>
  );
}
