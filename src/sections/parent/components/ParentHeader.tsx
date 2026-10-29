import { useEffect, useLayoutEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { FamilyMember } from '../../../api/types';
import { listEs } from '../lib/format';
import { famTo } from '../lib/member';
import { MemberPicker } from './MemberPicker';

/** Teléfono (tanda T5): de qué lado de la fila de solapas queda más para deslizar. Lo marca en `data-fade` y parent.css
 *  esfuma ESE borde (con 11 solapas en una fila, 7 quedan afuera: que se note que hay más). Sin desborde → vacío. */
function markFade(el: HTMLElement) {
  const max = el.scrollWidth - el.clientWidth;
  const start = max > 1 && el.scrollLeft > 1;
  const end = max > 1 && el.scrollLeft < max - 1;
  const v = start && end ? 'both' : start ? 'start' : end ? 'end' : '';
  if (el.dataset.fade !== v) el.dataset.fade = v;
}
/** La activa al CENTRO de la fila (si la fila desborda). */
function centerActive(el: HTMLElement) {
  const tab = el.querySelector<HTMLElement>('.pz-tab.is-on');
  const max = el.scrollWidth - el.clientWidth;
  if (tab && max > 1) el.scrollLeft = Math.max(0, Math.min(max, tab.offsetLeft - (el.clientWidth - tab.offsetWidth) / 2));
}
/** Trae `tab` entera a la vista SOLO en horizontal, fuera de lo esfumado (el scroll-padding de la fila, parent.css): un
 *  scrollIntoView movía también la PÁGINA (QA-T5 R3: tocar una solapa a medias la bajaba 24 px). */
function revealInline(el: HTMLElement, tab: HTMLElement) {
  const pad = parseFloat(getComputedStyle(el).scrollPaddingInlineStart) || 0;
  const l = tab.offsetLeft, r = l + tab.offsetWidth;
  if (l - pad < el.scrollLeft) el.scrollLeft = l - pad;
  else if (r + pad > el.scrollLeft + el.clientWidth) el.scrollLeft = r + pad - el.clientWidth;
}

/** Secciones de Familia (la ex Zona de padres; rutas, no solapas de estado: cada una tiene su URL). Primero lo que se
 *  configura, después lo que se mira. Cada link lleva el integrante elegido (`?m=`): la elección sobrevive al cambiar de
 *  solapa. NavLink compara solo el pathname, así que la solapa activa se marca igual. */
const TABS = [
  { to: '/familia', label: 'Funcionalidades', end: true },
  { to: '/familia/temas', label: 'Temas y palabras', end: false },
  // MyTube (F2, 28-oct; ex «YouTube», /familia/youtube redirige): la MISMA grilla de canales que ve el chico + el agregar por
  // URL (porte W5: videos, playlists y canales de YouTube que se suman al catálogo). De toda la familia.
  { to: '/familia/mytube', label: 'MyTube', end: false },
  // After Day con solapa propia (F2; antes vivía al pie de YouTube): la misma grilla del chico + agregar/quitar.
  { to: '/familia/afterday', label: 'After Day', end: false },
  // Límites = topes de volumen + la zona horaria de la familia.
  { to: '/familia/limites', label: 'Límites', end: false },
  // Ciclo del día (F2, docs/USUARIOS.md §11): rangos horarios y qué secciones hay en cada uno, por integrante.
  { to: '/familia/ciclo', label: 'Ciclo del día', end: false },
  { to: '/familia/avisos', label: 'Avisos', end: false },
  { to: '/familia/premios', label: 'Premios', end: false },
  // Mentorías (tanda U2): lo contratado en Buscar → Mentores, para el adulto y sus dependientes (antes, "Profesores").
  { to: '/familia/mentorias', label: 'Mentorías', end: false },
  { to: '/familia/actividad', label: 'Actividad', end: false },
  { to: '/familia/protecciones', label: 'Protecciones', end: false },
];

/** Cabecera de Familia (U3 · M2): a quién se configura —"Cuenta de {integrante}", o "Toda la familia" en las solapas que son
 *  de la familia (`note` dice por qué)—, el selector de integrante y las secciones. Sin "salir": desde el 14-oct es el menú
 *  propio del adulto, sin portón (docs/USUARIOS.md §5).
 *  Contadores: `pending` = canjes del integrante elegido que esperan que se los den; `unseenBy` = avisos sin ver POR
 *  integrante (en cada chip) y el de la solapa Avisos es el de TODA la familia —un aviso de Luna no se pierde mientras se
 *  mira a Ian— (`crisis` = entre ellos hay uno de crisis: se marca distinto). Pura en lo de dominio (datos y acciones por
 *  props); lo único propio es la presentación de la fila de solapas en el teléfono (centrar la activa, esfumar bordes). */
export function ParentHeader({ member, members, note, onPick, unseenBy, pending, alerts, crisis }: {
  member: FamilyMember;
  members: FamilyMember[];
  /** solapa de toda la familia: la nota que va bajo el título (null = la solapa es del integrante elegido) */
  note: string | null;
  onPick: (id: string) => void;
  unseenBy: Record<string, number>;
  pending: number;
  alerts: number;
  crisis: boolean;
}) {
  const family = note !== null;
  const who = members.filter((m) => (unseenBy[m.id] ?? 0) > 0).map((m) => `${unseenBy[m.id]} sobre ${m.name}`);
  // Teléfono (T5, docs/RESPONSIVE.md §4.6): las 11 solapas van en UNA fila deslizable (parent.css). La activa se trae al
  // centro de la fila al entrar, al cambiar de solapa y cuando llegan los contadores (corren las solapas que siguen), y los
  // bordes se esfuman según quede más de cada lado. Donde las solapas bajan de línea (tablet y escritorio) la fila no
  // desborda y nada de esto hace nada. Solo presentación: no hay estado de dominio acá.
  const nav = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const el = nav.current;
    if (!el) return;
    centerActive(el);
    markFade(el);
  }, [pathname, pending, alerts]);
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const on = () => markFade(el);
    const overflows = () => el.scrollWidth > el.clientWidth + 1;
    // Con el TECLADO (solo :focus-visible: un toque o un clic no mueven nada): el navegador trae la solapa enfocada justo al
    // borde, debajo de lo esfumado; se la deja entera a la vista, solo en horizontal.
    const focus = (e: FocusEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && overflows() && t.matches(':focus-visible')) revealInline(el, t);
    };
    // Flechas con una solapa enfocada (QA-T5 R2): por defecto scrolleaban la fila y la enfocada quedaba afuera; con la fila
    // desbordada mueven el foco a la solapa vecina (que se trae a la vista). Tab sigue recorriéndolas todas, como links.
    const keys = (e: KeyboardEvent) => {
      if ((e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') || e.altKey || e.ctrlKey || e.metaKey || !overflows()) return;
      const tabs = [...el.querySelectorAll<HTMLElement>('.pz-tab')];
      const i = tabs.indexOf(e.target as HTMLElement);
      if (i < 0) return;
      e.preventDefault();
      const next = tabs[i + (e.key === 'ArrowRight' ? 1 : -1)];
      if (next) { next.focus({ preventScroll: true }); revealInline(el, next); }
    };
    // Al girar el teléfono (cambia el ANCHO de la fila) la activa vuelve al centro (QA-T5 R4: quedaba fuera de la fila).
    let width = el.clientWidth;
    const resized = () => {
      if (el.clientWidth !== width) { width = el.clientWidth; centerActive(el); }
      markFade(el);
    };
    el.addEventListener('scroll', on, { passive: true });
    el.addEventListener('focusin', focus);
    el.addEventListener('keydown', keys);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resized);
    ro?.observe(el);
    return () => {
      el.removeEventListener('scroll', on); el.removeEventListener('focusin', focus); el.removeEventListener('keydown', keys);
      ro?.disconnect();
    };
  }, []);
  return (
    <header className="pz-head">
      <div className="pz-head-top">
        <div className="pz-head-id">
          <p className="pz-kicker">Familia</p>
          <h2 className="pz-title">{family ? 'Toda la familia' : `Cuenta de ${member.name}`}</h2>
          {family && <p className="pz-mem-note">{note}</p>}
        </div>
        {members.length > 0 && <MemberPicker members={members} selected={member.id} unseenBy={unseenBy} disabled={family} onPick={onPick} />}
      </div>
      <nav className="pz-tabs" aria-label="Secciones de Familia" ref={nav}>
        {TABS.map((t) => (
          <NavLink key={t.to} to={famTo(t.to, member.id)} end={t.end} className={({ isActive }) => `pz-tab${isActive ? ' is-on' : ''}`}>
            {t.label}
            {t.to === '/familia/premios' && pending > 0 && (
              <span className="pz-count" aria-label={`, ${pending} ${pending === 1 ? 'canje pendiente' : 'canjes pendientes'} de ${member.name}`}>{pending}</span>
            )}
            {t.to === '/familia/avisos' && alerts > 0 && (
              <span className={`pz-count${crisis ? ' is-alert' : ''}`}
                aria-label={`, ${alerts} ${alerts === 1 ? 'aviso sin ver' : 'avisos sin ver'}${who.length ? ` (${listEs(who)})` : ''}${crisis ? ', hay uno de crisis' : ''}`}>{alerts}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
