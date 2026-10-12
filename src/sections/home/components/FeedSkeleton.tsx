/** Esqueletos del hilo mientras llega la primera página (la forma de la card estándar). */
export const FeedSkeleton = () => (
  <div className="hf-sk" aria-hidden="true">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="hf-card hf-sk-card sk">
        <div className="ph-a" />
        <div className="ph-b"><i /><i /><i /></div>
      </div>
    ))}
  </div>
);
