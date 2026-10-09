import type { Friend } from '../../../api/types';
import { Avatar } from '../../../shared/components/Avatar';
import { IcChat, IcClose } from '../../../shared/components/icons';

/** Detalle de un amigo (el panel de la derecha que abre ⓘ). */
export const FriendProfile = ({ f, onClose, onMessage }: { f: Friend; onClose: () => void; onMessage: () => void }) => (
  <div className="fpbody">
    <button className="fpx" type="button" title="Cerrar" aria-label={`Cerrar la información de ${f.nick}`} onClick={onClose}><IcClose /></button>
    <div className="fprof"><Avatar name={f.nick} color={f.color} /><div><h3>{f.nick}</h3><small>Amigos desde {f.since}</small></div></div>
    <div className="fstats">
      <div><b>{f.xp}</b><span>XP totales</span></div>
      <div><b>{f.streak}</b><span>Racha</span></div>
      <div><b>{f.league.replace('Liga ', '')}</b><span>Liga actual</span></div>
    </div>
    <div><span className="lbl">Cursos en común</span><div className="fchips">{f.commonCourses.map((c) => <span key={c}>{c}</span>)}</div></div>
    <button className="fpmsg" type="button" onClick={onMessage}><IcChat />Mandar mensaje</button>
  </div>
);
