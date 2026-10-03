import type { SharedCard } from '../../../api/types';
import { BrandMark } from '../../../shared/components/BrandMark';
import { ShareCard } from '../cards/ShareCard';
import { TypingDots } from './TypingDots';

export type ChatMsg =
  | { id: number; role: 'kid'; text: string }
  | { id: number; role: 'ai'; text: string; share?: 'checking' | SharedCard };
export function ChatBubble({ m, onOpenShare }: { m: ChatMsg; onOpenShare: (c: SharedCard) => void }) {
  if (m.role === 'kid') return <div className="m kid">{m.text}</div>;
  return (
    <div className="m ai">
      <BrandMark />
      <div className="bub">
        {m.text ? <div>{m.text}</div> : <TypingDots />}
        {m.share && <ShareCard share={m.share} onOpen={onOpenShare} />}
      </div>
    </div>
  );
}
