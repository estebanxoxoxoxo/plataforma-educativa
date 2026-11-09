import { L } from '../../../shared/lib/lang';
/** Mientras carga un panel (o si falló): esqueleto sobrio o aviso con reintento. Pura. */
export function PanelState({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  if (failed) {
    return (
      <div className="pz-fail" role="alert">
        <p>{L('No pude cargar estos datos. Revisá la conexión y probá de nuevo.', 'I couldn’t load this data. Check your connection and try again.')}</p>
        <button type="button" className="pz-btn pz-btn--ghost" onClick={onRetry}>{L('Reintentar', 'Retry')}</button>
      </div>
    );
  }
  return (
    <div className="pz-skel" aria-busy="true" aria-label={L('Cargando', 'Loading')}>
      <i /><i /><i />
    </div>
  );
}
