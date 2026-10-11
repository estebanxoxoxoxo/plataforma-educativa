import { GlyphSkip } from '../../../shared/components/icons';

/** Botón de DEMO al pie de Ligas (docs/AGENTS.md regla 9): chip discreto que solo dispara el cierre simulado del server
 *  (POST /api/leagues/close-week). No compite con la UI del chico: chico, punteado y gris. Puro por props. */
export const SimulateCloseChip = ({ busy, failed, onClick }: { busy: boolean; failed: boolean; onClick: () => void }) => (
  <div className="ldemo-bar">
    <button className="ldemo" onClick={onClick} disabled={busy} aria-busy={busy || undefined}
      title="Botón de demo: cierra la semana de la liga ahora (al recargar, todo vuelve al inicio)">
      <span className="ldemo-tag">Demo</span>{' '}
      <GlyphSkip className="ldemo-ic" aria-hidden />
      {busy ? 'Cerrando la semana…' : 'Simular cierre de semana'}
    </button>
    {failed && <span className="ldemo-err" role="alert">No pude cerrar la semana ahora. Probá de nuevo en un ratito.</span>}
  </div>
);
