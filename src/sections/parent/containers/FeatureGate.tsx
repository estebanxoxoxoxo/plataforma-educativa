import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { FeatureOff } from '../components/FeatureOff';
import { refreshFeatures, useFeatureGate } from '../lib/features';
import { ScheduleGate } from './ScheduleGate';

/** Portón de rutas de la cuenta del chico (envuelve el <Outlet/> del Layout): si la ruta pertenece a una
 *  funcionalidad que el padre apagó (/tienda, /ligas, /chat y sus subrutas; /amigos ya no es sección: redirige al Feed), en lugar de la
 *  página va "Esta parte está apagada por tu familia." Fail-closed: mientras no se sabe, no se muestra.
 *  Prendida (o sin on-off) → pasa por el portón de HORARIO (ScheduleGate, W7): capas independientes, el apagado gana. */
export function FeatureGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const state = useFeatureGate(pathname);
  if (state === 'on') return <ScheduleGate>{children}</ScheduleGate>;
  if (state === 'loading') return null;
  if (state === 'error') return <FeatureOff error onRetry={() => void refreshFeatures()} />;
  return <FeatureOff />;
}
