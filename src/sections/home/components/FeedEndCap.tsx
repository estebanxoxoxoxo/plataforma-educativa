import { IcRefreshLine } from './feedIcons';
import { L } from '../../../shared/lib/lang';

/** El pie del hilo (mock v6): el feed es FINITO. Mientras haya edición, "Ver más de antes" (la página siguiente la pide el
 *  chico: nada de scroll infinito); al final, "Estás al día" — un premio, no un vacío. Pura. */
export function FeedEndCap({ more, state, onMore }: { more: boolean; state: 'idle' | 'busy' | 'failed'; onMore: () => void }) {
  if (!more) {
    return (
      <div className="hf-endcap is-done">
        <p className="hf-end-t">{L('Estás al día', 'You’re all caught up')}</p>
        <p className="hf-end-s">{L('Eso es todo por hoy. Volvé más tarde para novedades.', 'That’s all for today. Come back later for news.')}</p>
      </div>
    );
  }
  return (
    <div className="hf-endcap">
      <button type="button" className="hf-more" disabled={state === 'busy'} aria-busy={state === 'busy' || undefined} onClick={onMore}>
        <IcRefreshLine />{state === 'busy' ? L('Cargando…', 'Loading…') : L('Ver más de antes', 'See older posts')}
      </button>
      {state === 'failed' && <p className="hf-more-err" role="status">{L('No pude traer más. Probá de nuevo.', 'I couldn’t load more. Try again.')}</p>}
    </div>
  );
}
