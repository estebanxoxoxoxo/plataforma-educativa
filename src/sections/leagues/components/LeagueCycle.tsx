import type { AssignedLeague } from '../../../api/types';
import { MEDAL_INFO, closesLabel, lastWeekLabel } from '../lib/cycle';

/** Chips del ciclo semanal en el hero de Ligas: cuánto falta para el cierre y el estandarte de la semana pasada.
 *  El estandarte es solo para el podio (con medalla); sin datos del ciclo no se muestra nada. */
export function LeagueCycle({ league }: { league: AssignedLeague }) {
  const days = league.closesInDays;
  const lw = league.lastWeek;
  const medal = lw?.medal ? MEDAL_INFO[lw.medal] : null;
  if (days === undefined && !medal) return null;
  return (
    <div className="lchips">
      {days !== undefined && (
        <span className="lchip lclose" data-today={days <= 0 || undefined} title={`La liga cierra ${league.closes}`}>
          <span className="lchip-ic" aria-hidden>⏳</span>{closesLabel(days)}
        </span>
      )}
      {lw && medal && (
        <span className="lchip lmedal" data-medal={lw.medal} title={`${medal.name} · ${lastWeekLabel(lw.pos)}`}>
          <span className="lchip-ic" role="img" aria-label={medal.name}>{medal.emoji}</span>{lastWeekLabel(lw.pos)}
        </span>
      )}
    </div>
  );
}
