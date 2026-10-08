import { useSearchParams } from 'react-router-dom';
import { UnderlineTabs } from '../../../shared/components/UnderlineTabs';
import { ChannelsPane } from '../components/ChannelsPane';
import { PlaylistsPane } from '../components/PlaylistsPane';

type VTab = 'canales' | 'listas';
const TABS: { id: VTab; label: string }[] = [
  { id: 'canales', label: 'Canales' },
  { id: 'listas', label: 'Mis listas' },
];

/** Videos (Mi espacio): adentro viven los Canales (MyTube) y Mis listas, en solapas. */
export function VideosPage() {
  const [params, setParams] = useSearchParams();
  const tab: VTab = params.get('tab') === 'listas' ? 'listas' : 'canales';
  return (
    <section className="view" id="v-space">
      <div>
        <h2 className="h2">Videos</h2>
        <p className="lede">Tus canales y tus listas de reproducción, siempre del catálogo aprobado.</p>
      </div>
      <UnderlineTabs tabs={TABS} value={tab} onChange={(t) => setParams(t === 'canales' ? {} : { tab: t })}
        className="sptabs" tabClass="sptab" inkClass="spink" />
      {tab === 'canales' ? <ChannelsPane /> : <PlaylistsPane />}
    </section>
  );
}
