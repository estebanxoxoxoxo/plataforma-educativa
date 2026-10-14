import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useUser } from '../../../hooks/user';
import { ScheduleClosed } from '../components/ScheduleClosed';
import { useScheduleGate } from '../lib/schedules';

/** Portón de HORARIO de las rutas del chico (porte Smarty W7: el guard de ruta de ChildShell del POC). Hermano de
 *  FeatureGate y compuesto ADENTRO de él (FeatureGate → 'on' → ScheduleGate): si el padre apagó la sección gana el
 *  apagado; si está prendida, rige su franja. Fuera de horario, en lugar de la página va la pantalla "cerrado" — también
 *  cuando la ventana se cierra con la sección abierta (el tick de lib/schedules.ts). Mientras se confirma con el server
 *  (primera carga o dato viejo al entrar) no se muestra nada. El audio de fondo que ya sonaba NO se toca (quirk fiel).
 *  Los horarios son del DEPENDIENTE (docs/USUARIOS.md §4): con un ADULTO como usuario activo la página va directo. */
export function ScheduleGate({ children }: { children: ReactNode }) {
  const adult = useUser()?.kind === 'adult';
  const { pathname } = useLocation();
  const gate = useScheduleGate(pathname);
  if (adult) return <>{children}</>;
  if (gate.state === 'loading') return null;
  if (gate.state === 'closed') return <ScheduleClosed opensAt={gate.opensAt} />;
  return <>{children}</>;
}
