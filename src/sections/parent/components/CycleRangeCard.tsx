import type { SectionKey } from '../../../api/types';
import { IcCheck } from '../../../shared/components/icons';
import type { RangeDraft } from '../lib/cycleDraft';
import { spanLabel } from '../lib/cycleDraft';
import { CYCLE_SECTIONS } from '../lib/cycleSections';

/** Un rango del Ciclo del día en el editor de Familia: nombre, desde/hasta (inputs time nativos) y las secciones del menú
 *  disponibles en ese rango como fichas que se prenden y apagan (en el orden del menú). Debajo, cómo se lee el rango ("de
 *  14:00 a 18:00", "todo el día", "cruza la medianoche") y, si corresponde, "Ahora" (el reloj de la familia cae acá) y
 *  "En la demo" (el selector de la barra lateral puso a {kid} en este rango). Pura. */
export function CycleRangeCard({ draft, index, kid, now, demo, disabled, onChange, onToggle, onRemove }: {
  draft: RangeDraft;
  index: number;
  kid: string;
  /** el reloj de la familia está dentro de este rango */
  now: boolean;
  /** el selector de demo puso al integrante en este rango */
  demo: boolean;
  disabled: boolean;
  onChange: (patch: Partial<Pick<RangeDraft, 'name' | 'from' | 'to'>>) => void;
  onToggle: (key: SectionKey) => void;
  onRemove: () => void;
}) {
  const span = spanLabel(draft.from, draft.to);
  const base = `pz-cy-${draft.key.replace(/[^A-Za-z0-9_-]/g, '_')}`;
  const label = draft.name.trim() || `Rango ${index + 1}`;
  return (
    <li className={`pz-cy-range${now ? ' is-now' : ''}`} data-range={draft.id ?? draft.key}>
      <fieldset className="pz-cy-set" disabled={disabled}>
        <legend className="pz-sr">Rango {index + 1}: {label}</legend>
        <div className="pz-cy-top">
          <div className="pz-cy-field pz-cy-name">
            <label htmlFor={`${base}-n`}>Nombre</label>
            <input id={`${base}-n`} className="pz-input" value={draft.name} maxLength={60} placeholder="Ej.: Tarde"
              onChange={(e) => onChange({ name: e.target.value })} />
          </div>
          <div className="pz-cy-field">
            <label htmlFor={`${base}-f`}>Desde</label>
            <input id={`${base}-f`} className="pz-input pz-cy-time" type="time" value={draft.from}
              onChange={(e) => onChange({ from: e.target.value })} />
          </div>
          <div className="pz-cy-field">
            <label htmlFor={`${base}-t`}>Hasta</label>
            <input id={`${base}-t`} className="pz-input pz-cy-time" type="time" value={draft.to}
              onChange={(e) => onChange({ to: e.target.value })} />
          </div>
          <button type="button" className="pz-link pz-yt-del pz-cy-del" onClick={onRemove} aria-label={`Borrar el rango ${label}`}>Borrar</button>
        </div>
        <p className="pz-cy-span">
          <span className={span ? '' : 'is-bad'}>{span ? `Rige ${span}, todos los días.` : 'Revisá las horas (HH:MM).'}</span>
          {now && <span className="pz-cy-badge is-now">Ahora</span>}
          {demo && <span className="pz-cy-badge is-demo">En la demo, {kid} está acá</span>}
        </p>
        <div className="pz-cy-secs" role="group" aria-label={`Qué tiene ${kid} en ${label}`}>
          {CYCLE_SECTIONS.map(({ key, label: sec }) => {
            const on = draft.sections.includes(key);
            return (
              <button key={key} type="button" className={`pz-cy-sec${on ? ' is-on' : ''}`} aria-pressed={on} data-sec={key} onClick={() => onToggle(key)}>
                {on && <IcCheck aria-hidden="true" />}{sec}
              </button>
            );
          })}
        </div>
        {draft.sections.length === 0 && <p className="pz-cy-none">Sin secciones: en este rango {kid} solo tiene lo que no está en ningún rango (y el Feed).</p>}
      </fieldset>
    </li>
  );
}
