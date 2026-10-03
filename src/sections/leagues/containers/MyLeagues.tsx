import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import type { MyLeague } from '../../../api/types';
import { useAsync } from '../../../hooks/useAsync';
import { LeagueCard } from '../cards/LeagueCard';

export function MyLeagues() {
  const { data } = useAsync<MyLeague[]>(() => api.myLeagues(), []);
  const go = useNavigate();
  return (
    <div className="lpane">
      <div className="lcards">{data?.map((l) => <LeagueCard key={l.id} l={l} onOpen={() => go(`/ligas/${l.id}`)} />)}</div>
    </div>
  );
}
