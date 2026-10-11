import type { CSSProperties } from 'react';
import type { CalendarEvent } from '../../../api/types';
import { endOf, hm } from '../lib/calendar';

/** Tarjetita de una clase dentro de su día en la tira de la semana: emoji + hora y la materia, sobre el color del profe.
 *  Lo visible es corto (la columna es angosta); el lector de pantalla escucha la clase entera. Pura. */
export function ClassTile({ e, live }: { e: CalendarEvent; live: boolean }) {
  return (
    <li className={`cal-tile${live ? ' is-live' : ''}`} style={{ '--c': e.color } as CSSProperties} title={`${e.title} · de ${hm(e.start)} a ${hm(endOf(e))}`} data-event={e.id}>
      <span className="cal-tile-top" aria-hidden="true">
        <span className="cal-tile-emo">{e.emoji}</span>
        <span className="cal-tile-time">{hm(e.start)}</span>
      </span>
      <span className="cal-tile-name" aria-hidden="true">{e.subject}</span>
      <span className="cal-sr">{`${hm(e.start)}: ${e.title}${live ? ', está pasando ahora' : ''}`}</span>
    </li>
  );
}
