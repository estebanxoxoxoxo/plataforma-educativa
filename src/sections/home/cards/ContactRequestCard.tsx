import type { FriendRequest } from '../../../api/types';
import { Avatar, lookFor } from '../../../shared/components/Avatar';
import type { PinPhase } from '../lib/highlights';

/** Destacado "X quiere contactarse con vos" (zona pinneada del Feed): el avatar de quien escribe (su look de siempre), su
 *  nota y Aceptar / "Ahora no" ahí mismo. `accepted` = Ian ya dijo que sí: en lugar de los botones, un festejo corto
 *  mientras su conversación se abre en el dock; después la tarjeta se pliega. Pura por props. */
export function ContactRequestCard({ r, phase, accepted, onAccept, onDecline }: {
  r: FriendRequest; phase: PinPhase; accepted: boolean; onAccept: () => void; onDecline: () => void;
}) {
  const busy = phase !== 'idle';
  return (
    <div className="fpin-card" data-kind="contact" data-req={r.id}>
      <Avatar name={r.nick} color={r.color} look={lookFor(r.nick)} />
      <div className="fpin-body">
        <p className="fpin-line"><b>{r.nick}</b> quiere contactarse con vos</p>
        {r.note && <p className="fpin-note">“{r.note}”</p>}
      </div>
      {accepted ? (
        <p className="fpin-done" role="status"><span aria-hidden="true">🎉</span> ¡Ya son amigos! Su chat se abrió en Mensajes</p>
      ) : (
        <div className="fpin-acts">
          <button className="fpin-ok" type="button" disabled={busy} aria-label={`Aceptar a ${r.nick}`} onClick={onAccept}>Aceptar</button>
          <button className="fpin-no" type="button" disabled={busy} aria-label={`Decirle «ahora no» a ${r.nick}`} onClick={onDecline}>Ahora no</button>
        </div>
      )}
    </div>
  );
}
