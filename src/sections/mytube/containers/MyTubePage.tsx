import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UnderlineTabs } from '../../../shared/components/UnderlineTabs';
import { IcNavMyTube } from '../../../shared/components/icons';
import type { MtHomeState, MtTab } from '../lib/nav';
import { ChannelsPane } from './ChannelsPane';
import { ListsPane } from './ListsPane';

const TABS: { id: MtTab; label: string }[] = [
  { id: 'canales', label: 'Canales' },
  { id: 'listas', label: 'Mis listas' },
];

/** MyTube (porte EXACTO de MyTube.tsx del POC): dos solapas, Canales | Mis listas, en estado LOCAL (no en la URL) que
 *  arranca en Canales. Sin buscador ni grilla para descubrir: a un canal que no se sigue solo se llega desde el
 *  reproductor. La solapa queda anotada en el estado de esta entrada del historial, así al volver de un canal o una lista
 *  sigue donde estaba (en el POC esas vistas son overlays y MyTube nunca se desmonta). */
export function MyTubePage() {
  const go = useNavigate();
  const loc = useLocation();
  const [tab, setTab] = useState<MtTab>(() => ((loc.state as MtHomeState | null)?.tab === 'listas' ? 'listas' : 'canales'));
  const change = (t: MtTab) => {
    setTab(t);
    go(loc.pathname, { replace: true, state: { tab: t } satisfies MtHomeState });
  };
  return (
    <section className="view mt-view" id="v-mytube">
      {/* «Mis videos» (pedido de Esteban, 30-oct): es el nombre VISIBLE; la ruta /mytube, la sec y los archivos quedan. */}
      {/* Ícono + título, sin subtítulo, como el resto de las secciones (pedido de Esteban, 30-oct). */}
      <div className="mt-title">
        <span className="mt-tico" aria-hidden="true"><IcNavMyTube /></span>
        <h2 className="h2">Mis videos</h2>
      </div>
      <UnderlineTabs tabs={TABS} value={tab} onChange={change} className="mt-tabs" tabClass="mt-tab" inkClass="mt-ink" />
      {tab === 'listas' ? <ListsPane /> : <ChannelsPane />}
    </section>
  );
}
