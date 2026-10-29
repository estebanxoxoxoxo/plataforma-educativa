import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Friend } from '../../../api/types';
import { useReturnFocus, useVeil } from '../../store/lib/sheet';
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

  // Al irse, el foco vuelve a quien la abrió si quedó en la nada: el opener se captura EN EL RENDER (store/lib/sheet
  // useReturnFocus; QA-T1 H4: con el efecto, en StrictMode su 2.ª corrida tomaba por opener al «Cerrar» de la hoja → body).
  useReturnFocus();
  // Al abrir: el foco entra a la hoja (su "Cerrar").
  useEffect(() => { card.current?.querySelector<HTMLElement>('.fpx')?.focus(); }, []);
  const veil = useVeil(onClose);

  // Teclado: Esc cierra y Tab no se escapa de la hoja. En CAPTURA (QA-T6 H-T6-2): la hoja es modal y se dibuja encima de
  // la conversación del dock, cuyo onKeyDown (React, en la raíz) minimiza la ventana con Esc y corta la propagación; si el
  // foco quedaba en la ventana de atrás, el Esc no llegaba nunca a la hoja (se minimizaba la conversación y la hoja seguía).
  // En captura la hoja lo ve primero y, al cortarlo, el Esc no llega a nadie más.
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
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, []);
  // El foco no sale de la hoja mientras está abierta (es modal). QA-T6 H-T6-2: en Safari/WebKit, desde la 2.ª apertura
  // (después de tocar el campo de la conversación), el navegador le pasaba el foco SOLO —sin ningún focus() del código— al
  // avatar de la ventana de atrás (.fdk-pav) un instante después de que la hoja lo pusiera en su «Cerrar». Si se escapa,
  // vuelve al «Cerrar». Al irse la hoja (la tarjeta ya no está en la página) no hace nada: el foco lo reparte quien cierra.
  useEffect(() => {
    const onIn = (e: FocusEvent) => {
      const c = card.current;
      if (!c || !c.isConnected || !(e.target instanceof Node) || c.contains(e.target)) return;
      c.querySelector<HTMLElement>('.fpx')?.focus();
    };
    document.addEventListener('focusin', onIn);
    return () => document.removeEventListener('focusin', onIn);
  }, []);

  return (
    <div className="shov fdk-pov" onMouseDown={veil}>
      <div className="shcard fdk-psheet" ref={card} role="dialog" aria-modal="true" aria-labelledby={headingId} data-friend={f.id}>
        <FriendProfile f={f} headingId={headingId} onClose={onClose} onMessage={onMessage} onGift={onGift} />
      </div>
    </div>
  );
}
