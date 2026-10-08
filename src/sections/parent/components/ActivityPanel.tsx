import { TYPE_LABEL, fmtFull, fmtNum, fmtWhen, isoOf } from '../lib/format';
import type { ParentDashboard } from '../lib/types';
import { PanelState } from './PanelState';

/** "Actividad de Ian" (solo lectura): XP de la semana, Energy Coins, racha, qué está practicando y todo
 *  lo que guardó en Mi espacio con su carpeta. Pura: los datos llegan del contenedor. */
export function ActivityPanel({ kid, dash, failed, onRetry }: { kid: string; dash: ParentDashboard | null; failed: boolean; onRetry: () => void }) {
  const c = dash?.continue ?? null;
  const pct = c ? Math.max(0, Math.min(100, Math.round((c.done / Math.max(1, c.total)) * 100))) : 0;
  return (
    <section className="pz-panel" aria-labelledby="pz-act-h">
      <header className="pz-panel-head">
        <h3 id="pz-act-h">Actividad de {kid}</h3>
        <p>Cómo viene la semana y lo que fue guardando. Solo lectura.</p>
      </header>
      {!dash ? <PanelState failed={failed} onRetry={onRetry} /> : (
        <>
          <dl className="pz-stats">
            <div className="pz-stat">
              <dt>XP de esta semana</dt>
              <dd>{fmtNum(dash.xpWeek)}</dd>
              <span className="pz-stat-sub">El mismo puntaje ordena su liga</span>
            </div>
            <div className="pz-stat">
              <dt>Energy Coins disponibles</dt>
              <dd><span className="pz-bolt" aria-hidden="true">⚡</span> {fmtNum(dash.ec)}</dd>
              <span className="pz-stat-sub">Para canjear en la Tienda</span>
            </div>
            <div className="pz-stat">
              <dt>Racha</dt>
              <dd>{dash.streakDays} {dash.streakDays === 1 ? 'día' : 'días'}</dd>
              <span className="pz-stat-sub">Días seguidos practicando</span>
            </div>
          </dl>

          <div className="pz-block">
            <h4 className="pz-block-h">Está practicando</h4>
            {c ? (
              <div className="pz-cont">
                <p className="pz-cont-t"><b>{c.title}</b> <span>({fmtNum(c.done)} de {fmtNum(c.total)})</span></p>
                <span className="pz-bar" role="progressbar" aria-label={`Avance en ${c.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></span>
              </div>
            ) : (
              <p className="pz-muted">Todavía no empezó a practicar.</p>
            )}
          </div>

          <div className="pz-block">
            <h4 className="pz-block-h">Lo que guardó en Mi espacio <span className="pz-block-n">{dash.saved.length}</span></h4>
            {dash.saved.length === 0 ? (
              <p className="pz-muted">Todavía no guardó nada.</p>
            ) : (
              <div className="pz-table-wrap">
                <table className="pz-table pz-table--saved">
                  <colgroup><col /><col className="pz-c-type" /><col className="pz-c-folder" /><col className="pz-c-date" /></colgroup>
                  <thead><tr><th scope="col">Título</th><th scope="col">Tipo</th><th scope="col">Carpeta</th><th scope="col">Fecha</th></tr></thead>
                  <tbody>
                    {dash.saved.map((s, i) => (
                      <tr key={`${s.createdAt}-${i}`} className="pz-tr">
                        <td className="pz-td-main"><span className="pz-cell-title">{s.title}</span></td>
                        <td>{TYPE_LABEL[s.type] ?? s.type}</td>
                        <td className="pz-td-folder">{s.folder}</td>
                        <td className="pz-td-date"><time dateTime={isoOf(s.createdAt)} title={fmtFull(s.createdAt)}>{fmtWhen(s.createdAt)}</time></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
