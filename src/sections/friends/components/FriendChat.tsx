import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Friend, FriendMessage } from '../../../api/types';
import { Avatar } from '../../../shared/components/Avatar';
import { IcArrowRight, IcChev, IcClose, IcShield, IcShieldOkBold, IcUpSm } from '../../../shared/components/icons';
import { TypingDots } from '../../discover/components/TypingDots';

/** Lo que muestra la ventana: los mensajes del hilo + avisos LOCALES que nunca entraron al hilo
 *  (`mod` = el moderador explica por qué un mensaje no salió · `sys` = falla de red). */
export type ChatEntry = FriendMessage | { id: string; from: 'mod' | 'sys'; text: string };

type Props = {
  f: Friend;
  entries: ChatEntry[];
  /** El amigo está escribiendo (hay una respuesta en camino). */
  typing: boolean;
  /** El mensaje de Ian se está revisando (moderación en tiempo real). */
  sending: boolean;
  minimized: boolean;
  /** Mensajes que llegaron con la ventana minimizada. */
  unread: number;
  /** true = el mensaje salió (se limpia el campo); false = no salió y el texto queda para reescribirlo. */
  onSend: (text: string) => Promise<boolean>;
  onToggleMin: () => void;
  onClose: () => void;
};

/** Ventana de chat flotante abajo a la derecha (estilo LinkedIn): una conversación a la vez; minimizada queda como
 *  una barrita con el nick. Al abrirla, cambiar de amigo o restaurarla, el foco va al campo; Esc la cierra. */
export function FriendChat({ f, entries, typing, sending, minimized, unread, onSend, onToggleMin, onClose }: Props) {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setText(''); }, [f.id]); // otro amigo: borrador nuevo
  useEffect(() => { if (!minimized) input.current?.focus(); }, [f.id, minimized]);

  const submit = async () => {
    const t = text.trim();
    if (!t || sending) return;
    if (await onSend(t)) setText('');
    input.current?.focus();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };

  return (
    <div className={`fcw${minimized ? ' min' : ''}`} role="dialog" aria-label={`Conversación con ${f.nick}`} onKeyDown={onKey}>
      <header className="fcw-head" onClick={onToggleMin}>
        <Avatar name={f.nick} color={f.color} />
        <div className="fcw-who">
          <b>{f.nick}</b>
          <small className={typing ? 'typing' : undefined}>{typing ? 'escribiendo…' : f.status}</small>
        </div>
        {minimized && unread > 0 && <span className="fcw-badge" aria-label={`${unread} mensajes nuevos`}>{unread}</span>}
        <button className="fcw-b" type="button" title={minimized ? 'Abrir' : 'Minimizar'} aria-label={minimized ? 'Abrir la conversación' : 'Minimizar la conversación'}
          onClick={(e) => { e.stopPropagation(); onToggleMin(); }}>{minimized ? <IcUpSm /> : <IcChev />}</button>
        <button className="fcw-b" type="button" title="Cerrar" aria-label="Cerrar la conversación"
          onClick={(e) => { e.stopPropagation(); onClose(); }}><IcClose /></button>
      </header>
      {!minimized && (
        <>
          <div className="fthread" aria-live="polite" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
            {entries.map((m) =>
              m.from === 'mod' ? (
                <div key={m.id} className="fmod" role="note"><IcShield /><p><b>Moderador</b>{m.text}</p></div>
              ) : m.from === 'sys' ? (
                <p key={m.id} className="fsys">{m.text}</p>
              ) : (
                <div key={m.id} className={`fm ${m.from}`}>{m.text}</div>
              ),
            )}
            {typing && <div className="fm them ftyping" role="status" aria-label={`${f.nick} está escribiendo…`}><TypingDots /></div>}
          </div>
          <form className="fin" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribí un mensaje…" aria-label="Mensaje" maxLength={500} readOnly={sending} />
            <button className="send" type="submit" aria-label="Enviar" disabled={!text.trim() || sending}><IcArrowRight /></button>
          </form>
          <span className={`fnote${sending ? ' busy' : ''}`}><IcShieldOkBold />{sending ? 'Revisando tu mensaje…' : 'Los mensajes también están moderados para chicos.'}</span>
        </>
      )}
    </div>
  );
}
