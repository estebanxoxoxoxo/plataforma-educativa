import { useEffect, useRef, type CSSProperties } from 'react';
import type { Teacher } from '../../../api/types';
import { firstName, ratingLabel, slotLabel, usd } from '../lib/teachers';

/** Tarjeta de un profe del marketplace: emoji de la materia sobre su color, nombre, materia y calificación, una línea
 *  de quién es, el precio por hora bien visible y la acción. Sin contratar → "Contactar" (abre la hoja de reserva).
 *  Contratado → insignia con el horario + "Cancelar" (sus clases), que se confirma en la misma tarjeta. Los errores de una
 *  acción se muestran acá (nada de alert()). Pura: las acciones las resuelve el contenedor. */
export function TeacherCard({ t, kid, confirming, busy, fresh, error, onContact, onAskCancel, onConfirmCancel, onKeep }: {
  t: Teacher;
  kid: string;
  /** Pidiendo confirmación para cancelar sus clases. */ confirming: boolean;
  /** Cancelando en el server. */ busy: boolean;
  /** Recién contratado: se resalta un momento. */ fresh: boolean;
  error: string | null;
  onContact: () => void;
  onAskCancel: () => void;
  onConfirmCancel: () => void;
  onKeep: () => void;
}) {
  const card = useRef<HTMLLIElement>(null);
  const act = useRef<HTMLButtonElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const was = useRef(confirming);
  // Foco: al pedir confirmación, el "No" (lo seguro); al cerrarla, de vuelta al botón de la tarjeta — solo si el foco
  // estaba en la tarjeta o se perdió (no se le roba a otra parte de la página).
  useEffect(() => {
    if (confirming === was.current) return;
    was.current = confirming;
    const at = document.activeElement;
    const ours = !at || at === document.body || !!card.current?.contains(at);
    if (!ours) return;
    if (confirming) keep.current?.focus();
    else act.current?.focus();
  }, [confirming]);

  const short = firstName(t.name);
  return (
    <li ref={card} className={`pz-tc${t.hired ? ' is-hired' : ''}${fresh ? ' is-fresh' : ''}`} data-teacher={t.id}>
      <div className="pz-tc-head">
        <span className="pz-tc-emo" style={{ '--tc': t.color } as CSSProperties} aria-hidden="true">{t.emoji}</span>
        <div className="pz-tc-id">
          <h4 className="pz-tc-name">{t.name}</h4>
          <p className="pz-tc-sub">
            <span>{t.subject}</span>
            <span className="pz-tc-rate">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.9l2.45 5.1 5.6.75-4.08 3.9 1 5.55L10 14.55 5.03 17.2l1-5.55-4.08-3.9 5.6-.75z" fill="currentColor" /></svg>
              <span aria-hidden="true">{ratingLabel(t.rating)}</span>
              <span className="pz-sr">Calificación {ratingLabel(t.rating)} de 5</span>
            </span>
          </p>
        </div>
      </div>
      <p className="pz-tc-bio">{t.bio}</p>
      {t.hired && t.slot && (
        <p className="pz-tc-hired">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l2.9 2.9 6.1-6.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Contratado · {slotLabel(t.slot)}
        </p>
      )}
      <div className="pz-tc-foot">
        <p className="pz-tc-price"><b>{usd(t.pricePerHour)}</b> por hora</p>
        {/* data-tc-act: el contenedor devuelve el foco acá al cerrar la hoja de reserva */}
        {!confirming && (t.hired ? (
          <button ref={act} type="button" className="pz-btn pz-btn--ghost pz-btn--sm" data-tc-act disabled={busy} aria-label={`Cancelar las clases con ${t.name}`} onClick={onAskCancel}>Cancelar</button>
        ) : (
          <button ref={act} type="button" className="pz-btn pz-btn--sm" data-tc-act aria-label={`Contactar a ${t.name}`} onClick={onContact}>Contactar</button>
        ))}
      </div>
      {confirming && (
        <div className="pz-tc-confirm" role="group" aria-label={`Cancelar las clases con ${t.name}`}>
          <p>¿Cancelás las clases con {short}? Las próximas salen del calendario de {kid}.</p>
          <div className="pz-form-btns">
            <button type="button" className="pz-btn pz-btn--sm" disabled={busy} aria-busy={busy} onClick={onConfirmCancel}>{busy ? 'Cancelando…' : 'Sí, cancelar'}</button>
            <button ref={keep} type="button" className="pz-btn pz-btn--ghost pz-btn--sm" disabled={busy} onClick={onKeep}>No, mantener</button>
          </div>
        </div>
      )}
      {error && <p className="pz-tc-err" role="alert">{error}</p>}
    </li>
  );
}
