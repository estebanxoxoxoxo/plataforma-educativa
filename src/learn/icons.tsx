// PORTE INNERITH (W2): los Boards del POC usan lucide-react (Check, X, Minus, Lightbulb), que Innerith
// no tiene. Check y X salen del set de Innerith (shared/components/icons); Minus y Lightbulb no existen
// ahí → se definen acá con la MISMA convención (viewBox 24, trazo currentColor) para que los Boards
// rindan ya. La estética fina la ajusta W3.
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

export const IcMinus = (props: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" {...props}>
    <path d="M5 12h14" />
  </svg>
);

export const IcLightbulb = (props: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <path d="M9 18h6" />
    <path d="M10 22h4" />
  </svg>
);
