import { NavLink } from 'react-router-dom';

/** Secciones de Familia (la ex Zona de padres; rutas, no solapas de estado: cada una tiene su URL). Primero lo que se
 *  configura, después lo que se mira. */
const TABS = [
  { to: '/familia', label: 'Funcionalidades', end: true },
  { to: '/familia/temas', label: 'Temas y palabras', end: false },
  // Porte Smarty W5: videos, playlists y canales de YouTube de la familia (se suman al catálogo; canales de MyTube).
  { to: '/familia/youtube', label: 'YouTube', end: false },
  { to: '/familia/limites', label: 'Límites', end: false },
  { to: '/familia/avisos', label: 'Avisos', end: false },
  { to: '/familia/premios', label: 'Premios', end: false },
  // Mentorías (tanda U2): lo contratado en Buscar → Mentores, para el adulto y sus dependientes (antes, "Profesores").
  { to: '/familia/mentorias', label: 'Mentorías', end: false },
  { to: '/familia/actividad', label: 'Actividad', end: false },
  { to: '/familia/protecciones', label: 'Protecciones', end: false },
];

/** Cabecera de Familia: de quién es la cuenta que se configura y las secciones. Sin "salir": desde el 14-oct es el menú
 *  propio del adulto, sin portón (docs/USUARIOS.md §5). `pending` = canjes que esperan que se los den; `alerts` = avisos
 *  sin ver (`crisis` = entre ellos hay uno de crisis: el contador se marca distinto). */
export function ParentHeader({ kid, pending, alerts, crisis }: { kid: string; pending: number; alerts: number; crisis: boolean }) {
  return (
    <header className="pz-head">
      <div className="pz-head-top">
        <div className="pz-head-id">
          <p className="pz-kicker">Familia</p>
          <h2 className="pz-title">Cuenta de {kid}</h2>
        </div>
      </div>
      <nav className="pz-tabs" aria-label="Secciones de Familia">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `pz-tab${isActive ? ' is-on' : ''}`}>
            {t.label}
            {t.to === '/familia/premios' && pending > 0 && (
              <span className="pz-count" aria-label={`, ${pending} ${pending === 1 ? 'canje pendiente' : 'canjes pendientes'}`}>{pending}</span>
            )}
            {t.to === '/familia/avisos' && alerts > 0 && (
              <span className={`pz-count${crisis ? ' is-alert' : ''}`} aria-label={`, ${alerts} ${alerts === 1 ? 'aviso sin ver' : 'avisos sin ver'}${crisis ? ', hay uno de crisis' : ''}`}>{alerts}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
