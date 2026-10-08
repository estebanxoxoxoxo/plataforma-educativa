export type RowStatus = { kind: 'saved' | 'error'; text: string } | null;

/** Un gran on-off: nombre, UNA línea de descripción, estado en texto (no solo color) y el switch.
 *  `on` undefined = todavía sin datos (switch deshabilitado). `pending` = guardando el valor al que va.
 *  Pura: el guardado lo resuelve el contenedor. */
export function FeatureRow({ id, label, desc, on, pending, status, onToggle }: {
  id: string; label: string; desc: string;
  on: boolean | undefined;
  /** Valor que se está guardando (el switch ya se muestra ahí). */ pending: boolean | null;
  status: RowStatus;
  onToggle: (next: boolean) => void;
}) {
  const shown = pending ?? on;
  return (
    <li className={`pz-feat${shown === false ? ' is-off' : ''}`} data-feature={id}>
      <div className="pz-feat-txt">
        <span className="pz-feat-name" id={`pz-f-${id}`}>{label}</span>
        <span className="pz-feat-desc" id={`pz-fd-${id}`}>{desc}</span>
      </div>
      <div className="pz-feat-ctl">
        <span className={`pz-feat-msg${status?.kind === 'error' ? ' is-err' : ''}`} role="status">{status?.text ?? ''}</span>
        <span className="pz-feat-state" aria-hidden="true">{shown === undefined ? '…' : shown ? 'Prendida' : 'Apagada'}</span>
        <button
          type="button"
          role="switch"
          className="pz-switch"
          aria-checked={shown === true}
          aria-labelledby={`pz-f-${id}`}
          aria-describedby={`pz-fd-${id}`}
          aria-busy={pending !== null}
          disabled={on === undefined || pending !== null}
          onClick={() => on !== undefined && onToggle(!on)}
        >
          <span className="pz-knob" />
        </button>
      </div>
    </li>
  );
}
