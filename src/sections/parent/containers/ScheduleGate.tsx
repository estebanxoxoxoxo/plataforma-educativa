import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ScheduleClosed } from '../components/ScheduleClosed';
import { useScheduleGate } from '../lib/schedules';

/** Portón de HORARIO de las rutas del chico (porte Smarty W7: el guard de ruta de ChildShell del POC). Hermano de
 *  FeatureGate y compuesto ADENTRO de él (FeatureGate → 'on' → ScheduleGate): si el padre apagó la sección gana el
 *  apagado; si está prendida, rige su franja. Fuera de horario, en lugar de la página va la pantalla "cerrado" — también
 *  cuando la ventana se cierra con la sección abierta (el tick de lib/schedules.ts). Mientras se confirma con el server
 *  (primera carga o dato viejo al entrar) no se muestra nada. El audio de fondo que ya sonaba NO se toca (quirk fiel). */
export function ScheduleGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const gate = useScheduleGate(pathname);
  if (gate.state === 'loading') return null;
  if (gate.state === 'closed') return <ScheduleClosed opensAt={gate.opensAt} />;
  return <>{children}</>;
}
