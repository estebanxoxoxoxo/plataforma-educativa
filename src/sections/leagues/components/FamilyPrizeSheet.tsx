import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { FamilyPrizeOptions, FamilyPrizeRequest, FamilyWeekPrize } from '../../../api/types';
import { useSheetKeys, useVeil } from '../../store/lib/sheet';
import { CONDITIONS, PRIZE_EMOJIS, draftFrom, prizeRequest, reconcileDraft, type PrizeDraft, type PrizeMode } from '../lib/familyWeek';

/** U5 (§3.2): la hoja del ADULTO para poner (o cambiar) el premio de la semana de la familia, sobre el chasis global
 *  `.shov/.shcard`. Dos maneras: "De los premios de tus chicos" (los NO archivados de la Tienda de cada uno, agrupados "De la
 *  Tienda de Ian"; elegir uno COPIA emoji, título y descripción: no toca su stock ni sus canjes) o "Uno nuevo" (emoji + título
 *  + descripción opcional). Y la condición con radios nativos: D1 arranca en "Para todos los que superen su semana
 *  anterior". La validación de acá es SOLO de forma (para habilitar el botón); los límites los valida el server y su motivo
 *  (`error`) se muestra TAL CUAL. Foco y teclado como las hojas de la casa (store/lib/sheet: Esc cierra, Tab queda adentro).
 *  `options`: null = cargando · 'error' = no se pudieron leer. Puro: el guardado lo hace el contenedor (onSubmit). */
export function FamilyPrizeSheet({ initial, options, busy, error, errorSeq, onSubmit, onRetryOptions, onClose }: {
  initial: FamilyWeekPrize | null;
  options: FamilyPrizeOptions | null | 'error';
  busy: boolean;
  error: string | null;
  /** sube con cada rechazo: el foco va al motivo */ errorSeq: number;
  onSubmit: (req: FamilyPrizeRequest) => void;
  onRetryOptions: () => void;
  onClose: () => void;
}) {
  const uid = useId();
  const card = useRef<HTMLDivElement>(null);
  const [d, setD] = useState<PrizeDraft>(() => reconcileDraft(draftFrom(initial), options));
  // "Cambiar" un premio de la Tienda cuyo ítem ya no está o cambió: al llegar las opciones, la hoja pasa a "Uno nuevo" con
  // el texto prometido (lib: reconcileDraft; sin cambios si el ítem sigue igual o ya se eligió otro).
  useEffect(() => { setD((x) => reconcileDraft(x, options)); }, [options]);
  const phase = busy ? 'busy' : error ? `error-${errorSeq}` : 'edit';
  useSheetKeys(card, phase, busy, onClose);
  const veil = useVeil(onClose, busy);
  const req = prizeRequest(d);
  const set = (patch: Partial<PrizeDraft>) => setD((x) => ({ ...x, ...patch }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!busy && req) onSubmit(req);
  };
  const groups = options && options !== 'error' ? options.groups : [];
  const anyItem = groups.some((g) => g.items.length > 0);
  const pickKey = d.pick ? `${d.pick.member}:${d.pick.itemId}` : '';
  // El foco inicial: el modo elegido (con flechas se cambia); mientras guarda, la hoja misma; tras un rechazo, el motivo.
  const focusMode = !error && !busy;

  return (
    <div className="shov lgp-ov" onMouseDown={veil}>
      <div className="shcard lgp-sheet" ref={card} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-d`}>
        {/* WebKit (Safari, iPhone) no desplaza el radio que se enfoca con las FLECHAS (Chrome sí): quedaba debajo del pie pegado
            o fuera de la lista de premios. Al enfocarse, cada radio se trae a la vista (respeta el scroll-padding de la hoja). */}
        <form onSubmit={submit} noValidate className="lgp-form"
          onFocus={(e) => { const el = e.target; if (el instanceof HTMLInputElement && el.type === 'radio') el.scrollIntoView({ block: 'nearest' }); }}>
          <header>
            <h3 className="lgp-sheet-t" id={`${uid}-t`}>{initial ? 'Cambiar el premio de la semana' : 'El premio de esta semana'}</h3>
            <p className="lgp-sheet-d" id={`${uid}-d`}>Lo ve toda la familia en Ligas. Se lo das vos cuando cierre la semana: no se compra con ⚡ ni se sortea.</p>
          </header>

          <fieldset className="lgp-modes" disabled={busy}>
            <legend className="lgp-legend">¿Qué premio?</legend>
            {([['tienda', 'De los premios de tus chicos'], ['nuevo', 'Uno nuevo']] as [PrizeMode, string][]).map(([m, label]) => (
              <label key={m} className={`lgp-mode${d.mode === m ? ' is-on' : ''}`}>
                <input type="radio" name={`${uid}-mode`} value={m} checked={d.mode === m} onChange={() => set({ mode: m })}
                  data-autofocus={focusMode && d.mode === m ? true : undefined} />
                {label}
              </label>
            ))}
          </fieldset>

          {d.mode === 'tienda' ? (
            <div className="lgp-pane" data-pane="tienda">
              {options === null ? (
                <p className="lgp-note" role="status">Buscando los premios de tus chicos…</p>
              ) : options === 'error' ? (
                <p className="lgp-note">No pude traer los premios de la Tienda ahora. <button type="button" className="lgp-link" onClick={onRetryOptions}>Reintentar</button></p>
              ) : !anyItem ? (
                <p className="lgp-note">Tus chicos todavía no tienen premios en la Tienda. Elegí «Uno nuevo» y escribilo acá.</p>
              ) : (
                groups.map((g) => (
                  <fieldset key={g.member} className="lgp-group" disabled={busy}>
                    <legend className="lgp-legend">De la Tienda de {g.name}</legend>
                    {g.items.length === 0 ? (
                      <p className="lgp-note">{g.name} todavía no tiene premios en su Tienda.</p>
                    ) : (
                      g.items.map((it) => {
                        const key = `${g.member}:${it.itemId}`;
                        return (
                          <label key={key} className={`lgp-opt${pickKey === key ? ' is-on' : ''}`}>
                            <input type="radio" name={`${uid}-item`} value={key} checked={pickKey === key}
                              onChange={() => set({ pick: { member: g.member, itemId: it.itemId } })} />
                            <span className="lgp-opt-emo" aria-hidden="true">{it.emoji}</span>
                            <span className="lgp-opt-main">
                              <b>{it.title}</b>
                              {it.desc && <span>{it.desc}</span>}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </fieldset>
                ))
              )}
            </div>
          ) : (
            <div className="lgp-pane" data-pane="nuevo">
              <div className="lgp-field">
                <label htmlFor={`${uid}-emoji`}>Emoji</label>
                <div className="lgp-emoji-row">
                  <input id={`${uid}-emoji`} className="lgp-input lgp-input--emoji" value={d.emoji} maxLength={16} autoComplete="off"
                    disabled={busy} onChange={(e) => set({ emoji: e.target.value })} />
                  <div className="lgp-emoji-sugs" role="group" aria-label="Sugerencias de emoji">
                    {PRIZE_EMOJIS.map((em) => (
                      <button key={em} type="button" className={`lgp-emoji-sug${d.emoji.trim() === em ? ' is-on' : ''}`} aria-pressed={d.emoji.trim() === em}
                        aria-label={`Usar ${em}`} disabled={busy} onClick={() => set({ emoji: em })}>{em}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="lgp-field">
                <label htmlFor={`${uid}-title`}>Título</label>
                <input id={`${uid}-title`} className="lgp-input" value={d.title} maxLength={80} autoComplete="off" disabled={busy}
                  placeholder="Por ejemplo: 1 hora de bici" onChange={(e) => set({ title: e.target.value })} />
              </div>
              <div className="lgp-field">
                <label htmlFor={`${uid}-desc`}>Descripción <span className="lgp-opt-t">(opcional)</span></label>
                <input id={`${uid}-desc`} className="lgp-input" value={d.desc} maxLength={160} autoComplete="off" disabled={busy}
                  placeholder="Cuándo o cómo se lo das" onChange={(e) => set({ desc: e.target.value })} />
              </div>
            </div>
          )}

          <fieldset className="lgp-conds" disabled={busy}>
            <legend className="lgp-legend">¿Para quién es?</legend>
            {CONDITIONS.map((c) => (
              <label key={c.id} className={`lgp-cnd${d.condition === c.id ? ' is-on' : ''}`}>
                <input type="radio" name={`${uid}-cond`} value={c.id} checked={d.condition === c.id} onChange={() => set({ condition: c.id })} />
                <span className="lgp-cnd-main">
                  <b>{c.label}</b>
                  <span>{c.help}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {error && <p className="lgp-err" role="alert" tabIndex={-1} data-autofocus>{error}</p>}
          <div className="lgp-sheet-btns">
            <button type="button" className="lgp-btn lgp-btn--ghost" onClick={onClose} disabled={busy}>Cancelar</button>
            <button type="submit" className="lgp-btn" disabled={busy || !req} aria-busy={busy || undefined}>
              {busy ? 'Guardando…' : initial ? 'Guardar el cambio' : 'Poner el premio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
