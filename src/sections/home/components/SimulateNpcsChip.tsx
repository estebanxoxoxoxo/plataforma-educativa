import { IcSparkDouble } from '../../../shared/components/icons';
import { L } from '../../../shared/lib/lang';

/** Botón de DEMO junto al saludo del feed (docs/AGENTS.md regla 9): chip discreto que solo dispara la ráfaga de NPCs
 *  del server (POST /api/feed/simulate-npcs). Feed v6: el contenedor NO refetchea — muestra la píldora "N novedades ↑" y
 *  lo nuevo entra arriba cuando el chico la toca. `note` = cuántas esperan (se borra sola). Puro por props. */
export const SimulateNpcsChip = ({ busy, note, failed, onClick }: { busy: boolean; note: string | null; failed: boolean; onClick: () => void }) => (
  <div className="fdemo-wrap">
    <button className="fdemo" onClick={onClick} disabled={busy} aria-busy={busy || undefined}
      title={L('Botón de demo: tus amigos y tu liga publican novedades (al recargar, todo vuelve al inicio)', 'Demo button: your friends and your league post news (reloading resets everything)')}>
      <span className="fdemo-tag">Demo</span>{' '}
      <IcSparkDouble className="fdemo-ic" aria-hidden />
      {busy ? L('Simulando…', 'Simulating…') : L('Simular NPCs', 'Simulate NPCs')}
    </button>
    {/* región viva siempre presente: anuncia "+5 novedades" o el error amable */}
    <span className={`fdemo-msg${failed ? ' err' : ''}`} role="status">{failed ? L('No pude simular ahora. Probá de nuevo.', 'I couldn’t simulate right now. Try again.') : note}</span>
  </div>
);
