import type { FeedItem } from '../../../api/types';
import { IcArrowRight, IcTrophyLine } from '../../../shared/components/icons';

type It = Extract<FeedItem, { kind: 'league' }>;

/** Noticia de la liga ASIGNADA de la semana (las ligas no se eligen: se asignan por resultados). */
export const LeagueInviteCard = ({ it, onOpen }: { it: It; onOpen: () => void }) => (
  <button className="fcard fleague" onClick={onOpen}>
    <span className="fcup"><IcTrophyLine /></span>
    <span className="fbody">
      <small className="ftag tleague">Tu liga de la semana</small>
      <b className="ftitle">{it.name}</b>
      <span className="fsnip">{it.desc}</span>
    </span>
    <span className="fgo gold">Ver mi liga<IcArrowRight /></span>
  </button>
);
