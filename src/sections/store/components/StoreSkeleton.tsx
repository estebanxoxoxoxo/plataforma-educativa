/** Esqueleto de carga de la Tienda: billetera + premios (mismas medidas que lo real, sin saltos). */
export function StoreSkeleton() {
  return (
    <div className="st-skel" role="status" aria-label="Cargando la Tienda">
      <span className="st-sk st-sk-hero" />
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
  );
}
