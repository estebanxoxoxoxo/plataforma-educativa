import type { ComponentType, SVGProps } from 'react';
import type { FeedItem } from '../../../api/types';
import { Avatar, lookFor } from '../../../shared/components/Avatar';
import { IcBolt, IcMedal } from '../../../shared/components/icons';
import { FeedCard } from '../components/FeedCard';
import { IcRouteLine, IcUnitLine, IcUsersLine } from '../components/feedIcons';
import { ReactionBar } from '../components/ReactionBar';
import { L } from '../../../shared/lib/lang';

type It = Extract<FeedItem, { kind: 'friend' }>;

/** Qué hizo el amigo (el tinte de cada evento: los de siempre del feed). Las medallas y lo de ligas van como NOTICIA. */
// Función y no constante: los L() se resuelven en render (una tabla de módulo se congelaría en el idioma del import).
const event = (icon: It['icon']): { label: string; I: ComponentType<SVGProps<SVGSVGElement>> } => ({
  streak: { label: L('Racha', 'Streak'), I: IcBolt },
  badge: { label: L('Insignia', 'Badge'), I: IcMedal },
  unit: { label: L('Unidad', 'Unit'), I: IcUnitLine },
  route: { label: L('Ruta compartida', 'Shared route'), I: IcRouteLine },
  medal: { label: L('Medalla', 'Medal'), I: IcMedal },
  league: { label: L('Liga', 'League'), I: IcMedal },
})[icon];

/** Noticia de un amigo (racha, insignia, unidad completada, ruta compartida) como card estándar: con SU avatar (el look de siempre, 80/20) en
 *  el lugar de la miniatura y las reacciones de emoji como acción. Pura. */
export function FriendEventCard({ it, onReact, onLess }: { it: It; onReact: (id: string, emoji: string) => void; onLess: () => void }) {
  const ev = event(it.icon);
  return (
    <FeedCard family="amigos" icon={<IcUsersLine />} label={L('Amigos', 'Friends')} time={it.time} reason={it.reason} whyIcon={<IcUsersLine />} onLess={onLess}
      thumb={<span className="hf-av"><Avatar name={it.friend.nick} color={it.friend.color} look={lookFor(it.friend.nick)} size={48} /></span>}
      title={<><b>{it.friend.nick}</b> {it.text}</>}
      meta={<span className="hf-evt" data-icon={it.icon}><ev.I aria-hidden="true" />{ev.label}</span>}
      action={<ReactionBar reactions={it.reactions} onReact={(e) => onReact(it.id, e)} />}
    />
  );
}
