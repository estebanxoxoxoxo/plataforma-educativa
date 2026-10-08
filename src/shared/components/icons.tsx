// Todos los íconos SVG del prototipo, copiados 1:1.
import type { ReactNode, SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const svg = (children: ReactNode, base: P) => (props: P) => (
  <svg viewBox="0 0 24 24" {...base} {...props}>{children}</svg>
);
const stroke = (w: number, extra: P = {}): P => ({ fill: 'none', stroke: 'currentColor', strokeWidth: w, ...extra });

// Navegación
export const IcDiscover = svg(<><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>, stroke(2.2, { strokeLinejoin: 'round' }));
export const IcSearch = svg(<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>, stroke(2.4, { strokeLinecap: 'round' }));
export const IcChat = svg(<path d="M4 5h16v11H10l-6 4z" />, stroke(2.2, { strokeLinejoin: 'round' }));
export const IcLearn = svg(<><path d="M4 5.5C4 4.7 4.7 4 5.5 4H20v14H5.5A1.5 1.5 0 004 19.5z" /><path d="M4 19.5A1.5 1.5 0 005.5 21H20v-3" /><path d="M9 8h7" /></>, stroke(2.2, { strokeLinejoin: 'round' }));
export const IcPractice = svg(<><path d="M5 21V4" /><path d="M5 4h12l-2.5 4L17 12H5" /></>, stroke(2.2, { strokeLinejoin: 'round', strokeLinecap: 'round' }));
export const IcFriends = svg(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><circle cx="17" cy="9" r="2.8" /><path d="M16.5 14.6c2.6.2 4.4 2 5 5" /></>, stroke(2.2, { strokeLinecap: 'round' }));
export const IcTrophyLine = svg(<><path d="M7 4h10v5a5 5 0 01-10 0z" /><path d="M7 6H4v1.5A3.5 3.5 0 007.5 11M17 6h3v1.5A3.5 3.5 0 0116.5 11M12 14v3M8 20h8" /></>, stroke(2.2, { strokeLinejoin: 'round', strokeLinecap: 'round' }));

// Búsqueda (look Google)
export const IcClose = svg(<path d="M6 6l12 12M18 6L6 18" />, stroke(2, { strokeLinecap: 'round' }));
export const IcSearchG = svg(<><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></>, stroke(2.2, { strokeLinecap: 'round' }));
export const IcShield = svg(<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />, stroke(2.4, { strokeLinejoin: 'round' }));
export const IcShieldOk = svg(<><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" strokeLinecap="round" /></>, stroke(2.4, { strokeLinejoin: 'round' }));
export const IcShieldOkBold = svg(<><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" strokeLinecap="round" /></>, stroke(2.6, { strokeLinejoin: 'round' }));
export const IcShieldX = svg(<><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 9l6 6M15 9l-6 6" strokeLinecap="round" /></>, stroke(2.4, { strokeLinejoin: 'round' }));
export const IcShieldBlock = svg(<><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9.5 9.5l5 5M14.5 9.5l-5 5" strokeLinecap="round" /></>, stroke(2.4, { strokeLinejoin: 'round' }));

// Genéricos
export const IcCheck = svg(<path d="M5 12.5l4.5 4.5L19 7.5" />, stroke(3.4, { strokeLinecap: 'round', strokeLinejoin: 'round' }));
export const IcX = svg(<path d="M6 6l12 12M18 6L6 18" />, stroke(3, { strokeLinecap: 'round' }));
export const IcPlayDark = svg(<path d="M6 4l14 8-14 8z" fill="#1B2238" />, {});
export const IcPlayWhite = svg(<path d="M6 4l14 8-14 8z" fill="#fff" />, {});
export const IcChev = svg(<path d="M6 9l6 6 6-6" />, stroke(2.6, { strokeLinecap: 'round', strokeLinejoin: 'round' }));
export const IcArrowRight = svg(<path d="M5 12h14M13 6l6 6-6 6" />, stroke(2.6, { strokeLinecap: 'round', strokeLinejoin: 'round' }));
export const IcArrowLeft = svg(<path d="M19 12H5M11 6l-6 6 6 6" />, stroke(2.8, { strokeLinecap: 'round', strokeLinejoin: 'round' }));
export const IcSpark = svg(<path d="M11 2l2.2 5.8L19 10l-5.8 2.2L11 18l-2.2-5.8L3 10l5.8-2.2z" />, { fill: 'currentColor' });
export const IcSparkDouble = svg(<><path d="M11 2l2.2 5.8L19 10l-5.8 2.2L11 18l-2.2-5.8L3 10l5.8-2.2z" /><path d="M19 14l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" /></>, { fill: 'currentColor' });
export const IcInfo = svg(<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.6v.2" strokeLinecap="round" strokeWidth={2.6} /></>, stroke(2.2));
export const IcGuide = svg(<><rect x="5" y="3" width="15" height="18" rx="2.5" /><path d="M9 8h7M9 12h7M9 16h4M3 7h3M3 12h3M3 17h3" /></>, stroke(2.4, { strokeLinecap: 'round', strokeLinejoin: 'round' }));

// Recursos de capítulos
export const IcResVideo = svg(<path d="M8 5l12 7-12 7z" fill="currentColor" />, {});
export const IcResLect = svg(<path d="M4 5h6a2 2 0 012 2v12a2 2 0 00-2-2H4zM20 5h-6a2 2 0 00-2 2v12a2 2 0 012-2h6z" />, stroke(2.4, { strokeLinejoin: 'round' }));
export const IcResImg = svg(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 16l5-5 4 4 3-3 6 6" /></>, stroke(2.4, { strokeLinejoin: 'round' }));
export const IcResAct = svg(<path d="M4 20l4-1L19 8l-3-3L5 16z" />, stroke(2.4, { strokeLinejoin: 'round', strokeLinecap: 'round' }));

// Reproductor
export const IcPPause = svg(<><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>, { fill: '#fff' });
export const IcPPlay = svg(<path d="M7 5l12 7-12 7z" />, { fill: '#fff' });
export const IcPNext = svg(<path d="M5 5l10 7-10 7zM16 5h3v14h-3z" />, { fill: '#fff' });
export const IcPVol = svg(<><path d="M4 9h4l5-4v14l-5-4H4z" fill="#fff" /><path d="M16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11" /></>, { fill: 'none', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round' });
export const IcPCC = svg(<><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M10 10.5a2 2 0 100 3M16 10.5a2 2 0 100 3" strokeLinecap="round" /></>, { fill: 'none', stroke: '#fff', strokeWidth: 2 });
export const IcPGear = svg(<><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" strokeLinecap="round" /></>, { fill: 'none', stroke: '#fff', strokeWidth: 2 });
export const IcPFull = svg(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />, { fill: 'none', stroke: '#fff', strokeWidth: 2.2, strokeLinecap: 'round' });

// Tipos de ejercicio (glifos de los nodos)
export const GlyphOpen = svg(<path d="M2.5 6.5a3.5 3.5 0 013.5-3.5h12a3.5 3.5 0 013.5 3.5v7a3.5 3.5 0 01-3.5 3.5H10l-5 4v-4.2a3.5 3.5 0 01-2.5-3.3z" fill="currentColor" />, {});
export const GlyphMC = svg(<><rect x="3" y="3" width="6" height="6" rx="1.6" fill="currentColor" /><rect x="11" y="4.7" width="10" height="2.6" rx="1.3" fill="currentColor" /><rect x="3.8" y="10.3" width="4.4" height="4.4" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" /><rect x="11" y="11.2" width="10" height="2.6" rx="1.3" fill="currentColor" /><rect x="3" y="16" width="6" height="6" rx="1.6" fill="currentColor" /><rect x="11" y="17.7" width="10" height="2.6" rx="1.3" fill="currentColor" /></>, {});
export const GlyphVF = svg(<><rect x="1.5" y="6" width="21" height="12" rx="6" fill="none" stroke="currentColor" strokeWidth="2.4" /><circle cx="16.5" cy="12" r="4" fill="currentColor" /></>, {});
export const GlyphTrophy = svg(<><path d="M7 3h10v5.5a5 5 0 01-10 0z" fill="currentColor" /><path d="M7 5H4v1.5A3.5 3.5 0 007.5 10M17 5h3v1.5a3.5 3.5 0 01-3.5 3.5" stroke="currentColor" strokeWidth="2" fill="none" /><rect x="10.5" y="13" width="3" height="4" fill="currentColor" /><rect x="7" y="17" width="10" height="3.5" rx="1.2" fill="currentColor" /></>, {});
export const GlyphSkip = svg(<path d="M3 5l9 7-9 7zM12 5l9 7-9 7z" fill="currentColor" />, {});

// Practicar (rediseño)
export const IcLock = svg(<><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 018 0v2.5" /></>, stroke(2.2, { strokeLinecap: 'round', strokeLinejoin: 'round' }));
export const IcClock = svg(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>, stroke(2.2, { strokeLinecap: 'round', strokeLinejoin: 'round' }));
export const IcBolt = svg(<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" />, { fill: 'currentColor' });
export const IcBook = svg(<><path d="M4 5.5A1.5 1.5 0 015.5 4H11v15H5.5A1.5 1.5 0 014 17.5zM20 5.5A1.5 1.5 0 0018.5 4H13v15h5.5a1.5 1.5 0 001.5-1.5z" /></>, stroke(2.1, { strokeLinejoin: 'round' }));
export const IcMedal = svg(<><path d="M12 2.8l7.8 4.5v9.4L12 21.2l-7.8-4.5V7.3z" fill="currentColor" /><path d="M12 7.6l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z" fill="#fff" /></>, {});
export const IcNone = svg(<><circle cx="12" cy="12" r="8.5" /><path d="M6 18L18 6" /></>, stroke(2.2, { strokeLinecap: 'round' }));
