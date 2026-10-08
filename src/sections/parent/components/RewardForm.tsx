import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { NewMarketItem } from '../../../api/types';
import { EMOJI_SUGGESTIONS, LIMITS, draftFrom, validateDraft, type Draft, type DraftErrors } from '../lib/rewardDraft';
import type { ParentItemView } from '../lib/types';

/** Formulario para publicar un premio o editar uno existente (`item`). Valida igual que el server
 *  antes de mandar; el emoji es un campo de texto simple con sugerencias tocables.
 *  Pura: el guardado lo hace el contenedor (onSubmit); `error` es el motivo si el server lo rechazó. */
export function RewardForm({ item, kid, busy, error, onSubmit, onCancel }: {
  item?: ParentItemView;
  kid: string;
  busy: boolean;
  error: string | null;
  onSubmit: (value: NewMarketItem) => void;
  onCancel: () => void;
}) {
  const [d, setD] = useState<Draft>(() => draftFrom(item));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [tried, setTried] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  const editing = !!item;

  useEffect(() => { first.current?.focus(); }, []);

  const set = (k: keyof Draft) => (v: string) => {
    const next = { ...d, [k]: v };
    setD(next);
    if (tried) setErrors(validateDraft(next).errors);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setTried(true);
    const r = validateDraft(d);
    setErrors(r.errors);
    if (r.value) onSubmit(r.value);
  };
  const err = (k: keyof Draft) => (errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': `pz-rf-${k}-err` } : {});
  const msg = (k: keyof Draft) => errors[k] && <span className="pz-field-err" id={`pz-rf-${k}-err`}>{errors[k]}</span>;

  return (
    <form className="pz-form" onSubmit={submit} noValidate aria-labelledby="pz-rf-h">
      <h4 className="pz-form-h" id="pz-rf-h">{editing ? 'Editar premio' : 'Publicar premio'}</h4>

      <div className="pz-field pz-field--emoji">
        <label htmlFor="pz-rf-emoji">Emoji</label>
        <div className="pz-emoji-row">
          <input id="pz-rf-emoji" ref={first} className="pz-input pz-input--emoji" value={d.emoji} maxLength={16} autoComplete="off"
            onChange={(e) => set('emoji')(e.target.value)} {...err('emoji')} />
          <div className="pz-emoji-sugs" role="group" aria-label="Sugerencias de emoji">
            {EMOJI_SUGGESTIONS.map((em) => (
              <button key={em} type="button" className={`pz-emoji-sug${d.emoji.trim() === em ? ' is-on' : ''}`} aria-pressed={d.emoji.trim() === em}
                aria-label={`Usar ${em}`} onClick={() => set('emoji')(em)}>{em}</button>
            ))}
          </div>
        </div>
        {msg('emoji')}
      </div>

      <div className="pz-field">
        <label htmlFor="pz-rf-title">Título</label>
        <input id="pz-rf-title" className="pz-input" value={d.title} maxLength={LIMITS.title + 10} autoComplete="off"
          placeholder="Por ejemplo: Una hora de juegos de mesa" onChange={(e) => set('title')(e.target.value)} {...err('title')} />
        {msg('title')}
      </div>

      <div className="pz-field">
        <label htmlFor="pz-rf-desc">Descripción <span className="pz-opt">(opcional)</span></label>
        <input id="pz-rf-desc" className="pz-input" value={d.desc} maxLength={LIMITS.desc + 10} autoComplete="off"
          placeholder={`Cómo o cuándo se lo das a ${kid}`} onChange={(e) => set('desc')(e.target.value)} {...err('desc')} />
        {msg('desc')}
      </div>

      <div className="pz-field-pair">
        <div className="pz-field">
          <label htmlFor="pz-rf-price">Precio en Energy Coins (⚡)</label>
          <input id="pz-rf-price" className="pz-input pz-input--num" value={d.price} inputMode="numeric" autoComplete="off"
            placeholder="Ej.: 300" onChange={(e) => set('price')(e.target.value)} {...err('price')} />
          {msg('price')}
        </div>
        <div className="pz-field">
          <label htmlFor="pz-rf-stock">Stock</label>
          <input id="pz-rf-stock" className="pz-input pz-input--num" value={d.stock} inputMode="numeric" autoComplete="off"
            placeholder="Vacío = sin límite" aria-describedby={errors.stock ? 'pz-rf-stock-err' : 'pz-rf-stock-help'}
            aria-invalid={errors.stock ? true : undefined} onChange={(e) => set('stock')(e.target.value)} />
          {errors.stock ? msg('stock') : <span className="pz-field-help" id="pz-rf-stock-help">Cuántas veces se puede canjear. Vacío = sin límite.</span>}
        </div>
      </div>

      {error && <p className="pz-form-err" role="alert">{error}</p>}
      <div className="pz-form-btns">
        <button type="submit" className="pz-btn" disabled={busy}>{busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Publicar premio'}</button>
        <button type="button" className="pz-btn pz-btn--ghost" onClick={onCancel} disabled={busy}>Cancelar</button>
      </div>
    </form>
  );
}
