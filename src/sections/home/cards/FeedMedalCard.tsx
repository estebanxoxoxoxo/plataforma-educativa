import type { FeedItem } from '../../../api/types';
import { MyAvatar } from '../../../shared/components/ProfileCard';
import { IcMedal } from '../../../shared/components/icons';
import { newsTitle } from '../../../shared/lib/medals';
import { WhyChip } from '../components/FeedBits';

export type MedalNewsItem = Extract<FeedItem, { kind: 'medal' }>;

/** La noticia PROPIA de una medalla nueva de la plataforma (U5, spec §5.5c; el server la pone en lo vivo del dueño con
 *  `kind:'medal'`, id `fm-<n>`, reason 'Es tu medalla nueva'). Estilo C de noticia (las .hf-news de FeedNewsCard), con tu
 *  avatar: kicker "Tu medalla", título "Ganaste la medalla «Primera posta»", el texto informativo de la medalla y "Ver tus
 *  medallas" (abre la pila; el contenedor la abre con openMedalsSheet). A propósito SIN reacciones, sin festejos de NPCs,
 *  sin "ver menos" y sin el anillo de "recién entrada": es tuya y no es la medalla de liga "que ven tus amigos" (§1, §5.1).
 *  Pura. */
export function FeedMedalCard({ it, name, onOpen }: { it: MedalNewsItem; name: string; onOpen: () => void }) {
  const titleId = `hf-nt-${it.id}`;
  return (
    <section className="hf-news hf-medal" data-medal={it.medal.id} aria-labelledby={titleId}>
      <div className="hf-big">
        <span className="hf-big-em" aria-hidden="true">{it.medal.emoji}</span>
        <MyAvatar name={name} size={30} />
      </div>
      <div className="hf-nx">
        <p className="hf-k"><IcMedal aria-hidden="true" />Tu medalla<span className="hf-k-time">· {it.time}</span></p>
        <h3 className="hf-nt" id={titleId}>{newsTitle(it.medal)}</h3>
        <p className="hf-np">{it.medal.text}</p>
        <div className="hf-act">
          <button type="button" className="hf-cta is-quiet" aria-haspopup="dialog" onClick={onOpen}>Ver tus medallas</button>
          {it.reason && <WhyChip reason={it.reason} />}
        </div>
      </div>
    </section>
  );
}
