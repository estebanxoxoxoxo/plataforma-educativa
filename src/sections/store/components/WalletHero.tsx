import { useEffect, useRef, useState } from 'react';
import { IcCoin } from '../../../shared/components/icons';
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
 *  accesos a las tres páginas de la Tienda (pedido 12-oct: canjes y movimientos ya no son tablas de la
 *  vista principal, cada una tiene su página como la lista de deseos): "Tu lista de deseos (N)",
 *  "Tus canjes" (resaltado si hay pendientes de entrega) y "Tus movimientos". Pura: todo llega por props. */
export function WalletHero({ ec, wishCount, pending, onPractice, onWishes, onRedemptions, onMoves }: {
  /** Saldo que devolvió el server (nunca un cálculo optimista) */ ec: number;
  /** Cuántos premios hay en la lista de deseos (ya con el toggle optimista) */ wishCount: number;
  /** Canjes pendientes de entrega */ pending: number;
  onPractice: () => void;
  onWishes: () => void;
  onRedemptions: () => void;
  onMoves: () => void;
}) {
  const shown = useCountTo(ec);
  return (
    <section className="st-hero" aria-labelledby="st-hero-k">
      <div className="st-hero-main">
        <span className="st-kicker" id="st-hero-k">Tu billetera</span>
        <p className="st-bal">
          <IcCoin className="st-bal-bolt" aria-hidden="true" />
          <b className="st-bal-num" data-ec={ec}>{fmtEc(shown)}</b>
        </p>
        <span className="st-unit">Energy Coins</span>
        <p className="st-earn">
          Los ganás practicando.{' '}
          <a className="st-link" href="/aprender" onClick={(e) => { e.preventDefault(); onPractice(); }}>Ir a Aprender →</a>
        </p>
      </div>

      <div className="st-hero-side">
        <a className="st-pill st-pill--wish" href="/tienda?vista=deseos" data-count={wishCount}
          onClick={(e) => { e.preventDefault(); onWishes(); }}>
          <HeartInline /> Tu lista de deseos ({wishCount}) →
        </a>
        <a className={`st-pill${pending > 0 ? ' st-pill--pend' : ''}`} href="/tienda?vista=canjes"
          onClick={(e) => { e.preventDefault(); onRedemptions(); }}>
          📦 Tus canjes{pending > 0 && ` (${pending === 1 ? '1 pendiente' : `${pending} pendientes`})`} →
        </a>
        <a className="st-pill" href="/tienda?vista=movimientos" onClick={(e) => { e.preventDefault(); onMoves(); }}>
          🧾 Tus movimientos →
        </a>
      </div>
    </section>
  );
}
