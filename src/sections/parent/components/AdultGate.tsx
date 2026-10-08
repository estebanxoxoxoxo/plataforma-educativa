import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { HOLD_MS } from '../lib/adultGate';

type Phase = 'idle' | 'holding' | 'early';

/** Portón de adulto: "Mantené apretado 3 segundos para entrar" con barra de progreso real; soltar antes
 *  (o salir del botón) la reinicia. Mouse, touch y teclado (Espacio/Enter sostenidos).
 *  Lo que decide es el TIEMPO REAL apretado (reloj + timer + chequeo al soltar), no los cuadros de
 *  animación: con la pestaña estrangulada (segundo plano, ahorro de energía) la barra puede ir a los
 *  saltos, pero 3 s apretado siempre entra y menos nunca.
 *  TODO(PIN parental): reemplazar por el PIN real validado en el server (ver lib/adultGate.ts).
 *  Pura: el desbloqueo lo resuelve quien la usa (onUnlock). */
export function AdultGate({ kid, onUnlock }: { kid: string; onUnlock: () => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const bar = useRef<HTMLSpanElement>(null);
  const raf = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t0 = useRef(0);
  const holding = useRef(false);
  const done = useRef(false);

  const clearClock = () => {
    cancelAnimationFrame(raf.current);
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };
  useEffect(() => clearClock, []);

  /** Pinta la barra (0–1). `ease` = volver suave a cero al soltar; mientras se aprieta sigue al reloj. */
  const paint = (p: number, ease = false) => {
    if (!bar.current) return;
    bar.current.style.transition = ease ? 'transform .25s ease' : 'none';
    bar.current.style.transform = `scaleX(${p})`;
  };
  const elapsed = () => performance.now() - t0.current;
  const complete = () => {
    if (done.current) return;
    done.current = true;
    holding.current = false;
    clearClock();
    paint(1);
    onUnlock();
  };
  const tick = () => {
    const p = Math.min(1, elapsed() / HOLD_MS);
    paint(p);
    if (p >= 1) { complete(); return; }
    raf.current = requestAnimationFrame(tick);
  };
  const start = () => {
    if (holding.current || done.current) return;
    holding.current = true;
    t0.current = performance.now();
    setPhase('holding');
    raf.current = requestAnimationFrame(tick);
    timer.current = setTimeout(() => { if (holding.current && elapsed() >= HOLD_MS) complete(); }, HOLD_MS + 20);
  };
  const stop = () => {
    if (!holding.current || done.current) return;
    if (elapsed() >= HOLD_MS) { complete(); return; } // llegó a los 3 s aunque no se haya pintado el último cuadro
    holding.current = false;
    clearClock();
    paint(0, true);
    setPhase('early');
  };

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.repeat) start();
  };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); stop(); }
  };

  return (
    <section className="view pz-gate-view" id="v-parent">
      <div className="pz-gate">
        <span className="pz-gate-ic" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
            <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
            <circle cx="12" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <h2 className="pz-gate-title">Zona de padres</h2>
        <p className="pz-gate-text">
          Este espacio es para los adultos de la familia. Desde acá se elige qué partes de Innerith puede usar {kid},
          se publican sus premios y se ve su actividad.
        </p>
        <button
          type="button"
          className={`pz-hold${phase === 'holding' ? ' is-holding' : ''}`}
          aria-describedby="pz-hold-hint"
          onPointerDown={onPointerDown}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          onKeyDown={onKeyDown}
          onKeyUp={onKeyUp}
          onBlur={stop}
          onContextMenu={(e) => e.preventDefault()}
        >
          <span className="pz-hold-fill" ref={bar} aria-hidden="true" />
          <span className="pz-hold-label">{phase === 'holding' ? 'Seguí apretando…' : 'Mantené apretado 3 segundos para entrar'}</span>
        </button>
        <p className={`pz-gate-hint${phase === 'early' ? ' is-warn' : ''}`} id="pz-hold-hint" role="status">
          {phase === 'early'
            ? 'Soltaste antes de tiempo. Mantené apretado hasta que la barra se complete.'
            : 'Con el mouse, el dedo o la barra espaciadora.'}
        </p>
      </div>
    </section>
  );
}
