import { IcSparkDouble } from '../../../shared/components/icons';

/** Botón de DEMO junto al saludo del feed (docs/AGENTS.md regla 9): chip discreto que solo dispara la ráfaga de NPCs
 *  del server (POST /api/feed/simulate-npcs); el contenedor refetchea y lo nuevo entra arriba. `note` = cuántas
 *  novedades entraron (se borra sola). Puro por props. */
export const SimulateNpcsChip = ({ busy, note, failed, onClick }: { busy: boolean; note: string | null; failed: boolean; onClick: () => void }) => (
  <div className="fdemo-wrap">
    <button className="fdemo" onClick={onClick} disabled={busy} aria-busy={busy || undefined}
      title="Botón de demo: tus amigos y tu liga publican novedades (al recargar, todo vuelve al inicio)">
      <span className="fdemo-tag">Demo</span>{' '}
      <IcSparkDouble className="fdemo-ic" aria-hidden />
      {busy ? 'Simulando…' : 'Simular NPCs'}
    </button>
    {/* región viva siempre presente: anuncia "+5 novedades" o el error amable */}
    <span className={`fdemo-msg${failed ? ' err' : ''}`} role="status">{failed ? 'No pude simular ahora. Probá de nuevo.' : note}</span>
  </div>
);
