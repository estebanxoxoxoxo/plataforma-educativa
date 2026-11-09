import { Link } from 'react-router-dom';
import { L } from '../../../shared/lib/lang';

/** Estados del Calendario sin clases para mostrar. Puros. */

/** Vacío: todavía no hay mentores contratados para quien mira. Al chico lo invita sin link (no gestiona: se los contrata su
 *  familia); al adulto, que los contrata él, lo manda a Buscar → Mentores. */
export function CalendarEmpty({ adult }: { adult: boolean }) {
  return (
    <section className="cal-empty" aria-labelledby="cal-empty-t">
      <div className="cal-empty-art" aria-hidden="true">
        <span className="cal-leaf cal-leaf--empty">
          <span className="cal-leaf-m">&nbsp;</span>
          <span className="cal-leaf-d cal-leaf-d--empty"><i /><i /><i /><i /><i /><i /></span>
        </span>
        <span className="cal-empty-spark">✨</span>
      </div>
      <h3 className="cal-empty-t" id="cal-empty-t">{L('Todavía no hay clases', 'No classes yet')}</h3>
      {adult ? (
        <>
          <p className="cal-empty-p">{L('Cuando contrates un mentor para vos, tus clases aparecen acá.', 'When you hire a mentor for yourself, your classes show up here.')}</p>
          <Link className="cal-more" to="/buscar?tab=mentors">{L('Buscar mentores', 'Find mentors')}</Link>
        </>
      ) : (
        <p className="cal-empty-p">{L('Cuando tu familia contrate un mentor, sus clases aparecen acá.', 'When your family hires a mentor, their classes show up here.')}</p>
      )}
    </section>
  );
}

/** No se pudo leer el calendario (y no hay nada para mostrar todavía). */
export function CalendarFail({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="cal-fail" role="alert">
      <p>{L('No pude traer tu calendario. Probá de nuevo en un ratito.', 'I couldn’t get your calendar. Try again in a little bit.')}</p>
      <button type="button" className="cal-more" onClick={onRetry}>{L('Reintentar', 'Try again')}</button>
    </div>
  );
}

/** Esqueleto mientras llega el calendario: hero y tres filas del listado. */
export function CalendarSkeleton() {
  return (
    // El mismo armado que lo real (30-oct): el hero en la columna lateral (derecha en el escritorio), las filas en la principal.
    <div className="cal-sk cal-layout" aria-busy="true" aria-label={L('Cargando tu calendario', 'Loading your calendar')}>
      <div className="cal-aside"><div className="cal-sk-hero"><i /><i /><i /></div></div>
      <div className="cal-sk-rows">
        <div className="cal-sk-row"><i /><i /></div>
        <div className="cal-sk-row"><i /><i /></div>
        <div className="cal-sk-row"><i /><i /></div>
      </div>
    </div>
  );
}
