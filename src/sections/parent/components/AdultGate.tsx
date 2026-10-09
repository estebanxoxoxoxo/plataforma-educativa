import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from 'react';
import type { UnlockResult } from '../lib/adultGate';

type Status = { kind: 'idle' } | { kind: 'busy' } | { kind: 'wrong' } | { kind: 'error' } | { kind: 'wait'; until: number };

const PIN_LEN = 6;
/** Puntos sin <input type=password> donde el navegador lo soporta (-webkit-text-security): así no ofrece
 *  "guardar contraseña" en un dispositivo que también usa el chico. Si no, password común. */
const MASK = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('-webkit-text-security', 'disc');
const onlyDigits = (s: string) => s.replace(/\D/g, '').slice(0, PIN_LEN);
const seconds = (n: number) => (n === 1 ? '1 segundo' : `${n} segundos`);

/** Portón de la Zona de padres: PIN de la familia (6 dígitos) que valida el server. "Entrar" o Enter envían;
 *  pegar deja solo los dígitos. Incorrecto → "PIN incorrecto." con una sacudida suave (sin movimiento si
 *  el sistema pide reducirlo) y el campo vacío. Demasiados intentos → cuenta regresiva con el campo
 *  deshabilitado. Pura: la verificación y el desbloqueo los resuelve el contenedor (onSubmit). */
export function AdultGate({ kid, onSubmit }: { kid: string; onSubmit: (pin: string) => Promise<UnlockResult> }) {
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [shaking, setShaking] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const busy = status.kind === 'busy';
  const waiting = status.kind === 'wait';
  const left = status.kind === 'wait' ? Math.max(0, Math.ceil((status.until - now) / 1000)) : 0;
  // Cuenta regresiva de la espera; al llegar a cero, el campo vuelve.
  useEffect(() => {
    if (status.kind !== 'wait') return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [status]);
  useEffect(() => { if (waiting && left === 0) setStatus({ kind: 'idle' }); }, [waiting, left]);
  // El campo recupera el foco cada vez que vuelve a estar disponible (también al abrir).
  useEffect(() => { if (status.kind !== 'busy' && status.kind !== 'wait') input.current?.focus(); }, [status.kind]);

  const type = (v: string) => {
    setPin(onlyDigits(v));
    if (status.kind === 'wrong' || status.kind === 'error') setStatus({ kind: 'idle' });
  };
  const paste = (e: ClipboardEvent<HTMLInputElement>) => { e.preventDefault(); type(e.clipboardData.getData('text')); };
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (pin.length !== PIN_LEN || busy || waiting) return;
    setStatus({ kind: 'busy' });
    let r: UnlockResult;
    try { r = await onSubmit(pin); } catch {
      if (alive.current) { setPin(''); setStatus({ kind: 'error' }); }
      return;
    }
    if (!alive.current || r.ok) return; // al acertar, el contenedor abre la zona y este portón se desmonta
    setPin('');
    if (r.waitSeconds) {
      const t = Date.now();
      setNow(t);
      setStatus({ kind: 'wait', until: t + r.waitSeconds * 1000 });
    } else {
      setStatus({ kind: 'wrong' });
      setShaking(true);
    }
  };

  const msg = status.kind === 'wrong' ? 'PIN incorrecto.'
    : status.kind === 'error' ? 'No pude verificar el PIN. Probá de nuevo.'
    : status.kind === 'wait' ? `Demasiados intentos. Esperá ${seconds(left)}.`
    : '';

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
          Es para los adultos de la familia: desde acá se elige qué partes de Innerith puede usar {kid}, se publican sus
          premios y se ve su actividad.
        </p>
        <form className="pz-pin-form" onSubmit={(e) => void submit(e)} noValidate>
          <label className="pz-pin-label" htmlFor="pz-pin">Ingresá el PIN de la familia para entrar.</label>
          <input
            id="pz-pin"
            ref={input}
            className={`pz-pin${MASK ? ' is-masked' : ''}${shaking ? ' is-shake' : ''}`}
            type={MASK ? 'text' : 'password'}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={PIN_LEN}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="••••••"
            value={pin}
            disabled={busy || waiting}
            aria-invalid={status.kind === 'wrong' ? true : undefined}
            aria-describedby="pz-pin-msg"
            onChange={(e) => type(e.target.value)}
            onPaste={paste}
            onAnimationEnd={() => setShaking(false)}
          />
          <button type="submit" className="pz-btn pz-pin-go" disabled={pin.length !== PIN_LEN || busy || waiting}>
            {busy ? 'Verificando…' : 'Entrar'}
          </button>
        </form>
        <p className={`pz-gate-msg${status.kind === 'wrong' || status.kind === 'error' ? ' is-err' : waiting ? ' is-wait' : ''}`} id="pz-pin-msg" role="status">
          {msg}
        </p>
      </div>
    </section>
  );
}
