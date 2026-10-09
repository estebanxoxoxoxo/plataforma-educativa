import type { KeyboardEvent, RefObject } from 'react';
import type { Friend } from '../../../api/types';
import { Avatar, lookFor } from '../../../shared/components/Avatar';
import { IcDownSm, IcUpSm } from '../../../shared/components/icons';
import { MyAvatar } from '../../../shared/components/ProfileCard';
import type { DockWin } from '../lib/chatDock';

type Props = {
  /** Nombre de Ian (las iniciales de su avatar si no eligió personaje). */
  me: string;
  /** Amigos aceptados (null = cargando). Las solicitudes NO van acá: viven en /amigos. */
  friends: Friend[] | null;
  failed: boolean;
  open: boolean;
  /** Ventanas abiertas (para marcar la conversación y su contador de no leídos). */
  wins: DockWin[];
  /** Ids de las ventanas que no entran en la fila (el «+N»). */
  hidden: string[];
  /** La tira (el botón que despliega): el dock le devuelve el foco al cerrar una ventana que lo tenía. */
  barRef: RefObject<HTMLButtonElement | null>;
  onToggle: () => void;
  onPick: (id: string) => void;
  onRetry: () => void;
};

const plural = (n: number) => `${n} ${n === 1 ? 'amigo' : 'amigos'}`;

/** La barra «Mensajes» del dock (estilo LinkedIn): fija abajo a la derecha, minimizada por defecto (una tira con el
 *  avatar de Ian, "Mensajes", cuántos amigos tiene y el chevron). Desplegada muestra la lista de conversaciones —avatar
 *  (el mismo look que en todos lados), nombre y su línea de estado—; tocar una abre su ventana a la izquierda.
 *  Esc con el foco adentro la pliega y el foco vuelve a la tira. */
export function ChatListBar({ me, friends, failed, open, wins, hidden, barRef, onToggle, onPick, onRetry }: Props) {
  const winOf = (id: string) => wins.find((w) => w.id === id);
  const hiddenUnread = hidden.some((id) => (winOf(id)?.unread ?? 0) > 0);
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return;
    e.stopPropagation();
    onToggle();
    barRef.current?.focus();
  };

  return (
    <section className={`fdk-list${open ? ' open' : ''}`} aria-label="Mensajes" onKeyDown={onKey}>
      <button ref={barRef} className="fdk-lhead" type="button" aria-expanded={open} aria-controls={open ? 'fdk-lbody' : undefined}
        title={open ? 'Minimizar los mensajes' : 'Ver tus conversaciones'} onClick={onToggle}>
        <MyAvatar name={me} size={32} />
        <span className="fdk-nm">
          <b>Mensajes</b>
          <small>{friends ? plural(friends.length) : failed ? 'Sin conexión' : ' '}</small>
        </span>
        {hidden.length > 0 && (
          <span className={`fdk-more${hiddenUnread ? ' new' : ''}`}
            title={`${hidden.length} ${hidden.length === 1 ? 'conversación abierta no entra' : 'conversaciones abiertas no entran'} en la pantalla`}
            aria-label={`${hidden.length} ${hidden.length === 1 ? 'conversación abierta más' : 'conversaciones abiertas más'}${hiddenUnread ? ', con mensajes nuevos' : ''}`}>
            +{hidden.length}
          </span>
        )}
        <span className="fdk-chev" aria-hidden="true">{open ? <IcDownSm /> : <IcUpSm />}</span>
      </button>
      {open && (
        <div className="fdk-lbody" id="fdk-lbody">
          {failed && !friends ? (
            <div className="fdk-empty">
              <p>No pude cargar tus conversaciones ahora mismo.</p>
              <button className="fdk-retry" type="button" onClick={onRetry}>Reintentar</button>
            </div>
          ) : !friends ? (
            <div className="fdk-sk" role="status" aria-label="Cargando tus conversaciones">{[0, 1, 2].map((i) => <span key={i}><i /><b /></span>)}</div>
          ) : friends.length === 0 ? (
            <p className="fdk-empty">Todavía no tenés amigos en Innerith. Cuando aceptes una solicitud, vas a poder escribirle desde acá.</p>
          ) : (
            <ul className="fdk-items">
              {friends.map((f) => {
                const w = winOf(f.id);
                const state = w ? (hidden.includes(f.id) ? ', abierta (no entra en la pantalla)' : w.min ? ', minimizada' : ', abierta') : '';
                const news = w && w.unread > 0 ? `, ${w.unread} ${w.unread === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}` : '';
                return (
                  <li key={f.id}>
                    <button className={`fdk-item${w ? ' on' : ''}`} type="button" onClick={() => onPick(f.id)}
                      aria-label={`Conversación con ${f.nick}: ${f.status}${state}${news}`}>
                      <Avatar name={f.nick} color={f.color} look={lookFor(f.nick)} />
                      <span className="fdk-nm"><b>{f.nick}</b><small>{f.status}</small></span>
                      {w && w.unread > 0 ? <span className="fdk-badge" aria-hidden="true">{w.unread}</span> : w ? <span className="fdk-dot" aria-hidden="true" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
