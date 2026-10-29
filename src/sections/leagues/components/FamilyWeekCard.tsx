import { useId } from 'react';
import type { FamilyWeekClosed } from '../../../api/types';
import { capFirst, closedPrizeLine, cupLine, marksOf, totalLine } from '../lib/familyWeek';

/** El resumen de UNA semana cerrada: la copa, las marcas alcanzables por todos, la línea cooperativa y el premio. SIN
 *  puestos (§2.2: no hay "último" ni "2.º" en el resumen; solo la copa). `latest` = es history[0] (solo ahí un premio sin
 *  ganadores puede decir "sigue en juego"; en las anteriores va en pasado). */
function WeekSummary({ w, meId, latest }: { w: FamilyWeekClosed; meId?: string; latest: boolean }) {
  const cup = cupLine(w);
  const marks = marksOf(w);
  const prize = closedPrizeLine(w, meId, latest);
  return (
    <>
      {cup && <p className="lgw-cup">{cup}</p>}
      {marks.length > 0 && (
        <ul className="lgw-marks" aria-label="Lo que logró cada uno">
          {marks.map((m) => <li key={m.id}><b>{m.name}</b> {m.text}</li>)}
        </ul>
      )}
      <p className="lgw-total">{totalLine(w.total)}</p>
      {prize && <p className="lgw-prize">{prize}</p>}
    </>
  );
}

/** U5 (§2.6): arriba de la tabla de la familia, para TODOS, la tarjeta "La semana pasada" (history[0]: "🏆 Ganó Luna · 1.350
 *  XP", "Ian ↑ superó su semana · Andrés ✨ los 7 días", "Entre todos sumaron 2.830 XP" y, si hubo, "🚲 1 hora de bici →
 *  para Luna (se lo da Andrés)") y un "Semanas anteriores" plegado (`<details>` nativo) con el resto del historial (≤ 8).
 *  `meId` = quien mira ("para vos"). Sin historial no hay tarjeta. Puro. */
export function FamilyWeekCard({ history, meId }: { history: FamilyWeekClosed[]; meId?: string }) {
  const id = useId();
  const [last, ...older] = history;
  if (!last) return null;
  return (
    <section className="lgw" aria-labelledby={id} data-week={last.week}>
      <h4 className="lgw-k" id={id}>{capFirst(last.label)}</h4>
      <WeekSummary w={last} meId={meId} latest />
      {older.length > 0 && (
        <details className="lgw-more">
          <summary>Semanas anteriores</summary>
          <ol className="lgw-older">
            {older.map((w) => (
              <li key={w.week} data-week={w.week}>
                <p className="lgw-when">{capFirst(w.label)}</p>
                <WeekSummary w={w} meId={meId} latest={false} />
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
