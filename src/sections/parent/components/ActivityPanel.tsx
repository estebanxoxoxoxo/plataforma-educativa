import { hiddenNote, sinceText, timesText } from '../../../shared/lib/medals';
import { useCycle } from '../lib/cycle';
import { TYPE_LABEL, fmtFull, fmtNum, fmtWhen, isoOf } from '../lib/format';
import type { ParentDashboard } from '../lib/types';
import { PanelState } from './PanelState';

/** "Actividad de {integrante}" (solo lectura): XP de la semana, Energy Coins, racha, qué está practicando, sus MEDALLAS y
 *  todo lo que guardó en Mi espacio con su carpeta. U4 (docs/USUARIOS.md §10): TODO es DEL INTEGRANTE elegido (antes, en U3,
 *  estos números eran compartidos y la nota lo avisaba); la nota ahora dice qué sigue siendo de la familia —el catálogo:
 *  las rutas de Aprender y el YouTube aprobado—. U5-D (spec §5.5d): las medallas de la plataforma del integrante
 *  (`dash.medals`, de U5-B): emoji + título + "Desde el…" (+ "×N"), SIN "Nueva" y sin filtrar por los candados: el adulto
 *  ve todas, y las que el integrante no ve llevan la nota "(Ligas apagadas: Luna no la ve)". Los datos llegan del
 *  contenedor; las fechas se escriben en la ZONA DE LA FAMILIA (useCycle().tz, la pared de la barra superior; QA-U5-E). */
export function ActivityPanel({ kid, dash, failed, onRetry }: { kid: string; dash: ParentDashboard | null; failed: boolean; onRetry: () => void }) {
  const tz = useCycle().tz;
  const c = dash?.continue ?? null;
  const pct = c ? Math.max(0, Math.min(100, Math.round((c.done / Math.max(1, c.total)) * 100))) : 0;
  return (
    <section className="pz-panel" aria-labelledby="pz-act-h">
      <header className="pz-panel-head">
        <h3 id="pz-act-h">Actividad de {kid}</h3>
        <p>Cómo viene la semana y lo que fue guardando. Solo lectura.</p>
      </header>
      <p className="pz-note">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M10 9v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="10" cy="6.2" r="1.1" fill="currentColor" /></svg>
        Todo lo de acá es de {kid}: su XP, sus ⚡ y su racha, lo que está practicando y lo que guardó en su Mi espacio. Lo que
        sigue siendo de toda la familia es el catálogo: las rutas de Aprender y el YouTube que aprobás.
      </p>
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

          {dash.medals && (
            <div className="pz-block" data-block="medals">
              <h4 className="pz-block-h">Medallas de {kid} <span className="pz-block-n">{dash.medals.length}</span></h4>
              {dash.medals.length === 0 ? (
                <p className="pz-muted">Todavía no ganó medallas.</p>
              ) : (
                <ul className="pz-dls pz-mds">
                  {dash.medals.map((m) => {
                    const since = sinceText(m.at, undefined, tz);
                    const times = timesText(m.times);
                    return (
                      <li key={m.id} className="pz-dl" data-medal={m.id} data-hidden={m.hidden}>
                        <span className="pz-emo" aria-hidden="true">{m.emoji}</span>
                        <span className="pz-dl-main">
                          <span className="pz-dl-title">
                            {m.title}
                            {times && <> <span className="pz-md-times"><span aria-hidden="true">{times}</span><span className="pz-sr">, {m.times} veces</span></span></>}
                          </span>
                          {(since || m.hidden) && (
                            <span className="pz-dl-meta">
                              {since}
                              {since && m.hidden && ' '}
                              {m.hidden && <span className="pz-md-hid">{hiddenNote(m.hidden, kid)}</span>}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <div className="pz-block">
            <h4 className="pz-block-h">Lo que guardó en Mi espacio <span className="pz-block-n">{dash.saved.length}</span></h4>
            {dash.saved.length === 0 ? (
              <p className="pz-muted">Todavía no guardó nada.</p>
            ) : (
              <div className="pz-table-wrap">
                {/* Teléfono (tanda T5): la tabla se apila (parent.css) y la carpeta muestra su data-label («Carpeta: …»). Los
                    roles explícitos mantienen la tabla como tabla para el lector de pantalla aunque el CSS le cambie el display
                    (Safari la deja de exponer si no). */}
                <table role="table" className="pz-table pz-table--saved">
                  <colgroup><col /><col className="pz-c-type" /><col className="pz-c-folder" /><col className="pz-c-date" /></colgroup>
                  <thead role="rowgroup"><tr role="row"><th role="columnheader" scope="col">Título</th><th role="columnheader" scope="col">Tipo</th><th role="columnheader" scope="col">Carpeta</th><th role="columnheader" scope="col">Fecha</th></tr></thead>
                  <tbody role="rowgroup">
                    {dash.saved.map((s, i) => (
                      <tr role="row" key={`${s.createdAt}-${i}`} className="pz-tr">
                        <td role="cell" className="pz-td-main"><span className="pz-cell-title">{s.title}</span></td>
                        <td role="cell" data-label="Tipo">{TYPE_LABEL[s.type] ?? s.type}</td>
                        <td role="cell" className="pz-td-folder" data-label="Carpeta">{s.folder}</td>
                        <td role="cell" className="pz-td-date" data-label="Fecha"><time dateTime={isoOf(s.createdAt)} title={fmtFull(s.createdAt, tz)}>{fmtWhen(s.createdAt, undefined, tz)}</time></td>
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
