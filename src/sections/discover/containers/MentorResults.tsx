import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../api';
import type { Mentor, MentorContract, MentorPlan, MentorsResponse, TeacherSlot } from '../../../api/types';
import { useUser } from '../../../hooks/user';
import { firstClass, forWho, mentorMatches } from '../../../shared/lib/mentors';
import { useCycle } from '../../parent/lib/cycle';
import { MentorCard } from '../cards/MentorCard';
import { MentorSheet, type MentorSheetState } from '../components/MentorSheet';

type Sheet = { teacherId: string; state: MentorSheetState };
const NET_ERR = 'No se pudo completar. Revisá la conexión y probá de nuevo.';

/** Buscar → Mentores (tanda U2, docs/USUARIOS.md §6; solo el ADULTO: lo monta SearchPage con un adulto activo). Contenedor:
 *  lee el catálogo con los contratos de la familia (api.mentors, al montar y al volver el foco) y filtra LOCAL por nombre,
 *  materia o bio — sin query, el catálogo entero; sin red extra. Resuelve la hoja de contratación:
 *    · "Contratar" → plan + para quién → api.mentorContract (el pago del demo) → la AGENDA del post-compra.
 *    · agenda → api.mentorSchedule → "listo", con la primera clase (del calendario si el beneficiario es el usuario activo;
 *      si no, la cuenta con sus días: /api/calendar solo trae el del activo). La fecha y la hora van en la ZONA HORARIA DE
 *      LA FAMILIA (tanda B2: la `tz` del store de horarios, el mismo que usan la barra superior y el Calendario; null = la
 *      del navegador), que es donde el server ancla las clases: "los miércoles a las 17:00" es la primera a las 17:00.
 *    · "Elegir los días" de un contrato pendiente (en su tarjeta, o `agendar` = el id que manda Familia → Mentorías) →
 *      la agenda directo. Cerrar en la agenda deja el contrato pendiente.
 *  Nada optimista: después de cada acción —y al cerrar la hoja, en cualquier fase— se relee (lo que se ve es lo que guardó
 *  el server). Los rechazos de negocio (200 + ok:false) van en la hoja con su motivo. */
export function MentorResults({ q, agendar, onAgendarUsed }: {
  q: string;
  /** Id de un contrato pendiente cuya agenda hay que abrir (?agendar= de la URL). */ agendar: string | null;
  /** Ya se usó `agendar`: el que lo pasó lo saca de la URL. */ onAgendarUsed: () => void;
}) {
  const me = useUser()?.id ?? '';
  const tz = useCycle().tz; // la zona de la familia (la lee el store desde que monta la barra superior)
  /** La zona vigente cuando vuelve el agendado (el `schedule` en vuelo es de un render anterior). */
  const tzNow = useRef(tz);
  useEffect(() => { tzNow.current = tz; });
  const [data, setData] = useState<MentorsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const alive = useRef(true);
  const seq = useRef(0);
  /** Una acción contra el server a la vez, aunque lleguen dos clics antes del próximo render. */
  const inflight = useRef(false);

  /** Relee los mentores. Las recargas no tapan lo que ya hay; solo cuenta la respuesta de la última. */
  const load = useCallback(async () => {
    const my = ++seq.current;
    try {
      const r = await api.mentors();
      if (alive.current && my === seq.current) { setData(r); setFailed(false); }
    } catch {
      if (alive.current && my === seq.current) setFailed(true);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    // Fresco al volver a la pestaña (otra pestaña —o Familia → Mentorías— pudo contratar, agendar o cancelar).
    const wake = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      alive.current = false;
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [load]);

  // ?agendar=<id> (desde Familia → Mentorías): con los mentores leídos, abre la agenda de ese contrato si sigue pendiente.
  const agendarUsed = useRef(onAgendarUsed);
  useEffect(() => { agendarUsed.current = onAgendarUsed; });
  useEffect(() => {
    if (!agendar || !data) return;
    const id = Number(agendar);
    const m = data.mentors.find((x) => x.contracts.some((c) => c.id === id));
    const c = m?.contracts.find((x) => x.id === id);
    if (m && c?.status === 'pending') setSheet({ teacherId: m.id, state: { phase: 'agenda', contract: c, justPaid: false, busy: false, error: null } });
    else setNote(m && c ? `Las clases de ${m.subject} con ${m.name} ${forWho(c.beneficiary, me, data.people)} ya tienen sus días.`
      : 'Esa contratación ya no está: puede que se haya cancelado.');
    agendarUsed.current();
  }, [agendar, data, me]);

  const setFor = (teacherId: string, state: MentorSheetState) => setSheet((s) => (s && s.teacherId === teacherId ? { teacherId, state } : s));
  const open = (m: Mentor) => { setNote(null); setSheet({ teacherId: m.id, state: { phase: 'plan', busy: false, error: null } }); };
  const openAgenda = (m: Mentor, c: MentorContract) => {
    setNote(null);
    setSheet({ teacherId: m.id, state: { phase: 'agenda', contract: c, justPaid: false, busy: false, error: null } });
  };
  const close = () => {
    const id = sheet?.teacherId;
    setSheet(null);
    void load();
    // El foco vuelve a SU tarjeta: "Contratar" o, si ya no hay qué contratar, su "Elegir los días".
    if (id) {
      requestAnimationFrame(() => {
        const cardEl = document.querySelector(`[data-mentor="${id}"]`);
        cardEl?.querySelector<HTMLElement>('[data-smn-act], [data-smn-agenda]')?.focus();
      });
    }
  };

  /* ---- el pago: el contrato nace pendiente y la hoja pasa a la agenda ---- */
  const contract = async (plan: MentorPlan, beneficiary: string) => {
    if (!sheet || sheet.state.phase !== 'plan' || sheet.state.busy || inflight.current) return;
    inflight.current = true;
    const id = sheet.teacherId;
    setFor(id, { phase: 'plan', busy: true, error: null });
    try {
      const r = await api.mentorContract(id, plan, beneficiary);
      await load(); // la tarjeta ya muestra el contrato (o, si se rechazó, lo que cambió mientras tanto)
      if (!alive.current) return;
      if (r.ok && r.contract) setFor(id, { phase: 'agenda', contract: r.contract, justPaid: true, busy: false, error: null });
      else setFor(id, { phase: 'plan', busy: false, error: r.error ?? 'No se pudo contratar. Probá de nuevo.' });
    } catch {
      if (alive.current) setFor(id, { phase: 'plan', busy: false, error: NET_ERR });
    } finally {
      inflight.current = false;
    }
  };

  /* ---- el post-compra: los días ---- */
  const schedule = async (slots: TeacherSlot[]) => {
    if (!sheet || sheet.state.phase !== 'agenda' || sheet.state.busy || inflight.current) return;
    inflight.current = true;
    const id = sheet.teacherId;
    const st = sheet.state;
    setFor(id, { ...st, busy: true, error: null });
    try {
      const r = await api.mentorSchedule(st.contract.id, slots);
      if (!r.ok || !r.contract) {
        await load(); // las horas ocupadas al día (el motivo puede ser una clase agendada en otra pestaña)
        if (alive.current) setFor(id, { ...st, busy: false, error: r.error ?? 'No se pudieron guardar los días. Probá de nuevo.' });
        return;
      }
      const c = r.contract;
      const [, cal] = await Promise.all([load(), c.beneficiary === me ? api.calendar().catch(() => null) : Promise.resolve(null)]);
      if (!alive.current) return;
      const fromCal = cal?.events.filter((e) => e.teacherId === id).sort((a, b) => a.start - b.start)[0]?.start;
      setFor(id, { phase: 'done', contract: c, first: fromCal ?? firstClass(c.slots, Date.now(), tzNow.current) });
    } catch {
      if (alive.current) setFor(id, { ...st, busy: false, error: NET_ERR });
    } finally {
      inflight.current = false;
    }
  };

  if (!data) {
    if (failed) {
      return (
        <div className="smn-fail" role="alert">
          <p>No pude traer los mentores ahora mismo. Probemos de nuevo en un ratito.</p>
          <button type="button" className="smn-btn smn-btn--ghost" onClick={() => { setFailed(false); void load(); }}>Reintentar</button>
        </div>
      );
    }
    return (
      <div className="smn" role="status" aria-label="Buscando mentores">
        {[0, 1, 2].map((i) => <div key={i} className="smn-card sk"><span className="ph-a" /><span className="ph-b"><i /><i /><i /></span></div>)}
      </div>
    );
  }
  const list = data.mentors.filter((m) => mentorMatches(m, q));
  const sheetMentor = sheet ? data.mentors.find((m) => m.id === sheet.teacherId) ?? null : null;
  return (
    <>
      {note && <p className="smn-msg" role="status">{note}</p>}
      {list.length === 0 ? (
        <p className="sempty smn-empty">No encontré mentores de “{q}”.</p>
      ) : (
        <>
          <p className="smn-count">{q ? `${list.length} ${list.length === 1 ? 'mentor' : 'mentores'} para “${q}”` : `${list.length} mentores`}</p>
          <ul className="smn">
            {list.map((m) => (
              <MentorCard key={m.id} m={m} me={me} people={data.people} onHire={() => open(m)} onSchedule={(c) => openAgenda(m, c)} />
            ))}
          </ul>
        </>
      )}
      {sheet && sheetMentor && (
        <MentorSheet mentor={sheetMentor} me={me} people={data.people} taken={data.taken} state={sheet.state} tz={tz}
          onContract={(plan, who) => void contract(plan, who)} onSchedule={(slots) => void schedule(slots)} onClose={close} />
      )}
    </>
  );
}
