import type { LeagueResult } from '../../../api/types';
import { LeagueIcon } from '../components/LeagueIcon';

export const LeagueRow = ({ l, busy, onJoin }: { l: LeagueResult; busy?: boolean; onJoin: () => void }) => (
  <div className="lr">
    <LeagueIcon color={l.color} />
    <div className="grow"><b>{l.name}</b><small>{l.desc}</small></div>
    <button className={`jbtn${l.joined ? ' done' : ''}`} disabled={l.joined || busy} onClick={onJoin}>{l.joined ? '✓ Te uniste' : busy ? 'Uniéndote…' : 'Unirme'}</button>
  </div>
);
