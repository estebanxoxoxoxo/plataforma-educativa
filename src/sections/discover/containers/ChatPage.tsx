import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import type { ChatReply, ChatTurn } from '../../../api/types';
import { IcShield } from '../../../shared/components/icons';
import { ChatBubble, type ChatMediaHandlers, type ChatMsg } from '../components/ChatBubble';

// Persisten mientras la app está abierta: lo que se ve y el contexto que se manda al backend.
let chatHistory: ChatMsg[] = [];
let context: ChatTurn[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    setMsgs((m) => [...m, { id: kidId, role: 'kid', text: q }, { id: aiId, role: 'ai', text: '', pending: true }]);
    const patch = (p: Partial<Extract<ChatMsg, { role: 'ai' }>>) =>
      setMsgs((all) => all.map((m) => (m.id === aiId && m.role === 'ai' ? { ...m, ...p } : m)));

    let reply: ChatReply;
    try {
      reply = await api.chat(context, q);
    } catch {
      patch({ text: 'No puedo revisar esto ahora mismo. Probemos de nuevo en un ratito 🙂', pending: false }); // fail-closed
      setBusy(false);
      return;
    }
    // Contexto en cuarentena (Smarty RF-5.7): lo que entra a los próximos turnos lo decide el backend.
    context = [...context, { role: 'user', content: reply.childContextText ?? q }, { role: 'assistant', content: reply.contextText }];
    console.debug('[chat] decisión:', reply.kind, '·', reply.trace);

    // La respuesta ya pasó el juez completa; se revela de a poco solo por estética.
    const words = reply.text.split(/(\s+)/);
    for (let i = 1; i <= words.length; i += 2) { patch({ text: words.slice(0, i).join(''), pending: false }); await sleep(18); }
    patch({ text: reply.text, media: reply.media });
    setBusy(false);
  };

  const h: ChatMediaHandlers = {
    onVideo: (v) => go(`/buscar/video/${v.id}`),
    onArticle: (url) => go(`/buscar/articulo/${encodeURIComponent(url)}`),
    onImage: (img) => window.open(img.full, '_blank', 'noopener'),
  };

  return (
    <section className="view" id="v-chat">
      <div><h2 className="h2">Chat</h2><p className="lede">Preguntá lo que quieras saber.</p></div>
      <div className="msgs" ref={list}>{msgs.map((m) => <ChatBubble key={m.id} m={m} h={h} />)}</div>
      <form className="cin" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribí tu pregunta…" aria-label="Tu pregunta" maxLength={2000} />
        <button className="send" type="submit" aria-label="Enviar" disabled={busy || !text.trim()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </form>
      <div className="note"><IcShield />Respuestas y contenidos moderados para chicos</div>
    </section>
  );
}
