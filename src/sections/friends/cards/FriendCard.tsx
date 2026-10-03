import type { Friend } from '../../../api/types';
import { Avatar } from '../../../shared/components/Avatar';
import { IcChat, IcInfo } from '../../../shared/components/icons';

export const FriendRow = ({ f, selected, mode, onInfo, onMsg }: { f: Friend; selected: boolean; mode?: 'info' | 'chat'; onInfo: () => void; onMsg: () => void }) => (
  <div className={`fr${selected ? ' sel' : ''}`}>
    <Avatar name={f.nick} color={f.color} />
    <div className="grow"><b>{f.nick}</b><small>{f.status}</small></div>
    <button className={`ib info${selected && mode === 'info' ? ' active' : ''}`} title="Ver información" aria-label={`Ver información de ${f.nick}`} onClick={onInfo}><IcInfo /></button>
    <button className={`ib msg${selected && mode === 'chat' ? ' active' : ''}`} title="Mandar mensaje" aria-label={`Mandar mensaje a ${f.nick}`} onClick={onMsg}><IcChat /></button>
  </div>
);
