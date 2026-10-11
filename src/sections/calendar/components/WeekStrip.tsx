import { ClassTile } from '../cards/ClassTile';
import { isLive, type Week } from '../lib/calendar';

/** "La semana": tira de lunes a domingo con las clases como tarjetitas en su día, hoy marcado y los días que ya pasaron
 *  más apagados. Es esta semana mientras le quede alguna clase; si no, la que viene (y lo dice). Pura. */
export function WeekStrip({ week, now }: { week: Week; now: number }) {
  return (
    <section className="cal-sec" aria-labelledby="cal-week-t">
      <div className="cal-sechead">
        <h3 id="cal-week-t">{week.label}</h3>
        <small>{week.range}{week.skippedThisWeek && ' · esta semana ya no tenés más clases'}</small>
      </div>
      <ol className="cal-week" aria-label={`${week.label}: del ${week.range}`}>
        {week.days.map((d) => (
          <li key={d.date} className={`cal-day${d.isToday ? ' is-today' : ''}${d.isPast ? ' is-past' : ''}`} aria-current={d.isToday ? 'date' : undefined}>
            <div className="cal-dh" aria-hidden="true">
              <span className="cal-dow">{d.isToday ? 'Hoy' : d.dow}</span>
              <span className="cal-dnum">{d.num}</span>
            </div>
            <span className="cal-sr">{d.isToday ? `Hoy, ${d.fullDate}` : d.fullDate}{d.events.length ? '' : ': sin clases'}</span>
            {d.events.length > 0 && (
              <ul className="cal-tiles">
                {d.events.map((e) => <ClassTile key={e.id} e={e} live={isLive(e, now)} />)}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
