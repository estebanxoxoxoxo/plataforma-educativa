import type { ComponentType } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { User } from '../../api/types';
import { BrandMark } from './BrandMark';
import { IcChat, IcDiscover, IcFriends, IcLearn, IcPractice, IcSearch, IcTrophyLine } from './icons';

type Sec = 'discover' | 'learn' | 'practice' | 'friends' | 'leagues';
const NAV: { sec: Sec; label: string; to: string; Icon: ComponentType }[] = [
  { sec: 'discover', label: 'Descubrir', to: '/descubrir/busqueda', Icon: IcDiscover },
  { sec: 'learn', label: 'Aprender', to: '/aprender', Icon: IcLearn },
  { sec: 'practice', label: 'Practicar', to: '/practicar', Icon: IcPractice },
  { sec: 'friends', label: 'Amigos', to: '/amigos', Icon: IcFriends },
  { sec: 'leagues', label: 'Ligas', to: '/ligas', Icon: IcTrophyLine },
];
function activeFrom(path: string): { sec?: Sec; sub?: 'search' | 'chat' } {
  if (path.startsWith('/descubrir')) return { sec: 'discover', sub: path.startsWith('/descubrir/chat') ? 'chat' : 'search' };
  if (path.startsWith('/aprender')) return { sec: 'learn' };
  if (path.startsWith('/practicar')) return { sec: 'practice' };
  if (path.startsWith('/amigos')) return { sec: 'friends' };
  if (path.startsWith('/ligas')) return { sec: 'leagues' };
  return {};
}
export function Sidebar({ user }: { user?: User }) {
  const { pathname } = useLocation();
  const go = useNavigate();
  const { sec, sub } = activeFrom(pathname);

  const item = (n: (typeof NAV)[number]) => (
    <button key={n.sec} className={`nav-item${sec === n.sec ? ' on' : ''}`} data-sec={n.sec} onClick={() => go(n.to)}>
      <n.Icon />{n.label}
    </button>
  );

  return (
    <aside className="side">
      <button className="brand" onClick={() => go('/')}><BrandMark />Innerith</button>
      <nav>
        {item(NAV[0])}
        <div className={`sub${sec === 'discover' ? ' open' : ''}`}>
          <button className={`sub-item${sub === 'search' ? ' on' : ''}`} onClick={() => go('/descubrir/busqueda')}><IcSearch />Búsqueda</button>
          <button className={`sub-item${sub === 'chat' ? ' on' : ''}`} onClick={() => go('/descubrir/chat')}><IcChat />Chat</button>
        </div>
        {NAV.slice(1).map(item)}
      </nav>
      <div className="profile">
        <span className="av">{user?.name[0] ?? ''}</span>
        <div><b>{user?.name ?? '…'}</b><small>{user ? `${user.age} años` : ''}</small></div>
      </div>
    </aside>
  );
}
