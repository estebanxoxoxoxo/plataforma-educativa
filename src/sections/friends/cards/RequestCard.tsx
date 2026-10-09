import type { FriendRequest } from '../../../api/types';
import { Avatar } from '../../../shared/components/Avatar';

/** Solicitud de amistad entrante: avatar, nick y la nota del que la manda + Aceptar / Ahora no.
 *  `leaving` = se está plegando (ya se aceptó o se rechazó). */
export const RequestCard = ({ r, busy, leaving, onAccept, onDecline }: {
  r: FriendRequest; busy: boolean; leaving: boolean; onAccept: () => void; onDecline: () => void;
}) => (
  <div className={`freq${leaving ? ' out' : ''}`}>
    <div className="freq-clip">
      <div className="freq-card">
        <Avatar name={r.nick} color={r.color} />
        <div className="grow">
          <p className="freq-line"><b>{r.nick}</b> te mandó una solicitud de amistad</p>
          {r.note && <p className="freq-note">“{r.note}”</p>}
        </div>
        <div className="freq-acts">
          <button className="freq-ok" type="button" disabled={busy || leaving} onClick={onAccept}>Aceptar</button>
          <button className="freq-no" type="button" disabled={busy || leaving} onClick={onDecline}>Ahora no</button>
        </div>
      </div>
    </div>
  </div>
);
