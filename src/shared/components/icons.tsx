// Todos los íconos SVG del prototipo, copiados 1:1.
import type { ReactNode, SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const svg = (children: ReactNode, base: P) => (props: P) => (
  <svg viewBox="0 0 24 24" {...base} {...props}>{children}</svg>
);
const stroke = (w: number, extra: P = {}): P => ({ fill: 'none', stroke: 'currentColor', strokeWidth: w, ...extra });

// Navegación
export const IcChat = svg(<path d="M4 5h16v11H10l-6 4z" />, stroke(2.2, { strokeLinejoin: 'round' }));
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

// Feed / home
export const IcShare = svg(<><circle cx="6" cy="12" r="2.6" /><circle cx="17.5" cy="5.5" r="2.6" /><circle cx="17.5" cy="18.5" r="2.6" /><path d="M8.3 10.8l6.9-4M8.3 13.2l6.9 4" /></>, stroke(2, {}));

// Mi espacio (Drive, canales, listas) + audio de fondo
/** Carpeta "estilo Windows": la MISMA para todas (amarilla, solapa atrás + cuerpo adelante). */
export const IcFolderWin = (props: P) => (
  <svg viewBox="0 0 48 38" {...props}>
    <path d="M4 7a3 3 0 013-3h9.6a3 3 0 012.2 1L21.6 8H41a3 3 0 013 3v4H4z" fill="#E6A23C" />
    <rect x="4" y="10.5" width="40" height="23.5" rx="3" fill="#FFC95C" />
    <path d="M4 13.5a3 3 0 013-3h34a3 3 0 013 3v1.8H4z" fill="#FFD98A" />
  </svg>
);
export const IcListMusic = svg(<><path d="M4 6h10M4 11h10M4 16h6" strokeLinecap="round" /><circle cx="16.5" cy="17" r="2.5" /><path d="M19 17V8l3-1" strokeLinecap="round" strokeLinejoin="round" /></>, stroke(2.2));
export const IcHeadphones = svg(<><path d="M4 14v-2a8 8 0 0116 0v2" /><rect x="3" y="14" width="4.5" height="6" rx="1.8" /><rect x="16.5" y="14" width="4.5" height="6" rx="1.8" /></>, stroke(2.1, { strokeLinecap: 'round', strokeLinejoin: 'round' }));
export const IcBookmark = svg(<path d="M6.5 4h11v16.5L12 16.6l-5.5 3.9z" />, stroke(2.2, { strokeLinejoin: 'round' }));
export const IcBookmarkOn = svg(<path d="M6.5 4h11v16.5L12 16.6l-5.5 3.9z" fill="currentColor" />, {});
export const IcPlusList = svg(<><path d="M4 6h10M4 11h10M4 16h6" strokeLinecap="round" /><path d="M17.5 12.5v7M14 16h7" strokeLinecap="round" /></>, stroke(2.2));
export const IcTrash = svg(<><path d="M4.5 6.5h15" strokeLinecap="round" /><path d="M8 6.5V4.8A1.3 1.3 0 019.3 3.5h5.4A1.3 1.3 0 0116 4.8v1.7" /><path d="M6.5 6.5l1 13.2A1.4 1.4 0 008.9 21h6.2a1.4 1.4 0 001.4-1.3l1-13.2" /><path d="M10 10.5v6M14 10.5v6" strokeLinecap="round" /></>, stroke(2, { strokeLinejoin: 'round' }));
export const IcRestore = svg(<><path d="M4.5 9A8 8 0 114 13.5" strokeLinecap="round" /><path d="M4 5v4.5h4.5" strokeLinecap="round" strokeLinejoin="round" /></>, stroke(2.2));
export const IcDots = svg(<><circle cx="12" cy="5.5" r="1.7" fill="currentColor" /><circle cx="12" cy="12" r="1.7" fill="currentColor" /><circle cx="12" cy="18.5" r="1.7" fill="currentColor" /></>, {});
export const IcPlay = svg(<path d="M7 4.5l13 7.5-13 7.5z" fill="currentColor" />, {});
export const IcPause = svg(<><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" /></>, {});
export const IcSkipNext = svg(<path d="M5 5.5l9 6.5-9 6.5zM16.5 5.5h2.8v13h-2.8z" fill="currentColor" />, {});
export const IcSkipPrev = svg(<path d="M19 5.5L10 12l9 6.5zM4.7 5.5h2.8v13H4.7z" fill="currentColor" />, {});
export const IcRepeat = svg(<><path d="M17 3.5l3 3-3 3" /><path d="M20 6.5H8a4 4 0 00-4 4v.8" /><path d="M7 20.5l-3-3 3-3" /><path d="M4 17.5h12a4 4 0 004-4v-.8" /></>, stroke(2.1, { strokeLinecap: 'round', strokeLinejoin: 'round' }));
export const IcUpSm = svg(<path d="M6 14.5l6-6 6 6" />, stroke(2.6, { strokeLinecap: 'round', strokeLinejoin: 'round' }));
export const IcDownSm = svg(<path d="M6 9.5l6 6 6-6" />, stroke(2.6, { strokeLinecap: 'round', strokeLinejoin: 'round' }));

// Tienda (premios del padre, se canjean con Energy Coin)
/** Regalo: caja + tapa + cinta + moño, mismo trazo 2.2 que el resto del menú. */

// ── Menú lateral (estética Duolingo): íconos RELLENOS y multicolor, viewBox 32, colores FIJOS (sin currentColor)
//    → se ven iguales activos o inactivos; el estado lo marcan la píldora y la etiqueta. Son decorativos (el botón
//    ya tiene su texto), por eso aria-hidden. Paleta: tonos de los tokens de base.css + luces/sombras planas.
const filled = (children: ReactNode) => (props: P) => (
  <svg viewBox="0 0 32 32" aria-hidden="true" {...props}>{children}</svg>
);
const NK = {
  ink: '#3D4766', coral: '#EF5A4C', brown: '#8A4B1B', wood: '#B8683A',
  gold: '#FFC23D', goldD: '#E39710', goldL: '#FFDB7A',
  sky: '#38A8E0', skyD: '#1E8BC6', skyL: '#D9F1FC',
  pink: '#EC5F92', pinkL: '#FFE6EF',
  blue: '#3A5BD9', blueL: '#F2F5FF', blueM: '#A9BBF6',
  orange: '#F26B3A', orangeD: '#D9531F', violet: '#8A5CF5', green: '#2FB57A',
  fTab: '#E6A23C', fBody: '#FFC95C', fHi: '#FFD98A', // = IcFolderWin
};
/** Descubrir (el feed de recomendaciones, la home): brújula rosa con aguja coral. */
export const IcNavDiscover = filled(<>
  <circle cx="16" cy="16" r="13.4" fill={NK.pink} />
  <circle cx="16" cy="16" r="9.4" fill={NK.pinkL} />
  <circle cx="16" cy="8.9" r="1" fill={NK.pink} /><circle cx="23.1" cy="16" r="1" fill={NK.pink} />
  <circle cx="16" cy="23.1" r="1" fill={NK.pink} /><circle cx="8.9" cy="16" r="1" fill={NK.pink} />
  <path d="M21.6 10.4L17.9 17.9 14.1 14.1z" fill={NK.coral} />
  <path d="M10.4 21.6L14.1 14.1 17.9 17.9z" fill={NK.ink} />
  <circle cx="16" cy="16" r="1.5" fill="#fff" />
</>);
/** Buscar: lupa celeste con mango oscuro y brillo. */
export const IcNavSearch = filled(<>
  <path d="M20.6 20.6l6 6" stroke={NK.ink} strokeWidth="5.2" strokeLinecap="round" />
  <circle cx="13.5" cy="13.5" r="10" fill={NK.sky} />
  <circle cx="13.5" cy="13.5" r="6.4" fill={NK.skyL} />
  <path d="M9.6 12.2a4.3 4.3 0 013-3.1" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
</>);
/** Chat: globo de diálogo verde con "escribiendo…" (el verde no lo usa ningún otro ícono del menú). */
export const IcNavChat = filled(<>
  <rect x="3" y="5" width="26" height="19" rx="7" fill={NK.green} />
  <path d="M7.5 22l-1.3 6.8 7.8-5.2z" fill={NK.green} />
  <circle cx="10" cy="14.5" r="2.1" fill="#fff" /><circle cx="16" cy="14.5" r="2.1" fill="#fff" /><circle cx="22" cy="14.5" r="2.1" fill="#fff" />
</>);
/** Mi espacio: la carpeta amarilla de siempre (colores de IcFolderWin) con un corazón: "lo mío". */
export const IcNavSpace = filled(<>
  <path d="M3 9a2.6 2.6 0 012.6-2.6h6.6a2.6 2.6 0 011.9.8L16.3 9.6H26.4A2.6 2.6 0 0129 12.2v2H3z" fill={NK.fTab} />
  <rect x="3" y="12" width="26" height="15.6" rx="2.8" fill={NK.fBody} />
  <path d="M3 14.8A2.8 2.8 0 015.8 12h20.4a2.8 2.8 0 012.8 2.8v1.2H3z" fill={NK.fHi} />
  <path d="M16 25c-3.6-2.3-5.6-4.3-5.6-6.5a2.8 2.8 0 015.6-.9 2.8 2.8 0 015.6.9c0 2.2-2 4.2-5.6 6.5z" fill="#fff" />
</>);
/** Tienda: tiendita con toldo a rayas coral, vidriera y puerta dorada. */
export const IcNavStore = filled(<>
  <rect x="5.5" y="11" width="21" height="17" rx="2" fill={NK.wood} />
  <rect x="8.5" y="16" width="7" height="6" rx="1.2" fill="#CDEBFA" />
  <rect x="18" y="16" width="5.5" height="12" rx="1.2" fill={NK.gold} />
  <rect x="4" y="5" width="24" height="7" rx="2" fill={NK.coral} />
  <rect x="8.8" y="5" width="4.8" height="7" fill="#fff" />
  <rect x="18.4" y="5" width="4.8" height="7" fill="#fff" />
  <circle cx="6.4" cy="12" r="2.4" fill={NK.coral} /><circle cx="11.2" cy="12" r="2.4" fill="#fff" />
  <circle cx="16" cy="12" r="2.4" fill={NK.coral} /><circle cx="20.8" cy="12" r="2.4" fill="#fff" />
  <circle cx="25.6" cy="12" r="2.4" fill={NK.coral} />
</>);
/** Aprender: libro azul abierto con páginas claras. */
export const IcNavLearn = filled(<>
  <path d="M2.5 9A3 3 0 015.5 6h7c1.5 0 2.7.5 3.5 1.3.8-.8 2-1.3 3.5-1.3h7a3 3 0 013 3v15a2 2 0 01-2 2h-8.2c-1.5 0-2.7.5-3.3 1.4-.6-.9-1.8-1.4-3.3-1.4H4.5a2 2 0 01-2-2z" fill={NK.blue} />
  <path d="M4.8 9.2A1.2 1.2 0 016 8h6.4c1.3 0 2.5.6 2.9 1.6V24.4c-.7-.6-1.8-.9-3-.9H6a1.2 1.2 0 01-1.2-1.2z" fill={NK.blueL} />
  <path d="M27.2 9.2A1.2 1.2 0 0026 8h-6.4c-1.3 0-2.5.6-2.9 1.6V24.4c.7-.6 1.8-.9 3-.9H26a1.2 1.2 0 001.2-1.2z" fill={NK.blueL} />
  <path d="M7.5 12h5M7.5 15.5h5M7.5 19h3.5M19.5 12h5M19.5 15.5h5M19.5 19h3.5" stroke={NK.blueM} strokeWidth="1.6" strokeLinecap="round" />
</>);
/** Practicar: mancuerna naranja (el naranja de la sección; celeste quedaba pegada al libro azul). */
export const IcNavPractice = filled(<g transform="rotate(-40 16 16)">
  <rect x="6" y="14.5" width="20" height="3" rx="1.5" fill={NK.ink} />
  <rect x="2.6" y="10.6" width="5" height="10.8" rx="2.5" fill={NK.orangeD} />
  <rect x="24.4" y="10.6" width="5" height="10.8" rx="2.5" fill={NK.orangeD} />
  <rect x="7" y="7.4" width="5.6" height="17.2" rx="2.8" fill={NK.orange} />
  <rect x="19.4" y="7.4" width="5.6" height="17.2" rx="2.8" fill={NK.orange} />
</g>);
/** Amigos: dos caritas (violeta atrás, dorada adelante con aro blanco que las separa). */
export const IcNavFriends = filled(<>
  <circle cx="21.4" cy="10.8" r="8.8" fill={NK.violet} />
  <circle cx="20.2" cy="9.6" r="1.2" fill="#fff" />
  <circle cx="24.4" cy="9.6" r="1.2" fill="#fff" />
  <path d="M20.6 12.7q1.9 1.7 3.8 0" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
  <circle cx="11.4" cy="20.2" r="11.5" fill="#fff" />
  <circle cx="11.4" cy="20.2" r="10.2" fill={NK.gold} />
  <circle cx="8.6" cy="19.2" r="1.35" fill={NK.brown} />
  <circle cx="14.2" cy="19.2" r="1.35" fill={NK.brown} />
  <path d="M8.3 22.7q3.1 2.8 6.2 0" stroke={NK.brown} strokeWidth="1.9" strokeLinecap="round" fill="none" />
</>);
const SHIELD = 'M4.8 7.6c0-1 .7-1.9 1.7-2.1L16 3.4l9.5 2.1c1 .2 1.7 1.1 1.7 2.1V15c0 6.8-4.5 11.6-11.2 14C9.3 26.6 4.8 21.8 4.8 15z';
const SHIELD_IN = 'M7.6 9.1c0-.6.4-1.1 1-1.3L16 6.2l7.4 1.6c.6.2 1 .7 1 1.3V15c0 5.3-3.3 9.3-8.4 11.3C10.9 24.3 7.6 20.3 7.6 15z';
/** Ligas: escudo dorado con brillo diagonal; el borde oscuro es un aro evenodd pintado ENCIMA del brillo. */
export const IcNavLeagues = filled(<>
  <path d={SHIELD} fill={NK.gold} />
  <path d="M19.6 5.2l5.2 1.1L12.6 26.9l-4-3z" fill={NK.goldL} />
  <path d={SHIELD + SHIELD_IN} fill={NK.goldD} fillRule="evenodd" />
</>);
/** Sub-ítem Carpetas (16-18 px): carpetita amarilla. */
export const IcNavFolder = filled(<>
  <path d="M3 9.4A2.6 2.6 0 015.6 6.8h6.6a2.6 2.6 0 011.9.8l2.4 2.6h9.9A2.6 2.6 0 0129 12.8v1.6H3z" fill={NK.fTab} />
  <rect x="3" y="11.6" width="26" height="15.4" rx="2.8" fill={NK.fBody} />
  <path d="M3 14.4a2.8 2.8 0 012.8-2.8h20.4a2.8 2.8 0 012.8 2.8v1.4H3z" fill={NK.fHi} />
</>);
/** Sub-ítem Videos: tele celeste con antena. */
export const IcNavTv = filled(<>
  <path d="M11 4l5 4.6L21 4" stroke={NK.ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  <rect x="3" y="8.5" width="26" height="19" rx="4.2" fill={NK.sky} />
  <rect x="6.6" y="12" width="18.8" height="12" rx="2.2" fill={NK.skyL} />
  <path d="M14 14.8v6.4l5.6-3.2z" fill={NK.sky} />
</>);
/** Botón "Sonido de fondo" del pie del menú (el IcHeadphones de trazo sigue en el reproductor y en Listas). */
export const IcNavHeadphones = filled(<>
  <path d="M5.5 19v-3.5a10.5 10.5 0 0121 0V19" stroke={NK.ink} strokeWidth="3" strokeLinecap="round" fill="none" />
  <rect x="3.5" y="16.5" width="7.5" height="11.5" rx="3.4" fill={NK.sky} />
  <rect x="21" y="16.5" width="7.5" height="11.5" rx="3.4" fill={NK.sky} />
  <rect x="7.6" y="18.6" width="2.4" height="7.4" rx="1.2" fill={NK.skyD} />
  <rect x="22" y="18.6" width="2.4" height="7.4" rx="1.2" fill={NK.skyD} />
</>);
