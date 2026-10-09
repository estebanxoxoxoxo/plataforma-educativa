import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import type { ParentAlert } from '../../../api/types';
import { useUser } from '../../../hooks/user';
import { ActivityPanel } from '../components/ActivityPanel';
import { AdultGate } from '../components/AdultGate';
import { AlertsPanel } from '../components/AlertsPanel';
import { ParentHeader } from '../components/ParentHeader';
import { ProtectionsPanel } from '../components/ProtectionsPanel';
import { lockAdult, parentCall, unlockAdult, unlockWithPin, useAdultNotice, useAdultUnlocked } from '../lib/adultGate';
import type { ParentDashboard } from '../lib/types';
import { FeaturesPanel } from './FeaturesPanel';
import { LimitsPanel } from './LimitsPanel';
import { PresetsPanel } from './PresetsPanel';
import { RewardsPanel } from './RewardsPanel';
import { TopicsPanel } from './TopicsPanel';

/** Zona de padres (/padres/*): primero el portón (PIN de la familia, lo valida el server y abre una sesión de API);
 *  pasado, la configuración de la cuenta del chico en secciones con URL propia — /padres (presets + funcionalidades),
 *  /padres/temas, /padres/limites, /padres/avisos, /padres/premios, /padres/actividad y /padres/protecciones.
 *  Estética sobria de adulto (parent.css, pz-). Si la sesión vence (401), vuelve al portón con el motivo. */
export function ParentPage() {
  const unlocked = useAdultUnlocked();
  const notice = useAdultNotice();
  const kid = useUser()?.name ?? 'tu hijo';
  const tryPin = async (pin: string) => {
    const r = await unlockWithPin(pin);
    if (r.ok) unlockAdult();
    return r;
  };
  return unlocked ? <ParentZone kid={kid} /> : <AdultGate kid={kid} notice={notice} onSubmit={tryPin} />;
}

function ParentZone({ kid }: { kid: string }) {
  const go = useNavigate();
  const { pathname } = useLocation();
  const [dash, setDash] = useState<ParentDashboard | null>(null);
  const [failed, setFailed] = useState(false);
  const [alerts, setAlerts] = useState<ParentAlert[] | null>(null);
  const [alertsFailed, setAlertsFailed] = useState(false);
  const [seenBusy, setSeenBusy] = useState<number[]>([]);
  const seq = useRef(0);
  const aseq = useRef(0);
  const view = useRef<HTMLElement>(null);

  /** El tablero del padre (actividad + canjes + premios + protecciones) en una sola lectura. Las
   *  recargas no tapan lo que ya hay; solo cuenta la respuesta de la última. */
  const load = useCallback(async () => {
    const my = ++seq.current;
    try {
      const d = (await parentCall(api.parentActivity())) as ParentDashboard;
      if (my === seq.current) { setDash(d); setFailed(false); }
    } catch {
      if (my === seq.current) setFailed(true);
    }
  }, []);
  /** Los avisos (para la sección y para el contador de la navegación). */
  const loadAlerts = useCallback(async () => {
    const my = ++aseq.current;
    try {
      const r = await parentCall(api.parentAlerts());
      if (my === aseq.current) { setAlerts(r.alerts); setAlertsFailed(false); }
    } catch {
      if (my === aseq.current) setAlertsFailed(true);
    }
  }, []);

  // Fresco en cada sección y al volver a la pestaña (el chico puede haber canjeado, guardado o escrito algo mientras
  // tanto); cada sección arranca arriba de todo.
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

  const pending = dash?.redemptions.filter((r) => r.status === 'pendiente').length ?? 0;
  const unseen = alerts?.filter((a) => !a.seen) ?? [];
  const crisis = unseen.some((a) => a.kind === 'crisis');
  const exit = () => { lockAdult(); go('/'); };

  return (
    <section className="view" id="v-parent" ref={view}>
      <div className="pz-page">
        <ParentHeader kid={kid} pending={pending} alerts={unseen.length} crisis={crisis} onExit={exit} />
        {crisis && pathname !== '/padres/avisos' && (
          <p className="pz-crisis-bar" role="alert">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.8l7.6 13.4H2.4z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M10 8v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="10" cy="14.3" r="1" fill="currentColor" /></svg>
            Hay un aviso de crisis sin ver sobre {kid}.
            <Link to="/padres/avisos" className="pz-inline">Ver avisos</Link>
          </p>
        )}
        <Routes>
          <Route index element={<><PresetsPanel kid={kid} /><FeaturesPanel kid={kid} /></>} />
          <Route path="presets" element={<Navigate to="/padres" replace />} />
          <Route path="temas" element={<TopicsPanel kid={kid} />} />
          <Route path="limites" element={<LimitsPanel kid={kid} />} />
          <Route path="avisos" element={<AlertsPanel kid={kid} alerts={alerts} failed={alertsFailed} busy={seenBusy}
            onSeen={(id) => void markSeen([id])} onSeenAll={() => void markSeen(unseen.map((a) => a.id))} onRetry={() => void loadAlerts()} />} />
          <Route path="premios" element={<RewardsPanel kid={kid} dash={dash} failed={failed} reload={load} />} />
          <Route path="actividad" element={<ActivityPanel kid={kid} dash={dash} failed={failed} onRetry={() => void load()} />} />
          <Route path="protecciones" element={<ProtectionsPanel kid={kid} dash={dash} failed={failed} onRetry={() => void load()} />} />
          <Route path="*" element={<Navigate to="/padres" replace />} />
        </Routes>
      </div>
    </section>
  );
}
