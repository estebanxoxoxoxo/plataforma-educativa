import type { MyLeague } from '../../../api/types';
import { LeagueIcon } from '../components/LeagueIcon';

export const LeagueCard = ({ l, onOpen }: { l: MyLeague; onOpen: () => void }) => (
  <button className="lcard" onClick={onOpen}>
    <LeagueIcon color={l.color} />
    <div className="grow"><b>{l.name}</b></div>
    <div className="lpos">Tu puesto<br /><b>{l.pos}</b>/{l.total}</div>
  </button>
);
