import { useSearchParams } from 'react-router-dom';
import { api } from '../../../api';
import { useAsync } from '../../../hooks/useAsync';
import { UnderlineTabs } from '../../../shared/components/UnderlineTabs';
import { FullRanking } from '../components/FullRanking';
import { LeagueCycle } from '../components/LeagueCycle';
import { LeagueIcon } from '../components/LeagueIcon';
import { LeaguePanel } from '../components/LeaguePanel';
import { Ranking } from '../components/Ranking';
import { useFontReady } from '../lib/useFontReady';

type LTab = 'liga' | 'zona' | 'pais';
const TABS: { id: LTab; label: string }[] = [
  { id: 'liga', label: 'Mi liga' },
  { id: 'zona', label: 'Tu zona' },
  { id: 'pais', label: 'País' },
];

/** Ligas: el hero de MI liga (asignada por resultados, con su ciclo semanal: cierre + medalla de la semana pasada)
 *  siempre visible y, debajo, tres solapas deep-linkeables (?tab=, patrón de /espacio/videos): Mi liga (default,
 *  sin parámetro) · Tu zona · País, cada una con SOLO su tabla. Contenedor puro: todo sale de la API. */
export function LeaguesPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('tab');
  const tab: LTab = q === 'zona' || q === 'pais' ? q : 'liga';
  const fontReady = useFontReady('800 14.5px Nunito', TABS.map((t) => t.label).join(' '));
  const { data, error } = useAsync(async () => {
    const league = await api.myLeague();
    const [standing, zona, pais] = await Promise.all([
      api.leagueStanding(league.id),
      api.geoRanking('zona'),
      api.geoRanking('pais'),
    ]);
    return { league, standing, zona, pais };
  }, []);

  return (
    <section className="view" id="v-leagues">
      <h2 className="h2">Ligas</h2>
      <p className="lede">Tu liga se asigna según tus resultados. Con tu puntaje también tenés un puesto en tu zona y en el país.</p>
      {error && <p className="lempty">No pude cargar las ligas ahora. Probemos de nuevo en un ratito.</p>}
      {data && <>
        <div className="lhead">
          <LeagueIcon color={data.league.color} />
          <div>
            <h3 className="ltitle">{data.league.name}</h3>
            <p className="lede">Asignada por tus resultados · Tu puesto {data.league.pos} de {data.league.total} · {data.league.xp.toLocaleString('es-AR')} XP esta semana{data.league.closesInDays === undefined && ` · cierra ${data.league.closes}`}</p>
            <LeagueCycle league={data.league} />
          </div>
        </div>
        <UnderlineTabs key={fontReady ? 'font' : 'fallback'} tabs={TABS} value={tab} onChange={(t) => setParams(t === 'liga' ? {} : { tab: t })}
          className="ltabs" tabClass="ltab" inkClass="ltink" />
        <div className="lpanels">
          <LeaguePanel on={tab === 'liga'} label="Mi liga" caption={`${data.league.name} · ${data.league.total} chicos`}>
            <FullRanking rows={data.standing.rows} />
          </LeaguePanel>
          <LeaguePanel on={tab === 'zona'} label="Tu zona" caption={data.zona.name}><Ranking r={data.zona} /></LeaguePanel>
          <LeaguePanel on={tab === 'pais'} label="País" caption={data.pais.name}><Ranking r={data.pais} /></LeaguePanel>
        </div>
      </>}
    </section>
  );
}
