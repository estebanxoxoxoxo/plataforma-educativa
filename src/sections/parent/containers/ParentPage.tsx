import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import { useUser } from '../../../hooks/user';
import { ActivityPanel } from '../components/ActivityPanel';
import { AdultGate } from '../components/AdultGate';
import { ParentHeader } from '../components/ParentHeader';
import { ProtectionsPanel } from '../components/ProtectionsPanel';
import { lockAdult, unlockAdult, unlockWithPin, useAdultUnlocked } from '../lib/adultGate';
import type { ParentDashboard } from '../lib/types';
import { FeaturesPanel } from './FeaturesPanel';
import { RewardsPanel } from './RewardsPanel';

/** Zona de padres (/padres/*): primero el portón (PIN de la familia, lo valida el server); pasado, la
 *  configuración de la cuenta del chico en cuatro secciones con URL propia — /padres (Funcionalidades),
 *  /padres/premios, /padres/actividad y /padres/protecciones. Estética sobria de adulto (parent.css, pz-). */
export function ParentPage() {
  const unlocked = useAdultUnlocked();
  const kid = useUser()?.name ?? 'tu hijo';
  const tryPin = async (pin: string) => {
    const r = await unlockWithPin(pin);
    if (r.ok) unlockAdult();
    return r;
  };
  return unlocked ? <ParentZone kid={kid} /> : <AdultGate kid={kid} onSubmit={tryPin} />;
}

function ParentZone({ kid }: { kid: string }) {
  const go = useNavigate();
  const { pathname } = useLocation();
  const [dash, setDash] = useState<ParentDashboard | null>(null);
  const [failed, setFailed] = useState(false);
  const seq = useRef(0);
  const view = useRef<HTMLElement>(null);

  /** El tablero del padre (actividad + canjes + premios + protecciones) en una sola lectura. Las
   *  recargas no tapan lo que ya hay; solo cuenta la respuesta de la última. */
  const load = useCallback(async () => {
    const my = ++seq.current;
    try {
      const d = (await api.parentActivity()) as ParentDashboard;
      if (my === seq.current) { setDash(d); setFailed(false); }
    } catch {
      if (my === seq.current) setFailed(true);
    }
  }, []);

  // Fresco en cada sección y al volver a la pestaña (el chico puede haber canjeado o guardado algo
  // mientras tanto); cada sección arranca arriba de todo.
  useEffect(() => { void load(); }, [load, pathname]);
  useEffect(() => { view.current?.scrollTo({ top: 0 }); }, [pathname]);
  useEffect(() => {
    const wake = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => { window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake); };
  }, [load]);

  const pending = dash?.redemptions.filter((r) => r.status === 'pendiente').length ?? 0;
  const exit = () => { lockAdult(); go('/'); };

  return (
    <section className="view" id="v-parent" ref={view}>
      <div className="pz-page">
        <ParentHeader kid={kid} pending={pending} onExit={exit} />
        <Routes>
          <Route index element={<FeaturesPanel kid={kid} />} />
          <Route path="premios" element={<RewardsPanel kid={kid} dash={dash} failed={failed} reload={load} />} />
          <Route path="actividad" element={<ActivityPanel kid={kid} dash={dash} failed={failed} onRetry={() => void load()} />} />
          <Route path="protecciones" element={<ProtectionsPanel kid={kid} dash={dash} failed={failed} onRetry={() => void load()} />} />
          <Route path="*" element={<Navigate to="/padres" replace />} />
        </Routes>
      </div>
    </section>
  );
}
