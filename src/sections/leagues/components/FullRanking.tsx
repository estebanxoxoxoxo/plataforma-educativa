import type { LeagueStanding } from '../../../api/types';
import { Avatar } from '../../../shared/components/Avatar';
import { MEDAL, fmt } from '../lib/format';

/** Ranking completo de una liga: todas las filas, con la propia resaltada. */
export const FullRanking = ({ rows }: { rows: LeagueStanding['rows'] }) => (
  <div className="rank full">
    {rows.map((p) => (
      <div className={`rk${p.me ? ' me' : ''}`} key={p.pos} data-me={p.me || undefined}>
        <span className="pos">{p.pos <= 3 ? <span className="md" style={{ background: MEDAL[p.pos - 1] }}>{p.pos}</span> : fmt(p.pos)}</span>
        {p.me ? <span className="av3" style={{ background: '#FFC23D', color: '#5A3D00' }}>{p.nick[0]}</span> : <Avatar name={p.nick} color={p.color} />}
        <span className="nm">{p.nick}{p.me && <span className="you">Vos</span>}</span><span className="xp">{fmt(p.xp)} XP</span>
      </div>
    ))}
  </div>
);
