import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { Mentor, MentorContract, MentorPlan, TakenSlot, TeacherSlot } from '../../../api/types';
import {
  CLASSES, DAYS, DAYS_SHORT, HOURS, PLANS, calendarOf, dateLong, everyDay, familyIds, firstName, forWho, hourLabel, listEs,
  pickWho, planClasses, planLabel, slotsEvery, takenBy, usd, weeklyPrice, whoName, type People,
} from '../../../shared/lib/mentors';

/** Estado de la hoja que maneja el contenedor (MentorResults):
 *  · plan   — cuántas clases por semana y para quién → "Contratar" (el pago del demo: instantáneo, sin cobrar nada).
 *  · agenda — el POST-COMPRA: los días del contrato `pending` (tantos como pagó), cada uno con su hora. `justPaid` = se
 *             acaba de pagar en esta hoja (si no, se reabrió un pendiente desde su tarjeta o desde Familia → Mentorías).
 *  · done   — listo: las clases ya están en el calendario del beneficiario (`first` = la primera, si se pudo saber). */
export type MentorSheetState =
  | { phase: 'plan'; busy: boolean; error: string | null }
  | { phase: 'agenda'; contract: MentorContract; justPaid: boolean; busy: boolean; error: string | null }
  | { phase: 'done'; contract: MentorContract; first: number | null };

type Common = { mentor: Mentor; me: string; people: People };

/** Hoja de contratación de Buscar → Mentores (patrón global .shov/.shcard; los patrones de foco, Esc y Tab de la vieja
 *  hoja de reserva de Profesores). Teclado: Esc cierra (salvo mientras guarda), Tab queda adentro, los planes, los
 *  beneficiarios, los días y las horas son grupos de radio (flechas). Cerrar en la agenda NO pierde la compra: el contrato
 *  queda pendiente y se completa después ("Elegir los días"). Pura: lo elegido vive acá; contratar y agendar los hace el
 *  contenedor (y relee los mentores al cerrar, en cualquier fase). */
export function MentorSheet({ mentor, me, people, taken, state, onContract, onSchedule, onClose }: Common & {
  /** Las horas ocupadas por beneficiario (MentorsResponse.taken). */ taken: Readonly<Record<string, TakenSlot[]>>;
  state: MentorSheetState;
  onContract: (plan: MentorPlan, beneficiary: string) => void;
  onSchedule: (slots: TeacherSlot[]) => void;
  onClose: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const busy = state.phase !== 'done' && state.busy;
  const live = useRef({ busy, onClose });
  useLayoutEffect(() => { live.current = { busy, onClose }; });

  // Foco: al abrir y en cada fase, su [data-autofocus] o la hoja (el lector anuncia el diálogo).
  useEffect(() => {
    const c = card.current;
    (c?.querySelector<HTMLElement>('[data-autofocus]') ?? c)?.focus();
  }, [state.phase]);
  // Mientras guarda, el botón deshabilitado pierde el foco: lo toma la hoja (si no, el Tab se escaparía a la página).
  useEffect(() => {
    const c = card.current;
    const at = document.activeElement as HTMLElement | null;
    if (c && (!at || at === document.body || !c.contains(at) || (at as HTMLButtonElement).disabled)) c.focus();
  }, [busy]);
  // Teclado: Esc cierra (salvo mientras guarda) y Tab queda adentro de la hoja.
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

  const short = firstName(mentor.name);
  const head = state.phase === 'plan'
    ? { t: `Contratar a ${mentor.name}`, sub: `${mentor.subject} · ${usd(mentor.pricePerHour)} la hora` }
    : state.phase === 'agenda'
      ? { t: state.justPaid ? '¡Listo! Elegí los días' : 'Elegí los días',
        sub: `${mentor.subject} con ${short} ${forWho(state.contract.beneficiary, me, people)} · ${planLabel(state.contract.daysPerWeek)}` }
      : { t: `Clases con ${mentor.name}`, sub: `${mentor.subject} · ${planLabel(state.contract.daysPerWeek)}` };

  return (
    <div className="shov smn-ov" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="shcard smn-sheet" ref={card} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="smn-sh-t"
        aria-describedby="smn-sh-d" data-mentor-sheet={mentor.id} data-phase={state.phase}>
        <div className="smn-sh-head">
          <span className="smn-emo" style={{ '--mc': mentor.color } as CSSProperties} aria-hidden="true">{mentor.emoji}</span>
          <div className="smn-sh-id">
            <h3 className="smn-sh-t" id="smn-sh-t">{head.t}</h3>
            <p className="smn-sh-sub">{head.sub}</p>
          </div>
          <button type="button" className="smn-x" aria-label="Cerrar" disabled={busy} onClick={onClose}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        {state.phase === 'plan' ? (
          <PlanStep mentor={mentor} me={me} people={people} busy={state.busy} error={state.error} onContract={onContract} onCancel={onClose} />
        ) : state.phase === 'agenda' ? (
          <AgendaStep key={state.contract.id} mentor={mentor} me={me} people={people} contract={state.contract} justPaid={state.justPaid}
            taken={taken[state.contract.beneficiary] ?? []} busy={state.busy} error={state.error} onSchedule={onSchedule} onLater={onClose} />
        ) : (
          <DoneStep mentor={mentor} me={me} people={people} contract={state.contract} first={state.first} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

/** El motivo de un rechazo se va apenas se cambia la elección (ya no aplica); el próximo intento lo puede traer de nuevo. */
function useErrorGone(busy: boolean) {
  const [gone, setGone] = useState(false);
  useEffect(() => { if (busy) setGone(false); }, [busy]);
  return [gone, () => setGone(true)] as const;
}

/* ---------- 1. plan: cuántas clases por semana y para quién ---------- */
function PlanStep({ mentor, me, people, busy, error, onContract, onCancel }: Common & {
  busy: boolean; error: string | null;
  onContract: (plan: MentorPlan, beneficiary: string) => void;
  onCancel: () => void;
}) {
  const [plan, setPlan] = useState<MentorPlan | null>(null);
  const [who, setWho] = useState<string | null>(null);
  const [errGone, dropError] = useErrorGone(busy);
  const short = firstName(mentor.name);
  const family = familyIds(me, people);
  /** El contrato que ya tiene esa persona con este mentor (uno por mentor y beneficiario: no se puede elegir de nuevo). */
  const holderOf = (id: string) => mentor.contracts.find((c) => c.beneficiary === id);
  // Si mientras tanto quedó contratado para esa persona (otra pestaña), deja de contar como elegido.
  const pickedWho = who !== null && !holderOf(who) ? who : null;
  const nobody = family.every((id) => holderOf(id));
  const price = plan === null ? null : weeklyPrice(mentor.pricePerHour, plan);
  const ready = plan !== null && pickedWho !== null;
  const pending = nobody ? `Ya hay clases con ${short} para toda tu familia.`
    : plan === null && pickedWho === null ? 'Elegí cuántas clases por semana y para quién.'
    : plan === null ? 'Ahora elegí cuántas clases por semana.'
    : 'Ahora elegí para quién son.';

  return (
    <>
      <p className="smn-lede" id="smn-sh-d">Elegí cuántas clases por semana y para quién. Después del pago elegís los días y las horas.</p>
      <fieldset className="smn-set" disabled={busy}>
        <legend className="smn-legend">¿Cuántas clases por semana?</legend>
        <div className="smn-plans">
          {PLANS.map((p) => (
            <label key={p} className="smn-plan" data-plan={p}>
              <input type="radio" name="smn-plan" value={p} checked={plan === p} onChange={() => { setPlan(p); dropError(); }} />
              <span className="smn-plan-box">
                <span className="smn-plan-n">{p}</span>
                <span className="smn-plan-t">{p === 1 ? 'clase por semana' : 'clases por semana'}</span>
                <span className="smn-plan-p">{planClasses(p)} · <b>{usd(weeklyPrice(mentor.pricePerHour, p))}</b> por semana</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="smn-set" disabled={busy}>
        <legend className="smn-legend">¿Para quién?</legend>
        <div className="smn-whos">
          {family.map((id) => {
            const c = holderOf(id);
            const why = !c ? null
              : c.status === 'pending' ? 'Pagado: falta elegir los días'
              : `Ya ${id === me ? 'tenés' : 'tiene'} clases con ${short}`;
            return (
              <label key={id} className="smn-who" data-who={id}>
                <input type="radio" name="smn-who" value={id} checked={pickedWho === id} disabled={!!c} onChange={() => { setWho(id); dropError(); }} />
                <span className="smn-who-box">
                  <b>{pickWho(id, me, people)}</b>
                  {why && <small>{why}</small>}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="smn-sum" aria-live="polite">
        {ready && price !== null ? (
          <>
            <p className="smn-sum-main"><b>{mentor.subject} con {short}</b> {forWho(pickedWho, me, people)} · {planLabel(plan)}</p>
            <p className="smn-sum-sub">
              {usd(price)} por semana ({planClasses(plan)} a {usd(mentor.pricePerHour)} la hora). Después del pago elegís {plan === 1 ? 'el día' : `los ${plan} días`} y la hora.
            </p>
          </>
        ) : <p className="smn-sum-empty">{pending}</p>}
      </div>
      {error && !errGone && <p className="smn-err" role="alert">{error}</p>}
      <div className="smn-btns">
        <button type="button" className="smn-btn smn-btn--ghost" disabled={busy} onClick={onCancel}>Cancelar</button>
        <button type="button" className="smn-btn smn-go" disabled={!ready || busy} aria-busy={busy}
          onClick={() => { if (plan !== null && pickedWho !== null) onContract(plan, pickedWho); }}>
          {busy ? 'Contratando…' : price !== null && ready ? `Contratar · ${usd(price)} por semana` : 'Contratar'}
        </button>
      </div>
      <p className="smn-demo">Demo: el pago es instantáneo y no se cobra nada.</p>
    </>
  );
}

/* ---------- 2. agenda (post-compra): un día con su hora por cada clase del plan ---------- */
type Row = { day: number | null; hour: number | null };
function AgendaStep({ mentor, me, people, contract, justPaid, taken, busy, error, onSchedule, onLater }: Common & {
  contract: MentorContract; justPaid: boolean;
  /** Las horas que el BENEFICIARIO ya tiene ocupadas (con quién). */ taken: readonly TakenSlot[];
  busy: boolean; error: string | null;
  onSchedule: (slots: TeacherSlot[]) => void;
  onLater: () => void;
}) {
  const n = contract.daysPerWeek;
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: n }, () => ({ day: null, hour: null })));
  const [errGone, dropError] = useErrorGone(busy);
  const short = firstName(mentor.name);
  const self = contract.beneficiary === me;
  const name = whoName(contract.beneficiary, me, people);
  const set = (i: number, patch: Partial<Row>) => { setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r))); dropError(); };
  // Una hora que el beneficiario ya tiene ocupada ese día no cuenta como elegida (si cambia el día, vuelve a valer).
  const picked = rows.map((r) => ({ day: r.day, hour: r.day !== null && r.hour !== null && takenBy(taken, r.day, r.hour) ? null : r.hour }));
  const slots: TeacherSlot[] | null = picked.every((r) => r.day !== null && r.hour !== null)
    ? picked.map((r) => ({ weekday: r.day as number, hour: r.hour as number }))
    : null;
  const missing = picked.findIndex((r) => r.day === null || r.hour === null);
  const which = n === 1 ? 'de la clase' : `de la clase ${missing + 1}`;
  const pending = missing < 0 ? '' : picked[missing].day === null ? `Elegí el día ${which}.` : `Ahora elegí la hora ${which}.`;

  return (
    <>
      {justPaid ? (
        <p className="smn-lede smn-paid" id="smn-sh-d" role="status">
          <b>Pagado.</b> Ahora elegí {n === 1 ? 'el día' : `los ${n} días`} de {mentor.subject} {forWho(contract.beneficiary, me, people)}, cada uno con su hora. Cada clase dura una hora.
        </p>
      ) : (
        <p className="smn-lede" id="smn-sh-d">Elegí {n === 1 ? 'el día' : `los ${n} días`} de {mentor.subject} {forWho(contract.beneficiary, me, people)}, cada uno con su hora. Cada clase dura una hora.</p>
      )}
      <div className="smn-rows">
        {picked.map((r, i) => {
          const dayOf = (wd: number) => picked.findIndex((x, k) => k !== i && x.day === wd);
          const busyThatDay = r.day === null ? [] : HOURS.flatMap((h) => { const by = takenBy(taken, r.day as number, h); return by ? [{ h, by }] : []; });
          return (
            <fieldset key={i} className="smn-row" disabled={busy} data-row={i}>
              <legend className="smn-legend">
                Clase {i + 1}
                {r.day !== null && r.hour !== null && <span className="smn-row-pick"> · {DAYS[r.day]} {hourLabel(r.hour)}</span>}
              </legend>
              <div className="smn-opts" role="group" aria-label={`Día de la clase ${i + 1}`}>
                {DAYS_SHORT.map((d, wd) => {
                  const other = dayOf(wd);
                  return (
                    <label key={wd} className="smn-opt" data-day={wd} title={other >= 0 ? `Ya lo elegiste para la clase ${other + 1}` : undefined}>
                      <input type="radio" name={`smn-day-${i}`} value={wd} checked={r.day === wd} disabled={other >= 0} onChange={() => set(i, { day: wd })} />
                      <span className="smn-chip"><span aria-hidden="true">{d}</span><span className="smn-sr">{DAYS[wd]}{other >= 0 ? ' (ya elegido para otra clase)' : ''}</span></span>
                    </label>
                  );
                })}
              </div>
              {r.day !== null && (
                <div className="smn-opts smn-opts--hours" role="group" aria-label={`Hora de la clase ${i + 1}`}>
                  {HOURS.map((h) => {
                    const by = takenBy(taken, r.day as number, h);
                    return (
                      <label key={h} className="smn-opt" data-hour={h}
                        title={by ? `Ocupado: ${self ? 'tenés' : `${name} tiene`} ${by.subject} con ${firstName(by.mentorName)}` : undefined}>
                        <input type="radio" name={`smn-hour-${i}`} value={h} checked={r.hour === h} disabled={!!by} onChange={() => set(i, { hour: h })} />
                        <span className="smn-chip">{hourLabel(h)}{by && <span className="smn-sr"> (ocupado)</span>}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {busyThatDay.length > 0 && r.day !== null && (
                <p className="smn-taken">
                  {busyThatDay.length === 1 ? 'Tachada: la hora que' : 'Tachadas: las horas que'} {self ? 'ya tenés' : `${name} ya tiene`}{' '}
                  {busyThatDay.length === 1 ? 'ocupada' : 'ocupadas'} {everyDay(r.day)} (
                  {listEs(busyThatDay.map(({ h, by }) => `${by.subject} con ${firstName(by.mentorName)} a las ${hourLabel(h)}`))}).
                </p>
              )}
            </fieldset>
          );
        })}
      </div>
      <div className="smn-sum" aria-live="polite">
        {slots ? (
          <>
            <p className="smn-sum-main"><b>{mentor.subject} con {short}</b> {forWho(contract.beneficiary, me, people)} · {slotsEvery(slots)}</p>
            <p className="smn-sum-sub">
              {usd(weeklyPrice(mentor.pricePerHour, n))} por semana. Las próximas {CLASSES} clases de {n === 1 ? 'ese día' : 'cada día'} aparecen en {calendarOf(contract.beneficiary, me, people)}.
            </p>
          </>
        ) : <p className="smn-sum-empty">{pending}</p>}
      </div>
      {error && !errGone && <p className="smn-err" role="alert">{error}</p>}
      <div className="smn-btns">
        <button type="button" className="smn-btn smn-btn--ghost" disabled={busy} onClick={onLater}>Elegir más tarde</button>
        <button type="button" className="smn-btn smn-go" disabled={!slots || busy} aria-busy={busy} onClick={() => { if (slots) onSchedule(slots); }}>
          {busy ? 'Guardando…' : 'Confirmar los días'}
        </button>
      </div>
      <p className="smn-later">Podés elegir los días más tarde desde esta tarjeta o desde Familia → Mentorías: la compra no se pierde.</p>
    </>
  );
}

/* ---------- 3. listo: las clases ya están en el calendario ---------- */
function DoneStep({ mentor, me, people, contract, first, onClose }: Common & {
  contract: MentorContract; first: number | null; onClose: () => void;
}) {
  const self = contract.beneficiary === me;
  const short = firstName(mentor.name);
  return (
    <div className="smn-done" role="status">
      <span className="smn-ok" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <p className="smn-done-t" id="smn-sh-d">
        Listo: {self ? 'tenés' : `${whoName(contract.beneficiary, me, people)} tiene`} {mentor.subject} con {short} {slotsEvery(contract.slots)}.
      </p>
      <p className="smn-done-p">
        Las clases ya están en {calendarOf(contract.beneficiary, me, people)}.
        {first !== null && <> La primera es el {dateLong(first)}.</>}
      </p>
      <div className="smn-btns">
        {self && <Link className="smn-btn" to="/calendario">Ver calendario</Link>}
        <button type="button" className={`smn-btn${self ? ' smn-btn--ghost' : ''}`} data-autofocus onClick={onClose}>Listo</button>
      </div>
    </div>
  );
}
