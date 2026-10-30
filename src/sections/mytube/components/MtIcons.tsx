// Íconos propios de MyTube que no están en shared/components/icons.tsx (mismo lenguaje: viewBox 24, trazo redondeado).
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base: P = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

/** Tele (vacío de Canales). */
export const IcMtTv = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="6.5" width="18" height="12.5" rx="2.5" /><path d="M8.5 2.8L12 6.3l3.5-3.5" /></svg>
);
export const IcMtPlus = (p: P) => (
  <svg {...base} strokeWidth={2.6} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
/** Antes / después en la lista (30-oct): los videos de una lista pasaron de filas a grilla, y en una grilla «antes» es a la
 *  izquierda (o al final de la fila de arriba), no arriba. Mismo trazo que IcUpSm/IcDownSm de shared. */
export const IcMtPrev = (p: P) => (
  <svg {...base} strokeWidth={2.6} {...p}><path d="M14.5 6l-6 6 6 6" /></svg>
);
export const IcMtNext = (p: P) => (
  <svg {...base} strokeWidth={2.6} {...p}><path d="M9.5 6l6 6-6 6" /></svg>
);
export const IcMtPencil = (p: P) => (
  <svg {...base} {...p}><path d="M4 20l4-1L19 8l-3-3L5 16z" /><path d="M14 7l3 3" /></svg>
);
