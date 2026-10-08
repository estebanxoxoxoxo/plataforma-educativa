/** Mientras carga un panel (o si falló): esqueleto sobrio o aviso con reintento. Pura. */
export function PanelState({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  if (failed) {
    return (
      <div className="pz-fail" role="alert">
        <p>No pude cargar estos datos. Revisá la conexión y probá de nuevo.</p>
        <button type="button" className="pz-btn pz-btn--ghost" onClick={onRetry}>Reintentar</button>
      </div>
    );
  }
  return (
    <div className="pz-skel" aria-busy="true" aria-label="Cargando">
      <i /><i /><i />
    </div>
  );
}
