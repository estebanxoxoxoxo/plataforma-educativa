import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api';
import type { MentorContract, MentorsResponse, Teacher } from '../../../api/types';
import { useUser } from '../../../hooks/user';
import { calendarOf, forWho, usd, weeklyPrice } from '../../../shared/lib/mentors';
import { MentorshipRow } from '../cards/MentorshipRow';
import { PanelState } from '../components/PanelState';
import { parentCall, rejectedReason } from '../lib/adultGate';

const NET_ERR = 'No se pudo completar. Revisá la conexión y probá de nuevo.';

/** "Mentorías" (tanda U2, docs/USUARIOS.md §5; la ex pantalla Profesores): YA NO es el marketplace — los mentores se buscan
 *  y se contratan en Buscar → Mentores. Acá el adulto administra lo contratado, para él y para sus dependientes: una fila
 *  por CONTRATO (mentor, materia, para quién, plan con su precio semanal, los días o "Falta elegir los días" →
 *  "Elegir los días" abre la agenda en Buscar) y "Cancelar" con confirmación. Arriba, cuántas mentorías y el total
 *  semanal, y "Buscar mentores". Nada optimista: después de cancelar se relee (lo que se ve es lo que guardó el server).
 *  Va con la sesión del adulto activo (parentCall; un chico recibe 401). */
export function MentorshipsPanel() {
  const me = useUser()?.id ?? '';
  const [data, setData] = useState<MentorsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const alive = useRef(true);
  const seq = useRef(0);
  const inflight = useRef(false);
  const head = useRef<HTMLHeadingElement>(null);

  /** Relee los mentores con los contratos de la familia. Solo cuenta la respuesta de la última lectura. */
  const load = useCallback(async () => {
    const my = ++seq.current;
    try {
      const r = await parentCall(api.mentors());
      if (alive.current && my === seq.current) { setData(r); setFailed(false); }
    } catch {
      if (alive.current && my === seq.current) setFailed(true);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    // Fresco al volver a la pestaña (en Buscar —acá o en otra pestaña— se pudo contratar, agendar o cancelar).
    const wake = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      alive.current = false;
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [load]);
  // Los avisos de éxito se van solos.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice((n) => (n === notice ? null : n)), 7000);
    return () => clearTimeout(t);
  }, [notice]);

  const clearError = (id: number) => setErrors((e) => { if (!(id in e)) return e; const n = { ...e }; delete n[id]; return n; });
  const askCancel = (c: MentorContract) => { setConfirming(c.id); setNotice(null); clearError(c.id); };
  const cancel = async (m: Teacher, c: MentorContract) => {
    if (busy !== null || inflight.current) return;
    inflight.current = true;
    setBusy(c.id);
    try {
      const r = await parentCall(api.mentorCancel(c.id));
      await load();
      if (!alive.current) return;
      if (r.ok) {
        const people = data?.people ?? {};
        setNotice(c.status === 'active'
          ? `Listo: se cancelaron las clases de ${m.subject} con ${m.name} ${forWho(c.beneficiary, me, people)}. Ya no están en ${calendarOf(c.beneficiary, me, people)}.`
          : `Listo: se canceló ${m.subject} con ${m.name} ${forWho(c.beneficiary, me, people)}.`);
        // La fila ya no está: el foco va al título del panel (el aviso se anuncia solo).
        requestAnimationFrame(() => head.current?.focus());
      } else {
        setErrors((e) => ({ ...e, [c.id]: r.error ?? 'Esa contratación ya no estaba (puede que se haya cancelado desde otra pestaña).' }));
      }
    } catch (err) {
      if (alive.current) setErrors((e) => ({ ...e, [c.id]: rejectedReason(err) ?? NET_ERR }));
    } finally {
      inflight.current = false;
      if (alive.current) { setBusy(null); setConfirming(null); }
    }
  };

  // Una fila por contrato: primero los que esperan sus días (hay algo que hacer), después el resto; en el orden del catálogo.
  const rows = (data?.mentors ?? []).flatMap((m) => m.contracts.map((c) => ({ m, c })))
    .sort((a, b) => Number(b.c.status === 'pending') - Number(a.c.status === 'pending'));
  const weekly = rows.reduce((n, { m, c }) => n + weeklyPrice(m.pricePerHour, c.daysPerWeek), 0);

  return (
    <section className="pz-panel" aria-labelledby="pz-ms-h">
      <header className="pz-panel-head pz-panel-head--act">
        <div>
          <h3 id="pz-ms-h" ref={head} tabIndex={-1}>Mentorías</h3>
          <p>Las clases particulares que contrataste en Buscar → Mentores, para vos o para tu familia. Cada clase aparece en el calendario de quien la toma.</p>
        </div>
        <Link className="pz-btn" to="/buscar?tab=mentors">Buscar mentores</Link>
      </header>
      <p className={`pz-notice${notice ? '' : ' is-empty'}`} role="status">{notice}</p>
      {!data ? <PanelState failed={failed} onRetry={() => void load()} /> : rows.length === 0 ? (
        <p className="pz-ms-empty">Todavía no hay mentorías. Buscá mentores en Buscar → Mentores.</p>
      ) : (
        <>
          <p className="pz-ms-sum">
            <b>{rows.length}</b> {rows.length === 1 ? 'mentoría' : 'mentorías'} · <b>{usd(weekly)}</b> por semana
          </p>
          <ul className="pz-ms-list">
            {rows.map(({ m, c }) => (
              <MentorshipRow key={c.id} m={m} c={c} me={me} people={data.people} confirming={confirming === c.id} busy={busy === c.id}
                error={errors[c.id] ?? null} onAskCancel={() => askCancel(c)} onConfirmCancel={() => void cancel(m, c)} onKeep={() => setConfirming(null)} />
            ))}
          </ul>
        </>
      )}
      <p className="pz-foot">En esta demo el mentor confirma al instante y no se cobra nada: los mensajes con el mentor y el pago todavía no están.</p>
    </section>
  );
}
