import type { ParentAlert } from '../../../api/types';
import { AlertRow } from '../cards/AlertRow';
import { PanelState } from './PanelState';

/** "Avisos": lo que Innerith le avisa al padre sobre la seguridad del chico (un mensaje de crisis —sin lo que escribió:
 *  cuarentena—, un intento de pasar datos de contacto o de salir de la plataforma, y mensajes frenados una y otra vez),
 *  del más nuevo al más viejo. Pura: los datos y las acciones los resuelve el contenedor (ParentZone, que además lleva
 *  el contador de la navegación). */
export function AlertsPanel({ kid, alerts, failed, busy, onSeen, onSeenAll, onRetry }: {
  kid: string;
  alerts: ParentAlert[] | null;
  failed: boolean;
  busy: number[];
  onSeen: (id: number) => void;
  onSeenAll: () => void;
  onRetry: () => void;
}) {
  const unseen = alerts?.filter((a) => !a.seen).length ?? 0;
  return (
    <section className="pz-panel" aria-labelledby="pz-al-h">
      <header className="pz-panel-head pz-panel-head--act">
        <div>
          <h3 id="pz-al-h">Avisos</h3>
          <p>Lo que el Moderador y el chat te avisan sobre {kid}: mensajes de crisis, intentos de pasar datos de contacto y mensajes frenados una y otra vez.</p>
        </div>
        {unseen > 1 && <button type="button" className="pz-btn pz-btn--ghost pz-btn--sm" disabled={busy.length > 0} onClick={onSeenAll}>Marcar todos como vistos</button>}
      </header>
      {!alerts ? <PanelState failed={failed} onRetry={onRetry} /> : alerts.length === 0 ? (
        <div className="pz-alerts-empty">
          <p className="pz-muted">No hay avisos. Si {kid} escribe algo que indique una crisis, intenta pasar datos de contacto o insiste con mensajes que el Moderador frena, aparece acá.</p>
        </div>
      ) : (
        <ul className="pz-alerts">
          {alerts.map((a) => <AlertRow key={a.id} a={a} busy={busy.includes(a.id)} onSeen={() => onSeen(a.id)} />)}
        </ul>
      )}
      <p className="pz-foot">Por el cuidado de {kid}, en un aviso de crisis no se muestra lo que escribió. En esta demo los avisos viven en la memoria del servidor: un reinicio los borra.</p>
    </section>
  );
}
