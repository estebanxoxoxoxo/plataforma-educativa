// Íconos de trazo del Feed v6 que el mock usa y no están en shared/components/icons.tsx (ese archivo no se toca: viven
// acá, locales a la sección). Mismo dibujo que los símbolos del mock (viewBox 24, trazo redondeado).
import type { ReactNode, SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const line = (children: ReactNode) => (props: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
);

/** Amigos (eyebrow de lo social y su "por qué"). */
export const IcUsersLine = line(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2-4.2" /></>);
/** Ruta (eyebrow de las rutas y el hero "tu siguiente paso"). */
export const IcRouteLine = line(<><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="6" r="2.5" /><path d="M8.5 18H14a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5" /></>);
/** "Ver más de antes". */
export const IcRefreshLine = line(<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />);
/** La píldora "N novedades ↑". */
export const IcUpLine = line(<path d="M12 19V6M6 11l6-6 6 6" />);
/** Encabezado de la grilla de videos. */
export const IcPlayLine = line(<path d="M8 5.5v13l11-6.5-11-6.5Z" />);
/** Unidad completada (el evento 'unit' de una noticia de amigo: un tilde en un círculo). */
export const IcUnitLine = line(<><circle cx="12" cy="12" r="8.5" /><path d="M8.2 12.4l2.6 2.6 5-5.4" /></>);
/** Lectura (eyebrow y miniatura de las lecturas). */
export const IcBookLine = line(<path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" />);
