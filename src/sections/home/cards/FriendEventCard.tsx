import type { ComponentType, SVGProps } from 'react';
import type { FeedItem } from '../../../api/types';
import { Avatar, lookFor } from '../../../shared/components/Avatar';
import { IcBolt, IcMedal } from '../../../shared/components/icons';
import { FeedCard } from '../components/FeedCard';
import { IcRouteLine, IcUnitLine, IcUsersLine } from '../components/feedIcons';
import { ReactionBar } from '../components/ReactionBar';

type It = Extract<FeedItem, { kind: 'friend' }>;

/** Qué hizo el amigo (el tinte de cada evento: los de siempre del feed). Las medallas y lo de ligas van como NOTICIA. */
const EVENT: Record<It['icon'], { label: string; I: ComponentType<SVGProps<SVGSVGElement>> }> = {
  streak: { label: 'Racha', I: IcBolt },
  badge: { label: 'Insignia', I: IcMedal },
  unit: { label: 'Unidad', I: IcUnitLine },
  route: { label: 'Ruta compartida', I: IcRouteLine },
  medal: { label: 'Medalla', I: IcMedal },
  league: { label: 'Liga', I: IcMedal },
};

/** Noticia de un amigo (racha, insignia, unidad completada, ruta compartida) como card estándar: con SU avatar (el look de siempre, 80/20) en
 *  el lugar de la miniatura y las reacciones de emoji como acción. Pura. */
export function FriendEventCard({ it, onReact, onLess }: { it: It; onReact: (id: string, emoji: string) => void; onLess: () => void }) {
  const ev = EVENT[it.icon];
  return (
    <FeedCard family="amigos" icon={<IcUsersLine />} label="Amigos" time={it.time} reason={it.reason} whyIcon={<IcUsersLine />} onLess={onLess}
      thumb={<span className="hf-av"><Avatar name={it.friend.nick} color={it.friend.color} look={lookFor(it.friend.nick)} size={48} /></span>}
      title={<><b>{it.friend.nick}</b> {it.text}</>}
      meta={<span className="hf-evt" data-icon={it.icon}><ev.I aria-hidden="true" />{ev.label}</span>}
      action={<ReactionBar reactions={it.reactions} onReact={(e) => onReact(it.id, e)} />}
    />
  );
}
