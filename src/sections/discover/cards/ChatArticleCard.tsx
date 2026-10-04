import type { ChatMedia } from '../../../api/types';

type Art = NonNullable<ChatMedia['articles']>[number];
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

/** Tarjeta de un artículo de un sitio aprobado que el chat sugiere leer. Abre el lector moderado. */
export const ChatArticleCard = ({ a, onOpen }: { a: Art; onOpen: (url: string) => void }) => (
  <button className="chat-art" onClick={() => onOpen(a.url)}>
    <b>{a.title}</b>
    {a.snippet && <span>{a.snippet}</span>}
    <small>{host(a.url)}</small>
  </button>
);
