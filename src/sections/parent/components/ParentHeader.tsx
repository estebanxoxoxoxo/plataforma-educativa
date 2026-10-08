import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/padres', label: 'Funcionalidades', end: true },
  { to: '/padres/premios', label: 'Premios', end: false },
  { to: '/padres/actividad', label: 'Actividad', end: false },
  { to: '/padres/protecciones', label: 'Protecciones', end: false },
];

/** Cabecera de la Zona de padres: de quién es la cuenta, salir, y las cuatro secciones (rutas, no solapas
 *  de estado: cada una tiene su URL). `pending` = canjes de Ian que esperan que se los den. */
export function ParentHeader({ kid, pending, onExit }: { kid: string; pending: number; onExit: () => void }) {
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
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
