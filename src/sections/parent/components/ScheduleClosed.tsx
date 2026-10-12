import { Link } from 'react-router-dom';

/** Lo que ve el chico si entra (por URL, un link del Feed, la barra superior…) a una sección FUERA DE SU HORARIO. Port del
 *  ClosedSection del POC con sus MISMOS textos (copy.fueraDeHorario de fábrica y "Se abre de nuevo a las HH:MM." solo si hoy
 *  abre más tarde); la estética y el "Ir al Feed" son los de FeatureOff: el Feed nunca se cierra, así que siempre hay otra
 *  opción (el "nada disponible" del POC, con todo cerrado, acá no puede pasar). Pura. */
export function ScheduleClosed({ opensAt }: { opensAt: string | null }) {
  return (
    <section className="view pz-off-view" aria-labelledby="pz-closed-t">
      <div className="pz-off">
        <span className="pz-off-ic" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
          </svg>
        </span>
        <p className="pz-off-t" id="pz-closed-t">Esta parte está descansando ahora. Probá otra opción del menú 🙂</p>
        {opensAt && <p className="pz-off-sub">Se abre de nuevo a las {opensAt}.</p>}
        <Link className="pz-btn" to="/">Ir al Feed</Link>
      </div>
    </section>
  );
}
