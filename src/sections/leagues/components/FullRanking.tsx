import type { LeagueStanding } from '../../../api/types';
import { Avatar, lookFor } from '../../../shared/components/Avatar';
import { MyAvatar } from '../../../shared/components/ProfileCard';
import { MEDAL, fmt } from '../lib/format';

/** Ranking completo de una liga: todas las filas, con la propia resaltada. */
export const FullRanking = ({ rows }: { rows: LeagueStanding['rows'] }) => (
  <div className="rank full">
    {rows.map((p) => (
      <div className={`rk${p.me ? ' me' : ''}`} key={p.pos} data-me={p.me || undefined}>
        <span className="pos">{p.pos <= 3 ? <span className="md" style={{ background: MEDAL[p.pos - 1] }}>{p.pos}</span> : fmt(p.pos)}</span>
        {p.me ? <MyAvatar name={p.nick} /> : <Avatar name={p.nick} color={p.color} look={lookFor(p.nick)} />}
        <span className="nm">{p.nick}{p.me && <span className="you">Vos</span>}</span><span className="xp">{fmt(p.xp)} XP</span>
      </div>
    ))}
  </div>
);
