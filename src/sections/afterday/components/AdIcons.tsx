// Íconos propios de After Day (los de icons.tsx no tienen la nota musical del POC).
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

/** Nota musical (la "Music" del POC): el vacío y el disco de la tarjeta — pedido de Esteban 29-oct: la nota ES el play de
 *  la modalidad solo-audio (en color; en blanco y negro cuando está en pausa). El ▶ y el ⏸ de un rato antes se fueron. */
export const IcAdMusic = (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);
