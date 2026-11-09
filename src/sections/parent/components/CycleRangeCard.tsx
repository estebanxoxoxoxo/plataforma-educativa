import type { SectionKey } from '../../../api/types';
import { IcCheck } from '../../../shared/components/icons';
import type { RangeDraft } from '../lib/cycleDraft';
import { spanLabel } from '../lib/cycleDraft';
import { CYCLE_SECTIONS } from '../lib/cycleSections';
import { L } from '../../../shared/lib/lang';

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
  const label = draft.name.trim() || L(`Rango ${index + 1}`, `Range ${index + 1}`);
  return (
    <li className={`pz-cy-range${now ? ' is-now' : ''}`} data-range={draft.id ?? draft.key}>
      <fieldset className="pz-cy-set" disabled={disabled}>
        <legend className="pz-sr">{L(`Rango ${index + 1}: ${label}`, `Range ${index + 1}: ${label}`)}</legend>
        <div className="pz-cy-top">
          <div className="pz-cy-field pz-cy-name">
            <label htmlFor={`${base}-n`}>{L('Nombre', 'Name')}</label>
            <input id={`${base}-n`} className="pz-input" value={draft.name} maxLength={60} placeholder={L('Ej.: Tarde', 'E.g.: Afternoon')}
              onChange={(e) => onChange({ name: e.target.value })} />
          </div>
          <div className="pz-cy-field">
            <label htmlFor={`${base}-f`}>{L('Desde', 'From')}</label>
            <input id={`${base}-f`} className="pz-input pz-cy-time" type="time" value={draft.from}
              onChange={(e) => onChange({ from: e.target.value })} />
          </div>
          <div className="pz-cy-field">
            <label htmlFor={`${base}-t`}>{L('Hasta', 'To')}</label>
            <input id={`${base}-t`} className="pz-input pz-cy-time" type="time" value={draft.to}
              onChange={(e) => onChange({ to: e.target.value })} />
          </div>
          <button type="button" className="pz-link pz-yt-del pz-cy-del" onClick={onRemove} aria-label={L(`Borrar el rango ${label}`, `Delete the range ${label}`)}>{L('Borrar', 'Delete')}</button>
        </div>
        <p className="pz-cy-span">
          <span className={span ? '' : 'is-bad'}>{span ? L(`Rige ${span}, todos los días.`, `Applies ${span}, every day.`) : L('Revisá las horas (HH:MM).', 'Check the times (HH:MM).')}</span>
          {now && <span className="pz-cy-badge is-now">{L('Ahora', 'Now')}</span>}
          {demo && <span className="pz-cy-badge is-demo">{L(`En la demo, ${kid} está acá`, `In the demo, ${kid} is here`)}</span>}
        </p>
        <div className="pz-cy-secs" role="group" aria-label={L(`Qué tiene ${kid} en ${label}`, `What ${kid} has during ${label}`)}>
          {CYCLE_SECTIONS.map(({ key, label: sec }) => {
            const on = draft.sections.includes(key);
            return (
              <button key={key} type="button" className={`pz-cy-sec${on ? ' is-on' : ''}`} aria-pressed={on} data-sec={key} onClick={() => onToggle(key)}>
                {on && <IcCheck aria-hidden="true" />}{sec}
              </button>
            );
          })}
        </div>
        {draft.sections.length === 0 && <p className="pz-cy-none">{L(`Sin secciones: mientras dure este rango, ${kid} solo tiene el Feed (más lo de otro rango que se le superponga).`, `No sections: while this range lasts, ${kid} only has the Feed (plus whatever another overlapping range allows).`)}</p>}
      </fieldset>
    </li>
  );
}
