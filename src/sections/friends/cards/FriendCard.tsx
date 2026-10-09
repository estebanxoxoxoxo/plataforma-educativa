import type { MouseEvent } from 'react';
import type { Friend } from '../../../api/types';
import { Avatar, lookFor } from '../../../shared/components/Avatar';
import { IcChat, IcInfo } from '../../../shared/components/icons';

/** Fila de un amigo. ⓘ abre/cierra su detalle (panel de la derecha); el globo abre su conversación en el dock de
 *  mensajes (abajo a la derecha; `chatOpen` = ya tiene ventana ahí, abierta o minimizada).
 *  Tocar la fila también abre el detalle: con ventanas del dock abiertas sobre la lista a ancho completo, los botones
 *  de las filas de abajo pueden quedar tapados, pero el nombre se puede tocar igual (y el detalle trae "Mandar mensaje").
 *  `fresh` = recién aceptado de una solicitud (entra con una animación suave). */
export const FriendRow = ({ f, infoOpen, chatOpen, fresh, onInfo, onMsg }: {
  f: Friend; infoOpen: boolean; chatOpen: boolean; fresh?: boolean; onInfo: () => void; onMsg: () => void;
}) => {
  const only = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); fn(); };
  return (
    <div className={`fr${infoOpen ? ' sel' : ''}${fresh ? ' fresh' : ''}`} onClick={onInfo}>
      <Avatar name={f.nick} color={f.color} look={lookFor(f.nick)} />
      <div className="grow"><b>{f.nick}</b><small>{f.status}</small></div>
      <button className={`ib info${infoOpen ? ' active' : ''}`} title={infoOpen ? 'Cerrar información' : 'Ver información'}
        aria-label={`${infoOpen ? 'Cerrar' : 'Ver'} información de ${f.nick}`} aria-expanded={infoOpen} onClick={only(onInfo)}><IcInfo /></button>
      <button className={`ib msg${chatOpen ? ' active' : ''}`} title="Mandar mensaje" aria-label={`Mandar mensaje a ${f.nick}`} onClick={only(onMsg)}><IcChat /></button>
    </div>
  );
};
