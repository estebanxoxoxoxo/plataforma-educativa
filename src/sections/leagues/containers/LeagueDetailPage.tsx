import { useLayoutEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import { useAsync } from '../../../hooks/useAsync';
import { FullRanking } from '../components/FullRanking';
import { LeagueIcon } from '../components/LeagueIcon';

export function LeagueDetailPage() {
  const { id = '' } = useParams();
  const go = useNavigate();
  const { data, error } = useAsync(() => api.leagueStanding(id), [id]);
  const box = useRef<HTMLDivElement>(null);
  // abre centrado en mi puesto
  useLayoutEffect(() => {
    const me = box.current?.querySelector<HTMLElement>('[data-me]');
    const view = box.current?.closest<HTMLElement>('.view');
    if (me && view) view.scrollTop = me.offsetTop - view.clientHeight / 2;
  }, [data]);
  return (
    <section className="view" id="v-league">
      <button className="back" onClick={() => go('/ligas')} style={{ color: '#8A5A00' }}>‹ Ligas</button>
      {error && <p className="lempty">{error.message}</p>}
      {data && <>
        <div className="lhead">
          <LeagueIcon color={data.league.color} />
          <div><h2 className="h2">{data.league.name}</h2><p className="lede">{data.league.total} chicos · Tu puesto {data.league.pos}/{data.league.total}</p></div>
        </div>
        <div ref={box}><FullRanking rows={data.rows} /></div>
      </>}
    </section>
  );
}
