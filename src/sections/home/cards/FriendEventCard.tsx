import type { ComponentType } from 'react';
import type { FeedItem } from '../../../api/types';
import { Avatar, lookFor } from '../../../shared/components/Avatar';
import { MyAvatar } from '../../../shared/components/ProfileCard';
import { IcBolt, IcBook, IcMedal, IcTrophyLine } from '../../../shared/components/icons';
import { MEDAL_INFO, type Medal } from '../../leagues/lib/cycle';
import { ReactionBar } from '../components/ReactionBar';

type It = Extract<FeedItem, { kind: 'friend' }>;

const ICONS: Record<It['icon'], { I: ComponentType; c: string; bg: string }> = {
  medal: { I: IcMedal, c: '#B07A06', bg: '#FFF1D6' },
  streak: { I: IcBolt, c: '#C24B1F', bg: '#FDEBE3' },
  badge: { I: IcMedal, c: '#0B6B66', bg: '#E2F5F3' },
  route: { I: IcBook, c: '#2843A8', bg: '#E7ECFD' },
  league: { I: IcTrophyLine, c: '#8A5A00', bg: '#FFF1D6' },
};

/** La medalla de liga que nombra el texto (🥇/🥈/🥉), si nombra una. */
const medalIn = (text: string): Medal | null => (Object.keys(MEDAL_INFO) as Medal[]).find((m) => text.includes(MEDAL_INFO[m].emoji)) ?? null;

/** Noticia de un amigo (logro, racha, ruta compartida) con reacciones de emoji.
 *  `mine` = la noticia es del propio chico (su medalla del cierre de liga: la que ven sus amigos en su feed): va con SU
 *  avatar, la pastilla "Vos" y los colores de la medalla, celebratoria. `fresh` = acaba de entrar (animación de entrada). */
export function FriendEventCard({ it, onReact, mine, fresh }: { it: It; onReact: (id: string, emoji: string) => void; mine?: boolean; fresh?: boolean }) {
  const { I, c, bg } = ICONS[it.icon];
  const medal = mine ? medalIn(it.text) : null;
  return (
    <article className={`fcard ffriend${fresh ? ' fnew' : ''}`} data-icon={it.icon} data-mine={mine || undefined} data-medal={medal ?? undefined}>
      {mine ? <MyAvatar name={it.friend.nick} /> : <Avatar name={it.friend.nick} color={it.friend.color} look={lookFor(it.friend.nick)} />}
      <div className="fbody">
        <p className="fline"><b>{it.friend.nick}</b>{mine && <span className="fyou">Vos</span>} {it.text}</p>
        <span className="fmeta">{it.time}{mine && ' · Tus amigos lo ven en su feed'}</span>
        <ReactionBar reactions={it.reactions} onReact={(e) => onReact(it.id, e)} />
      </div>
      {medal
        ? <span className="fev fev-medal" role="img" aria-label={MEDAL_INFO[medal].name}>{MEDAL_INFO[medal].emoji}</span>
        : <span className="fev" style={{ color: c, background: bg }} aria-hidden><I /></span>}
    </article>
  );
}
