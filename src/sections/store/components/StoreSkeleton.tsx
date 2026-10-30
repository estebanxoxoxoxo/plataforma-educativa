/** Esqueleto de carga de la Tienda: billetera + premios (mismas medidas que lo real, sin saltos). */
export function StoreSkeleton() {
  return (
    // El mismo armado que lo real (30-oct): billetera en la columna lateral (derecha en el escritorio), premios en la principal.
    <div className="st-skel st-layout" role="status" aria-label="Cargando la Tienda">
      <div className="st-aside"><span className="st-sk st-sk-hero" /></div>
      <div className="st-main">
        <div className="st-grid">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="st-card st-card--sk">
              <span className="st-sk st-sk-art" />
              <span className="st-sk st-sk-l1" />
              <span className="st-sk st-sk-l2" />
              <span className="st-sk st-sk-btn" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
