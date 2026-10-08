/** Esqueletos del feed mientras llega la primera página. */
export const FeedSkeleton = () => (
  <>
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className={`fcard fsk sk${i % 2 ? ' alt' : ''}`} aria-hidden>
        <div className="ph-a" />
        <div className="ph-b"><i /><i /><i /></div>
      </div>
    ))}
  </>
);
