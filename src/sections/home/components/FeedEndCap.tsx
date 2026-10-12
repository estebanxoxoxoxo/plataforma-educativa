import { IcRefreshLine } from './feedIcons';

/** El pie del hilo (mock v6): el feed es FINITO. Mientras haya edición, "Ver más de antes" (la página siguiente la pide el
 *  chico: nada de scroll infinito); al final, "Estás al día" — un premio, no un vacío. Pura. */
export function FeedEndCap({ more, state, onMore }: { more: boolean; state: 'idle' | 'busy' | 'failed'; onMore: () => void }) {
  if (!more) {
    return (
      <div className="hf-endcap is-done">
        <p className="hf-end-t">Estás al día</p>
        <p className="hf-end-s">Eso es todo por hoy. Volvé más tarde para novedades.</p>
      </div>
    );
  }
  return (
    <div className="hf-endcap">
      <button type="button" className="hf-more" disabled={state === 'busy'} aria-busy={state === 'busy' || undefined} onClick={onMore}>
        <IcRefreshLine />{state === 'busy' ? 'Cargando…' : 'Ver más de antes'}
      </button>
      {state === 'failed' && <p className="hf-more-err" role="status">No pude traer más. Probá de nuevo.</p>}
    </div>
  );
}
