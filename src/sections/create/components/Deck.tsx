import { cardsOf, questionsOf, type DraftPosta } from '../lib/routeDraft';
import { IcClose } from '../../../shared/components/icons';
import { IcCrPlus } from './CreateIcons';

/** El contenido de una posta (comprensión o profundización): mazo de flashcards EDITABLE a mano, o vista previa de opción
 *  múltiple SOLO LECTURA (POC: para cambiarla hay que regenerar; la correcta es la que se marca). Pura. */
export function Deck({ posta, onCard, onAddCard, onRemoveCard }: {
  posta: DraftPosta;
  onCard: (ci: number, field: 'front' | 'back', val: string) => void;
  onAddCard: () => void;
  onRemoveCard: (ci: number) => void;
}) {
  if (posta.def.typeId === 'multiplechoice') {
    const qs = questionsOf(posta);
    return (
      <div className="cr-deck cr-mc">
        <ol className="cr-mc-qs">
          {qs.map((q, qi) => (
            <li key={q.id} className="cr-mc-q">
              <p className="cr-mc-prompt">{qi + 1}. {q.prompt}</p>
              <ul className="cr-mc-opts">
                {q.options.map((o) => (
                  <li key={o.id} className={o.correct ? 'cr-mc-opt is-ok' : 'cr-mc-opt'}>
                    <span className="cr-mc-mark" aria-hidden="true">{o.correct ? '✓' : '·'}</span>
                    {o.text}
                    {o.correct && <span className="cr-sr"> (correcta)</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className="cr-deck-note">Opción múltiple — {qs.length} pregunta(s). Para cambiarlas, regenerá el módulo.</p>
      </div>
    );
  }

  return (
    <div className="cr-deck">
      {cardsOf(posta).map((c, ci) => (
        <div key={c.id} className="cr-card">
          <input className="cr-input cr-input--sm" value={c.front} onChange={(e) => onCard(ci, 'front', e.target.value)} placeholder="Frente (pregunta)" aria-label={`Tarjeta ${ci + 1}: frente`} />
          <span className="cr-card-arrow" aria-hidden="true">→</span>
          <input className="cr-input cr-input--sm" value={c.back} onChange={(e) => onCard(ci, 'back', e.target.value)} placeholder="Reverso (respuesta)" aria-label={`Tarjeta ${ci + 1}: reverso`} />
          <button type="button" className="cr-ib is-danger" onClick={() => onRemoveCard(ci)} title="Quitar tarjeta" aria-label={`Quitar la tarjeta ${ci + 1}`}><IcClose aria-hidden="true" /></button>
        </div>
      ))}
      <button type="button" className="cr-link cr-link--add" onClick={onAddCard}><IcCrPlus /> tarjeta</button>
    </div>
  );
}
