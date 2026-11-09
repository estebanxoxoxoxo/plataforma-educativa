import { cardsOf, questionsOf, type DraftPosta } from '../lib/routeDraft';
import { IcClose } from '../../../shared/components/icons';
import { IcCrPlus } from './CreateIcons';
import { L } from '../../../shared/lib/lang';

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
                    {o.correct && <span className="cr-sr">{L(' (correcta)', ' (correct)')}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className="cr-deck-note">{L(`Opción múltiple — ${qs.length} pregunta(s). Para cambiarlas, regenerá el módulo.`, `Multiple choice — ${qs.length} question(s). To change them, regenerate the module.`)}</p>
      </div>
    );
  }

  return (
    <div className="cr-deck">
      {cardsOf(posta).map((c, ci) => (
        <div key={c.id} className="cr-card">
          <input className="cr-input cr-input--sm" value={c.front} onChange={(e) => onCard(ci, 'front', e.target.value)} placeholder={L('Frente (pregunta)', 'Front (question)')} aria-label={L(`Tarjeta ${ci + 1}: frente`, `Card ${ci + 1}: front`)} />
          <span className="cr-card-arrow" aria-hidden="true">→</span>
          <input className="cr-input cr-input--sm" value={c.back} onChange={(e) => onCard(ci, 'back', e.target.value)} placeholder={L('Reverso (respuesta)', 'Back (answer)')} aria-label={L(`Tarjeta ${ci + 1}: reverso`, `Card ${ci + 1}: back`)} />
          <button type="button" className="cr-ib is-danger" onClick={() => onRemoveCard(ci)} title={L('Quitar tarjeta', 'Remove card')} aria-label={L(`Quitar la tarjeta ${ci + 1}`, `Remove card ${ci + 1}`)}><IcClose aria-hidden="true" /></button>
        </div>
      ))}
      <button type="button" className="cr-link cr-link--add" onClick={onAddCard}><IcCrPlus /> {L('tarjeta', 'card')}</button>
    </div>
  );
}
