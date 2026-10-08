import type { ComponentType } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { User } from '../../api/types';
import { BrandMark } from './BrandMark';
import { MiniPlayer } from './MiniPlayer';
import {
  IcNavDiscover, IcNavFolder, IcNavFriends, IcNavHome, IcNavLeagues, IcNavLearn,
  IcNavPractice, IcNavSearch, IcNavSpace, IcNavStore, IcNavTv,
} from './icons';

type Sec = 'home' | 'search' | 'discover' | 'space' | 'store' | 'learn' | 'practice' | 'friends' | 'leagues';
const NAV: { sec: Sec; label: string; to: string; Icon: ComponentType }[] = [
  { sec: 'home', label: 'Inicio', to: '/', Icon: IcNavHome },
  { sec: 'search', label: 'Buscar', to: '/buscar', Icon: IcNavSearch },
  // Descubrir ES el chat (la forma conversacional de encontrar cosas). Sin submenús.
  { sec: 'discover', label: 'Descubrir', to: '/descubrir', Icon: IcNavDiscover },
  { sec: 'space', label: 'Mi espacio', to: '/espacio/carpetas', Icon: IcNavSpace },
  // Tienda: premios que publica el padre y se canjean con la Energy Coin cosechada practicando.
  { sec: 'store', label: 'Tienda', to: '/tienda', Icon: IcNavStore },
  { sec: 'learn', label: 'Aprender', to: '/aprender', Icon: IcNavLearn },
  { sec: 'practice', label: 'Practicar', to: '/practicar', Icon: IcNavPractice },
  { sec: 'friends', label: 'Amigos', to: '/amigos', Icon: IcNavFriends },
  { sec: 'leagues', label: 'Ligas', to: '/ligas', Icon: IcNavLeagues },
];

function activeFrom(path: string): { sec?: Sec; sub?: string } {
  if (path === '/') return { sec: 'home' };
  if (path.startsWith('/buscar')) return { sec: 'search' }; // incluye artículo y video
  if (path.startsWith('/descubrir')) return { sec: 'discover' };
  if (path.startsWith('/espacio')) {
    return { sec: 'space', sub: path.startsWith('/espacio/videos') ? 'videos' : 'folders' };
  }
  if (path.startsWith('/tienda')) return { sec: 'store' };
  if (path.startsWith('/aprender')) return { sec: 'learn' };
  if (path.startsWith('/practicar')) return { sec: 'practice' };
  if (path.startsWith('/amigos')) return { sec: 'friends' };
  if (path.startsWith('/ligas')) return { sec: 'leagues' };
  return {};
}

/** Barra lateral estilo Duolingo (estilos en shell.css): píldora activa con borde por sección, etiquetas en
 *  mayúsculas e íconos rellenos que no cambian con el estado. Mi espacio despliega Carpetas/Videos debajo. */
export function Sidebar({ user }: { user?: User }) {
  const { pathname } = useLocation();
  const go = useNavigate();
  const { sec, sub } = activeFrom(pathname);

  const item = (n: (typeof NAV)[number]) => {
    const on = sec === n.sec;
    // Con submenú abierto, la página actual la marca el sub-ítem; el padre queda como "parte de lo actual".
    const current = on ? (n.sec === 'space' ? 'true' : 'page') : undefined;
    return (
      <button key={n.sec} className={`nav-item${on ? ' on' : ''}`} data-sec={n.sec} aria-current={current} onClick={() => go(n.to)}>
        <n.Icon />{n.label}
      </button>
    );
  };
  const subItem = (key: string, label: string, to: string, Icon: ComponentType) => (
    <button key={key} className={`sub-item${sub === key ? ' on' : ''}`} aria-current={sub === key ? 'page' : undefined} onClick={() => go(to)}>
      <Icon />{label}
    </button>
  );

  return (
    <aside className="side">
      <button className="brand" onClick={() => go('/')}><BrandMark />Innerith</button>
      <nav aria-label="Secciones">
        {NAV.slice(0, 4).map(item)}
        {/* .sub anima la altura (0fr → 1fr) y .sub-in recorta; cerrado queda fuera del orden de tabulación. */}
        <div className={`sub${sec === 'space' ? ' open' : ''}`}>
          <div className="sub-in">
            {subItem('folders', 'Carpetas', '/espacio/carpetas', IcNavFolder)}
            {subItem('videos', 'Videos', '/espacio/videos', IcNavTv)}
          </div>
        </div>
        {NAV.slice(4).map(item)}
      </nav>
      <MiniPlayer />
      <div className="profile">
        <span className="av">{user?.name[0] ?? ''}</span>
        <div><b>{user?.name ?? '…'}</b><small>{user ? `${user.age} años` : ''}</small></div>
      </div>
    </aside>
  );
}
