import { Link } from 'react-router-dom';

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
      <h3 className="cal-empty-t" id="cal-empty-t">Todavía no hay clases</h3>
      {adult ? (
        <>
          <p className="cal-empty-p">Cuando contrates un mentor para vos, tus clases aparecen acá.</p>
          <Link className="cal-more" to="/buscar?tab=mentors">Buscar mentores</Link>
        </>
      ) : (
        <p className="cal-empty-p">Cuando tu familia contrate un mentor, sus clases aparecen acá.</p>
      )}
    </section>
  );
}

/** No se pudo leer el calendario (y no hay nada para mostrar todavía). */
export function CalendarFail({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="cal-fail" role="alert">
      <p>No pude traer tu calendario. Probá de nuevo en un ratito.</p>
      <button type="button" className="cal-more" onClick={onRetry}>Reintentar</button>
    </div>
  );
}

/** Esqueleto mientras llega el calendario: hero y tres filas del listado. */
export function CalendarSkeleton() {
  return (
    // El mismo armado que lo real (30-oct): el hero en la columna lateral (derecha en el escritorio), las filas en la principal.
    <div className="cal-sk cal-layout" aria-busy="true" aria-label="Cargando tu calendario">
      <div className="cal-aside"><div className="cal-sk-hero"><i /><i /><i /></div></div>
      <div className="cal-sk-rows">
        <div className="cal-sk-row"><i /><i /></div>
        <div className="cal-sk-row"><i /><i /></div>
        <div className="cal-sk-row"><i /><i /></div>
      </div>
    </div>
  );
}
