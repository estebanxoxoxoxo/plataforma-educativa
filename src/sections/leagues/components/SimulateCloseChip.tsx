import { GlyphSkip } from '../../../shared/components/icons';
import { L } from '../../../shared/lib/lang';

/** Botón de DEMO al pie de Ligas (docs/AGENTS.md regla 9): chip discreto que solo dispara un cierre simulado del server
 *  (POST /api/leagues/close-week; U5: en la solapa Familia, para el adulto, el de la familia —POST
 *  /api/leagues/family/close-week— con `label`/`title`/`busyLabel` propios). `failedText` = el motivo del server si lo dio.
 *  No compite con la UI del chico: chico, punteado y gris. Sin las props opcionales, igual que siempre. Puro por props. */
export const SimulateCloseChip = ({ busy, failed, onClick, label, title, busyLabel, failedText }: {
  busy: boolean; failed: boolean; onClick: () => void;
  label?: string; title?: string; busyLabel?: string; failedText?: string | null;
}) => (
  <div className="ldemo-bar">
    <button className="ldemo" onClick={onClick} disabled={busy} aria-busy={busy || undefined}
      title={title ?? L('Botón de demo: cierra la semana de la liga ahora (al recargar, todo vuelve al inicio)', 'Demo button: closes the league week now (reloading resets everything)')}>
      <span className="ldemo-tag">{L('Demo', 'Demo')}</span>{' '}
      <GlyphSkip className="ldemo-ic" aria-hidden />
      {busy ? (busyLabel ?? L('Cerrando la semana…', 'Closing the week…')) : (label ?? L('Simular cierre de semana', 'Simulate week close'))}
    </button>
    {failed && <span className="ldemo-err" role="alert">{failedText || L('No pude cerrar la semana ahora. Probá de nuevo en un ratito.', 'I couldn’t close the week right now. Try again in a little bit.')}</span>}
  </div>
);
