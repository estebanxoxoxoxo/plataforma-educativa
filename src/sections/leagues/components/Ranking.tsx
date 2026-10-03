import type { GeoRanking } from '../../../api/types';
import { Avatar } from '../../../shared/components/Avatar';
import { MEDAL, fmt } from '../lib/format';

export const Ranking = ({ r, loading }: { r: GeoRanking; loading?: boolean }) => (
  <div className={`rank${loading ? ' loading' : ''}`}>
    {r.top.map((p, i) => (
      <div className="rk" key={i}>
        <span className="pos">{i < 3 ? <span className="md" style={{ background: MEDAL[i] }}>{i + 1}</span> : i + 1}</span>
        <Avatar name={p.nick} color={p.color} /><span className="nm">{p.nick}</span><span className="xp">{fmt(p.xp)} XP</span>
      </div>
    ))}
    <div className="rkgap">···</div>
    <div className="rk me">
      <span className="pos">{fmt(r.me.pos)}</span>
      <span className="av3" style={{ background: '#FFC23D', color: '#5A3D00' }}>{r.me.nick[0]}</span>
      <span className="nm">{r.me.nick}<span className="you">Vos</span></span><span className="xp">{fmt(r.me.xp)} XP</span>
    </div>
  </div>
);
