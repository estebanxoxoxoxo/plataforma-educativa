import type { ComponentType } from 'react';
import type { FeedItem } from '../../../api/types';
import { Avatar } from '../../../shared/components/Avatar';
import { IcBolt, IcBook, IcMedal, IcTrophyLine } from '../../../shared/components/icons';
import { ReactionBar } from '../components/ReactionBar';

type It = Extract<FeedItem, { kind: 'friend' }>;

const ICONS: Record<It['icon'], { I: ComponentType; c: string; bg: string }> = {
  medal: { I: IcMedal, c: '#B07A06', bg: '#FFF1D6' },
  streak: { I: IcBolt, c: '#C24B1F', bg: '#FDEBE3' },
  badge: { I: IcMedal, c: '#0B6B66', bg: '#E2F5F3' },
  route: { I: IcBook, c: '#2843A8', bg: '#E7ECFD' },
  league: { I: IcTrophyLine, c: '#8A5A00', bg: '#FFF1D6' },
};

/** Noticia de un amigo (logro, racha, ruta compartida) con reacciones de emoji. */
export function FriendEventCard({ it, onReact }: { it: It; onReact: (id: string, emoji: string) => void }) {
  const { I, c, bg } = ICONS[it.icon];
  return (
    <article className="fcard ffriend">
      <Avatar name={it.friend.nick} color={it.friend.color} />
      <div className="fbody">
        <p className="fline"><b>{it.friend.nick}</b> {it.text}</p>
        <span className="fmeta">{it.time}</span>
        <ReactionBar reactions={it.reactions} onReact={(e) => onReact(it.id, e)} />
      </div>
      <span className="fev" style={{ color: c, background: bg }} aria-hidden><I /></span>
    </article>
  );
}
