import ReactMarkdown from 'react-markdown';
import type { ChatMedia, VideoResult } from '../../../api/types';
import { BrandMark } from '../../../shared/components/BrandMark';
import { ChatArticleCard } from '../cards/ChatArticleCard';
import { ShareCard } from '../cards/ShareCard';
import { ChatGallery } from './ChatGallery';
import { TypingDots } from './TypingDots';

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

export function ChatBubble({ m, h }: { m: ChatMsg; h: ChatMediaHandlers }) {
  if (m.role === 'kid') return <div className="m kid">{m.text}</div>;
  const media = m.media;
  return (
    <div className="m ai">
      <BrandMark />
      <div className="bub">
        {m.pending && !m.text
          ? <TypingDots />
          : <div className="md"><ReactMarkdown allowedElements={MD_ALLOWED} unwrapDisallowed>{m.text}</ReactMarkdown></div>}
        {media?.images && <ChatGallery images={media.images} onOpen={h.onImage} />}
        {media?.videos?.map((v) => <ShareCard key={v.id} v={v} onOpen={h.onVideo} />)}
        {media?.articles?.map((a) => <ChatArticleCard key={a.url} a={a} onOpen={h.onArticle} />)}
      </div>
    </div>
  );
}
