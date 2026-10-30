import type { CalendarEvent } from '../../../api/types';
import { ClassRow } from '../cards/ClassRow';
import { isLive, type DayGroup, type Tz } from '../lib/calendar';

/** "Próximas clases": TODAS las que vienen, agrupadas por día ("Hoy", "Mañana", "Martes 13"…) en un solo
 *  listado que scrollea con la página (pedido 11-oct: sin tira semanal ni "Ver más"). Pura. */
export function UpcomingList({ groups, nextId, now, tz }: {
  groups: DayGroup[];
  /** La próxima clase (se marca "La próxima"). */ nextId: number | null;
  now: number;
  /** La zona de la familia: las horas de cada fila se leen en su pared (null = la del navegador). */ tz: Tz;
}) {
  const tagOf = (e: CalendarEvent) => (isLive(e, now) ? 'live' : e.id === nextId ? 'next' : null);
  return (
    <section className="cal-sec" aria-labelledby="cal-up-t">
      <div className="cal-sechead">
        {/* Sin el «Tenés N clases por delante» (pedido de Esteban, 30-oct). */}
        <h3 id="cal-up-t">Próximas clases</h3>
      </div>
      <div className="cal-days">
        {groups.map((g) => (
          <div key={g.date} className="cal-group">
            <h4 className="cal-group-h">{g.title}{g.sub && <span> · {g.sub}</span>}</h4>
            <ul className="cal-rows">
              {g.events.map((e) => <ClassRow key={e.id} e={e} tag={tagOf(e)} tz={tz} />)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
