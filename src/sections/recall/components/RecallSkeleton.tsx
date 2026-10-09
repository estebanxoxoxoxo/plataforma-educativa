/** Esqueleto de Repasar mientras llega el resumen: el hero, la tira y tres filas de curso. */
export const RecallSkeleton = () => (
  <div className="rc-sk" aria-busy="true" aria-label="Cargando tus cartas">
    <div className="rc-sk-hero"><i style={{ width: '22%' }} /><i style={{ width: '48%', height: 30 }} /><i style={{ width: '64%' }} /></div>
    <div className="rc-sk-strip"><i /><i /><i /><i /></div>
    {[0, 1, 2].map((k) => <div key={k} className="rc-sk-row"><i /><i /></div>)}
  </div>
);

/** Esqueleto de una carta (mientras se arma el mazo). */
export const CardSkeleton = () => (
  <div className="rc-sk rc-sk-card" aria-busy="true" aria-label="Mezclando las cartas">
    <i style={{ width: '30%' }} /><i style={{ width: '82%', height: 26 }} /><i style={{ width: '60%', height: 26 }} />
    <div className="rc-sk-opts"><i /><i /><i /><i /></div>
  </div>
);
