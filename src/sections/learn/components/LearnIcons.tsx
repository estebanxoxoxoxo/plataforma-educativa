import type { ReactNode, SVGProps } from 'react';

/* Íconos de Learn: los que el POC toma de lucide-react (Learn.tsx, RutaView.tsx, ActivityOverlay.tsx), dibujados acá
   como SVG locales de la sección (Innerith no usa lucide y shared/icons.tsx no se toca): misma geometría (viewBox 24,
   trazo currentColor 2, puntas redondeadas) y mismos nombres, así el ícono de cada nodo/botón es el del POC. */

type P = SVGProps<SVGSVGElement>;
const mk = (body: ReactNode) => {
  const Icon = (props: P) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {body}
    </svg>
  );
  return Icon;
};

export const IcArrowLeft = mk(<><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>);
export const IcCheck = mk(<path d="M20 6 9 17l-5-5" />);
export const IcRefreshCw = mk(<>
  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" />
</>);
export const IcStar = mk(<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />);
export const IcX = mk(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>);
export const IcChevronRight = mk(<path d="m9 18 6-6-6-6" />);
/* «+ Crear» del encabezado de Aprender (pedido de Esteban, 30-oct): un más, no el ícono de Crear del menú. */
export const IcPlus = mk(<><path d="M12 5v14" /><path d="M5 12h14" /></>);
export const IcRotateCcw = mk(<><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></>);
export const IcPause = mk(<><rect x="14" y="4" width="4" height="16" rx="1" /><rect x="6" y="4" width="4" height="16" rx="1" /></>);
export const IcPlay = mk(<polygon points="6 3 20 12 6 21 6 3" />);
export const IcFlag = mk(<><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><path d="M4 22v-7" /></>);

/* Ícono por TIPO de actividad (RutaView del POC) y por CONTENIDO (lectura / video). */
export const IcWalletCards = mk(<>
  <rect width="18" height="18" x="3" y="3" rx="2" /><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2" />
  <path d="M3 11h3c.8 0 1.6.3 2.1.9l1.1.9c1.6 1.6 4.1 1.6 5.7 0l1.1-.9c.5-.5 1.3-.9 2.1-.9H21" />
</>);
export const IcListChecks = mk(<>
  <path d="m3 17 2 2 4-4" /><path d="m3 7 2 2 4-4" /><path d="M13 6h8" /><path d="M13 12h8" /><path d="M13 18h8" />
</>);
export const IcCircleCheckBig = mk(<><path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" /></>);
export const IcDice3 = mk(<><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><path d="M16 8h.01" /><path d="M12 12h.01" /><path d="M8 16h.01" /></>);
export const IcShapes = mk(<>
  <path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z" />
  <rect x="3" y="14" width="7" height="7" rx="1" /><circle cx="17.5" cy="17.5" r="3.5" />
</>);
export const IcCircle = mk(<circle cx="12" cy="12" r="10" />);
export const IcMonitorPlay = mk(<>
  <path d="M10 7.75a.75.75 0 0 1 1.142-.638l3.664 2.249a.75.75 0 0 1 0 1.278l-3.664 2.25a.75.75 0 0 1-1.142-.64z" />
  <path d="M12 17v4" /><path d="M8 21h8" /><rect x="2" y="3" width="20" height="14" rx="2" />
</>);
export const IcBookOpen = mk(<>
  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
</>);

export type LearnIcon = (props: P) => ReactNode;
