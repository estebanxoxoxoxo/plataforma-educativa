import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from '../../../api';
import type { FamilyMember, ParentAlert } from '../../../api/types';
import { useUser } from '../../../hooks/user';
import { ActivityPanel } from '../components/ActivityPanel';
import { AlertsPanel } from '../components/AlertsPanel';
import { PanelState } from '../components/PanelState';
import { ParentHeader } from '../components/ParentHeader';
import { ProtectionsPanel } from '../components/ProtectionsPanel';
import { parentCall } from '../lib/adultGate';
import { listEs } from '../lib/format';
import { famTo, familyNoteFor, useFamilyMembers, useSelectedMember } from '../lib/member';
import type { ParentDashboard } from '../lib/types';
import { CyclePanel } from './CyclePanel';
import { FamilyAfterDayPanel } from './FamilyAfterDayPanel';
import { FamilyChannelPanel } from './FamilyChannelPanel';
import { FamilyMyTubePanel } from './FamilyMyTubePanel';
import { FeaturesPanel } from './FeaturesPanel';
import { LimitsPanel } from './LimitsPanel';
import { MentorshipsPanel } from './MentorshipsPanel';
import { PresetsPanel } from './PresetsPanel';
import { RewardsPanel } from './RewardsPanel';
import { TimezoneControl } from './TimezoneControl';
import { TopicsPanel } from './TopicsPanel';

/** Familia (/familia/*; la ex Zona de padres, /padres/* redirige acá): el punto de menú del ADULTO, abajo de todo
 *  (docs/USUARIOS.md §5). SIN portón: la sesión es la del usuario activo (el server la da por buena si es un adulto). La
 *  configuración de CADA integrante de su familia (U3 · M2, §9: el selector de la cabecera, `?m=<id>` en la URL) en
 *  secciones con URL propia (orden de la tanda F2, 28-oct) — /familia (presets + funcionalidades), /familia/temas,
 *  /familia/mytube (ex «YouTube», porte W5: la grilla de canales del chico + agregar por URL; un canal en
 *  /familia/mytube/canal/:id; /familia/youtube redirige — DE TODA LA FAMILIA), /familia/afterday (porte W6, solapa propia:
 *  la grilla del chico + agregar/quitar — DE TODA LA FAMILIA), /familia/limites (topes de volumen + la zona horaria, que es
 *  de la familia), /familia/ciclo (Ciclo del día: rangos horarios y qué secciones hay en cada uno — reemplazó a los horarios
 *  por sección; docs/USUARIOS.md §11), /familia/avisos, /familia/premios, /familia/mentorias (tanda U2: lo contratado en
 *  Buscar → Mentores, para el adulto y sus dependientes — DE TODA LA FAMILIA; /familia/profesores redirige acá),
 *  /familia/actividad y /familia/protecciones.
 *  Con un CHICO como usuario activo la ruta no existe: navega al Feed (y el server igual responde 401).
 *  Estética sobria de adulto (parent.css, pz-). */
export function ParentPage() {
  const user = useUser();
  const adult = user?.kind === 'adult';
  // Los integrantes = los dependientes del adulto (GET /api/users, una vez). Hasta saberlos no se pinta nada (sin un
  // "Cuenta de tu hijo" que después cambia).
  const { members, failed, retry } = useFamilyMembers(adult ? user?.id : undefined);
  if (!user) return null;
  if (!adult) return <Navigate to="/" replace />;
  if (!members) {
    return failed ? (
      <section className="view" id="v-parent">
        <div className="pz-page">
          <FamilyHeadOnly />
          <PanelState failed onRetry={retry} />
        </div>
      </section>
    ) : null;
  }
  if (!members.length) {
    return (
      <section className="view" id="v-parent">
        <div className="pz-page">
          <FamilyHeadOnly />
          <section className="pz-panel"><p className="pz-muted">Todavía no hay integrantes en tu familia para configurar.</p></section>
        </div>
      </section>
    );
  }
  return <ParentZone members={members} />;
}

/** La cabecera mínima mientras no hay a quién configurar (lectura fallida o adulto sin dependientes). */
function FamilyHeadOnly() {
  return (
    <header className="pz-head">
      <div className="pz-head-id">
        <p className="pz-kicker">Familia</p>
        <h2 className="pz-title">Familia</h2>
      </div>
    </header>
  );
}

function ParentZone({ members }: { members: FamilyMember[] }) {
  const { pathname } = useLocation();
  const [member, pick] = useSelectedMember(members);
  const mid = member.id;
  // El tablero del integrante (actividad + canjes + premios + protecciones). Va etiquetado con su integrante: al cambiar de
  // integrante no se muestra un instante el del otro.
  const [dash, setDash] = useState<{ of: string; d: ParentDashboard } | null>(null);
  const [failed, setFailed] = useState(false);
  const [alerts, setAlerts] = useState<ParentAlert[] | null>(null);
  const [alertsFailed, setAlertsFailed] = useState(false);
  const [seenBusy, setSeenBusy] = useState<number[]>([]);
  const seq = useRef(0);
  const aseq = useRef(0);
  const view = useRef<HTMLElement>(null);

  /** El tablero del integrante elegido en una sola lectura. Las recargas no tapan lo que ya hay; solo cuenta la respuesta
   *  de la última (también si en el medio se eligió a otro integrante). */
  const load = useCallback(async () => {
    const my = ++seq.current;
    try {
      const d = (await parentCall(api.parentActivity(mid))) as ParentDashboard;
      if (my === seq.current) { setDash({ of: mid, d }); setFailed(false); }
    } catch {
      if (my === seq.current) setFailed(true);
    }
  }, [mid]);
  /** Los avisos de TODA la familia (una lectura, sin member): de ahí salen el panel, los contadores y la barra de crisis. */
  const loadAlerts = useCallback(async () => {
    const my = ++aseq.current;
    try {
      const r = await parentCall(api.parentAlerts());
      if (my === aseq.current) { setAlerts(r.alerts); setAlertsFailed(false); }
    } catch {
      if (my === aseq.current) setAlertsFailed(true);
    }
  }, []);

  // Fresco en cada sección, al cambiar de integrante y al volver a la pestaña (un chico puede haber canjeado, guardado o
  // escrito algo mientras tanto); cada sección arranca arriba de todo.
  useEffect(() => { void load(); void loadAlerts(); }, [load, loadAlerts, pathname]);
  useEffect(() => { view.current?.scrollTo({ top: 0 }); }, [pathname]);
  useEffect(() => {
    const wake = () => { if (document.visibilityState === 'visible') { void load(); void loadAlerts(); } };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => { window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake); };
  }, [load, loadAlerts]);

  const markSeen = async (ids: number[]) => {
    if (!ids.length) return;
    setSeenBusy((b) => [...b, ...ids]);
    try {
      await Promise.all(ids.map((id) => parentCall(api.parentAlertSeen(id))));
    } catch { /* lo que no se pudo marcar sigue como nuevo: la relectura lo muestra */ }
    await loadAlerts();
    setSeenBusy((b) => b.filter((x) => !ids.includes(x)));
  };

  const d = dash?.of === mid ? dash.d : null;
  const pending = d?.redemptions.filter((r) => r.status === 'pendiente').length ?? 0;
  const unseen = useMemo(() => alerts?.filter((a) => !a.seen) ?? [], [alerts]);
  const unseenBy = useMemo(() => {
    const by: Record<string, number> = {};
    for (const a of unseen) if (a.childId) by[a.childId] = (by[a.childId] ?? 0) + 1;
    return by;
  }, [unseen]);
  // La barra de crisis es de TODA la familia: nombra a cada chico con una crisis sin ver, aunque se esté mirando a otro.
  const crisisKids = members.filter((m) => unseen.some((a) => a.kind === 'crisis' && a.childId === m.id));
  const crisis = unseen.some((a) => a.kind === 'crisis');
  const crisisNames = crisisKids.length ? listEs(crisisKids.map((m) => m.name)) : 'tu familia';
  const crisisTo = famTo('/familia/avisos', crisisKids[0]?.id ?? mid);
  const note = familyNoteFor(pathname);
  const home = famTo('/familia', mid);

  return (
    <section className="view" id="v-parent" ref={view}>
      <div className="pz-page">
        <ParentHeader member={member} members={members} note={note} onPick={pick} unseenBy={unseenBy} pending={pending} alerts={unseen.length} crisis={crisis} />
        {crisis && pathname !== '/familia/avisos' && (
          <p className="pz-crisis-bar" role="alert">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.8l7.6 13.4H2.4z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M10 8v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="10" cy="14.3" r="1" fill="currentColor" /></svg>
            Hay un aviso de crisis sin ver sobre {crisisNames}.
            <Link to={crisisTo} className="pz-inline">Ver avisos</Link>
          </p>
        )}
        {/* key = el integrante: cambiarlo REMONTA los paneles (obligatorio: LimitsPanel guarda al desmontar los topes que
            quedaron a medio guardar —con el integrante de ESE montaje—, y los borradores del Ciclo del día y de Premios
            arrancan de cero; sin remontar, lo pendiente de un integrante iría al otro). */}
        <Routes key={mid}>
          <Route index element={<><PresetsPanel kid={member.name} member={mid} /><FeaturesPanel kid={member.name} member={mid} /></>} />
          <Route path="presets" element={<Navigate to={home} replace />} />
          <Route path="temas" element={<TopicsPanel kid={member.name} member={mid} />} />
          {/* MyTube y After Day (F2): de TODA la familia, cada una con su solapa; la ruta vieja de YouTube redirige a MyTube.
              Límites = topes de volumen (del integrante) + la zona horaria (de la familia). Ciclo del día, del integrante. */}
          <Route path="mytube" element={<FamilyMyTubePanel member={mid} />} />
          <Route path="mytube/canal/:id" element={<FamilyChannelPanel member={mid} />} />
          <Route path="youtube/*" element={<Navigate to={famTo('/familia/mytube', mid)} replace />} />
          <Route path="afterday" element={<FamilyAfterDayPanel />} />
          <Route path="limites" element={<><LimitsPanel kid={member.name} member={mid} /><section className="pz-panel pz-panel--tz"><TimezoneControl member={mid} /></section></>} />
          <Route path="ciclo" element={<CyclePanel kid={member.name} member={mid} />} />
          <Route path="avisos" element={<AlertsPanel member={member} members={members} alerts={alerts} failed={alertsFailed} busy={seenBusy}
            onSeen={(id) => void markSeen([id])} onSeenAll={(ids) => void markSeen(ids)} onRetry={() => void loadAlerts()} />} />
          <Route path="premios" element={<RewardsPanel kid={member.name} member={mid} dash={d} failed={failed} reload={load} />} />
          {/* Mentorías (U2): administra lo contratado en Buscar → Mentores (de toda la familia); la ruta vieja de Profesores redirige acá */}
          <Route path="mentorias" element={<MentorshipsPanel />} />
          <Route path="profesores" element={<Navigate to={famTo('/familia/mentorias', mid)} replace />} />
          <Route path="actividad" element={<ActivityPanel kid={member.name} dash={d} failed={failed} onRetry={() => void load()} />} />
          <Route path="protecciones" element={<ProtectionsPanel kid={member.name} member={mid} dash={d} failed={failed} onRetry={() => void load()} />} />
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </div>
    </section>
  );
}
