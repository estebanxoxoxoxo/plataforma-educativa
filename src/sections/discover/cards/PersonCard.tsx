import { Avatar, lookFor } from '../../../shared/components/Avatar';
import { IcChat, IcClock } from '../../../shared/components/icons';
import type { PersonResult } from '../lib/people';

/** Un chico encontrado en Buscar → Personas: su avatar (el look de siempre, con la ropa que tenga puesta), su nombre de
 *  usuario y su línea de estado —nada más: sin texto libre— y la acción según la relación con Ian:
 *    · friend   → "Ya son amigos" (abre su conversación en el dock)
 *    · sent     → "Solicitud enviada" (espera que acepte)
 *    · none     → "Quiero contactarlo" (le manda una solicitud)
 *    · incoming → él ya quiere contactarse con Ian: "Aceptar"
 *  Pura por props. `busy` = esa acción está viajando al server. */
export function PersonCard({ p, busy, onConnect, onAccept, onChat }: {
  p: PersonResult; busy: boolean; onConnect: () => void; onAccept: () => void; onChat: () => void;
}) {
  return (
    <div className="ppl-row" data-person={p.id} data-relation={p.relation}>
      <Avatar name={p.nick} color={p.color} look={lookFor(p.nick)} accessory={p.accessory} />
      <div className="ppl-txt">
        <b className="ppl-nick">{p.nick}</b>
        <span className="ppl-status">{p.status}</span>
        {p.relation === 'incoming' && <span className="ppl-tag">Quiere contactarse con vos</span>}
      </div>
      {p.relation === 'friend' ? (
        <button className="ppl-btn ppl-btn--friend" type="button" title={`Abrir la conversación con ${p.nick}`}
          aria-label={`Ya son amigos: abrir la conversación con ${p.nick}`} onClick={onChat}><IcChat />Ya son amigos</button>
      ) : p.relation === 'sent' ? (
        <span className="ppl-btn ppl-btn--sent" role="status" title={`Esperando que ${p.nick} acepte`}><IcClock />Solicitud enviada</span>
      ) : p.relation === 'incoming' ? (
        <button className="ppl-btn ppl-btn--go" type="button" disabled={busy} aria-label={`Aceptar a ${p.nick}`} onClick={onAccept}>
          {busy ? 'Aceptando…' : 'Aceptar'}
        </button>
      ) : (
        <button className="ppl-btn ppl-btn--go" type="button" disabled={busy} aria-label={`Quiero contactarlo: mandarle una solicitud a ${p.nick}`} onClick={onConnect}>
          {busy ? 'Enviando…' : 'Quiero contactarlo'}
        </button>
      )}
    </div>
  );
}
