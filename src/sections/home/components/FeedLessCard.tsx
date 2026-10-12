/** Lo que queda en el lugar de una card después de "ver menos" (mock v6): amable y reversible. `failed` = no se pudo
 *  deshacer (sigue oculta: se puede reintentar). El foco va a "Deshacer" (se puede volver atrás al toque). Pura. */
export const FeedLessCard = ({ state, onUndo }: { state: 'gone' | 'undoing' | 'failed'; onUndo: () => void }) => (
  <div className="hf-card hf-lesscard" role="status">
    <p className="hf-mt">{state === 'failed' ? 'No pude deshacerlo. Probá de nuevo.' : 'Listo, vas a ver menos de esto.'}</p>
    <span className="hf-sp" />
    <button type="button" className="hf-cta is-quiet" disabled={state === 'undoing'} onClick={onUndo} autoFocus>Deshacer</button>
  </div>
);
