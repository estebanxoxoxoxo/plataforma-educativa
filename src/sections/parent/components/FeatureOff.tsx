import { Link } from 'react-router-dom';
import { L } from '../../../shared/lib/lang';

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
        <p className="pz-off-t" id="pz-off-t">{error ? L('No pude cargar esta parte ahora.', 'I couldn’t load this part right now.') : L('Esta parte está apagada por tu familia.', 'Your family turned this part off.')}</p>
        {error ? (
          <button type="button" className="pz-btn pz-btn--ghost" onClick={onRetry}>{L('Reintentar', 'Retry')}</button>
        ) : (
          <Link className="pz-btn" to="/">{L('Ir al Feed', 'Go to Feed')}</Link>
        )}
      </div>
    </section>
  );
}
