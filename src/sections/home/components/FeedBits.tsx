import type { ReactNode } from 'react';
import { IcClock, IcClose } from '../../../shared/components/icons';

/** Chip "por qué" (mock v6): el algoritmo se muestra. `title` = el motivo (tooltip nativo) y, al tocarlo o enfocarlo, la
 *  misma frase en un globito (en una tablet no hay hover). `end` = el chip va al final de su fila: el globito se abre
 *  hacia la izquierda (si no, se saldría del borde). No navega a ningún lado. Puro. */
export const WhyChip = ({ reason, icon, end }: { reason: string; icon?: ReactNode; end?: boolean }) => (
  <button type="button" className={`hf-why${end ? ' is-end' : ''}`} title={reason} data-why={reason} aria-label={`Por qué te lo muestro: ${reason}`}
    onClick={(e) => e.currentTarget.focus()} onKeyDown={(e) => { if (e.key === 'Escape') e.currentTarget.blur(); }}>
    {icon ?? <IcClock aria-hidden="true" />}por qué
  </button>
);

/** ✕ "Ver menos de esto" (reversible: lo reemplaza un "Listo… Deshacer"). Puro. */
export const LessButton = ({ onClick, className }: { onClick: () => void; className?: string }) => (
  <button type="button" className={`hf-less${className ? ` ${className}` : ''}`} aria-label="Ver menos de esto" title="Ver menos de esto" onClick={onClick}>
    <IcClose aria-hidden="true" />
  </button>
);

/** La Energy Coin dentro de un texto del server ("… · al cerrar la unidad, +30 ⚡") en el acento de la Tienda (oro). */
const COIN = /(\+?\d[\d.]*\s?⚡)/u;
export const Coins = ({ text }: { text: string }) => (
  <>{text.split(COIN).map((p, i) => (i % 2 === 1 ? <span key={i} className="hf-ec">{p}</span> : p))}</>
);
