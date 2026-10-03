import type { Friend } from '../../../api/types';
import { Avatar } from '../../../shared/components/Avatar';

export const FriendProfile = ({ f }: { f: Friend }) => (
  <>
    <div className="fprof"><Avatar name={f.nick} color={f.color} /><div><h3>{f.nick}</h3><small>Amigos desde {f.since}</small></div></div>
    <div className="fstats">
      <div><b>{f.xp}</b><span>XP totales</span></div>
      <div><b>{f.streak}</b><span>Racha</span></div>
      <div><b>{f.league.replace('Liga ', '')}</b><span>Liga actual</span></div>
    </div>
    <div><span className="lbl">Cursos en común</span><div className="fchips">{f.commonCourses.map((c) => <span key={c}>{c}</span>)}</div></div>
  </>
);
