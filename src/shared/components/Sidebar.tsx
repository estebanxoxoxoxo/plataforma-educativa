import type { ComponentType } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { User } from '../../api/types';
import { featureAllows, useFeatures } from '../../sections/parent/lib/features';
import { BrandMark } from './BrandMark';
import { MiniPlayer } from './MiniPlayer';
import { ProfileCard } from './ProfileCard';
import {
  IcNavCalendar, IcNavChat, IcNavDiscover, IcNavMyTube, IcNavLearn,
  IcNavSearch, IcNavSpace, IcNavStore,
} from './icons';

type Sec = 'home' | 'search' | 'chat' | 'space' | 'store' | 'learn' | 'mytube' | 'calendar';
// Orden definido por Esteban (9-oct-2026): Home primero, Mi espacio al final.
// El submenú de Mi espacio se engancha por sec, no por posición.
const NAV: { sec: Sec; label: string; to: string; Icon: ComponentType }[] = [
  // Feed (pedido 12-oct: el nuevo nombre de Home) = el feed de recomendaciones; sec 'home', ruta /.
  { sec: 'home', label: 'Feed', to: '/', Icon: IcNavDiscover },
  { sec: 'search', label: 'Buscar', to: '/buscar', Icon: IcNavSearch },
  // El chat es otra puerta para encontrar cosas, conversando. Sin submenús.
  { sec: 'chat', label: 'Chat', to: '/chat', Icon: IcNavChat },
  // MyTube después de Chat (pedido 12-oct).
  { sec: 'mytube', label: 'MyTube', to: '/mytube', Icon: IcNavMyTube },
  // Aprender se vuelve Learn (W3 del porte: aprender+practicar COLAPSADOS). Practicar y Repasar ya
  // salieron del menú (decisiones 12-oct): sus rutas siguen vivas por URL hasta que el porte las absorba.
  { sec: 'learn', label: 'Aprender', to: '/aprender', Icon: IcNavLearn },
  // Tienda después de Aprender y Calendario detrás (pedido 12-oct, noche).
  { sec: 'store', label: 'Tienda', to: '/tienda', Icon: IcNavStore },
  // Calendario: las clases con los profes que contrató el padre.
  { sec: 'calendar', label: 'Calendario', to: '/calendario', Icon: IcNavCalendar },
  // Mi espacio AL FONDO (pedido 12-oct).
  { sec: 'space', label: 'Mi espacio', to: '/espacio/carpetas', Icon: IcNavSpace },
];

function activeFrom(path: string): { sec?: Sec; sub?: string } {
  if (path === '/') return { sec: 'home' };
  if (path.startsWith('/buscar')) return { sec: 'search' }; // incluye artículo y video
  if (path.startsWith('/chat')) return { sec: 'chat' };
  // Mi espacio sin submenú (pedido 12-oct): la navegación interna es por carpetas; /espacio/videos
  // sigue ruteable sin link hasta que aterrice MyTube (W5 del porte).
  if (path.startsWith('/espacio/videos') || path.startsWith('/mytube')) return { sec: 'mytube' };
  if (path.startsWith('/espacio')) return { sec: 'space' };
  if (path.startsWith('/tienda')) return { sec: 'store' };
  if (path.startsWith('/aprender')) return { sec: 'learn' };
  // /practicar y /repasar siguen ruteables sin ítem: se marcan como parte de Aprender.
  if (path.startsWith('/practicar') || path.startsWith('/repasar')) return { sec: 'learn' };
  if (path.startsWith('/calendario')) return { sec: 'calendar' };
  // /crear vive DENTRO de Aprender (botón en su encabezado, pedido 12-oct)
  if (path.startsWith('/crear')) return { sec: 'learn' };
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
