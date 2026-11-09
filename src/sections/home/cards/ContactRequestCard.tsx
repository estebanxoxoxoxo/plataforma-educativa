import type { FriendRequest } from '../../../api/types';
import { Avatar, lookFor } from '../../../shared/components/Avatar';
import type { PinPhase } from '../lib/highlights';
import { L } from '../../../shared/lib/lang';

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
        <p className="fpin-line"><b>{r.nick}</b> {L('quiere contactarse con vos', 'wants to connect with you')}</p>
        {r.note && <p className="fpin-note">“{r.note}”</p>}
      </div>
      {accepted ? (
        <p className="fpin-done" role="status"><span aria-hidden="true">🤝</span> {L('Ya son amigos. Su chat se abrió en Mensajes', 'You’re friends now. Their chat opened in Messages')}</p>
      ) : (
        <div className="fpin-acts">
          <button className="fpin-ok" type="button" disabled={busy} aria-label={L(`Aceptar a ${r.nick}`, `Accept ${r.nick}`)} onClick={onAccept}>{L('Aceptar', 'Accept')}</button>
          <button className="fpin-no" type="button" disabled={busy} aria-label={L(`Decirle «ahora no» a ${r.nick}`, `Tell ${r.nick} “not now”`)} onClick={onDecline}>{L('Ahora no', 'Not now')}</button>
        </div>
      )}
    </div>
  );
}
