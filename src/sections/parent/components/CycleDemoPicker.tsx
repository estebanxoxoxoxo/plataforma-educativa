import type { CycleRange } from '../../../api/types';
import { rangeOptionLabel } from '../lib/cycleDraft';
import { L } from '../../../shared/lib/lang';

/** El selector de DEMO del Ciclo del día (regla 9 de docs/AGENTS.md: chip discreto que solo dispara un endpoint de demo del
 *  server): "Reloj real" + los rangos del integrante. Vive abajo del menú del Sidebar, con el lenguaje de los chips de demo
 *  (borde punteado; el rótulo dice "(demo)"). Un <select> nativo: entra en los 208 px de la barra con hasta 8 rangos y el
 *  teclado lo maneja solo. `value` = el rango elegido (null = reloj real). Pura: elegir lo resuelve el contenedor. */
export function CycleDemoPicker({ caption, ranges, value, busy, failed, onChoose }: {
  /** "Ciclo (demo)" con un chico; "Ciclo de Luna (demo)" con el adulto en Familia */
  caption: string;
  ranges: readonly CycleRange[];
  value: string | null;
  busy: boolean;
  failed: boolean;
  onChoose: (rangeId: string | null) => void;
}) {
  const current = value && ranges.some((r) => r.id === value) ? value : '';
  return (
    <div className="cyd" title={L('Botón de demo: elegí en qué rango del día está (al recargar la página del chico vuelve el reloj real)', 'Demo button: pick which part of the day it is (reloading the kid’s page brings back the real clock)')}>
      <label className="cyd-lbl" htmlFor="cyd-sel">{caption}</label>
      <select id="cyd-sel" className="cyd-sel" value={current} disabled={busy} aria-busy={busy || undefined}
        onChange={(e) => onChoose(e.target.value || null)}>
        <option value="">{L('Reloj real', 'Real clock')}</option>
        {ranges.map((r) => <option key={r.id} value={r.id}>{rangeOptionLabel(r)}</option>)}
      </select>
      {failed && <span className="cyd-err" role="status">{L('No pude cambiarlo. Probá de nuevo.', 'I couldn’t change it. Try again.')}</span>}
    </div>
  );
}
