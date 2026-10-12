import { Avatar, lookFor } from '../../../shared/components/Avatar';
import { MyAvatar } from '../../../shared/components/ProfileCard';
import { IcTrophyLine } from '../../../shared/components/icons';
import { MEDAL_INFO } from '../../leagues/lib/cycle';
import { LessButton, WhyChip } from '../components/FeedBits';
import { IcUsersLine } from '../components/feedIcons';
import { ReactionBar } from '../components/ReactionBar';
import { newsFace, type NewsItem } from '../lib/news';

/** NOTICIA que atraviesa el hilo (estilo C del mock v6): lo de las ligas — la tarjeta de la liga de la semana y las
 *  medallas/ascensos/carrera, propias y de los amigos. Fondo con el tinte de la sección (o el de la medalla) al blanco,
 *  emoji grande, título en serif. DESVÍO DECIDIDO: lleva el avatar de quien la protagoniza (nuestra identidad 80/20) y las
 *  reacciones de emoji. `mine` = la medalla del propio chico (la ven sus amigos en su feed). `fresh` = recién entrada por
 *  la píldora (con un anillo suave). Pura. */
export function FeedNewsCard({ it, mine, fresh, onReact, onLeague, onLess }: {
  it: NewsItem; mine?: boolean; fresh?: boolean;
  onReact: (id: string, emoji: string) => void; onLeague: () => void; onLess: () => void;
}) {
  const friend = it.kind === 'friend' ? it : null;
  const league = it.kind === 'league' ? it : null;
  const face = friend ? newsFace(friend.text) : newsFace(league?.desc ?? '', true);
  const kicker = friend ? (mine ? 'Tu medalla' : 'Noticia · Ligas') : 'Tu liga de la semana';
  const titleId = `hf-nt-${it.id}`;
  return (
    <section className={`hf-news${fresh ? ' is-fresh' : ''}`} data-tint={face.medal ?? 'liga'} data-mine={mine || undefined} aria-labelledby={titleId}>
      <LessButton onClick={onLess} className="hf-news-x" />
      <div className="hf-big">
        <span className="hf-big-em" role="img" aria-label={face.medal ? MEDAL_INFO[face.medal].name : 'Noticia de ligas'}>{face.emoji}</span>
        {friend && (mine
          ? <MyAvatar name={friend.friend.nick} size={30} />
          : <Avatar name={friend.friend.nick} color={friend.friend.color} look={lookFor(friend.friend.nick)} size={30} />)}
      </div>
      <div className="hf-nx">
        <p className="hf-k"><IcTrophyLine aria-hidden="true" />{kicker}<span className="hf-k-time">· {it.time}</span></p>
        <h3 className="hf-nt" id={titleId}>
          {friend ? <><b>{friend.friend.nick}</b>{mine && <span className="hf-you">Vos</span>} {face.text}</> : league?.name}
        </h3>
        {friend ? mine && <p className="hf-np">Tus amigos lo ven en su feed</p> : face.text && <p className="hf-np">{face.text}</p>}
        <div className="hf-act">
          {friend && <ReactionBar reactions={friend.reactions} onReact={(e) => onReact(friend.id, e)} />}
          <button type="button" className="hf-cta is-quiet" onClick={onLeague}>{friend ? 'Ver la liga' : 'Ver mi liga'}</button>
          <span className="hf-sp" />
          {it.reason && <WhyChip reason={it.reason} icon={friend && !mine ? <IcUsersLine /> : undefined} end />}
        </div>
      </div>
    </section>
  );
}
