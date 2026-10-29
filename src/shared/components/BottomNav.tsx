import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { User } from '../../api/types';
import { pickBar } from '../lib/navBar';
import { NAV, NAV_ID, activeFrom, useNavItems, type Sec } from './Sidebar';

/* Navegación del TELÉFONO (RESPONSIVE.md §2.2; decisiones D1/D2 del dueño, 28-oct). Debajo de 640 px de contenedor
   (@container app, shell.css) la barra lateral pasa a ser un CAJÓN y aparece esta barra inferior: 4 secciones + «Menú»,
   que abre el cajón con el menú COMPLETO (la misma .side: todas las secciones, «Ciclo (demo)», «Sonido de fondo» y el
   perfil). Desde 640 la barra inferior y el velo no se dibujan (display:none) y la clase is-nav-open no hace nada.
   Estilos: prefijo bnav- y .nav-scrim en shell.css. */

/** Las 4 de la barra, en orden de preferencia: las de consumo y aprendizaje para el chico (D1); para el adulto Familia
 *  entra en lugar de MyTube, al final como en el menú (D2). Si un candado o el ciclo apagan alguna, la completa la
 *  siguiente visible del menú (pickBar). Constantes: cambiar cuáles van es cambiar esta lista. */
const BAR: readonly Sec[] = ['home', 'search', 'mytube', 'learn'];
const BAR_ADULT: readonly Sec[] = ['home', 'search', 'learn', 'family'];
const MENU_ORDER = NAV.map((n) => n.sec);

export type NavDrawer = { open: boolean; toggle: () => void; close: () => void; menuRef: RefObject<HTMLButtonElement | null> };

/** Estado del cajón (vive en el Layout: la clase is-nav-open va en .app y el inert en .main y en la barra inferior).
 *  · Se cierra al navegar (cualquier navegación: un ítem del cajón, la marca, un link), con Esc o tocando el velo.
 *  · Abierto: el foco va al primer ítem; al cerrar vuelve a «Menú» (si estaba adentro del cajón o se perdió con él).
 *  · Abierto, lo que queda debajo del velo no se alcanza con Tab ni con un lector de pantalla: .main y la barra inferior
 *    van inert (la barra también aria-hidden; el dock lo oculta friends.css). Al cerrar se sacan en el mismo render, antes
 *    de que este efecto devuelva el foco a «Menú» (que vive en la barra).
 *  · Si el contenedor deja de ser teléfono con el cajón abierto (rotar, agrandar la ventana), se cierra solo: fuera del
 *    teléfono la clase no hace nada, pero el inert de .main dejaría la app sin poder usarse. */
export function useNavDrawer(): NavDrawer {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const { key } = useLocation();
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => { setOpen(false); }, [key]);

  useEffect(() => {
    if (!open) return;
    const side = document.getElementById(NAV_ID);
    const raf = requestAnimationFrame(() => side?.querySelector<HTMLElement>('.nav-item')?.focus());
    // Una hoja .shov abierta arriba (p. ej. "Tu avatar", que vive dentro del cajón) maneja su propio Esc.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('.shov')) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const bar = menuRef.current?.closest('.bnav');
    const ro = bar ? new ResizeObserver(() => { if (!bar.getClientRects().length) setOpen(false); }) : null;
    if (bar && ro) ro.observe(bar);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      ro?.disconnect();
      // el velo cuenta como "adentro": al tocarlo se enfoca y después se oculta (el foco se perdería)
      const at = document.activeElement;
      if (!at || at === document.body || side?.contains(at) || at.classList.contains('nav-scrim')) menuRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  return { open, toggle, close, menuRef };
}

/** «Menú»: tres barras redondeadas en la paleta del menú (mismo viewBox 32 y colores fijos que los IcNav*). */
const IcNavMenu = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <rect x="4" y="6.5" width="24" height="4.6" rx="2.3" fill="#3D4766" />
    <rect x="4" y="13.7" width="24" height="4.6" rx="2.3" fill="#8A5CF5" />
    <rect x="4" y="20.9" width="16" height="4.6" rx="2.3" fill="#3D4766" />
  </svg>
);

/** Barra inferior del teléfono: 4 secciones (la misma píldora por sección que el menú) + «Menú». «Menú» se marca activo
 *  con el cajón abierto o cuando la sección en la que estás no está en la barra (p. ej. Tienda). Con el cajón abierto la
 *  barra entera queda inert, como .main, y además aria-hidden (está debajo del velo: tocarla ya cerraba el cajón; con Tab se
 *  llegaba). */
export function BottomNav({ user, drawer, covered = false }: {
  user?: User; drawer: NavDrawer; /** tapada por el dock de Mensajes a pantalla completa: inert y aria-hidden */ covered?: boolean;
}) {
  const { pathname } = useLocation();
  const go = useNavigate();
  const { sec } = activeFrom(pathname);
  const bar = pickBar(useNavItems(user), user?.kind === 'adult' ? BAR_ADULT : BAR, MENU_ORDER);
  const menuOn = drawer.open || (sec !== undefined && !bar.some((n) => n.sec === sec));
  return (
    <nav className="bnav" aria-label="Secciones principales" inert={drawer.open || covered} aria-hidden={drawer.open || covered || undefined}>
      {bar.map((n) => {
        const on = !drawer.open && sec === n.sec;
        return (
          <button key={n.sec} type="button" className={`bnav-item${on ? ' on' : ''}`} data-sec={n.sec}
            aria-current={on ? 'page' : undefined} onClick={() => go(n.to)}>
            <n.Icon /><span>{n.label}</span>
          </button>
        );
      })}
      <button ref={drawer.menuRef} type="button" className={`bnav-item bnav-menu${menuOn ? ' on' : ''}`}
        aria-expanded={drawer.open} aria-controls={NAV_ID} onClick={drawer.toggle}>
        <IcNavMenu /><span>Menú</span>
      </button>
    </nav>
  );
}

/** Velo del cajón (teléfono): tocarlo cierra. Fuera del teléfono no se dibuja; cerrado está oculto (visibility). */
export function NavScrim({ drawer }: { drawer: NavDrawer }) {
  return <button type="button" className="nav-scrim" tabIndex={-1} aria-label="Cerrar menú" onClick={drawer.close} />;
}
