/** Estados del Calendario sin clases para mostrar. Puros. */

/** Vacío: todavía no hay profes contratados. Invita, pero sin link a la Zona de padres (el chico no gestiona). */
export function CalendarEmpty() {
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
      <p className="cal-empty-p">Cuando tu familia contrate un profe, aparecen acá.</p>
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
    <div className="cal-sk" aria-busy="true" aria-label="Cargando tu calendario">
      <div className="cal-sk-hero"><i /><i /><i /></div>
      <div className="cal-sk-row"><i /><i /></div>
      <div className="cal-sk-row"><i /><i /></div>
      <div className="cal-sk-row"><i /><i /></div>
    </div>
  );
}
