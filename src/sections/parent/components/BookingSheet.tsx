import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { Teacher, TeacherSlot } from '../../../api/types';
import {
  CLASSES_PER_HIRE, DAYS, DAYS_SHORT, HOURS, dateLong, everyDay, firstName, hourLabel, slotEvery, takenBy, usd, type TakenSlots,
} from '../lib/teachers';

/** Estado de la hoja que maneja el contenedor: eligiendo (con el motivo si el server dijo que no) o ya contratado. */
export type BookingState =
  | { phase: 'form'; busy: boolean; error: string | null }
  | { phase: 'done'; slot: TeacherSlot; /** inicio de la primera clase, si se pudo leer el calendario */ first: number | null };

/** Hoja de reserva (patrón global .shov/.shcard) que abre "Contactar": día de la semana + hora en punto → resumen
 *  ("Matemática con Caro · miércoles 17:00 · USD 40/h") → Confirmar → "Las clases ya están en el calendario de Ian" con
 *  link al calendario. Las horas que el chico ya tiene con otro profe salen tachadas (el server igual lo valida). Si
 *  mientras tanto el profe quedó contratado (otra pestaña), muestra el motivo y solo deja cerrar. Teclado: Esc cierra
 *  (salvo mientras guarda), Tab queda adentro, los días y las horas son grupos de radio (flechas). Pura: lo elegido
 *  vive acá (como RewardForm); la contratación la hace el contenedor. */
export function BookingSheet({ teacher, kid, state, taken, onConfirm, onClose }: {
  /** El profe con los datos más nuevos (si quedó contratado por otro lado, `hired` llega en true). */ teacher: Teacher;
  kid: string;
  state: BookingState;
  /** Horarios que el chico ya tiene con OTRO profe. */ taken: TakenSlots;
  onConfirm: (slot: TeacherSlot) => void;
  onClose: () => void;
}) {
  const [day, setDay] = useState<number | null>(null);
  const [hour, setHour] = useState<number | null>(null);
  /** El motivo de un rechazo se va apenas se cambia la elección (ya no aplica); el próximo intento lo puede traer de nuevo. */
  const [errGone, setErrGone] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const busy = state.phase === 'form' && state.busy;
  const live = useRef({ busy, onClose });
  useLayoutEffect(() => { live.current = { busy, onClose }; });
  useEffect(() => { if (busy) setErrGone(false); }, [busy]);
  const pickDay = (d: number) => { setDay(d); setErrGone(true); };
  const pickHour = (h: number) => { setHour(h); setErrGone(true); };

  const done = state.phase === 'done';
  /** El profe quedó contratado por otro lado (no por esta hoja): no hay nada que elegir. Nunca mientras guarda: al
   *  contratar desde acá la lista nueva (ya "contratado") llega un instante antes que el "listo". */
  const lockedOut = state.phase === 'form' && !state.busy && teacher.hired;
  const short = firstName(teacher.name);
  // Una hora que el chico ya tiene ocupada ese día no cuenta como elegida (si cambia el día, vuelve a valer).
  const pickedHour = hour !== null && day !== null && takenBy(taken, day, hour) ? null : hour;
  const slot: TeacherSlot | null = day !== null && pickedHour !== null ? { weekday: day, hour: pickedHour } : null;
  const busyThatDay = day === null ? [] : HOURS.flatMap((h) => { const by = takenBy(taken, day, h); return by ? [{ h, by }] : []; });

  // Foco: al abrir, la hoja (el lector anuncia el diálogo); al terminar o al quedar trabada, su botón principal; mientras
  // contrata, la hoja misma (el botón deshabilitado pierde el foco y el Tab se escaparía a la página).
  useEffect(() => {
    const c = card.current;
    if (!c) return;
    const auto = c.querySelector<HTMLElement>('[data-autofocus]');
    if (auto) { auto.focus(); return; }
    const at = document.activeElement as HTMLElement | null;
    if (!at || at === document.body || !c.contains(at) || (at as HTMLButtonElement).disabled) c.focus();
  }, [state.phase, lockedOut, busy]);

  // Teclado: Esc cierra (salvo mientras contrata) y Tab queda adentro de la hoja.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = card.current;
      if (!c) return;
      if (e.key === 'Escape') { e.preventDefault(); if (!live.current.busy) live.current.onClose(); return; }
      if (e.key !== 'Tab') return;
      const els = [...c.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)')];
      if (!els.length) { e.preventDefault(); c.focus(); return; }
      const first = els[0], last = els[els.length - 1], at = document.activeElement;
      const leaving = e.shiftKey ? at === first || at === c || !c.contains(at) : at === last || !c.contains(at);
      if (leaving) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const pending = day === null && pickedHour === null ? 'Elegí el día y la hora.' : day === null ? 'Ahora elegí el día.' : 'Ahora elegí la hora.';

  return (
    <div className="shov pz-ov" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="shcard pz-bk" ref={card} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="pz-bk-t" aria-describedby="pz-bk-d" data-booking={teacher.id}>
        <div className="pz-bk-head">
          <span className="pz-tc-emo" style={{ '--tc': teacher.color } as CSSProperties} aria-hidden="true">{teacher.emoji}</span>
          <div className="pz-bk-id">
            <h3 className="pz-bk-t" id="pz-bk-t">{done ? `Clases con ${teacher.name}` : `Contactar a ${teacher.name}`}</h3>
            <p className="pz-bk-sub">{teacher.subject} · {usd(teacher.pricePerHour)} por hora</p>
          </div>
          <button type="button" className="pz-bk-x" aria-label="Cerrar" disabled={busy} onClick={onClose}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        {state.phase === 'done' ? (
          <div className="pz-bk-done" role="status">
            <span className="pz-bk-ok" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <p className="pz-bk-done-t" id="pz-bk-d">Listo: {kid} tiene {teacher.subject} con {short} {slotEvery(state.slot)}.</p>
            <p className="pz-bk-done-p">
              Las clases ya están en el calendario de {kid}.
              {state.first !== null && <> La primera es el {dateLong(state.first)}.</>}
            </p>
            <div className="pz-bk-btns">
              <Link className="pz-btn" to="/calendario">Ver calendario</Link>
              <button type="button" className="pz-btn pz-btn--ghost" data-autofocus onClick={onClose}>Listo</button>
            </div>
          </div>
        ) : lockedOut ? (
          <>
            <p className="pz-bk-err" id="pz-bk-d" role="alert">
              {state.error ?? `${teacher.name} ya le da clases a ${kid}${teacher.slot ? ` ${slotEvery(teacher.slot)}` : ''}.`}
            </p>
            <div className="pz-bk-btns">
              <button type="button" className="pz-btn" data-autofocus onClick={onClose}>Entendido</button>
            </div>
          </>
        ) : (
          <>
            <p className="pz-bk-lede" id="pz-bk-d">Elegí el día y la hora de la clase semanal de {kid}. Cada clase dura una hora.</p>
            <fieldset className="pz-bk-set" disabled={busy}>
              <legend className="pz-bk-legend">Día</legend>
              <div className="pz-bk-opts">
                {DAYS_SHORT.map((d, i) => (
                  <label key={d} className="pz-bk-opt" data-day={i}>
                    <input type="radio" name="pz-bk-day" value={i} checked={day === i} onChange={() => pickDay(i)} />
                    <span className="pz-bk-chip"><span aria-hidden="true">{d}</span><span className="pz-sr">{DAYS[i]}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="pz-bk-set" disabled={busy}>
              <legend className="pz-bk-legend">Hora</legend>
              <div className="pz-bk-opts">
                {HOURS.map((h) => {
                  const by = day === null ? undefined : takenBy(taken, day, h);
                  return (
                    <label key={h} className="pz-bk-opt" data-hour={h} title={by ? `Ocupado: ${kid} tiene ${by.subject} con ${firstName(by.name)}` : undefined}>
                      <input type="radio" name="pz-bk-hour" value={h} checked={pickedHour === h} disabled={!!by} onChange={() => pickHour(h)} />
                      <span className="pz-bk-chip">{hourLabel(h)}{by && <span className="pz-sr"> (ocupado)</span>}</span>
                    </label>
                  );
                })}
              </div>
              {busyThatDay.length > 0 && day !== null && (
                <p className="pz-bk-taken">
                  {busyThatDay.length === 1 ? 'Tachada: la hora que' : 'Tachadas: las horas que'} {kid} ya tiene{' '}
                  {busyThatDay.length === 1 ? 'ocupada' : 'ocupadas'} {everyDay(day)} (
                  {busyThatDay.map(({ h, by }, i) => (
                    <span key={h}>{i ? (i === busyThatDay.length - 1 ? ' y ' : ', ') : ''}{by.subject} a las {hourLabel(h)}</span>
                  ))}).
                </p>
              )}
            </fieldset>
            <div className="pz-bk-sum" aria-live="polite">
              {slot ? (
                <>
                  <p className="pz-bk-sum-main"><b>{teacher.subject} con {short}</b> · {DAYS[slot.weekday]} {hourLabel(slot.hour)} · {usd(teacher.pricePerHour)}/h</p>
                  <p className="pz-bk-sum-sub">Una clase de una hora {slotEvery(slot)}: {usd(teacher.pricePerHour)} por semana. Las próximas {CLASSES_PER_HIRE} aparecen en el calendario de {kid}.</p>
                </>
              ) : <p className="pz-bk-sum-empty">{pending}</p>}
            </div>
            {state.error && !errGone && <p className="pz-bk-err" role="alert">{state.error}</p>}
            <div className="pz-bk-btns">
              <button type="button" className="pz-btn pz-btn--ghost" disabled={busy} onClick={onClose}>Cancelar</button>
              <button type="button" className="pz-btn pz-bk-go" disabled={!slot || busy} aria-busy={busy} onClick={() => { if (slot) onConfirm(slot); }}>
                {busy ? 'Contratando…' : 'Confirmar'}
              </button>
            </div>
            <p className="pz-bk-demo">Demo: el profe confirma al instante y no se cobra nada.</p>
          </>
        )}
      </div>
    </div>
  );
}
