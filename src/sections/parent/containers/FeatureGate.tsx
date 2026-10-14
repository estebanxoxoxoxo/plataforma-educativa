import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useUser } from '../../../hooks/user';
import { FeatureOff } from '../components/FeatureOff';
import { refreshFeatures, useFeatureGate } from '../lib/features';
import { ScheduleGate } from './ScheduleGate';

/** Portón de rutas de la cuenta del chico (envuelve el <Outlet/> del Layout): si la ruta pertenece a una
 *  funcionalidad que el padre apagó (/tienda, /ligas, /chat y sus subrutas; /amigos ya no es sección: redirige al Feed), en lugar de la
 *  página va "Esta parte está apagada por tu familia." Fail-closed: mientras no se sabe, no se muestra.
 *  Prendida (o sin on-off) → pasa por el portón de HORARIO (ScheduleGate, W7): capas independientes, el apagado gana.
 *  Los candados son del DEPENDIENTE (docs/USUARIOS.md §4): con un ADULTO como usuario activo no hay portón —ni de on-off ni
 *  de horario— y la página va directo (el server tampoco le responde 403). */
export function FeatureGate({ children }: { children: ReactNode }) {
  const adult = useUser()?.kind === 'adult';
  const { pathname } = useLocation();
  const state = useFeatureGate(pathname);
  if (adult) return <>{children}</>;
  if (state === 'on') return <ScheduleGate>{children}</ScheduleGate>;
  if (state === 'loading') return null;
  if (state === 'error') return <FeatureOff error onRetry={() => void refreshFeatures()} />;
  return <FeatureOff />;
}
