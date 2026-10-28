import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useUser } from '../../../hooks/user';
import { ScheduleClosed } from '../components/ScheduleClosed';
import { useCycleGate } from '../lib/cycle';

/** Portón del CICLO DEL DÍA de las rutas del chico (tanda F2, docs/USUARIOS.md §11; antes, de los horarios por sección del
 *  porte W7: el guard de ruta de ChildShell del POC). Hermano de FeatureGate y compuesto ADENTRO de él (FeatureGate → 'on' →
 *  ScheduleGate): si el padre apagó la sección gana el apagado; si está prendida, rige el ciclo. Con la sección no
 *  disponible en el rango en curso (o en el rango que eligió el selector de demo), en lugar de la página va la pantalla
 *  "descansando" — también cuando el rango termina con la sección abierta (el tick de lib/cycle.ts) o cuando el selector de
 *  demo la cierra, sin recargar. Mientras se confirma con el server (primera carga o dato viejo al entrar) no se muestra
 *  nada. El audio de fondo que ya sonaba NO se toca (quirk fiel). El ciclo es del DEPENDIENTE (docs/USUARIOS.md §4): con
 *  un ADULTO como usuario activo la página va directo. */
export function ScheduleGate({ children }: { children: ReactNode }) {
  const adult = useUser()?.kind === 'adult';
  const { pathname } = useLocation();
  const gate = useCycleGate(pathname);
  if (adult) return <>{children}</>;
  if (gate.state === 'loading') return null;
  if (gate.state === 'closed') return <ScheduleClosed opensAt={gate.opensAt} />;
  return <>{children}</>;
}
