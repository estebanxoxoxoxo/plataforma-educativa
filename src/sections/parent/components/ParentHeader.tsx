import { NavLink } from 'react-router-dom';

/** Secciones de la Zona de padres (rutas, no solapas de estado: cada una tiene su URL). Primero lo que se configura,
 *  después lo que se mira. */
const TABS = [
  { to: '/padres', label: 'Funcionalidades', end: true },
  { to: '/padres/temas', label: 'Temas y palabras', end: false },
  { to: '/padres/limites', label: 'Límites', end: false },
  { to: '/padres/avisos', label: 'Avisos', end: false },
  { to: '/padres/premios', label: 'Premios', end: false },
  { to: '/padres/actividad', label: 'Actividad', end: false },
  { to: '/padres/protecciones', label: 'Protecciones', end: false },
];

/** Cabecera de la Zona de padres: de quién es la cuenta, salir, y las secciones. `pending` = canjes que esperan que se
 *  los den; `alerts` = avisos sin ver (`crisis` = entre ellos hay uno de crisis: el contador se marca distinto). */
export function ParentHeader({ kid, pending, alerts, crisis, onExit }: { kid: string; pending: number; alerts: number; crisis: boolean; onExit: () => void }) {
  return (
    <header className="pz-head">
      <div className="pz-head-top">
        <div className="pz-head-id">
          <p className="pz-kicker">Zona de padres</p>
          <h2 className="pz-title">Cuenta de {kid}</h2>
        </div>
        <button type="button" className="pz-btn pz-btn--ghost pz-exit" onClick={onExit}>Cerrar zona de padres</button>
      </div>
      <nav className="pz-tabs" aria-label="Secciones de la zona de padres">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `pz-tab${isActive ? ' is-on' : ''}`}>
            {t.label}
            {t.to === '/padres/premios' && pending > 0 && (
              <span className="pz-count" aria-label={`, ${pending} ${pending === 1 ? 'canje pendiente' : 'canjes pendientes'}`}>{pending}</span>
            )}
            {t.to === '/padres/avisos' && alerts > 0 && (
              <span className={`pz-count${crisis ? ' is-alert' : ''}`} aria-label={`, ${alerts} ${alerts === 1 ? 'aviso sin ver' : 'avisos sin ver'}${crisis ? ', hay uno de crisis' : ''}`}>{alerts}</span>
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
