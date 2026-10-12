import type { ReactNode, SVGProps } from 'react';

/* Íconos propios de /crear que no están en shared/components/icons.tsx (mismo trazado: 24×24, currentColor, puntas
   redondeadas). Decorativos: van siempre con texto o con aria-label en su botón. */
type P = SVGProps<SVGSVGElement>;
const line = (children: ReactNode, w = 2.2) => (props: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>
);

/** Capas: un módulo de la ruta. */
export const IcCrLayers = line(<><path d="M12 3.5l8.5 4.5L12 12.5 3.5 8z" /><path d="M3.5 12.2L12 16.7l8.5-4.5" /><path d="M3.5 16.2L12 20.7l8.5-4.5" /></>);
/** Lista con tildes: el inventario de facts. */
export const IcCrListChecks = line(<><path d="M4 6.5l1.6 1.6L8.6 5" /><path d="M4 13.5l1.6 1.6 3-3.1" /><path d="M12 7h8M12 14h8M5 19.5h15" /></>);
/** Subir archivo (portada). */
export const IcCrUpload = line(<><path d="M12 15.5V4.5M7.5 9L12 4.5 16.5 9" /><path d="M4.5 15v3.5A1.5 1.5 0 006 20h12a1.5 1.5 0 001.5-1.5V15" /></>);
/** Guardar. */
export const IcCrSave = line(<><path d="M5 4h11.5L20 7.5V19a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" /><path d="M8 4v5h7V4M7.5 20v-6h9v6" /></>, 2);
/** Más (agregar). */
export const IcCrPlus = line(<path d="M12 5v14M5 12h14" />, 2.6);
/** Ruta nueva (hoja con más). */
export const IcCrFilePlus = line(<><path d="M14 3.5H7A1.5 1.5 0 005.5 5v14A1.5 1.5 0 007 20.5h10a1.5 1.5 0 001.5-1.5V8z" /><path d="M14 3.5V8h4.5M12 11v6M9 14h6" /></>, 2);
/** Ruedita de "en curso" (gira con la clase cr-spin). */
export const IcCrSpinner = line(<><path d="M12 3.5a8.5 8.5 0 11-8.5 8.5" /></>, 2.6);
/** Repaso (flecha circular). */
export const IcCrRepeat = line(<><path d="M19.5 9A8 8 0 006 6.3L4 8.3" /><path d="M4 4v4.3h4.3" /><path d="M4.5 15A8 8 0 0018 17.7l2-2" /><path d="M20 20v-4.3h-4.3" /></>);
