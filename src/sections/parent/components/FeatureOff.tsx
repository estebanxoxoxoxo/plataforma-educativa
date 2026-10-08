import { Link } from 'react-router-dom';

/** Lo que ve el chico si entra (por URL directa, un link viejo, etc.) a una sección que su familia apagó.
 *  `error` = no se pudo confirmar si está prendida: tampoco se muestra (fail-closed), pero se puede reintentar. */
export function FeatureOff({ error = false, onRetry }: { error?: boolean; onRetry?: () => void }) {
  return (
    <section className="view pz-off-view" aria-labelledby="pz-off-t">
      <div className="pz-off">
        <span className="pz-off-ic" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2.5" y="7" width="19" height="10" rx="5" />
            <circle cx="7.5" cy="12" r="3" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <p className="pz-off-t" id="pz-off-t">{error ? 'No pude cargar esta parte ahora.' : 'Esta parte está apagada por tu familia.'}</p>
        {error ? (
          <button type="button" className="pz-btn pz-btn--ghost" onClick={onRetry}>Reintentar</button>
        ) : (
          <Link className="pz-btn" to="/">Ir a Descubrir</Link>
        )}
      </div>
    </section>
  );
}
