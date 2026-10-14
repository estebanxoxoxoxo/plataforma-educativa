import { useEffect, useRef, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { MentorContract, Teacher } from '../../../api/types';
import {
  calendarOf, firstName, forWho, planLabel, slotsEvery, usd, weeklyPrice, type People,
} from '../../../shared/lib/mentors';
import { capFirst } from '../lib/format';

/** Una mentoría de Familia → Mentorías (un CONTRATO): el emoji de la materia sobre el color del mentor, "{materia} con
 *  {mentor}", para quién, el plan con su precio semanal y los días — o "Falta elegir los días" con "Elegir los días", que
 *  lleva a Buscar → Mentores con la agenda de ese contrato abierta (/buscar?tab=mentors&agendar=<id>). "Cancelar" se
 *  confirma en la misma fila (el foco va al "No", lo seguro). Los errores de la acción se muestran acá. Pura: las acciones
 *  las resuelve el contenedor. */
export function MentorshipRow({ m, c, me, people, confirming, busy, error, onAskCancel, onConfirmCancel, onKeep }: {
  m: Teacher;
  c: MentorContract;
  /** El adulto activo. */ me: string;
  people: People;
  /** Pidiendo confirmación para cancelar. */ confirming: boolean;
  /** Cancelando en el server. */ busy: boolean;
  error: string | null;
  onAskCancel: () => void;
  onConfirmCancel: () => void;
  onKeep: () => void;
}) {
  const row = useRef<HTMLLIElement>(null);
  const act = useRef<HTMLButtonElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const was = useRef(confirming);
  // Foco: al pedir confirmación, el "No" (lo seguro); al cerrarla, de vuelta a "Cancelar" — solo si el foco estaba en la
  // fila o se perdió (no se le roba a otra parte de la página).
  useEffect(() => {
    if (confirming === was.current) return;
    was.current = confirming;
    const at = document.activeElement;
    const ours = !at || at === document.body || !!row.current?.contains(at);
    if (!ours) return;
    if (confirming) keep.current?.focus();
    else act.current?.focus();
  }, [confirming]);

  const pending = c.status === 'pending';
  const who = forWho(c.beneficiary, me, people);
  const what = `${m.subject} con ${m.name} ${who}`;
  return (
    <li ref={row} className={`pz-ms${pending ? ' is-pending' : ''}`} data-contract={c.id} data-status={c.status}>
      <span className="pz-ms-emo" style={{ '--mc': m.color } as CSSProperties} aria-hidden="true">{m.emoji}</span>
      <div className="pz-ms-main">
        <p className="pz-ms-t"><b>{m.subject} con {m.name}</b> <span className="pz-ms-who">{who}</span></p>
        <p className="pz-ms-plan">{planLabel(c.daysPerWeek)} · <b>{usd(weeklyPrice(m.pricePerHour, c.daysPerWeek))}</b> por semana</p>
        {pending ? (
          <p className="pz-ms-days is-pending">
            <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M10 6.3V10l2.6 1.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Falta elegir los días
          </p>
        ) : (
          <p className="pz-ms-days">{capFirst(slotsEvery(c.slots))}</p>
        )}
      </div>
      {!confirming && (
        <div className="pz-ms-acts">
          {pending && (
            <Link className="pz-btn pz-btn--sm" to={`/buscar?tab=mentors&agendar=${c.id}`} aria-label={`Elegir los días de ${what}`}>Elegir los días</Link>
          )}
          <button ref={act} type="button" className="pz-btn pz-btn--ghost pz-btn--sm" data-ms-act disabled={busy}
            aria-label={`Cancelar ${what}`} onClick={onAskCancel}>Cancelar</button>
        </div>
      )}
      {confirming && (
        <div className="pz-ms-confirm" role="group" aria-label={`Cancelar ${what}`}>
          <p>
            ¿Cancelás {m.subject} con {firstName(m.name)} {who}?{' '}
            {pending ? 'Todavía no tenía días elegidos.' : `Las próximas clases salen de ${calendarOf(c.beneficiary, me, people)}.`}
          </p>
          <div className="pz-form-btns">
            <button type="button" className="pz-btn pz-btn--sm" disabled={busy} aria-busy={busy} onClick={onConfirmCancel}>{busy ? 'Cancelando…' : 'Sí, cancelar'}</button>
            <button ref={keep} type="button" className="pz-btn pz-btn--ghost pz-btn--sm" disabled={busy} onClick={onKeep}>No, mantener</button>
          </div>
        </div>
      )}
      {error && <p className="pz-ms-err" role="alert">{error}</p>}
    </li>
  );
}
