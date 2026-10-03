import { useState } from 'react';
import { UnderlineTabs } from '../../../shared/components/UnderlineTabs';
import { GeoLeagues } from './GeoLeagues';
import { MyLeagues } from './MyLeagues';
import { SearchLeagues } from './SearchLeagues';

type LTab = 'search' | 'geo' | 'mine';
const LTABS: { id: LTab; label: string }[] = [{ id: 'search', label: 'Buscar ligas' }, { id: 'geo', label: 'Por geografía' }, { id: 'mine', label: 'Mis ligas' }];
export function LeaguesPage() {
  const [tab, setTab] = useState<LTab>('mine');
  return (
    <section className="view" id="v-leagues">
      <h2 className="h2">Ligas</h2><p className="lede">Competí sumando XP con lo que practicás.</p>
      <UnderlineTabs tabs={LTABS} value={tab} onChange={setTab} className="ltabs" tabClass="ltab" inkClass="link" />
      <div className="lbody">
        {tab === 'search' && <SearchLeagues />}
        {tab === 'geo' && <GeoLeagues />}
        {tab === 'mine' && <MyLeagues />}
      </div>
    </section>
  );
}
