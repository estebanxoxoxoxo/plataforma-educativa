import { useLayoutEffect, type KeyboardEvent, type RefObject } from 'react';
import type { Friend } from '../../../api/types';
import { Avatar, lookFor } from '../../../shared/components/Avatar';
import { IcDownSm, IcSearchG, IcUpSm } from '../../../shared/components/icons';
import { MyAvatar } from '../../../shared/components/ProfileCard';
import { L } from '../../../shared/lib/lang';
import type { DockWin } from '../lib/chatDock';

type Props = {
  /** Nombre de Ian (las iniciales de su avatar si no eligió personaje). */
  me: string;
  /** Amigos aceptados (null = cargando). Las solicitudes NO van acá: llegan como destacado en la zona pinneada del Feed. */
  friends: Friend[] | null;
  failed: boolean;
  open: boolean;
  /** Ventanas abiertas (para marcar la conversación y su contador de no leídos). */
  wins: DockWin[];
  /** Ids de las ventanas que no entran en la fila (el «+N»). */
  hidden: string[];
  /** La lista es la pieza de arriba con el dock a PANTALLA COMPLETA (teléfono): se anuncia como diálogo modal. */
  modal?: boolean;
  /** La tira (el botón que despliega): el dock le devuelve el foco al cerrar una ventana que lo tenía. */
  barRef: RefObject<HTMLButtonElement | null>;
  onToggle: () => void;
  onPick: (id: string) => void;
  onRetry: () => void;
  /** "Buscar personas": lleva a Buscar → Personas (ahí se encuentra gente por su nombre de usuario). */
  onFind: () => void;
};

const plural = (n: number) => L(`${n} ${n === 1 ? 'amigo' : 'amigos'}`, `${n} ${n === 1 ? 'friend' : 'friends'}`);
/** «N mensaje(s) nuevo(s)» (el nombre de la tira y el de cada conversación). */
const newMsgs = (n: number) => L(`${n} ${n === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}`, `${n} ${n === 1 ? 'new message' : 'new messages'}`);

/** La barra «Mensajes» del dock (estilo LinkedIn): fija abajo a la derecha, minimizada por defecto (una tira con el
 *  avatar de Ian, "Mensajes", cuántos amigos tiene y el chevron). Desplegada muestra la lista de conversaciones —avatar
 *  (el mismo look que en todos lados), nombre y su línea de estado—; tocar una abre su ventana a la izquierda. Al pie,
 *  "Buscar personas" (Amigos ya no es sección: a la gente se la busca por su nombre de usuario en Buscar → Personas).
 *  Esc con el foco adentro la pliega y el foco vuelve a la tira.
 *  En el TELÉFONO (friends.css, < 640) la tira cerrada se dibuja como un botón redondo con tu avatar y una insignia con
 *  el total de no leídos (ahí las minimizadas no se dibujan); desplegada, la lista va a pantalla completa. */
export function ChatListBar({ me, friends, failed, open, wins, hidden, modal, barRef, onToggle, onPick, onRetry, onFind }: Props) {
  const winOf = (id: string) => wins.find((w) => w.id === id);
  const hiddenUnread = hidden.some((id) => (winOf(id)?.unread ?? 0) > 0);
  /** Todos los no leídos (solo suman los de las minimizadas). Solo lo dibuja el botón redondo del teléfono. */
  const unread = wins.reduce((n, w) => n + w.unread, 0);
  const moreText = L(
    `${hidden.length} ${hidden.length === 1 ? 'conversación abierta más' : 'conversaciones abiertas más'}${hiddenUnread ? ', con mensajes nuevos' : ''}`,
    `${hidden.length} more open ${hidden.length === 1 ? 'chat' : 'chats'}${hiddenUnread ? ', with new messages' : ''}`,
  );
  const unreadText = newMsgs(unread);
  const friendsText = friends ? plural(friends.length) : failed ? L('Sin conexión', 'Offline') : '';
  /* El nombre del botón, armado con lo que SE VE (QA-T1 H5: leído del contenido salía «Mensajes 6 amigos , 5 mensajes
     nuevos», con la coma suelta, porque el texto para lectores era un bloque aparte): «Mensajes, 6 amigos, 5 mensajes
     nuevos». El «+N» y el total de no leídos se dibujan o no según el modo (el CSS: el total solo en el botón redondo del
     teléfono; el «+N» solo donde las minimizadas se ven), así que entran al nombre solo si están dibujados, como antes. */
  useLayoutEffect(() => {
    const btn = barRef.current;
    if (!btn) return;
    const drawn = (sel: string) => { const e = btn.querySelector(sel); return !!e && e.getClientRects().length > 0; };
    const label = [L('Mensajes', 'Messages'), friendsText, drawn('.fdk-more') ? moreText : '', drawn('.fdk-tot') ? unreadText : ''].filter(Boolean).join(', ');
    if (btn.getAttribute('aria-label') !== label) btn.setAttribute('aria-label', label);
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return;
    e.stopPropagation();
    onToggle();
    barRef.current?.focus();
  };

  return (
    <section className={`fdk-list${open ? ' open' : ''}`} aria-label={L('Mensajes', 'Messages')} onKeyDown={onKey}
      role={modal ? 'dialog' : undefined} aria-modal={modal || undefined}>
      <button ref={barRef} className="fdk-lhead" type="button" aria-expanded={open} aria-controls={open ? 'fdk-lbody' : undefined}
        title={open ? L('Minimizar los mensajes', 'Minimize messages') : L('Ver tus conversaciones', 'See your chats')} onClick={onToggle}>
        <MyAvatar name={me} size={32} />
        <span className="fdk-nm">
          <b>{L('Mensajes', 'Messages')}</b>
          <small>{friends ? plural(friends.length) : failed ? L('Sin conexión', 'Offline') : ' '}</small>
        </span>
        {hidden.length > 0 && (
          <span className={`fdk-more${hiddenUnread ? ' new' : ''}`}
            title={L(
              `${hidden.length} ${hidden.length === 1 ? 'conversación abierta no entra' : 'conversaciones abiertas no entran'} en la pantalla`,
              `${hidden.length} open ${hidden.length === 1 ? 'chat doesn’t' : 'chats don’t'} fit on the screen`,
            )}
            aria-hidden="true">
            +{hidden.length}
          </span>
        )}
        {unread > 0 && (
          <span className="fdk-tot">
            <span aria-hidden="true">{unread > 99 ? '99+' : unread}</span>
          </span>
        )}
        <span className="fdk-chev" aria-hidden="true">{open ? <IcDownSm /> : <IcUpSm />}</span>
      </button>
      {open && (
        <div className="fdk-lbody" id="fdk-lbody">
          {failed && !friends ? (
            <div className="fdk-empty">
              <p>{L('No pude cargar tus conversaciones ahora mismo.', 'I couldn’t load your chats right now.')}</p>
              <button className="fdk-retry" type="button" onClick={onRetry}>{L('Reintentar', 'Try again')}</button>
            </div>
          ) : !friends ? (
            <div className="fdk-sk" role="status" aria-label={L('Cargando tus conversaciones', 'Loading your chats')}>{[0, 1, 2].map((i) => <span key={i}><i /><b /></span>)}</div>
          ) : friends.length === 0 ? (
            <p className="fdk-empty">{L(
              'Todavía no tenés amigos en Smarty. Buscá a otras personas por su nombre de usuario: cuando acepten, les vas a poder escribir desde acá.',
              'You don’t have friends on Smarty yet. Look for other people by their username: once they accept, you can message them from here.',
            )}</p>
          ) : (
            <ul className="fdk-items">
              {friends.map((f) => {
                const w = winOf(f.id);
                const state = w ? (hidden.includes(f.id) ? L(', abierta (no entra en la pantalla)', ', open (doesn’t fit on the screen)') : w.min ? L(', minimizada', ', minimized') : L(', abierta', ', open')) : '';
                const news = w && w.unread > 0 ? `, ${newMsgs(w.unread)}` : '';
                return (
                  <li key={f.id}>
                    <button className={`fdk-item${w ? ' on' : ''}`} type="button" onClick={() => onPick(f.id)}
                      aria-label={L(`Conversación con ${f.nick}: ${f.status}${state}${news}`, `Chat with ${f.nick}: ${f.status}${state}${news}`)}>
                      <Avatar name={f.nick} color={f.color} look={lookFor(f.nick)} accessory={f.accessory} />
                      <span className="fdk-nm"><b>{f.nick}</b><small>{f.status}</small></span>
                      {/* Marca SOLO si el amigo escribió y todavía no se vio (pedido 11-oct): tener ventana no marca nada. */}
                      {w && w.unread > 0 && <span className="fdk-badge" aria-hidden="true">{w.unread}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {open && (
        <button className="fdk-find" type="button" onClick={onFind}><IcSearchG />{L('Buscar personas', 'Find people')}</button>
      )}
    </section>
  );
}
