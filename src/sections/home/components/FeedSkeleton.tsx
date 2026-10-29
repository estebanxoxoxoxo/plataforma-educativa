/** Esqueletos del hilo mientras llega la primera página. Anticipan el ritmo REAL (tanda V2 "la media manda"): se
 *  alternan la card con media (chip, media 16:9 en su columna — apilada a todo el ancho en el teléfono —, título, meta y
 *  la píldora de la acción) y la card horizontal (chip, avatar redondo, dos renglones). Las formas salen de los mismos
 *  tokens que las cards de verdad: al llegar el feed no salta nada. */
export const FeedSkeleton = () => (
  <div className="hf-sk" aria-hidden="true">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="hf-card hf-sk-card sk" data-sk={i % 2 === 0 ? 'media' : 'row'}>
        <div className="ph-b hf-sk-eb"><i /></div>
        <div className="ph-a" />
        <div className="ph-b hf-sk-tx"><i /><i /><i /></div>
        <div className="ph-b hf-sk-ft"><i /></div>
      </div>
    ))}
  </div>
);
