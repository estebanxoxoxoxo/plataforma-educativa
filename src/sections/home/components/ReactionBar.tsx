import type { FeedReaction } from '../../../api/types';

/** Reacciones con emojis fijos sobre una noticia de amigo. */
export const ReactionBar = ({ reactions, onReact }: { reactions: FeedReaction[]; onReact: (emoji: string) => void }) => (
  <div className="rbar" role="group" aria-label="Reaccionar">
    {reactions.map((r) => (
      <button key={r.emoji} className={`rchip${r.mine ? ' on' : ''}`} aria-pressed={r.mine}
        onClick={(e) => { e.stopPropagation(); onReact(r.emoji); }}>
        <span aria-hidden>{r.emoji}</span>{r.count > 0 && <i>{r.count}</i>}
      </button>
    ))}
  </div>
);
