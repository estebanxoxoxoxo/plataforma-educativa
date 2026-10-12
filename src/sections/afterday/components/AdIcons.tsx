// Íconos propios de After Day (los de icons.tsx no tienen la nota musical del POC).
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

/** Nota musical (la "Music" del POC): la tarjeta que suena y el vacío. */
export const IcAdMusic = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

/** Play relleno, un poco corrido a la derecha para que se vea centrado en el círculo. */
export const IcAdPlay = (p: P) => (
  <svg viewBox="0 0 24 24" {...p}>
    <path d="M8.5 5.2l11 6.8-11 6.8z" fill="currentColor" />
  </svg>
);
