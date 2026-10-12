import type { FeedItem } from '../../../api/types';
import { IcClock, IcSpark } from '../../../shared/components/icons';

type It = Extract<FeedItem, { kind: 'summary' }>;

/** RESUMEN de la edición (estilo E del mock v6): el algoritmo se muestra — confiesa la mezcla de hoy (contada por el
 *  server) y cómo cambia con la hora del día. Panel apenas hundido, display en serif. Pura. */
export const FeedSummaryCard = ({ it }: { it: It }) => (
  <section className="hf-sum" aria-labelledby="hf-sum-t">
    <p className="hf-k"><IcSpark aria-hidden="true" />Resumen de hoy</p>
    <h3 className="hf-sum-t" id="hf-sum-t">{it.title}</h3>
    <p className="hf-sum-d">{it.desc}</p>
    {it.mix.length > 0 && (
      <ul className="hf-mix" aria-label="La mezcla de hoy">
        {it.mix.map((m) => <li key={m.label} className="hf-mx"><b>{m.n}</b>{' '}{m.label}</li>)}
      </ul>
    )}
    <p className="hf-adapt"><IcClock aria-hidden="true" />{it.later}</p>
  </section>
);
