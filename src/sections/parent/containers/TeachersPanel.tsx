import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api';
import type { Teacher, TeacherSlot } from '../../../api/types';
import { TeacherCard } from '../cards/TeacherCard';
import { BookingSheet, type BookingState } from '../components/BookingSheet';
import { PanelState } from '../components/PanelState';
import { parentCall } from '../lib/adultGate';
import { takenSlots, usd } from '../lib/teachers';

type Sheet = { id: string; state: BookingState } | null;
type Notice = { text: string } | null;
const NET_ERR = 'No se pudo completar. Revisá la conexión y probá de nuevo.';

/** "Profesores" (visión, audios 30 y 67; pedido de Esteban 11-oct-2026): marketplace de profes particulares por hora.
 *  "Contactar" abre la hoja de reserva (día + hora semanal); al confirmar, el server agenda las próximas clases y el
 *  chico las ve en su Calendario (/calendario). Un profe contratado muestra su horario y se puede cancelar (con
 *  confirmación en la tarjeta). Nada optimista: después de cada acción se relee la lista (lo que se ve es lo que guardó
 *  el server). Van con la sesión del padre —desde el 14-oct, la del ADULTO activo, implícita (parentCall; un chico recibe
 *  401)—. El calendario que se relee al contratar es el público del chico. */
export function TeachersPanel({ kid }: { kid: string }) {
  const [list, setList] = useState<Teacher[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const alive = useRef(true);
  const seq = useRef(0);
  /** Una acción contra el server a la vez (contratar o cancelar), aunque lleguen dos clics antes del próximo render. */
  const inflight = useRef(false);
  const freshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Relee el catálogo con lo contratado. Las recargas no tapan lo que ya hay; solo cuenta la respuesta de la última. */
  const load = useCallback(async () => {
    const my = ++seq.current;
    try {
      const r = await parentCall(api.teachers());
      if (alive.current && my === seq.current) { setList(r.teachers); setFailed(false); }
    } catch {
      if (alive.current && my === seq.current) setFailed(true);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; if (freshTimer.current) clearTimeout(freshTimer.current); };
  }, [load]);
  // Fresco al volver a la pestaña (otra pestaña o dispositivo pudo contratar o cancelar).
  useEffect(() => {
    const wake = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => { window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake); };
  }, [load]);
  // Los avisos de éxito se van solos.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice((n) => (n === notice ? null : n)), 7000);
    return () => clearTimeout(t);
  }, [notice]);

  const flash = (id: string) => {
    setFresh(id);
    if (freshTimer.current) clearTimeout(freshTimer.current);
    freshTimer.current = setTimeout(() => { if (alive.current) setFresh(null); }, 2600);
  };
  const clearError = (id: string) => setErrors((e) => { if (!(id in e)) return e; const n = { ...e }; delete n[id]; return n; });

  /* ---- reserva ---- */
  const open = (t: Teacher) => {
    setConfirming(null);
    setNotice(null);
    clearError(t.id);
    setSheet({ id: t.id, state: { phase: 'form', busy: false, error: null } });
  };
  const close = () => {
    const id = sheet?.id;
    setSheet(null);
    // El foco vuelve al botón de SU tarjeta (después de contratar ya es "Cancelar").
    if (id) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-teacher="${id}"] [data-tc-act]`)?.focus());
  };
  const setFor = (id: string, state: BookingState) => setSheet((s) => (s && s.id === id ? { id, state } : s));
  const hire = async (slot: TeacherSlot) => {
    if (!sheet || sheet.state.phase !== 'form' || sheet.state.busy || inflight.current) return;
    inflight.current = true;
    const id = sheet.id;
    setFor(id, { phase: 'form', busy: true, error: null });
    try {
      const r = await parentCall(api.hireTeacher(id, slot));
      if (!r.ok) {
        // Rechazo de negocio (ya contratado, horario ocupado…): el motivo va en la hoja y se relee la lista, así las
        // horas ocupadas y el estado del profe quedan al día.
        await load();
        if (alive.current) setFor(id, { phase: 'form', busy: false, error: r.error ?? 'No se pudo contratar. Probá de nuevo.' });
        return;
      }
      // Listo: la lista y, para decirle al padre cuándo es la primera clase, el calendario del chico.
      const [, cal] = await Promise.all([load(), api.calendar().catch(() => null)]);
      if (!alive.current) return;
      const first = cal?.events.filter((e) => e.teacherId === id).sort((a, b) => a.start - b.start)[0]?.start ?? null;
      setFor(id, { phase: 'done', slot, first });
      flash(id);
    } catch {
      if (alive.current) setFor(id, { phase: 'form', busy: false, error: NET_ERR });
    } finally {
      inflight.current = false;
    }
  };

  /* ---- cancelar ---- */
  const askCancel = (t: Teacher) => { setConfirming(t.id); setNotice(null); clearError(t.id); };
  const cancel = async (t: Teacher) => {
    if (busy || inflight.current) return;
    inflight.current = true;
    setBusy(t.id);
    try {
      const r = await parentCall(api.cancelTeacher(t.id));
      await load();
      if (!alive.current) return;
      if (r.ok) setNotice({ text: `Listo: se cancelaron las clases con ${t.name}. Ya no están en el calendario de ${kid}.` });
      else setErrors((e) => ({ ...e, [t.id]: 'Esas clases ya no estaban contratadas (puede que se hayan cancelado desde otra pestaña).' }));
    } catch {
      if (alive.current) setErrors((e) => ({ ...e, [t.id]: NET_ERR }));
    } finally {
      inflight.current = false;
      if (alive.current) { setBusy(null); setConfirming(null); }
    }
  };

  const hired = list?.filter((t) => t.hired && t.slot) ?? [];
  const weekly = hired.reduce((n, t) => n + t.pricePerHour, 0);
  const sheetTeacher = sheet && list ? list.find((t) => t.id === sheet.id) ?? null : null;

  return (
    <section className="pz-panel" aria-labelledby="pz-tc-h">
      <header className="pz-panel-head">
        <h3 id="pz-tc-h">Profesores</h3>
        <p>Profes particulares para {kid}, por hora. Elegís el día y la hora de la clase semanal y las clases aparecen solas en el calendario de {kid}.</p>
      </header>
      <p className={`pz-notice${notice ? '' : ' is-empty'}`} role="status">{notice?.text}</p>
      {!list ? <PanelState failed={failed} onRetry={() => void load()} /> : (
        <>
          <p className="pz-tc-sum">
            {hired.length === 0 ? <span>Todavía no hay profes contratados.</span> : (
              <span>
                <b>{hired.length}</b> {hired.length === 1 ? 'profe contratado' : 'profes contratados'} · <b>{usd(weekly)}</b> por semana
              </span>
            )}
            <Link to="/calendario" className="pz-inline pz-inline--tight">Ver el calendario de {kid}</Link>
          </p>
          <ul className="pz-tcs">
            {list.map((t) => (
              <TeacherCard key={t.id} t={t} kid={kid} confirming={confirming === t.id} busy={busy === t.id} fresh={fresh === t.id}
                error={errors[t.id] ?? null} onContact={() => open(t)} onAskCancel={() => askCancel(t)}
                onConfirmCancel={() => void cancel(t)} onKeep={() => setConfirming(null)} />
            ))}
          </ul>
        </>
      )}
      <p className="pz-foot">En esta demo el profe confirma al instante y no se cobra nada: los mensajes con el profe y el pago todavía no están.</p>
      {sheet && sheetTeacher && (
        <BookingSheet teacher={sheetTeacher} kid={kid} state={sheet.state} taken={takenSlots(list ?? [], sheet.id)}
          onConfirm={(slot) => void hire(slot)} onClose={close} />
      )}
    </section>
  );
}
