import type { CalendarEvent } from '../../../api/types';
import { ClassRow } from '../cards/ClassRow';
import { isLive, type DayGroup } from '../lib/calendar';

function Groups({ groups, nextId, now }: { groups: DayGroup[]; nextId: number | null; now: number }) {
  const tagOf = (e: CalendarEvent) => (isLive(e, now) ? 'live' : e.id === nextId ? 'next' : null);
  return (
    <>
      {groups.map((g) => (
        <div key={g.date} className="cal-group">
          <h4 className="cal-group-h">{g.title}{g.sub && <span> · {g.sub}</span>}</h4>
          <ul className="cal-rows">
            {g.events.map((e) => <ClassRow key={e.id} e={e} tag={tagOf(e)} />)}
          </ul>
        </div>
      ))}
    </>
  );
}

/** "Próximas clases": las de hoy y las dos semanas que siguen, agrupadas por día ("Hoy", "Mañana", "Martes 13"…); lo
 *  de más adelante aparece con "Ver más". Pura: si se ve lo de más adelante lo decide el contenedor. */
export function UpcomingList({ soon, later, laterCount, showLater, nextId, now, onToggle }: {
  soon: DayGroup[];
  later: DayGroup[];
  laterCount: number;
  showLater: boolean;
  /** La próxima clase (se marca "La próxima"). */ nextId: number | null;
  now: number;
  onToggle: () => void;
}) {
  return (
    <section className="cal-sec" aria-labelledby="cal-up-t">
      <div className="cal-sechead">
        <h3 id="cal-up-t">Próximas clases</h3>
        <small>Las de las próximas dos semanas</small>
      </div>
      <div className="cal-days" id="cal-up-list">
        {soon.length === 0
          ? <p className="cal-none">En las próximas dos semanas no tenés clases.</p>
          : <Groups groups={soon} nextId={nextId} now={now} />}
        {showLater && later.length > 0 && (
          <>
            {/* lo de más de dos semanas, separado: el subtítulo de arriba habla de "las próximas dos semanas" */}
            <p className="cal-later" role="separator" aria-label="Más adelante"><span>Más adelante</span></p>
            <Groups groups={later} nextId={nextId} now={now} />
          </>
        )}
      </div>
      {laterCount > 0 && (
        <button type="button" className="cal-more" aria-expanded={showLater} aria-controls="cal-up-list" onClick={onToggle}>
          {showLater ? 'Ver menos' : `Ver más adelante (${laterCount} ${laterCount === 1 ? 'clase' : 'clases'})`}
        </button>
      )}
    </section>
  );
}
