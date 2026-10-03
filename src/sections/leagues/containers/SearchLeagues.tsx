import { useEffect, useState } from 'react';
import { api } from '../../../api';
import type { LeagueResult } from '../../../api/types';
import { IcSearch } from '../../../shared/components/icons';
import { LeagueRow } from '../cards/LeagueSearchCard';

let lastLeagueQuery = '';
export function SearchLeagues() {
  const [q, setQ] = useState(lastLeagueQuery);
  const [res, setRes] = useState<LeagueResult[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { // debounce
    lastLeagueQuery = q;
    if (!q.trim()) { setRes([]); return; }
    let alive = true;
    const t = setTimeout(() => api.searchLeagues(q).then((r) => alive && setRes(r)), 350);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const join = async (id: string) => {
    setBusy(id);
    await api.joinLeague(id);
    setRes((r) => r.map((l) => (l.id === id ? { ...l, joined: true } : l)));
    setBusy(null);
  };

  return (
    <div className="lpane">
      <form className="lsbar" onSubmit={(e) => e.preventDefault()}>
        <IcSearch strokeWidth={2.6} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscá ligas por nombre o tema" aria-label="Buscar ligas" autoFocus />
      </form>
      <div className="lres">{res.map((l) => <LeagueRow key={l.id} l={l} busy={busy === l.id} onJoin={() => join(l.id)} />)}</div>
    </div>
  );
}
