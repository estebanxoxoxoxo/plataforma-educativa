import { IcAdMusic } from './AdIcons';

/** Vacío: todavía no hay contenido; lo agrega un adulto desde Familia (la ex Zona de padres). Los textos del POC decían
 *  «audio»: desde el 29-oct (pedido de Esteban) After Day es «contenido para ver o escuchar», y acá se habla igual. Pura. */
export function AdEmpty() {
  return (
    <div className="ad-none">
      <IcAdMusic aria-hidden="true" />
      <p>Todavía no hay nada acá.<small>Un adulto puede agregar contenido desde el panel.</small></p>
    </div>
  );
}

/** Mientras carga: la grilla con tarjetas vacías (el POC, con Dexie local, no tenía espera). Pura. */
export function AdSkeleton() {
  return (
    <div className="ad-grid" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: 4 }, (_, i) => (
        <span key={i} className="ad-card is-sk"><span className="ad-th ad-sk" /><i className="ad-sk" /></span>
      ))}
    </div>
  );
}

/** No se pudo leer la lista: no se muestra nada a medias (fail-closed) y se puede reintentar. Pura. */
export function AdFail({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="ad-fail" role="alert">
      <p>No pude cargar el contenido ahora.</p>
      <button type="button" className="ad-retry" onClick={onRetry}>Reintentar</button>
    </div>
  );
}
