import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatMedia, VideoResult } from '../../../api/types';
import { BrandMark } from '../../../shared/components/BrandMark';
import { ChatArticleCard } from '../cards/ChatArticleCard';
import { ShareCard } from '../cards/ShareCard';
import { ChatGallery } from './ChatGallery';
import { MediaGroup } from './MediaGroup';

export type ChatMsg =
  | { id: number; role: 'kid'; text: string }
  | { id: number; role: 'ai'; text: string; pending?: boolean; media?: ChatMedia };

export interface ChatMediaHandlers {
  onVideo: (v: VideoResult) => void;
  onArticle: (url: string) => void;
  onImage: (img: NonNullable<ChatMedia['images']>[number]) => void;
}

/* Markdown sin links ni imágenes: el texto del modelo nunca crea navegación (Smarty RF-3.6). */
const MD_ALLOWED = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'h3', 'h4', 'blockquote', 'code'];

/** Un grupo de medios del chat: los primeros 3 y «Ver los N …» que expande ahí mismo (el POC abría una vista aparte). */
function Group<T>({ kind, items, render }: { kind: 'videos' | 'images' | 'articles'; items: T[]; render: (shown: T[]) => ReactNode }) {
  const [all, setAll] = useState(false);
  return (
    <MediaGroup kind={kind} more={items.length} expanded={all} onMore={() => setAll((v) => !v)}>
      {render(all ? items : items.slice(0, 3))}
    </MediaGroup>
  );
}

/** Un mensaje del chat, con el estilo del POC (tanda BUSCARCHAT): el del chico, burbuja suave a la derecha; el de la IA, SIN
 *  burbuja, a lo ancho de la columna, con su marca chiquita arriba (la marca de 3 puntos que el chat ya usaba: el producto no
 *  le da otro nombre visible a la IA) y sus medios en los grupos de 3 del POC. Mientras espera, la píldora «Pensando…»
 *  (`slow`: el aviso de que tarda). Los handlers de medios son los de siempre (video → reproductor, artículo → lector,
 *  imagen → pestaña nueva). */
export function ChatBubble({ m, h, slow }: { m: ChatMsg; h: ChatMediaHandlers; slow?: boolean }) {
  if (m.role === 'kid') return <div className="cx-msg cx-kid"><div className="cx-kb">{m.text}</div></div>;
  const media = m.media;
  return (
    <div className="cx-msg cx-ai">
      <BrandMark className="mark cx-mark" />
      {m.pending && !m.text
        ? <div className="cx-think" role="status">{slow ? 'Esto está tardando más de lo normal…' : 'Pensando…'}</div>
        : <div className="cx-md"><ReactMarkdown allowedElements={MD_ALLOWED} unwrapDisallowed>{m.text}</ReactMarkdown></div>}
      {!!media?.images?.length && <Group kind="images" items={media.images} render={(s) => <ChatGallery images={s} onOpen={h.onImage} />} />}
      {!!media?.videos?.length && <Group kind="videos" items={media.videos}
        render={(s) => <div className="mg-vids">{s.map((v) => <ShareCard key={v.id} v={v} onOpen={h.onVideo} />)}</div>} />}
      {!!media?.articles?.length && <Group kind="articles" items={media.articles}
        render={(s) => <div className="mg-arts">{s.map((a) => <ChatArticleCard key={a.url} a={a} onOpen={h.onArticle} />)}</div>} />}
    </div>
  );
}
