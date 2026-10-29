import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { Friend, FriendMessage } from '../../../api/types';
import { Avatar, lookFor } from '../../../shared/components/Avatar';
import { IcArrowRight, IcChev, IcClose, IcInfo, IcShield, IcShieldOkBold } from '../../../shared/components/icons';
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
  /** En la fila queda solo su barra (nombre + cerrar; tocarla la restaura). */
  minimized: boolean;
  /** Mensajes que llegaron con la ventana minimizada. */
  unread: number;
  /** No entra en la fila (minimizada y sin lugar): sigue viva pero no se dibuja. */
  hidden: boolean;
  /** Es la pieza de arriba con el dock a PANTALLA COMPLETA (teléfono): se anuncia como diálogo modal (lo de atrás queda inert). */
  modal?: boolean;
  /** Cambia cada vez que hay que llevar el foco al campo (abrir, reabrir o restaurar esta conversación). 0 = nada. */
  focusKey: number;
  /** true = el mensaje salió (se limpia el campo); false = no salió y el texto queda para reescribirlo. */
  onSend: (text: string) => Promise<boolean>;
  onMinimize: () => void;
  onRestore: () => void;
  /** `hadFocus`: el foco estaba adentro (el dock lo lleva a la barra «Mensajes» para que no se pierda). */
  onClose: (hadFocus: boolean) => void;
  /** Abre el perfil del amigo (racha, liga, cursos en común, "Regalale ropa"): la hoja la dibuja el dock. */
  onProfile: () => void;
};

/** Una ventana del dock de mensajes (estilo LinkedIn): barra propia (avatar + nombre + "escribiendo…"/estado) con
 *  ⓘ (su perfil), minimizar y cerrar; abajo el hilo, el campo y la nota de moderación. Minimizada queda SOLO la barra
 *  (con el contador de no leídos y su cerrar) y tocarla la restaura. Tocar la barra de una ventana abierta la minimiza,
 *  salvo su avatar y su nombre: como en LinkedIn, abren su perfil (el mismo que el ⓘ; desde que Amigos dejó de ser
 *  sección, 12-oct, el perfil del amigo vive acá).
 *  Teclado: Esc adentro de la ventana la minimiza y el foco queda en su barra; abrirla o restaurarla lleva el foco
 *  al campo. El borrador sobrevive a minimizar (el componente sigue montado). */
export function ChatWindow({ f, entries, typing, sending, minimized, unread, hidden, modal, focusKey, onSend, onMinimize, onRestore, onClose, onProfile }: Props) {
  const [text, setText] = useState('');
  const root = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const bar = useRef<HTMLButtonElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  /** Se minimizó desde adentro (Esc o el botón): el foco pasa a la barra en vez de perderse. */
  const toBar = useRef(false);

  useEffect(() => { if (focusKey && !minimized && !hidden) input.current?.focus(); }, [focusKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (minimized && toBar.current) bar.current?.focus(); toBar.current = false; }, [minimized]);
  // El hilo siempre muestra lo último: al llegar algo, al aparecer "escribiendo…" y al restaurar.
  useLayoutEffect(() => { const el = thread.current; if (el) el.scrollTop = el.scrollHeight; }, [entries.length, typing, minimized]);

  const focusInside = () => !!root.current?.contains(document.activeElement);
  const minimize = () => { toBar.current = focusInside(); onMinimize(); };
  const only = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); fn(); };
  const submit = async () => {
    const t = text.trim();
    if (!t || sending) return;
    if (await onSend(t)) setText('');
    input.current?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !minimized) { e.stopPropagation(); minimize(); }
  };

  const avatar = <Avatar name={f.nick} color={f.color} look={lookFor(f.nick)} accessory={f.accessory} />;
  const status = <small className={typing ? 'typing' : undefined}>{typing ? 'escribiendo…' : f.status}</small>;
  const news = unread > 0 ? ` (${unread} ${unread === 1 ? 'mensaje nuevo' : 'mensajes nuevos'})` : '';
  // Ventana abierta: el avatar y el nombre (solo su texto) abren el perfil; la línea de estado y el hueco minimizan.
  // Fuera del orden de tabulación: con teclado, el perfil se abre con el ⓘ.
  const toProfile = { type: 'button' as const, tabIndex: -1, title: `Ver el perfil de ${f.nick}`, 'aria-label': `Ver el perfil de ${f.nick}`, onClick: only(onProfile) };

  return (
    <section ref={root} className={`fdk-win${minimized ? ' min' : ''}`} hidden={hidden} data-friend={f.id}
      role={modal ? 'dialog' : undefined} aria-modal={modal || undefined} aria-label={`Conversación con ${f.nick}`} onKeyDown={onKey}>
      <header className="fdk-head" onClick={minimized ? onRestore : minimize}>
        {minimized ? (
          <button ref={bar} className="fdk-who" type="button" aria-expanded={false} title={`Abrir la conversación con ${f.nick}`}
            aria-label={`Abrir la conversación con ${f.nick}${news}`} onClick={only(onRestore)}>
            {avatar}<span className="fdk-nm"><b>{f.nick}</b>{status}</span>
          </button>
        ) : (
          <div className="fdk-who">
            <button className="fdk-pav" {...toProfile}>{avatar}</button>
            <span className="fdk-nm"><b><button className="fdk-pname" {...toProfile}>{f.nick}</button></b>{status}</span>
          </div>
        )}
        {minimized && unread > 0 && <span className="fdk-badge" aria-hidden="true">{unread}</span>}
        {!minimized && (
          <button className="fdk-b fdk-info" type="button" title="Ver su perfil" aria-label={`Ver el perfil de ${f.nick}`} aria-haspopup="dialog"
            onClick={only(onProfile)}><IcInfo /></button>
        )}
        {!minimized && (
          <button className="fdk-b" type="button" title="Minimizar" aria-label={`Minimizar la conversación con ${f.nick}`} onClick={only(minimize)}><IcChev /></button>
        )}
        <button className="fdk-b" type="button" title="Cerrar" aria-label={`Cerrar la conversación con ${f.nick}`}
          onClick={only(() => onClose(focusInside()))}><IcClose /></button>
      </header>
      {!minimized && (
        <>
          <div className="fthread" ref={thread} aria-live="polite">
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
            <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribí un mensaje…"
              aria-label={`Mensaje para ${f.nick}`} maxLength={500} readOnly={sending} />
            <button className="send" type="submit" aria-label="Enviar" disabled={!text.trim() || sending}><IcArrowRight /></button>
          </form>
          <span className={`fnote${sending ? ' busy' : ''}`}><IcShieldOkBold />{sending ? 'Revisando tu mensaje…' : 'Los mensajes están moderados para chicos.'}</span>
        </>
      )}
    </section>
  );
}
