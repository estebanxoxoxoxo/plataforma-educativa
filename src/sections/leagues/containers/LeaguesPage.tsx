import { api } from '../../../api';
import { useAsync } from '../../../hooks/useAsync';
import { FullRanking } from '../components/FullRanking';
import { LeagueIcon } from '../components/LeagueIcon';
import { Ranking } from '../components/Ranking';

/** Ligas, sin solapas: la tabla de MI liga (asignada por resultados) y, debajo,
 *  las tablas por puntaje de la zona y del país. Contenedor puro: todo sale de la API. */
export function LeaguesPage() {
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
            <p className="lede">Asignada por tus resultados · Tu puesto {data.league.pos} de {data.league.total} · {data.league.xp.toLocaleString('es-AR')} XP esta semana · cierra {data.league.closes}</p>
          </div>
        </div>
        <FullRanking rows={data.standing.rows} />

        <div className="lsec"><h3>Tu zona</h3><small>{data.zona.name}</small></div>
        <Ranking r={data.zona} />

        <div className="lsec"><h3>País</h3><small>{data.pais.name}</small></div>
        <Ranking r={data.pais} />
      </>}
    </section>
  );
}
