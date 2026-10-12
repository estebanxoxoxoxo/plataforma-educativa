import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Friend } from '../../../api/types';
import { FriendProfile } from './FriendProfile';

/** La hoja del perfil de un amigo (patrón global .shov/.shcard), que se abre desde una ventana del dock (su ⓘ o su
 *  nombre). Adentro, el perfil de siempre (FriendProfile) con "Mandar mensaje" y "Regalale ropa". Pura: el dock trae los
 *  datos y resuelve las acciones. Esc o tocar afuera la cierran, Tab queda adentro y, al irse, el foco vuelve a quien la
 *  abrió (salvo que la acción lo lleve a otro lado: "Mandar mensaje" lo deja en el campo de la conversación). */
export function FriendProfileSheet({ f, onClose, onMessage, onGift }: {
  f: Friend; onClose: () => void; onMessage: () => void; onGift?: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useLayoutEffect(() => { close.current = onClose; });
  const headingId = `fdk-pf-${f.id}`;

  // Al abrir: el foco entra a la hoja (su "Cerrar"); al irse, vuelve a quien la abrió si quedó en la nada.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    card.current?.querySelector<HTMLElement>('.fpx')?.focus();
    return () => {
      const at = document.activeElement;
      if (opener?.isConnected && (!at || at === document.body)) opener.focus();
    };
  }, []);

  // Teclado: Esc cierra y Tab no se escapa de la hoja.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = card.current;
      if (!c) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close.current(); return; }
      if (e.key !== 'Tab') return;
      const els = [...c.querySelectorAll<HTMLElement>('button:not(:disabled)')];
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1], at = document.activeElement;
      if (!c.contains(at)) { e.preventDefault(); first.focus(); return; }
      if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="shov fdk-pov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="shcard fdk-psheet" ref={card} role="dialog" aria-modal="true" aria-labelledby={headingId} data-friend={f.id}>
        <FriendProfile f={f} headingId={headingId} onClose={onClose} onMessage={onMessage} onGift={onGift} />
      </div>
    </div>
  );
}
