import type { Friend } from '../../../api/types';
import { Avatar, accessoryArticle, accessoryById, lookFor, wornLabel } from '../../../shared/components/Avatar';
import { IcChat, IcClose } from '../../../shared/components/icons';

/** Detalle de un amigo (el panel de la derecha que abre ⓘ). Si lleva ropa puesta (en el demo: un regalo de Ian), se ve
 *  en su avatar y lo dice debajo del nombre. `onGift` (solo con la Tienda prendida) lleva a la ropa de la Tienda para
 *  regalarle una prenda (la hoja de regalo vive allá, con los precios y la billetera a la vista). */
export const FriendProfile = ({ f, onClose, onMessage, onGift }: { f: Friend; onClose: () => void; onMessage: () => void; onGift?: () => void }) => {
  const wearing = accessoryById(f.accessory);
  return (
    <div className="fpbody">
      <button className="fpx" type="button" title="Cerrar" aria-label={`Cerrar la información de ${f.nick}`} onClick={onClose}><IcClose /></button>
      <div className="fprof">
        <Avatar name={f.nick} color={f.color} look={lookFor(f.nick)} accessory={f.accessory} />
        <div>
          <h3>{f.nick}</h3>
          <small>Amigos desde {f.since}</small>
          {wearing && <span className="fwear" data-acc={wearing.id}><span aria-hidden="true">{wearing.emoji}</span> Tiene {wornLabel(wearing).toLowerCase()} {accessoryArticle(wearing)}</span>}
        </div>
      </div>
      <div className="fstats">
        <div><b>{f.xp}</b><span>XP totales</span></div>
        <div><b>{f.streak}</b><span>Racha</span></div>
        <div><b>{f.league.replace('Liga ', '')}</b><span>Liga actual</span></div>
      </div>
      <div><span className="lbl">Cursos en común</span><div className="fchips">{f.commonCourses.map((c) => <span key={c}>{c}</span>)}</div></div>
      <div className="fpacts">
        <button className="fpmsg" type="button" onClick={onMessage}><IcChat />Mandar mensaje</button>
        {onGift && <button className="fpgift" type="button" onClick={onGift}><span aria-hidden="true">🎁</span>Regalale ropa</button>}
      </div>
    </div>
  );
};
