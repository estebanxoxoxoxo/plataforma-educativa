import { clampDays, daysText } from '../lib/familyWeek';

/** U5 · D2 (§4.2): el reto "¿quién aprende más días esta semana?" como siete puntitos (llenos = días con algo nuevo
 *  aprendido) + "5 de 7 días". Se llenan de izquierda a derecha y NO tienen letras de día: no se ve QUÉ día faltó (lo que
 *  baja la conducta es ver la rotura, no la falta; G7). Solo sube dentro de la semana. Puro. */
export function DaysDots({ days }: { days: number }) {
  const n = clampDays(days);
  return (
    <span className="lgd" title={`${daysText(n)} aprendiendo algo nuevo esta semana`}>
      <span className="lgd-dots" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => <i key={i} className={i < n ? 'on' : undefined} />)}
      </span>
      <span className="lgd-t">{daysText(n)}</span>
    </span>
  );
}
