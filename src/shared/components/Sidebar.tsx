import { useEffect, useState, type ComponentType } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { EC_CHANGED_EVT, api } from '../../api';
import type { User } from '../../api/types';
import { useSocial } from '../../sections/friends/lib/social';
import { storePrizeFor } from '../../sections/leagues/lib/familyWeek';
import { seedNavHighlights, useNavHighlights, type NavHighlights } from '../lib/navHighlights';
import { featureAllows, useFeatures } from '../../sections/parent/lib/features';
import { cycleAllows, useCycle } from '../../sections/parent/lib/cycle';
import { BrandMark } from './BrandMark';
import { ProfileCard } from './ProfileCard';
import {
  IcNavCalendar, IcNavChat, IcNavDiscover, IcNavFamily, IcNavMoon, IcNavMyTube, IcNavLearn,
  IcNavSearch, IcNavSpace, IcNavStore,
} from './icons';

export type Sec = 'home' | 'search' | 'chat' | 'space' | 'store' | 'learn' | 'mytube' | 'afterday' | 'calendar' | 'family';
export type NavItem = { sec: Sec; label: string; to: string; Icon: ComponentType; adultOnly?: true };
/** id de la barra lateral: en el teléfono es el CAJÓN que abre «Menú» de la barra inferior (aria-controls, foco). */
export const NAV_ID = 'app-nav';
// Orden pedido por Esteban (30-oct, tanda SHELL-2): Feed · Buscar · Chat · MyTube («Mis videos») y, DESPUÉS de MyTube, Mi espacio ·
// Calendario · Aprender · Tienda. After Day no lo nombró: decisión del coordinador = al fondo (después de Tienda, antes de
// Familia), coherente con su tema «después del día». Familia sigue ABAJO DE TODO (solo adulto).
// El orden de la barra inferior del teléfono sale de acá (BottomNav: MENU_ORDER = NAV); activeFrom no depende del orden.
export const NAV: readonly NavItem[] = [
  // Feed (pedido 12-oct: el nuevo nombre de Home) = el feed de recomendaciones; sec 'home', ruta /.
  { sec: 'home', label: 'Feed', to: '/', Icon: IcNavDiscover },
  { sec: 'search', label: 'Buscar', to: '/buscar', Icon: IcNavSearch },
  // El chat es otra puerta para encontrar cosas, conversando. Sin submenús.
  { sec: 'chat', label: 'Chat', to: '/chat', Icon: IcNavChat },
  // «Mis videos» (pedido de Esteban, 30-oct): el label visible del punto MyTube; sec 'mytube' y la ruta /mytube no cambian.
  { sec: 'mytube', label: 'Mis videos', to: '/mytube', Icon: IcNavMyTube },
  // Mi espacio va directo a sus carpetas (sin submenú, pedido 12-oct).
  { sec: 'space', label: 'Mi espacio', to: '/espacio/carpetas', Icon: IcNavSpace },
  // Calendario: las clases del usuario activo con sus mentores (los contrata el adulto en Buscar → Mentores).
  { sec: 'calendar', label: 'Calendario', to: '/calendario', Icon: IcNavCalendar },
  // Aprender = Learn (W3 del porte: aprender+practicar COLAPSADOS). Practicar y Repasar ya salieron del menú
  // (decisiones 12-oct): sus rutas redirigen a /aprender.
  { sec: 'learn', label: 'Aprender', to: '/aprender', Icon: IcNavLearn },
  // Tienda: a la derecha de su etiqueta, los Energy Coins (30-oct: se mudaron de la barra superior, que ya no existe).
  { sec: 'store', label: 'Tienda', to: '/tienda', Icon: IcNavStore },
  // After Day: el audio/video de fondo curado por el padre (al fondo: decisión del coordinador, 30-oct).
  { sec: 'afterday', label: 'After Day', to: '/afterday', Icon: IcNavMoon },
  // Familia (línea 14-oct, docs/USUARIOS.md §5): el punto de menú propio del ADULTO, ABAJO DE TODO — la ex Zona de
  // padres, sin portón: ahí configura lo de sus dependientes. El chico no lo ve.
  { sec: 'family', label: 'Familia', to: '/familia', Icon: IcNavFamily, adultOnly: true },
];

/** La sección del menú que marca la ruta (la usan la barra lateral y la inferior). */
export function activeFrom(path: string): { sec?: Sec; sub?: string } {
  if (path === '/') return { sec: 'home' };
  if (path.startsWith('/buscar')) return { sec: 'search' }; // incluye artículo y video
  if (path.startsWith('/chat')) return { sec: 'chat' };
  // Mi espacio sin submenú (pedido 12-oct): la navegación interna es por carpetas; /espacio/videos
  // sigue ruteable sin link hasta que aterrice MyTube (W5 del porte).
  if (path.startsWith('/espacio/videos') || path.startsWith('/mytube')) return { sec: 'mytube' };
  if (path.startsWith('/afterday')) return { sec: 'afterday' };
  if (path.startsWith('/espacio')) return { sec: 'space' };
  if (path.startsWith('/tienda')) return { sec: 'store' };
  if (path.startsWith('/aprender')) return { sec: 'learn' };
  // /practicar* y /repasar* ya no existen (W3+W4): redirigen a /aprender en App; el instante del redirect marca Aprender.
  if (path.startsWith('/practicar') || path.startsWith('/repasar')) return { sec: 'learn' };
  if (path.startsWith('/calendario')) return { sec: 'calendar' };
  // /crear vive DENTRO de Aprender (botón en su encabezado, pedido 12-oct)
  if (path.startsWith('/crear')) return { sec: 'learn' };
  if (path === '/familia' || path.startsWith('/familia/')) return { sec: 'family' };
  return {};
}

/** Los puntos del menú que ESTE usuario ve, en el orden del menú: UNA sola fuente para la barra lateral y la inferior del
 *  teléfono (BottomNav), así los candados no se duplican. Con un ADULTO suma Familia y no lo alcanza ningún candado. */
export function useNavItems(user?: User): NavItem[] {
  const features = useFeatures();
  const cycle = useCycle();
  const adult = user?.kind === 'adult';
  return NAV.filter((n) => {
    if (n.adultOnly && !adult) return false;
    // Los candados son del CHICO: al adulto no se le esconde nada.
    if (adult) return true;
    // Tienda, Ligas, Amigos y Chat los puede apagar el padre: apagados (o sin saber todavía) no existen.
    // Ciclo del día (F2, docs/USUARIOS.md §11): una sección que no está disponible en el rango en curso (o en el que eligió
    // el selector de demo) sale del menú; el tick de 30 s, el selector y Familia la sacan y la vuelven a poner sin
    // recargar. El Feed nunca se gatea.
    return featureAllows(features, n.to) && cycleAllows(cycle, n.to);
  });
}

/** Los Energy Coins del usuario activo para el ítem Tienda (30-oct: eran de la barra superior, que se fue). null = no se
 *  muestran: con la Tienda apagada (o sin saber todavía) no se piden, y mientras no llega la primera lectura tampoco.
 *  Refresco: al montar, con EC_CHANGED_EVT (compra, canje, regalo, premio: el número cambia al instante) y al volver el foco
 *  o la pestaña. Sin poll (decisión SHELL-2: los movimientos propios ya avisan con el evento). */
function useEnergyCoins(): number | null {
  const tiendaOn = useFeatures()?.tienda === true; // con un adulto activo, siempre prendida (los candados son del chico)
  const [ec, setEc] = useState<number | null>(null);
  useEffect(() => {
    if (!tiendaOn) { setEc(null); return; }
    let alive = true;
    const load = () => { api.progress().then((p) => { if (alive) setEc(p.ec); }, () => { /* queda lo último que se supo */ }); };
    const wake = () => { if (document.visibilityState === 'visible') load(); };
    load();
    window.addEventListener(EC_CHANGED_EVT, load);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      alive = false;
      window.removeEventListener(EC_CHANGED_EVT, load);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [tiendaOn]);
  return tiendaOn ? ec : null;
}

/** El circulito del menú (pedido de Esteban, 30-oct: «toda sección que tenga menú contextual, el punto de menú tiene
 *  que tener un círculo con un número de cantidad de ítems destacados»). La cuenta es LO QUE ESPERA en el menú
 *  contextual de cada sección (shared/lib/navHighlights: el store de dos niveles). Acá vive la SIEMBRA liviana —
 *  Feed → solicitudes de amistad pendientes; Tienda → el premio de la liga de la familia en juego (0/1; la billetera
 *  no cuenta); Calendario → la próxima clase (0/1) — y cada sección la pisa con su cuenta real al armar su menú (el
 *  Feed suma el hero). Candados de siempre: sin Amigos no se piden solicitudes, sin Ligas no se pide el premio. Se lee
 *  al montar y al volver el foco o la pestaña; con 0 no hay círculo. */
function useHighlights(): NavHighlights {
  const amigosOn = useSocial() === true;
  const ligasOn = useFeatures()?.ligas === true;
  useEffect(() => {
    let alive = true;
    const load = () => {
      void Promise.allSettled([
        amigosOn ? api.requests() : Promise.reject(new Error('off')),
        api.calendar(),
        ligasOn ? api.familyLeague() : Promise.reject(new Error('off')),
      ]).then(([rq, cal, fam]) => {
        if (!alive) return;
        seedNavHighlights({
          home: rq.status === 'fulfilled' ? rq.value.requests.length : 0,
          calendar: cal.status === 'fulfilled' && cal.value.events.length > 0 ? 1 : 0,
          store: fam.status === 'fulfilled' && storePrizeFor(fam.value) ? 1 : 0,
        });
      });
    };
    const wake = () => { if (document.visibilityState === 'visible') load(); };
    load();
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      alive = false;
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [amigosOn, ligasOn]);
  return useNavHighlights();
}

/** Barra lateral estilo Duolingo (estilos en shell.css): píldora activa con borde por sección, etiquetas en
 *  mayúsculas e íconos rellenos que no cambian con el estado. Sin submenús (pedido 12-oct): Mi espacio
 *  va directo a sus carpetas. Con un ADULTO como usuario activo suma Familia al fondo y no la alcanzan los candados
 *  del chico (apagados ni ciclo del día: docs/USUARIOS.md §4). Abajo, la tarjeta de perfil (avatar → Configuración,
 *  nombre, 🎧 del Sonido de fondo y posición de liga; SHELL-2, 30-oct: la barra superior desapareció). El selector de
 *  DEMO del ciclo ya no vive acá: pasó a Configuración (pedido de Esteban, 30-oct).
 *  Los tres modos del shell (RESPONSIVE.md §2.1) son CSS sobre esta misma barra: escritorio (≥1024) tal cual; tablet
 *  (640–1023) rail de íconos de 80 px con las etiquetas ocultas visualmente (por eso cada botón lleva title/aria-label);
 *  teléfono (<640) cajón que abre «Menú» de la barra inferior (BottomNav). */
export function Sidebar({ user, covered = false }: { user?: User; /** tapada por el dock a pantalla completa: inert */ covered?: boolean }) {
  const { pathname } = useLocation();
  const go = useNavigate();
  const { sec } = activeFrom(pathname);
  const items = useNavItems(user);

  const ec = useEnergyCoins();
  const highlights = useHighlights();

  const item = (n: NavItem) => {
    if (!items.includes(n)) return null;
    const on = sec === n.sec;
    // Tienda con coins (pedido 30-oct): ⚡ + el número a la derecha de la PALABRA. En el rail de tablet la palabra no se ve
    // y los coins tampoco (shell.css); el title/aria-label los dice igual.
    const coins = n.sec === 'store' && ec !== null ? ec : null;
    const hl = highlights[n.sec] ?? 0;
    const name = (coins === null ? n.label : `${n.label}, tenés ${coins.toLocaleString('es-AR')} ${coins === 1 ? 'Energy Coin' : 'Energy Coins'}`)
      + (hl > 0 ? `, ${hl} ${hl === 1 ? 'destacado' : 'destacados'}` : '');
    return (
      <button key={n.sec} className={`nav-item${on ? ' on' : ''}`} data-sec={n.sec} aria-current={on ? 'page' : undefined}
        title={name} aria-label={name} onClick={() => go(n.to)}>
        {/* El span permite el ajuste óptico vertical de Baloo 2 (ver .nav-item span en shell.css) */}
        <n.Icon /><span>{n.label}</span>
        {coins !== null && (
          /* el MISMO ⚡ naranja que usaba la barra superior (y la billetera de la Tienda) */
          <span className="nav-ec" aria-hidden="true"><span className="nav-bolt">⚡</span>{coins.toLocaleString('es-AR')}</span>
        )}
        {/* el circulito de destacados (30-oct): cuántos ítems esperan en el menú contextual de la sección */}
        {hl > 0 && <span className="nav-hl" aria-hidden="true">{hl > 9 ? '9+' : hl}</span>}
      </button>
    );
  };

  return (
    <aside className="side" id={NAV_ID} inert={covered} aria-hidden={covered || undefined}>
      <button className="brand" onClick={() => go('/')}><BrandMark />Innerith</button>
      <nav aria-label="Secciones">
        {NAV.map((n) => (
          <div key={n.sec} className="nav-slot">
            {item(n)}
          </div>
        ))}
      </nav>
      <ProfileCard user={user} />
    </aside>
  );
}
