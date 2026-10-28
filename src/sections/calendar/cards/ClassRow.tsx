import type { CSSProperties } from 'react';
import type { CalendarEvent } from '../../../api/types';
import { endOf, hm, type Tz } from '../lib/calendar';

/** Fila de "Próximas clases": de qué hora a qué hora (en la pared de la zona de la familia, `tz`), el emoji sobre el color
 *  del mentor y la clase ("Clase de Inglés con Emily": materia + mentor). `tag` marca la que está pasando o la próxima.
 *  Pura. */
export function ClassRow({ e, tag, tz }: { e: CalendarEvent; tag: 'live' | 'next' | null; tz: Tz }) {
  return (
    <li className={`cal-row${tag === 'live' ? ' is-live' : ''}`} style={{ '--c': e.color } as CSSProperties} data-event={e.id}>
      <span className="cal-row-time"><b>{hm(e.start, tz)}</b><small>a {hm(endOf(e), tz)}</small></span>
      <span className="cal-row-emo" aria-hidden="true">{e.emoji}</span>
      <span className="cal-row-title">{e.title}</span>
      {tag && <span className={`cal-tag cal-tag--${tag}`}>{tag === 'live' ? 'Ahora' : 'La próxima'}</span>}
    </li>
  );
}
