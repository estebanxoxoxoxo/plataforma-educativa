import type { FeedItem } from '../../../api/types';
import { IcArrowRight, IcTrophyLine } from '../../../shared/components/icons';
import { MEDAL_INFO, type Medal } from '../../leagues/lib/cycle';

type It = Extract<FeedItem, { kind: 'league' }>;

/* Si la noticia arranca con una medalla (cómo te fue en el cierre de la semana pasada), la medalla va como insignia
   sobre la copa, con el anillo de su color, y el texto sigue sin el emoji. */
function splitMedal(desc: string): { medal: Medal | null; text: string } {
  const hit = (Object.keys(MEDAL_INFO) as Medal[]).find((m) => desc.startsWith(MEDAL_INFO[m].emoji));
  return hit ? { medal: hit, text: desc.slice(MEDAL_INFO[hit].emoji.length).trimStart() } : { medal: null, text: desc };
}

/** Noticia de la liga ASIGNADA de la semana (las ligas no se eligen: se asignan por resultados). Cuenta el ciclo:
 *  cómo te fue en el cierre pasado y dónde competís esta semana. */
export function LeagueInviteCard({ it, onOpen }: { it: It; onOpen: () => void }) {
  const { medal, text } = splitMedal(it.desc);
  return (
    <button className="fcard fleague" data-medal={medal ?? undefined} onClick={onOpen}>
      <span className="fcup">
        <IcTrophyLine />
        {medal && <span className="fcupm" role="img" aria-label={MEDAL_INFO[medal].name}>{MEDAL_INFO[medal].emoji}</span>}
      </span>
      <span className="fbody">
        <small className="ftag tleague">Tu liga de la semana</small>
        <b className="ftitle">{it.name}</b>
        <span className="fsnip">{text}</span>
      </span>
      <span className="fgo gold">Ver mi liga<IcArrowRight /></span>
    </button>
  );
}
