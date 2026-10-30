import type { ReactNode, SVGProps } from 'react';

/* Íconos de trazo FINO y uniforme de Buscar y Chat (tanda BUSCARCHAT, 30-oct): el nivel de limpieza del POC (lucide con
   el mismo strokeWidth en todos). Viven acá y no en shared/components/icons (que es de todos y tiene trazos de 2-2,6):
   mismo grosor en toda la sección. Trazos tomados de lucide (ISC). Decorativos: aria-hidden. */
type P = SVGProps<SVGSVGElement>;
const line = (d: ReactNode, sw = 1.8) => (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...p}>{d}</svg>
);

export const LnSearch = line(<><circle cx="11" cy="11" r="7.5" /><path d="m20.5 20.5-4.2-4.2" /></>);
export const LnX = line(<><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>);
export const LnHistory = line(<><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></>);
export const LnPlus = line(<><path d="M5 12h14" /><path d="M12 5v14" /></>, 2);
export const LnArrowUp = line(<><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></>, 2.2);
export const LnArrowDown = line(<><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>, 2);
export const LnFilm = line(<><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M7 3v18M17 3v18M3 12h18M3 7.5h4M3 16.5h4M17 7.5h4M17 16.5h4" /></>);
export const LnImages = line(<><path d="M18 22H4a2 2 0 0 1-2-2V6" /><path d="m22 13-1.3-1.3a2.4 2.4 0 0 0-3.4 0L11 18" /><circle cx="12" cy="8" r="2" /><rect width="16" height="16" x="6" y="2" rx="2" /></>);
export const LnBook = line(<><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></>);
export const LnTrash = line(<><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></>);
export const LnChat = line(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />);
export const LnShield = line(<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />);
export const LnPlay = (p: P) => <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...p}><path d="M8 5v14l11-7z" fill="currentColor" /></svg>;
