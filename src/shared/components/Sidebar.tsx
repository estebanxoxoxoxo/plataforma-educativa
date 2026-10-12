import type { ComponentType } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { User } from '../../api/types';
import { featureAllows, useFeatures } from '../../sections/parent/lib/features';
import { BrandMark } from './BrandMark';
import { MiniPlayer } from './MiniPlayer';
import { ProfileCard } from './ProfileCard';
import {
  IcNavCalendar, IcNavChat, IcNavCreate, IcNavDiscover, IcNavFriends, IcNavLeagues, IcNavLearn,
  IcNavPractice, IcNavRecall, IcNavSearch, IcNavSpace, IcNavStore,
} from './icons';

type Sec = 'home' | 'search' | 'chat' | 'space' | 'store' | 'learn' | 'practice' | 'recall' | 'friends' | 'leagues' | 'calendar' | 'create';
// Orden definido por Esteban (9-oct-2026): Home primero, Mi espacio al final.
// El submenú de Mi espacio se engancha por sec, no por posición.
const NAV: { sec: Sec; label: string; to: string; Icon: ComponentType }[] = [
  // Home ES el feed de recomendaciones (el "descubrir" de la visión, tipo YouTube/Instagram); sec 'home', ruta /.
  { sec: 'home', label: 'Home', to: '/', Icon: IcNavDiscover },
  { sec: 'search', label: 'Buscar', to: '/buscar', Icon: IcNavSearch },
  // El chat es otra puerta para encontrar cosas, conversando. Sin submenús.
  { sec: 'chat', label: 'Chat', to: '/chat', Icon: IcNavChat },
  { sec: 'learn', label: 'Aprender', to: '/aprender', Icon: IcNavLearn },
  { sec: 'practice', label: 'Practicar', to: '/practicar', Icon: IcNavPractice },
  // Repasar = las cartas diarias del Active Recall (visión, audio 17): refresca lo que quedó flojo.
  { sec: 'recall', label: 'Repasar', to: '/repasar', Icon: IcNavRecall },
  // Tienda: premios que publica el padre y se canjean con la Energy Coin cosechada practicando.
  { sec: 'store', label: 'Tienda', to: '/tienda', Icon: IcNavStore },
  { sec: 'friends', label: 'Amigos', to: '/amigos', Icon: IcNavFriends },
  { sec: 'leagues', label: 'Ligas', to: '/ligas', Icon: IcNavLeagues },
  { sec: 'space', label: 'Mi espacio', to: '/espacio/carpetas', Icon: IcNavSpace },
  // Calendario: las clases con los profes que contrató el padre (pedido 11-oct: "después de Mi espacio").
  { sec: 'calendar', label: 'Calendario', to: '/calendario', Icon: IcNavCalendar },
  // Crear: el creador de rutas del porte Smarty (decisión 12-oct: en la zona del chico, como el POC).
  { sec: 'create', label: 'Crear', to: '/crear', Icon: IcNavCreate },
];

function activeFrom(path: string): { sec?: Sec; sub?: string } {
  if (path === '/') return { sec: 'home' };
  if (path.startsWith('/buscar')) return { sec: 'search' }; // incluye artículo y video
  if (path.startsWith('/chat')) return { sec: 'chat' };
  // Mi espacio sin submenú (pedido 12-oct): la navegación interna es por carpetas; /espacio/videos
  // sigue ruteable sin link hasta que aterrice MyTube (W5 del porte).
  if (path.startsWith('/espacio')) return { sec: 'space' };
  if (path.startsWith('/tienda')) return { sec: 'store' };
  if (path.startsWith('/aprender')) return { sec: 'learn' };
  if (path.startsWith('/practicar')) return { sec: 'practice' };
  if (path.startsWith('/repasar')) return { sec: 'recall' };
  if (path.startsWith('/amigos')) return { sec: 'friends' };
  if (path.startsWith('/ligas')) return { sec: 'leagues' };
  if (path.startsWith('/calendario')) return { sec: 'calendar' };
  if (path.startsWith('/crear')) return { sec: 'create' };
  return {};
}

/** Barra lateral estilo Duolingo (estilos en shell.css): píldora activa con borde por sección, etiquetas en
 *  mayúsculas e íconos rellenos que no cambian con el estado. Sin submenús (pedido 12-oct): Mi espacio
 *  va directo a sus carpetas. */
export function Sidebar({ user }: { user?: User }) {
  const { pathname } = useLocation();
  const go = useNavigate();
  const { sec } = activeFrom(pathname);
  const features = useFeatures();

  const item = (n: (typeof NAV)[number]) => {
    // Tienda, Ligas, Amigos y Chat los puede apagar el padre: apagados (o sin saber todavía) no existen.
    if (!featureAllows(features, n.to)) return null;
    const on = sec === n.sec;
    return (
      <button key={n.sec} className={`nav-item${on ? ' on' : ''}`} data-sec={n.sec} aria-current={on ? 'page' : undefined} onClick={() => go(n.to)}>
        {/* El span permite el ajuste óptico vertical de Baloo 2 (ver .nav-item span en shell.css) */}
        <n.Icon /><span>{n.label}</span>
      </button>
    );
  };

  return (
    <aside className="side">
      <button className="brand" onClick={() => go('/')}><BrandMark />Innerith</button>
      <nav aria-label="Secciones">
        {NAV.map((n) => (
          <div key={n.sec} className="nav-slot">
            {item(n)}
          </div>
        ))}
      </nav>
      <MiniPlayer />
      <ProfileCard user={user} />
      {/* Acceso discreto a la Zona de padres (no es parte del menú del chico; estilo en parent.css) */}
      <Link className="pz-access" to="/padres">Zona de padres</Link>
    </aside>
  );
}
