import { useState } from 'react';
import type { Friend, FriendMessage } from '../../../api/types';
import { Avatar } from '../../../shared/components/Avatar';
import { IcArrowRight, IcShieldOkBold } from '../../../shared/components/icons';

export function FriendChat({ f, messages, onSend }: { f: Friend; messages: FriendMessage[]; onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const send = () => { const t = text.trim(); if (t) { onSend(t); setText(''); } };
  return (
    <>
      <div className="fprof small"><Avatar name={f.nick} color={f.color} /><div><h3>{f.nick}</h3><small>Mensajes</small></div></div>
      <div className="fthread" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
        {messages.map((m) => <div key={m.id} className={`fm ${m.from}`}>{m.text}</div>)}
      </div>
      <form className="fin" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribí un mensaje…" aria-label="Mensaje" />
        <button className="send" type="submit" aria-label="Enviar" disabled={!text.trim()}><IcArrowRight /></button>
      </form>
      <span className="fnote"><IcShieldOkBold />Los mensajes también están moderados para chicos.</span>
    </>
  );
}
