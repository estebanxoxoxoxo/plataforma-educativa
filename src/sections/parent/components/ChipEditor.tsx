import { useState, type FormEvent, type ReactNode } from 'react';
import { splitTerms } from '../lib/terms';

export type TermsStatus = { kind: 'saved' | 'error'; text: string; undo?: () => void } | null;

/** Una lista editable de la familia (temas o palabras) como chips: agregar uno o varios (separados por coma) y quitar.
 *  Pura: valida y guarda el contenedor (onAdd devuelve si se aceptó, para vaciar el campo); acá solo vive el texto que
 *  se está escribiendo. `items` null = cargando. */
export function ChipEditor({ id, title, help, empty, placeholder, items, tone, busy, status, onAdd, onRemove }: {
  id: string;
  title: string;
  help: ReactNode;
  empty: string;
  placeholder: string;
  items: string[] | null;
  tone: 'white' | 'black' | 'word';
  busy: boolean;
  status: TermsStatus;
  onAdd: (terms: string[]) => Promise<boolean>;
  onRemove: (term: string) => void;
}) {
  const [text, setText] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const terms = splitTerms(text);
    if (!terms.length || busy || !items) return;
    if (await onAdd(terms)) setText('');
  };
  return (
    <section className={`pz-terms pz-terms--${tone}`} aria-labelledby={`pz-t-${id}`} data-terms={id}>
      <div className="pz-terms-head">
        <h4 className="pz-block-h" id={`pz-t-${id}`}>
          {title}
          {items && <span className="pz-block-n">{items.length}</span>}
        </h4>
        <p className="pz-terms-help">{help}</p>
      </div>
      {!items ? (
        <div className="pz-skel pz-skel--chips" aria-busy="true" aria-label="Cargando"><i /><i /><i /></div>
      ) : items.length === 0 ? (
        <p className="pz-muted pz-terms-empty">{empty}</p>
      ) : (
        <ul className="pz-chips" aria-label={title}>
          {items.map((t) => (
            <li key={t} className="pz-chip">
              <span className="pz-chip-t">{t}</span>
              <button type="button" className="pz-chip-x" disabled={busy} aria-label={`Quitar «${t}»`} onClick={() => onRemove(t)}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="pz-terms-add" onSubmit={(e) => void submit(e)} noValidate>
        <label className="pz-sr" htmlFor={`pz-t-${id}-in`}>Agregar a «{title}»</label>
        <input id={`pz-t-${id}-in`} className="pz-input" value={text} placeholder={placeholder} autoComplete="off" spellCheck={false}
          maxLength={400} disabled={!items} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="pz-btn pz-btn--sm" disabled={busy || !items || !text.trim()}>{busy ? 'Guardando…' : 'Agregar'}</button>
      </form>
      <p className={`pz-notice${status?.kind === 'error' ? ' is-err' : ''}${status ? '' : ' is-empty'}`} role="status">
        {status?.text}
        {status?.undo && <button type="button" className="pz-link" onClick={status.undo}>Deshacer</button>}
      </p>
    </section>
  );
}
