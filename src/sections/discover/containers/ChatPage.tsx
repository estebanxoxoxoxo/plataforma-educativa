import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import type { SharedCard } from '../../../api/types';
import { IcShield } from '../../../shared/components/icons';
import { ChatBubble, type ChatMsg } from '../components/ChatBubble';

let chatHistory: ChatMsg[] = []; // persiste mientras la app está abierta
export function ChatPage() {
  const [msgs, setMsgs] = useState<ChatMsg[]>(chatHistory);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const go = useNavigate();
  const seq = useRef(chatHistory.length);

  useEffect(() => { chatHistory = msgs; list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }); }, [msgs]);

  const send = async () => {
    const q = text.trim(); if (!q || busy) return;
    setText(''); setBusy(true);
    const kidId = ++seq.current, aiId = ++seq.current;
    setMsgs((m) => [...m, { id: kidId, role: 'kid', text: q }, { id: aiId, role: 'ai', text: '' }]);
    const patch = (fn: (m: Extract<ChatMsg, { role: 'ai' }>) => Partial<Extract<ChatMsg, { role: 'ai' }>>) =>
      setMsgs((all) => all.map((m) => (m.id === aiId && m.role === 'ai' ? { ...m, ...fn(m) } : m)));
    for await (const ev of api.chat(q)) {
      if (ev.type === 'token') patch((m) => ({ text: m.text ? `${m.text} ${ev.text}` : ev.text }));
      else if (ev.type === 'share-checking') patch(() => ({ share: 'checking' }));
      else if (ev.type === 'share') patch(() => ({ share: ev.card }));
    }
    setBusy(false);
  };
  const openShare = (c: SharedCard) => c.videoId && go(`/descubrir/video/${c.videoId}`);

  return (
    <section className="view" id="v-chat">
      <div><h2 className="h2">Chat</h2><p className="lede">Preguntá lo que quieras saber.</p></div>
      <div className="msgs" ref={list}>{msgs.map((m) => <ChatBubble key={m.id} m={m} onOpenShare={openShare} />)}</div>
      <form className="cin" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribí tu pregunta…" aria-label="Tu pregunta" />
        <button className="send" type="submit" aria-label="Enviar" disabled={busy || !text.trim()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </form>
      <div className="note"><IcShield />Respuestas y contenidos moderados para chicos</div>
    </section>
  );
}
