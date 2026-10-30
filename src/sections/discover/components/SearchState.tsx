import { SUGGESTED_TOPICS } from '../lib/suggestions';
import { LnSearch, LnShield } from './icons';

/** Los estados de Buscar AL MEDIO (tanda BUSCARCHAT, pedido del dueño: «los empty state al medio con sugerencia de qué se
 *  puede hacer»), con el tono del POC: ícono fino, texto gris, centrado.
 *  - `empty`: «No encontré … de «q».» + UNA sugerencia (otras palabras o una de las ideas de la home, que buscan al tocarlas).
 *  - `block`: la búsqueda que el server NO hizo (SearchResponse.block: crisis / tema / falla). El texto va TAL CUAL llega,
 *    con sus saltos de línea: no se toca.
 *  - `error`: el backend no respondió. Puro. */
export function SearchState({ kind, text, q = '', onPick }: { kind: 'empty' | 'block' | 'error'; text: string; q?: string; onPick?: (topic: string) => void }) {
  // las ideas, sin la que se acaba de buscar (sugerir lo mismo que dio vacío no ayuda)
  const ideas = SUGGESTED_TOPICS.filter((t) => t.toLowerCase() !== q.trim().toLowerCase());
  const Icon = kind === 'block' ? LnShield : LnSearch;
  return (
    <div className={`sx-state sx-state--${kind}`} role="status">
      <Icon className="sx-state-ic" />
      <p className="sx-state-t">{text}</p>
      {kind === 'empty' && (
        <>
          <p className="sx-state-h">Probá con otras palabras o con una de estas ideas:</p>
          <div className="sx-chips">
            {ideas.map((t) => <button key={t} type="button" className="sx-chip" onClick={() => onPick?.(t)}>{t}</button>)}
          </div>
        </>
      )}
    </div>
  );
}
