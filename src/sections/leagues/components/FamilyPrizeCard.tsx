import { useEffect, useId, useRef, useState } from 'react';
import { IcCoin } from '../../../shared/components/icons';
import type { FamilyWeekPrize } from '../../../api/types';
import { conditionText, prizeByText } from '../lib/familyWeek';

/** U5 (§3.2-§3.3): el premio de la semana de la familia, arriba de la tabla.
 *  - Un CHICO (sin `manage`) lo ve si hay: "Si superás tu semana anterior: 🚲 1 hora de bici · Te lo da Andrés" (o "Si ganás
 *    la semana: …"). Sin premio, no hay tarjeta (nada que extrañar).
 *  - El ADULTO (`manage`, D4): con premio, lo prometido + "Cambiar" (reabre la hoja) y "Quitar" (con una confirmación chica);
 *    sin premio, "Poné un premio para esta semana" y, si el de la semana pasada se lo llevó alguien, "Repetir el de la semana
 *    pasada" (re-envía el mismo).
 *  El premio es un TEXTO que promete el adulto: sin ⚡, sin sorteo, nada que se pierda. `carried` = quedó sin ganadores la
 *  semana pasada y sigue en juego. `error` = el motivo del server tal cual (quitar / repetir). Puro: las acciones las hace el
 *  contenedor; acá solo vive el "¿seguro?" de Quitar. */
export function FamilyPrizeCard({ prize, carried, repeatable, manage, meId, busy, error, onOpen, onClear, onRepeat }: {
  prize: FamilyWeekPrize | null;
  carried: boolean;
  repeatable: FamilyWeekPrize | null;
  manage: boolean;
  meId?: string;
  busy: 'clear' | 'repeat' | null;
  error: string | null;
  onOpen: (opener: HTMLElement) => void;
  onClear: () => void;
  onRepeat: () => void;
}) {
  const id = useId();
  const [confirming, setConfirming] = useState(false);
  const yes = useRef<HTMLButtonElement>(null);
  const quit = useRef<HTMLButtonElement>(null);
  /** El "No" de la confirmación: al volver los botones, el foco va a "Quitar" (el "No" se desmonta y el foco caía en <body>). */
  const backToQuit = useRef(false);
  // Al pedir la confirmación el foco va a "Sí, quitarlo"; si el premio cambió por otro lado, la confirmación se cae.
  useEffect(() => {
    if (confirming) { yes.current?.focus(); return; }
    if (backToQuit.current) { backToQuit.current = false; quit.current?.focus(); }
  }, [confirming]);
  useEffect(() => { setConfirming(false); }, [prize?.setAt]);

  if (!prize && !manage) return null;
  const err = error && <p className="lgp-err" role="alert">{error}</p>;

  if (!prize) {
    return (
      <section className="lgp is-empty" aria-labelledby={id} data-lgp="empty">
        <span className="lgp-disc" aria-hidden="true">🎁</span>
        <div className="lgp-body">
          <h4 className="lgp-k" id={id} tabIndex={-1} data-lgp-focus>Poné un premio para esta semana</h4>
          <p className="lgp-sub">Lo elegís vos y se lo das vos: no se compra con <IcCoin className="ec-coin" aria-hidden="true" /> ni se sortea.</p>
          <div className="lgp-btns">
            <button type="button" className="lgp-btn" onClick={(e) => onOpen(e.currentTarget)} disabled={!!busy}>Elegir un premio</button>
            {repeatable && (
              <button type="button" className="lgp-btn lgp-btn--ghost lgp-btn--rep" onClick={onRepeat} disabled={!!busy} aria-busy={busy === 'repeat' || undefined}>
                {busy === 'repeat' ? 'Poniéndolo…' : <><span>Repetir el de la semana pasada</span><span className="lgp-rep">{repeatable.emoji} {repeatable.title}</span></>}
              </button>
            )}
          </div>
          {err}
        </div>
      </section>
    );
  }

  const audience = manage ? 'adult' : 'child';
  return (
    <section className="lgp" aria-labelledby={id} data-lgp="prize" data-condition={prize.condition}>
      <span className="lgp-disc" aria-hidden="true">{prize.emoji}</span>
      <div className="lgp-body">
        <p className="lgp-kick">
          Premio de esta semana
          {carried && <span className="lgp-tag">Sigue en juego</span>}
        </p>
        {manage ? (
          <>
            <h4 className="lgp-title" id={id} tabIndex={-1} data-lgp-focus>{prize.title}</h4>
            <p className="lgp-cond">{conditionText(prize.condition, 'adult')}</p>
          </>
        ) : (
          <h4 className="lgp-title" id={id}>
            <span className="lgp-cond">{conditionText(prize.condition, 'child')}:</span>{' '}{prize.title}
          </h4>
        )}
        {prize.desc && <p className="lgp-desc">{prize.desc}</p>}
        <p className="lgp-by">{prizeByText(prize, audience, meId)}</p>
        {manage && (
          confirming ? (
            <div className="lgp-confirm" role="group" aria-label="Quitar el premio">
              <span>¿Quitás el premio de esta semana?</span>
              <button type="button" ref={yes} className="lgp-btn lgp-btn--warn" onClick={onClear} disabled={!!busy} aria-busy={busy === 'clear' || undefined}>
                {busy === 'clear' ? 'Quitándolo…' : 'Sí, quitarlo'}
              </button>
              <button type="button" className="lgp-btn lgp-btn--ghost" onClick={() => { backToQuit.current = true; setConfirming(false); }} disabled={!!busy}>No</button>
            </div>
          ) : (
            <div className="lgp-btns">
              <button type="button" className="lgp-btn lgp-btn--ghost" onClick={(e) => onOpen(e.currentTarget)} disabled={!!busy}>Cambiar</button>
              <button type="button" ref={quit} className="lgp-btn lgp-btn--ghost" onClick={() => setConfirming(true)} disabled={!!busy}>Quitar</button>
            </div>
          )
        )}
        {err}
      </div>
    </section>
  );
}
