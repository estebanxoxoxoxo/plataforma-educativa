import type { CSSProperties, ReactNode } from 'react';
import type { AvatarLook } from '../../api/types';

/* Identidad (visión §9 y §13: el avatar es un ACTIVO del chico). Dos formas de verse:
     · `look` dibujado: un personaje de este set (variant) en un color de la paleta. SVG propio, sin assets
       externos (nada que moderar ni que bajar: funciona offline y no depende de ningún proveedor).
     · `look` null/ausente: el default típico, la inicial sobre un color (la .av3 de siempre).
   El tamaño lo dan las reglas de cada sección sobre .av3 (.fdk-item .av3 en el dock, .rk .av3 en ligas…) o la prop `size`.
   Estilos: avatar.css (prefijo idav-). */

/* ---------- paleta: la que ya circula en el demo (ligas/amigos). ESPEJO en server/src/identity.ts ---------- */
export const AVATAR_COLORS = ['#3A5BD9', '#13A39A', '#F26B3A', '#8A5CF5', '#E5487A', '#F2A81D', '#1C9BD6', '#18A957'] as const;

const INK = '#1B2238';
const WHITE = '#FFFFFF';
const NOSE = '#FF7A9C';
const SKIN = { light: '#F7D3B7', medium: '#EDBB92', tan: '#C68A5E', deep: '#8A5A3C' } as const;
const HAIR = { brown: '#4A3324', dark: '#2B1D16' } as const;

/** Mezcla lineal de dos colores #RRGGBB (t = cuánto del segundo). */
function mix(a: string, b: string, t: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t).toString(16).padStart(2, '0')).join('');
}
/** Colores de un personaje a partir de su color: cuerpo, sombra (hacia la tinta), luz y el fondo del círculo. */
type Kit = { c: string; d: string; l: string; bg: string };
const kitFor = (c: string): Kit => ({ c, d: mix(c, INK, 0.3), l: mix(c, WHITE, 0.55), bg: mix(c, WHITE, 0.8) });

/* ---------- piezas comunes (viewBox 48 × 48; el círculo lo recorta el CSS) ---------- */
const Eyes = ({ x1, x2, y, r = 2.2, fill = INK }: { x1: number; x2: number; y: number; r?: number; fill?: string }) => (
  <>
    <circle cx={x1} cy={y} r={r} fill={fill} /><circle cx={x2} cy={y} r={r} fill={fill} />
    <circle cx={x1 + r * 0.32} cy={y - r * 0.36} r={r * 0.34} fill={WHITE} /><circle cx={x2 + r * 0.32} cy={y - r * 0.36} r={r * 0.34} fill={WHITE} />
  </>
);
const Smile = ({ cx, y, w = 3, sw = 1.6 }: { cx: number; y: number; w?: number; sw?: number }) => (
  <path d={`M${cx - w} ${y}q${w} ${w * 0.85} ${w * 2} 0`} fill="none" stroke={INK} strokeWidth={sw} strokeLinecap="round" />
);
const Cheeks = ({ x1, x2, y, r = 2.3 }: { x1: number; x2: number; y: number; r?: number }) => (
  <g fill="#FF6F91" opacity={0.42}><circle cx={x1} cy={y} r={r} /><circle cx={x2} cy={y} r={r} /></g>
);
/** Polígono con puntas redondeadas (orejas, crestas): mismo color de relleno y de trazo. */
const Soft = ({ d, fill, w = 2.4 }: { d: string; fill: string; w?: number }) => (
  <path d={d} fill={fill} stroke={fill} strokeWidth={w} strokeLinejoin="round" />
);
/** Espeja un path de coordenadas absolutas sobre el eje x = 24 (solo comandos M/L/Z con pares x,y). */
const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${+(48 - Number(x)).toFixed(2)} ${y}`);

/* ---------- el set: 16 personajes (APPEND-ONLY: el índice es lo que se guarda en identity.json) ----------
   `bare` y `over` son SOLO para la ropa (guardarropas, más abajo): sin accesorio puesto se dibuja `draw`, igual que siempre.
     · bare: el personaje sin su gorro propio, para los accesorios de cabeza que lo REEMPLAZAN (una corona no va arriba de
       una gorra ni de un gorro de lana).
     · over: piezas que se vuelven a pintar ARRIBA del accesorio (la antena del robot atraviesa la gorra, los cuernos del
       monstruo asoman, el pompón queda delante de la vincha de los auriculares). */
type Variant = {
  name: string;
  draw: (k: Kit) => ReactNode;
  bare?: { for: readonly WearId[]; draw: (k: Kit) => ReactNode };
  over?: { for: readonly WearId[]; draw: (k: Kit) => ReactNode };
};
const VARIANTS: Variant[] = [
  { name: 'Gato', draw: ({ c, d, l }) => {
    const ear = 'M10 23 L12.2 7.6 L22 14.6 Z', inner = 'M13.4 17.4 L14.5 11.4 L18.9 14.6 Z';
    return <>
      <Soft d={ear} fill={c} /><Soft d={mirror(ear)} fill={c} />
      <Soft d={inner} fill={l} w={1.2} /><Soft d={mirror(inner)} fill={l} w={1.2} />
      <ellipse cx={24} cy={28} rx={15.6} ry={13.6} fill={c} />
      <path d="M7.6 30.6l7 .6M8.2 34.4l6.6-1.2M40.4 30.6l-7 .6M39.8 34.4l-6.6-1.2" stroke={d} strokeWidth={1.1} strokeLinecap="round" />
      <ellipse cx={24} cy={33.4} rx={6.4} ry={4.4} fill={l} />
      <Eyes x1={18.2} x2={29.8} y={26.2} r={2.3} />
      <Soft d="M22.3 30.4 H25.7 L24 32.4 Z" fill={NOSE} w={1.2} />
      <path d="M24 32.6v1.2m0 0q-1.5 1.5-3 .3m3-.3q1.5 1.5 3 .3" fill="none" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
    </>;
  } },
  { name: 'Oso', draw: ({ c, d, l }) => <>
    <circle cx={12.6} cy={14.6} r={6.3} fill={c} /><circle cx={35.4} cy={14.6} r={6.3} fill={c} />
    <circle cx={12.6} cy={14.6} r={3.2} fill={d} /><circle cx={35.4} cy={14.6} r={3.2} fill={d} />
    <circle cx={24} cy={28} r={15.2} fill={c} />
    <ellipse cx={24} cy={33.4} rx={7.6} ry={5.8} fill={l} />
    <Eyes x1={18} x2={30} y={25.4} r={2.2} />
    <ellipse cx={24} cy={30.8} rx={2.9} ry={2.1} fill={INK} />
    <path d="M24 32.6v1.5m-3 .6q1.5 1.4 3 0q1.5 1.4 3 0" fill="none" stroke={INK} strokeWidth={1.25} strokeLinecap="round" />
  </> },
  { name: 'Zorro', draw: ({ c, d }) => {
    const ear = 'M9 23.5 L11 5.6 L21.6 14.2 Z', inner = 'M12.2 17.6 L13 10.6 L17.6 14.3 Z';
    return <>
      <Soft d={ear} fill={c} /><Soft d={mirror(ear)} fill={c} />
      <Soft d={inner} fill={d} w={1.2} /><Soft d={mirror(inner)} fill={d} w={1.2} />
      <path d="M8.4 22.4C8.4 14.6 15 12.6 24 12.6S39.6 14.6 39.6 22.4C39.6 31.4 32.6 38.6 24 42.2C15.4 38.6 8.4 31.4 8.4 22.4Z" fill={c} />
      <path d="M8.6 24C14 24.4 19.4 28.6 24 34.8C28.6 28.6 34 24.4 39.4 24C38.6 32 32 38.6 24 42.2C16 38.6 9.4 32 8.6 24Z" fill={WHITE} />
      <Eyes x1={17.4} x2={30.6} y={24} r={2.2} />
      <ellipse cx={24} cy={36.2} rx={2.4} ry={1.8} fill={INK} />
    </>;
  } },
  { name: 'Conejo', draw: ({ c, l }) => <>
    <ellipse cx={17.6} cy={11.6} rx={4.5} ry={10.4} transform="rotate(-12 17.6 11.6)" fill={c} />
    <ellipse cx={30.4} cy={11.6} rx={4.5} ry={10.4} transform="rotate(12 30.4 11.6)" fill={c} />
    <ellipse cx={17.6} cy={12.6} rx={2.1} ry={7} transform="rotate(-12 17.6 12.6)" fill={l} />
    <ellipse cx={30.4} cy={12.6} rx={2.1} ry={7} transform="rotate(12 30.4 12.6)" fill={l} />
    <circle cx={24} cy={30.6} r={13.4} fill={c} />
    <Cheeks x1={16.4} x2={31.6} y={33.4} r={2.3} />
    <Eyes x1={18.8} x2={29.2} y={28.6} r={2.15} />
    <ellipse cx={24} cy={32.2} rx={1.9} ry={1.35} fill={NOSE} />
    <rect x={22.4} y={34.4} width={3.2} height={3.6} rx={0.9} fill={WHITE} stroke={INK} strokeWidth={0.9} />
    <path d="M24 34.6v3.2M20.6 33.9q1.7 1.3 3.4 0q1.7 1.3 3.4 0" fill="none" stroke={INK} strokeWidth={1.1} strokeLinecap="round" />
  </> },
  { name: 'Búho', draw: ({ c, d, l }) => <>
    <path d="M10.6 15.4L13.6 6.8L19.6 12.4C22.6 11.4 25.4 11.4 28.4 12.4L34.4 6.8L37.4 15.4C40.4 21.4 40.4 29.2 38.4 34.8C36 41.2 30.4 44.6 24 44.6S12 41.2 9.6 34.8C7.6 29.2 7.6 21.4 10.6 15.4Z"
      fill={c} stroke={c} strokeWidth={1.4} strokeLinejoin="round" />
    <ellipse cx={24} cy={40} rx={8.6} ry={6.6} fill={l} />
    <circle cx={18} cy={23.6} r={6.5} fill={WHITE} /><circle cx={30} cy={23.6} r={6.5} fill={WHITE} />
    <Eyes x1={18.6} x2={29.4} y={24} r={3.1} />
    <Soft d="M22.2 27.8 H25.8 L24 31.4 Z" fill={d} w={1.4} />
  </> },
  { name: 'Rana', draw: ({ c, d }) => <>
    <circle cx={15} cy={15.4} r={7.3} fill={c} /><circle cx={33} cy={15.4} r={7.3} fill={c} />
    <ellipse cx={24} cy={29.6} rx={18.6} ry={12.8} fill={c} />
    <circle cx={15} cy={14.8} r={4.7} fill={WHITE} /><circle cx={33} cy={14.8} r={4.7} fill={WHITE} />
    <Eyes x1={15.6} x2={32.4} y={15.4} r={2.5} />
    <circle cx={21.8} cy={26.2} r={0.95} fill={d} /><circle cx={26.2} cy={26.2} r={0.95} fill={d} />
    <Cheeks x1={11.6} x2={36.4} y={32.4} r={2.7} />
    <path d="M13 29.6Q24 39.6 35 29.6" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
  </> },
  { name: 'Panda', draw: ({ c, l }) => <>
    <circle cx={12.4} cy={14.4} r={6.2} fill={c} /><circle cx={35.6} cy={14.4} r={6.2} fill={c} />
    <circle cx={24} cy={28} r={15.4} fill={WHITE} stroke={l} strokeWidth={1.2} />
    <ellipse cx={17.4} cy={27} rx={4.5} ry={5.8} transform="rotate(32 17.4 27)" fill={c} />
    <ellipse cx={30.6} cy={27} rx={4.5} ry={5.8} transform="rotate(-32 30.6 27)" fill={c} />
    <circle cx={18} cy={26.4} r={1.9} fill={WHITE} /><circle cx={30} cy={26.4} r={1.9} fill={WHITE} />
    <circle cx={18.3} cy={26.6} r={1.05} fill={INK} /><circle cx={29.7} cy={26.6} r={1.05} fill={INK} />
    <Cheeks x1={14.6} x2={33.4} y={34.2} r={2.1} />
    <ellipse cx={24} cy={32.6} rx={2.7} ry={1.9} fill={INK} />
    <path d="M24 34.2v1.2m-2.6.4q1.3 1.2 2.6 0q1.3 1.2 2.6 0" fill="none" stroke={INK} strokeWidth={1.15} strokeLinecap="round" />
  </> },
  { name: 'León', draw: ({ c, d, l }) => <>
    <circle cx={24} cy={26.6} r={16.4} fill={c} />
    {Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return <circle key={i} cx={24 + Math.cos(a) * 15.2} cy={26.6 + Math.sin(a) * 15.2} r={5} fill={c} />;
    })}
    <circle cx={15.6} cy={17.6} r={3.3} fill={l} /><circle cx={32.4} cy={17.6} r={3.3} fill={l} />
    <circle cx={15.6} cy={17.6} r={1.6} fill={d} /><circle cx={32.4} cy={17.6} r={1.6} fill={d} />
    <circle cx={24} cy={27.6} r={11.2} fill={l} />
    <Eyes x1={19.8} x2={28.2} y={25.6} r={2} />
    <circle cx={22.1} cy={32.4} r={2.6} fill={WHITE} opacity={0.75} /><circle cx={25.9} cy={32.4} r={2.6} fill={WHITE} opacity={0.75} />
    <Soft d="M22 29.4 H26 L24 31.8 Z" fill={d} w={1.3} />
    <path d="M24 32v1.1m-2.3.5q1.15 1 2.3 0q1.15 1 2.3 0" fill="none" stroke={INK} strokeWidth={1.1} strokeLinecap="round" />
  </> },
  { name: 'Robot', draw: ({ c, d }) => <>
    <path d="M24 6.8V12.4" stroke={d} strokeWidth={2.2} strokeLinecap="round" />
    <circle cx={24} cy={6.2} r={2.9} fill={c} /><circle cx={23.1} cy={5.3} r={0.9} fill={WHITE} />
    <rect x={6.2} y={21.6} width={4.6} height={10.4} rx={2} fill={d} /><rect x={37.2} y={21.6} width={4.6} height={10.4} rx={2} fill={d} />
    <rect x={9.6} y={12} width={28.8} height={28.4} rx={7.4} fill={c} />
    <rect x={13.4} y={17.4} width={21.2} height={13.2} rx={4.6} fill={INK} />
    <circle cx={19.4} cy={24} r={2.6} fill="#7CF0DC" /><circle cx={28.6} cy={24} r={2.6} fill="#7CF0DC" />
    <rect x={18.2} y={33.4} width={11.6} height={3.4} rx={1.7} fill={d} />
    <path d="M22.1 33.6v3M25.9 33.6v3" stroke={c} strokeWidth={1} />
  </>,
    // la antena atraviesa la gorra (y queda delante de la vincha de los auriculares)
    over: { for: ['gorra', 'auriculares'], draw: ({ c, d }) => <>
      <path d="M24 6.8V12.4" stroke={d} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={24} cy={6.2} r={2.9} fill={c} /><circle cx={23.1} cy={5.3} r={0.9} fill={WHITE} />
    </> } },
  { name: 'Marciano', draw: ({ c, d }) => <>
    <path d="M18.6 14.4Q15.6 10 13.8 6.6M29.4 14.4Q32.4 10 34.2 6.6" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" />
    <circle cx={13.4} cy={6.2} r={2.9} fill={d} /><circle cx={34.6} cy={6.2} r={2.9} fill={d} />
    <path d="M24 11C34.6 11 40.2 18.6 39.6 26.6C39 35.6 31.6 42.6 24 42.6S9 35.6 8.4 26.6C7.8 18.6 13.4 11 24 11Z" fill={c} />
    <ellipse cx={17} cy={26} rx={4.4} ry={6} transform="rotate(-28 17 26)" fill={INK} />
    <ellipse cx={31} cy={26} rx={4.4} ry={6} transform="rotate(28 31 26)" fill={INK} />
    <circle cx={16.4} cy={23.8} r={1.4} fill={WHITE} /><circle cx={30} cy={23.8} r={1.4} fill={WHITE} />
    <Smile cx={24} y={35.2} w={2.6} />
  </>,
    // las antenas salen por arriba de la gorra y de la vincha de los auriculares
    over: { for: ['gorra', 'auriculares'], draw: ({ c, d }) => <>
      <path d="M18.6 14.4Q15.6 10 13.8 6.6M29.4 14.4Q32.4 10 34.2 6.6" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={13.4} cy={6.2} r={2.9} fill={d} /><circle cx={34.6} cy={6.2} r={2.9} fill={d} />
    </> } },
  { name: 'Monstruo', draw: ({ c, d }) => <>
    <Soft d="M14.2 15.6 Q11.6 10.4 14 5.6 Q16.4 10.6 19.6 12.8 Z" fill={d} w={1.4} />
    <Soft d="M33.8 15.6 Q36.4 10.4 34 5.6 Q31.6 10.6 28.4 12.8 Z" fill={d} w={1.4} />
    <rect x={8} y={11.6} width={32} height={42} rx={15} fill={c} />
    <circle cx={12.4} cy={31.6} r={1.5} fill={d} /><circle cx={36} cy={34.4} r={1.9} fill={d} /><circle cx={33.6} cy={16.8} r={1.2} fill={d} />
    <circle cx={24} cy={23.6} r={7.8} fill={WHITE} />
    <circle cx={24.6} cy={24.2} r={3.8} fill={INK} /><circle cx={26} cy={22.6} r={1.3} fill={WHITE} />
    <path d="M16.6 32.4Q24 41.4 31.4 32.4Z" fill={INK} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
    <path d="M20.4 33.2h3.2v2.2q-1.6 1-3.2 0Z" fill={WHITE} />
  </>,
    // los cuernos asoman por la gorra y quedan delante de la vincha de los auriculares
    over: { for: ['gorra', 'auriculares'], draw: ({ d }) => <>
      <Soft d="M14.2 15.6 Q11.6 10.4 14 5.6 Q16.4 10.6 19.6 12.8 Z" fill={d} w={1.4} />
      <Soft d="M33.8 15.6 Q36.4 10.4 34 5.6 Q31.6 10.6 28.4 12.8 Z" fill={d} w={1.4} />
    </> } },
  // De perfil (como 🦖): la única cabeza de costado del set, se reconoce hasta en 26 px.
  { name: 'Dino', draw: ({ c, d, l }) => <>
    <Soft d="M17.4 14.6 L18.6 8 L23 12.2 Z M12.4 20 L10 13.8 L16 15.6 Z M9.2 27.2 L5.4 22.4 L11.6 22.2 Z M7.8 35 L3.6 31.4 L9.6 30 Z" fill={d} w={1.8} />
    <path d="M7.6 48C7.6 38 9.6 28.4 14.6 21.4C18.6 15.6 25.4 11.6 32.6 11.8C39.6 12 44.4 16.4 44.4 22.2C44.4 27.8 40.4 31.2 34.2 31.6C30.4 31.8 27.8 33.6 27.2 37.4L26.4 48Z" fill={c} />
    <path d="M27.2 37.4C27.8 33.6 30.4 31.8 34.2 31.6L33.4 33.8C30.6 34.2 29.6 36.2 29.4 39.4L29 48H26.4Z" fill={l} />
    <circle cx={34.6} cy={25.6} r={2.3} fill="#FF6F91" opacity={0.42} />
    <circle cx={31.4} cy={19.6} r={2.5} fill={INK} /><circle cx={32.2} cy={18.7} r={0.85} fill={WHITE} />
    <circle cx={41} cy={18.4} r={1} fill={d} />
    <path d="M43 25.2Q37.4 28.8 31.6 26.6" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
  </> },
  { name: 'Astronauta', draw: ({ c, d, l }) => <>
    <rect x={4.4} y={21.6} width={4.8} height={10} rx={2.2} fill={d} /><rect x={38.8} y={21.6} width={4.8} height={10} rx={2.2} fill={d} />
    <circle cx={24} cy={26.6} r={17.6} fill={c} />
    <circle cx={24} cy={27.4} r={13.6} fill={l} />
    <circle cx={24} cy={27.4} r={12.4} fill={SKIN.medium} />
    <path d="M11.8 26C12.4 18.4 17.4 15 24 15S35.6 18.4 36.2 26C33.4 22.4 29.6 20.8 24 21.8C18.4 20.8 14.6 22.4 11.8 26Z" fill={HAIR.brown} />
    <Cheeks x1={16.6} x2={31.4} y={32.2} r={2.1} />
    <Eyes x1={19.4} x2={28.6} y={28.4} r={2} />
    <Smile cx={24} y={33} w={2.5} sw={1.5} />
    <path d="M14.6 21.4A11.6 11.6 0 0 1 21 16.2" fill="none" stroke={WHITE} strokeWidth={1.8} strokeLinecap="round" opacity={0.7} />
  </> },
  { name: 'Gorra', draw: ({ c, d }) => <>
    <circle cx={11.2} cy={30.6} r={2.8} fill={SKIN.tan} /><circle cx={36.8} cy={30.6} r={2.8} fill={SKIN.tan} />
    <circle cx={24} cy={29.8} r={12.9} fill={SKIN.tan} />
    <path d="M11.2 27.6C11.2 22.4 14 19 18 18L30 18C34 19 36.8 22.4 36.8 27.6C34 24.6 30 23.4 24 23.4S14 24.6 11.2 27.6Z" fill={HAIR.dark} />
    <path d="M10.4 23.8C10.4 13.2 16 8.6 24 8.6S37.6 13.2 37.6 23.8Z" fill={c} />
    <path d="M24 8.9V23.6" stroke={d} strokeWidth={1} opacity={0.55} />
    <circle cx={24} cy={9.2} r={1.7} fill={d} />
    <path d="M30.4 21.2C36.2 19.6 42.6 20 44.4 22.6C42.4 24.8 36.4 25.2 30.4 24.2Z" fill={d} stroke={d} strokeWidth={1} strokeLinejoin="round" />
    <path d="M10 23.4H38" stroke={d} strokeWidth={1.6} strokeLinecap="round" />
    <Cheeks x1={16.4} x2={31.6} y={33.4} r={2.1} />
    <Eyes x1={19.2} x2={28.8} y={29.8} r={2.1} />
    <Smile cx={24} y={34.4} w={2.6} sw={1.5} />
  </>,
    // sin su gorra (la corona y la vincha la reemplazan): pelo oscuro con raya al costado
    bare: { for: ['corona', 'vincha'], draw: () => <>
      <circle cx={11.2} cy={30.6} r={2.8} fill={SKIN.tan} /><circle cx={36.8} cy={30.6} r={2.8} fill={SKIN.tan} />
      <circle cx={24} cy={29.8} r={12.9} fill={SKIN.tan} />
      <path d="M11 28.8C10.4 20.2 15.8 15.6 24 15.6S37.6 20.2 37 28.8C35.6 25.2 33.2 23.2 29.6 22.4C27 24.4 21.4 24.8 17.6 23.4C14.6 24.2 12.4 26.2 11 28.8Z" fill={HAIR.dark} />
      <Cheeks x1={16.4} x2={31.6} y={33.4} r={2.1} />
      <Eyes x1={19.2} x2={28.8} y={29.8} r={2.1} />
      <Smile cx={24} y={34.4} w={2.6} sw={1.5} />
    </> } },
  { name: 'Rulos', draw: ({ c }) => <>
    {[[12.4, 24.6, 6.4], [13.4, 15.8, 6.8], [20, 10.8, 6.8], [28, 10.8, 6.8], [34.6, 15.8, 6.8], [35.6, 24.6, 6.4], [24, 20, 13]].map(([x, y, r], i) =>
      <circle key={i} cx={x} cy={y} r={r} fill={c} />)}
    <circle cx={24} cy={29.2} r={12.3} fill={SKIN.light} />
    {[[16.6, 19.6, 4.4], [22.6, 17.6, 4.6], [28.8, 18.2, 4.4], [33.2, 21.4, 3.4]].map(([x, y, r], i) =>
      <circle key={i} cx={x} cy={y} r={r} fill={c} />)}
    <Cheeks x1={15.2} x2={32.8} y={34.4} r={1.8} />
    <circle cx={19} cy={29.6} r={4.4} fill={WHITE} fillOpacity={0.35} stroke={INK} strokeWidth={1.5} />
    <circle cx={29} cy={29.6} r={4.4} fill={WHITE} fillOpacity={0.35} stroke={INK} strokeWidth={1.5} />
    <path d="M23.4 29.2q.6-.8 1.2 0" fill="none" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
    <Eyes x1={19} x2={29} y={29.8} r={1.6} />
    <Smile cx={24} y={35.6} w={2.4} sw={1.5} />
  </> },
  { name: 'Gorro de lana', draw: ({ c, d, l }) => <>
    <circle cx={11.6} cy={31} r={2.7} fill={SKIN.deep} /><circle cx={36.4} cy={31} r={2.7} fill={SKIN.deep} />
    <circle cx={24} cy={30.2} r={12.6} fill={SKIN.deep} />
    <path d="M10.8 25C10.8 14 16.5 9.6 24 9.6S37.2 14 37.2 25Z" fill={c} />
    <rect x={9.8} y={20.6} width={28.4} height={7} rx={3.5} fill={d} />
    <path d="M14 21.6v5M18 21.6v5M22 21.6v5M26 21.6v5M30 21.6v5M34 21.6v5" stroke={c} strokeWidth={1.1} opacity={0.45} />
    <circle cx={24} cy={8.4} r={4.5} fill={l} />
    <Cheeks x1={16.6} x2={31.4} y={35} r={2.1} />
    <Eyes x1={19.2} x2={28.8} y={31.4} r={2.15} />
    <Smile cx={24} y={35.8} w={2.6} sw={1.5} />
  </>,
    // sin su gorro de lana (la gorra, la corona y la vincha lo reemplazan): pelo corto con rulitos
    bare: { for: ['gorra', 'corona', 'vincha'], draw: () => <>
      <circle cx={11.6} cy={31} r={2.7} fill={SKIN.deep} /><circle cx={36.4} cy={31} r={2.7} fill={SKIN.deep} />
      <circle cx={24} cy={30.2} r={12.6} fill={SKIN.deep} />
      <path d="M11.4 27.6C11 20.6 16.4 16.8 24 16.8S37 20.6 36.6 27.6C34 24.6 29.8 23.6 24 23.6S14 24.6 11.4 27.6Z" fill={HAIR.dark} />
      {[[13.6, 23.2, 3.4], [16.4, 19.6, 3.8], [21, 17.4, 4], [27, 17.4, 4], [31.6, 19.6, 3.8], [34.4, 23.2, 3.4]].map(([x, y, r], i) =>
        <circle key={i} cx={x} cy={y} r={r} fill={HAIR.dark} />)}
      <Cheeks x1={16.6} x2={31.4} y={35} r={2.1} />
      <Eyes x1={19.2} x2={28.8} y={31.4} r={2.15} />
      <Smile cx={24} y={35.8} w={2.6} sw={1.5} />
    </> },
    // con auriculares el pompón queda delante de la vincha
    over: { for: ['auriculares'], draw: ({ l }) => <circle cx={24} cy={8.4} r={4.5} fill={l} /> } },
];
export const AVATAR_VARIANT_COUNT = VARIANTS.length;
/** Nombre de cada personaje (para el selector y los títulos). */
export const avatarVariantName = (v: number) => VARIANTS[v]?.name ?? 'Personaje';

/* ---------- el 80/20 del demo: el look de los DEMÁS usuarios se deriva de su nick ----------
   hash estable (FNV-1a + mezcla final de murmur3) → ~20% iniciales (el default típico), ~80% un personaje en un
   color. MISMO nick = MISMO look en todas las pantallas. La sal se eligió para que el demo muestre la mezcla real
   con los pocos usuarios visibles (amigos: 6 dibujados + 1 con iniciales; liga: 9 + 2, separados).
   ESPEJO en server/src/identity.ts (el look por defecto de Ian sale del mismo hash). */
const SALT = 'idav7891201:';
export function avatarHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
/** El look de otro usuario (NO de Ian: el suyo lo elige él y vive en el server). */
export function lookFor(nick: string): AvatarLook {
  const h = avatarHash(SALT + nick.normalize('NFC'));
  if (h % 10 < 2) return null;
  return { variant: (h >>> 8) % AVATAR_VARIANT_COUNT, color: AVATAR_COLORS[(h >>> 16) % AVATAR_COLORS.length] };
}

/* ==================== GUARDARROPAS: la ropa del avatar (visión §7 capa 6 + §9; audios 26, 29, 41-42) ====================
   "Tu prestigio se nota": 6 accesorios DIBUJADOS acá (SVG propio, sin assets externos, igual que los personajes) que se
   ponen ARRIBA de cualquiera de los 16 personajes —y también sobre las iniciales de un amigo que recibió un regalo—.
   Cada personaje tiene su propio calce (FITS): las cabezas son distintas (la rana tiene los ojos arriba, el dino está de
   perfil, el robot es un rectángulo con antena) y nada puede quedar flotando ni tapar los ojos (salvo los anteojos).
   El id es lo que viaja y se guarda (AvatarLook.accessory, Friend.accessory, MarketItem.accessoryId): APPEND-ONLY.
   ESPEJO en el server: server/src/identity.ts valida el id contra este set y server/src/market.ts vende cada uno al
   precio de acá (si cambiás un precio o sumás una prenda, tocá los tres). */
export type Accessory = {
  id: string;
  /** Como se lee en la Tienda y en "Tu avatar" */ name: string;
  /** Precio sugerido en ⚡ (el que cobra es el server: market.ts lo espeja) */ price: number;
  emoji: string;
  /** Género y número, para los textos ("ponérsela", "los anteojos de sol") */ fem: boolean; plural: boolean;
};
export const ACCESSORIES: readonly Accessory[] = [
  { id: 'gorra', name: 'Gorra', price: 80, emoji: '🧢', fem: true, plural: false },
  { id: 'vincha', name: 'Vincha deportiva', price: 90, emoji: '🎽', fem: true, plural: false },
  { id: 'lazo', name: 'Moño', price: 120, emoji: '🎀', fem: false, plural: false },
  { id: 'anteojos', name: 'Anteojos de sol', price: 150, emoji: '🕶️', fem: false, plural: true },
  { id: 'auriculares', name: 'Auriculares', price: 220, emoji: '🎧', fem: false, plural: true },
  { id: 'corona', name: 'Corona', price: 300, emoji: '👑', fem: true, plural: false },
];
type WearId = 'gorra' | 'vincha' | 'lazo' | 'anteojos' | 'auriculares' | 'corona';
const isWearId = (id: string): id is WearId => ACCESSORIES.some((a) => a.id === id);
/** El accesorio del set con ese id (undefined = no es del set: no se dibuja nada). */
export const accessoryById = (id: string | null | undefined): Accessory | undefined => (id ? ACCESSORIES.find((a) => a.id === id) : undefined);
/** "la gorra", "el moño", "los anteojos de sol" (minúscula, para meter en una frase). */
export const accessoryArticle = (a: Accessory) => `${a.plural ? (a.fem ? 'las' : 'los') : a.fem ? 'la' : 'el'} ${a.name.toLowerCase()}`;
/** Botón para equiparla: "Ponérsela" / "Ponérselo" / "Ponérselos". */
export const putOnLabel = (a: Accessory) => `Ponérsel${a.fem ? 'a' : 'o'}${a.plural ? 's' : ''}`;
/** Estado equipado: "Puesta" / "Puesto" / "Puestos". */
export const wornLabel = (a: Accessory) => `Puest${a.fem ? 'a' : 'o'}${a.plural ? 's' : ''}`;
/** Ya está en el guardarropas: "Es tuya" / "Es tuyo" / "Son tuyos". */
export const yoursLabel = (a: Accessory) => (a.plural ? `Son tuy${a.fem ? 'as' : 'os'}` : `Es tuy${a.fem ? 'a' : 'o'}`);

/* ---------- colores de la ropa: fijos (la prenda es la misma en todos) y con un contorno fino de tinta para que se lea
   sobre cualquier personaje (son 8 colores de cuerpo + 4 tonos de piel) ---------- */
const RED = '#E8394A', RED_D = '#B21E30';
// oro claro: se separa por luminosidad de los personajes ámbar (#F2A81D), que son del mismo tono
const GOLD = '#FFE066', GOLD_D = '#F0B21A', SKY = '#3CC5F2';
const LENS = '#252B49';
const PHONE = '#2B3253', PHONE_L = '#5A6390', PHONE_DOT = '#FF6B6B';
const PINK = '#FF5BA7', PINK_D = '#D33A86';
const LINE = { stroke: INK, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/* ---------- piezas (coordenadas del viewBox 48 × 48; cada calce dice dónde y de qué tamaño) ---------- */
/** Gorra con visera al costado (la silueta de 🧢; la misma que el personaje "Gorra"). (x, y) = centro de la banda;
 *  w = ancho de la copa; h = alto de la copa; r = giro. */
type CapFit = { x: number; y: number; w: number; h?: number; r?: number };
function Cap({ x, y, w, h, r = 0 }: CapFit) {
  const a = w / 2, t = h ?? a * 0.9, ow = Math.min(1, 0.55 + a * 0.03);
  const visor = `M${0.45 * a} ${-0.1 * t}C${0.92 * a} ${-0.27 * t} ${1.36 * a} ${-0.24 * t} ${1.5 * a} ${-0.05 * t}C${1.36 * a} ${0.12 * t} ${0.92 * a} ${0.15 * t} ${0.45 * a} ${0.08 * t}Z`;
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <path d={`M${-a} 0.4C${-a} ${-0.7 * t} ${-0.56 * a} ${-t} 0 ${-t}S${a} ${-0.7 * t} ${a} 0.4Z`} fill={RED} {...LINE} strokeWidth={ow} />
      <path d={`M${-0.86 * a} ${-0.42 * t}Q0 ${-0.66 * t} ${0.86 * a} ${-0.42 * t}`} fill="none" stroke={WHITE} strokeWidth={Math.max(1, 0.16 * a)} opacity={0.9} />
      <circle cx={0} cy={-t + 0.2} r={Math.max(0.9, 0.12 * a)} fill={RED_D} />
      <path d={visor} fill={RED_D} {...LINE} strokeWidth={ow} />
      <path d={`M${-a - 0.2} 0.2H${a + 0.2}`} stroke={RED_D} strokeWidth={Math.max(1.2, 0.13 * a)} strokeLinecap="round" />
    </g>
  );
}

/** Corona de 3 puntas con piedras. (x, y) = centro de la base; w = ancho de la base. */
type CrownFit = { x: number; y: number; w: number; r?: number };
function Crown({ x, y, w, r = 0 }: CrownFit) {
  const a = w / 2, H = w * 0.66, ow = Math.min(0.95, 0.5 + w * 0.035);
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <path d={`M${-a} 0L${-1.12 * a} ${-0.82 * H}L${-0.5 * a} ${-0.44 * H}L0 ${-H}L${0.5 * a} ${-0.44 * H}L${1.12 * a} ${-0.82 * H}L${a} 0Z`} fill={GOLD} {...LINE} strokeWidth={ow} />
      <path d={`M${-a} 0L${-1.035 * a} ${-0.28 * H}H${1.035 * a}L${a} 0Z`} fill={GOLD_D} {...LINE} strokeWidth={ow} />
      {[-1.12 * a, 0, 1.12 * a].map((cx, i) => <circle key={i} cx={cx} cy={i === 1 ? -H : -0.82 * H} r={0.09 * w} fill={GOLD} {...LINE} strokeWidth={ow * 0.8} />)}
      <circle cx={0} cy={-0.14 * H} r={0.085 * w} fill={RED} />
      <circle cx={-0.6 * a} cy={-0.14 * H} r={0.06 * w} fill={SKY} /><circle cx={0.6 * a} cy={-0.14 * H} r={0.06 * w} fill={SKY} />
      <path d={`M${-0.62 * a} ${-0.5 * H}L${-0.3 * a} ${-0.66 * H}`} stroke={WHITE} strokeWidth={0.06 * w} strokeLinecap="round" opacity={0.75} />
    </g>
  );
}

/** Anteojos de sol. (x, y) = centro entre los ojos; d = media distancia entre los ojos; s = radio de cada vidrio.
 *  tilt = vidrios girados (los ojos rasgados del marciano); one = un solo vidrio (el monstruo de un ojo). */
type ShadesFit = { x: number; y: number; d: number; s: number; r?: number; tilt?: number; oval?: boolean; one?: boolean };
function Shades({ x, y, d, s, r = 0, tilt = 0, oval, one }: ShadesFit) {
  const ow = Math.min(1.05, 0.55 + s * 0.09);
  const lens = (cx: number, sign: number) => (
    <g key={cx} transform={`translate(${cx} 0) rotate(${tilt * sign})`}>
      {oval
        ? <ellipse cx={0} cy={0} rx={s * 0.82} ry={s * 1.1} fill={LENS} {...LINE} strokeWidth={ow} />
        : <path d={`M${-1.12 * s} ${-0.5 * s}Q${-1.14 * s} ${-0.86 * s} ${-0.78 * s} ${-0.86 * s}H${0.78 * s}Q${1.14 * s} ${-0.86 * s} ${1.12 * s} ${-0.5 * s}Q${1.04 * s} ${0.9 * s} 0 ${0.9 * s}Q${-1.04 * s} ${0.9 * s} ${-1.12 * s} ${-0.5 * s}Z`} fill={LENS} {...LINE} strokeWidth={ow} />}
      <path d={`M${-0.62 * s} ${-0.34 * s}Q${-0.4 * s} ${-0.62 * s} ${-0.02 * s} ${-0.62 * s}`} fill="none" stroke={WHITE} strokeWidth={Math.max(0.6, 0.17 * s)} strokeLinecap="round" opacity={0.8} />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      {one ? lens(0, 0) : <>
        <path d={`M${-d + 0.9 * s} ${-0.42 * s}Q0 ${-0.95 * s} ${d - 0.9 * s} ${-0.42 * s}`} fill="none" stroke={INK} strokeWidth={Math.max(1, 0.24 * s)} strokeLinecap="round" />
        {lens(-d, -1)}{lens(d, 1)}
      </>}
    </g>
  );
}

/** Auriculares: vincha por arriba de la cabeza y dos parlantes a los costados. (x, top) = punto más alto de la vincha;
 *  y = altura de los parlantes; d = media distancia entre parlantes; s = escala; k = qué tan cuadrada va la vincha
 *  (chico = más redonda); side = cuánto se abre la vincha antes de subir (para esquivar ojos/orejas grandes). */
type PhonesFit = { x: number; top: number; y: number; d: number; s?: number; k?: number; side?: number };
function Phones({ x, top, y, d, s = 1, k = 0.56, side = 0 }: PhonesFit) {
  const cw = 3.9 * s, ch = 6.4 * s, y0 = y - ch * 0.36;
  const band = `M${x - d} ${y0}C${x - d - side} ${top + (y0 - top) * 0.2} ${x - d * k} ${top} ${x} ${top}S${x + d + side} ${top + (y0 - top) * 0.2} ${x + d} ${y0}`;
  return (
    <g>
      <path d={band} fill="none" stroke={INK} strokeWidth={2.9 * s} strokeLinecap="round" />
      <path d={band} fill="none" stroke={PHONE} strokeWidth={1.9 * s} strokeLinecap="round" />
      <path d={band} fill="none" stroke={PHONE_L} strokeWidth={0.5 * s} strokeLinecap="round" transform={`translate(0 ${-0.35 * s})`} opacity={0.9} />
      {[-1, 1].map((sg) => (
        <g key={sg}>
          <rect x={x + sg * d - cw / 2} y={y - ch / 2} width={cw} height={ch} rx={cw * 0.46} fill={PHONE} {...LINE} strokeWidth={0.7 * s} />
          <circle cx={x + sg * d} cy={y} r={0.95 * s} fill={PHONE_DOT} />
        </g>
      ))}
    </g>
  );
}

/** Vincha deportiva (de toalla, blanca con raya roja) que abraza la cabeza. Dos formas de calzarla:
 *  · head: la franja de la cabeza —un óvalo (cx, cy, rx, ry)— entre y1 e y2, con una leve curva (sag) que le da volumen:
 *    los costados SON el borde de la cabeza (nunca sobresale ni queda corta).
 *  · path: la forma exacta (cabezas que no son óvalos: el robot, el dino de perfil) + el trazo de la raya y su grosor. */
type BandFit =
  | { y1: number; y2: number; head: [cx: number, cy: number, rx: number, ry: number]; sag?: number }
  | { path: string; stripe: string; t: number };
function Band(fit: BandFit) {
  let d: string, stripe: string, t: number;
  if ('path' in fit) ({ path: d, stripe, t } = fit);
  else {
    const { y1, y2, head: [cx, cy, rx, ry], sag = 1 } = fit;
    const xAt = (y: number) => rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
    const a1 = xAt(y1), a2 = xAt(y2), ym = (y1 + y2) / 2, am = xAt(ym) - 0.3;
    d = `M${cx - a1} ${y1}Q${cx} ${y1 + 2 * sag} ${cx + a1} ${y1}A${rx} ${ry} 0 0 1 ${cx + a2} ${y2}Q${cx} ${y2 + 2 * sag} ${cx - a2} ${y2}A${rx} ${ry} 0 0 1 ${cx - a1} ${y1}Z`;
    stripe = `M${cx - am} ${ym}Q${cx} ${ym + 2 * sag} ${cx + am} ${ym}`;
    t = y2 - y1;
  }
  return (
    <g>
      <path d={d} fill={WHITE} {...LINE} strokeWidth={0.8} />
      <path d={stripe} fill="none" stroke={RED} strokeWidth={t * 0.36} />
    </g>
  );
}

/** Moño (de pelo, con lunares). (x, y) = el nudo; s = escala (1 = 16 de ancho); r = giro. */
type BowFit = { x: number; y: number; s?: number; r?: number };
function Bow({ x, y, s = 1, r = 0 }: BowFit) {
  const loop = 'M-1.2 -0.4C-2.8 -5.2 -7.6 -5.6 -7.4 -1.4C-7.2 2.8 -3 3.2 -1.2 0.9Z';
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s * 1.08})`}>
      <path d={loop} fill={PINK} {...LINE} strokeWidth={0.85} />
      <path d={mirror0(loop)} fill={PINK} {...LINE} strokeWidth={0.85} />
      <g fill={WHITE} opacity={0.95}>
        <circle cx={-4.8} cy={-2.1} r={0.85} /><circle cx={-3.4} cy={0.9} r={0.65} />
        <circle cx={4.8} cy={-2.1} r={0.85} /><circle cx={3.4} cy={0.9} r={0.65} />
      </g>
      <rect x={-1.7} y={-2.2} width={3.4} height={4.2} rx={1.5} fill={PINK_D} {...LINE} strokeWidth={0.85} />
    </g>
  );
}
/** Espeja un path relativo al origen sobre el eje x = 0 (solo comandos con pares x,y absolutos). */
const mirror0 = (d: string) => d.replace(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${+(-Number(x)).toFixed(2)} ${y}`);

/* ---------- de perfil (el Dino mira a la derecha): anteojos y auriculares vistos de costado (su vincha de costado es
   un `path` en su calce; gorra, corona y moño le calzan con giro) ---------- */
function ShadesSide() {
  return (
    <g>
      <path d="M29 18.6L22.6 17.4" stroke={INK} strokeWidth={1.3} strokeLinecap="round" />
      <path d="M35.2 18.4Q37.6 17.6 39.8 18.6" fill="none" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
      <path d="M28.6 17.4Q28.4 15.9 30 15.9H34.6Q36.2 15.9 36 17.6Q35.6 22.6 32.2 22.6Q28.9 22.6 28.6 17.4Z" fill={LENS} {...LINE} strokeWidth={0.9} />
      <path d="M40 18.2Q41.4 18.2 41.2 19.6Q40.9 21.8 39.8 21.8Z" fill={LENS} {...LINE} strokeWidth={0.8} />
      <path d="M30.2 17.6Q30.8 16.9 32.2 16.9" fill="none" stroke={WHITE} strokeWidth={0.7} strokeLinecap="round" opacity={0.8} />
    </g>
  );
}
/** De costado la vincha de los auriculares sube del parlante, pasa por arriba de la coronilla y baja del otro lado: el
 *  arco nace en el parlante y vuelve a apoyarse en la cabeza (sobre el hocico), nunca termina en el aire. El otro
 *  parlante queda del otro lado, tapado. */
function PhonesSide() {
  const band = 'M24.9 17.4C24.2 13.2 26.6 10.5 29.9 10.3C32.7 10.1 35 11 36.8 12.9';
  return (
    <g>
      <path d={band} fill="none" stroke={INK} strokeWidth={2.9} strokeLinecap="round" />
      <path d={band} fill="none" stroke={PHONE} strokeWidth={1.9} strokeLinecap="round" />
      <rect x={22.1} y={16.6} width={5.6} height={7.8} rx={2.6} fill={PHONE} {...LINE} strokeWidth={0.7} />
      <circle cx={24.9} cy={20.5} r={1.1} fill={PHONE_DOT} />
    </g>
  );
}

/* ---------- calces por personaje ---------- */
type Fit = { gorra: CapFit; corona: CrownFit; vincha: BandFit; anteojos: ShadesFit | 'side'; auriculares: PhonesFit | 'side'; lazo: BowFit };
/** Las iniciales: el círculo entero es la cabeza (la letra va al medio, la ropa la rodea sin taparla). */
const FIT_INITIALS: Fit = {
  gorra: { x: 24, y: 14.2, w: 27 },
  corona: { x: 24, y: 12.6, w: 14 },
  vincha: { y1: 8.6, y2: 13, head: [24, 24, 24, 24], sag: 1.2 },
  anteojos: { x: 24, y: 10.4, d: 6.6, s: 3.6 },
  auriculares: { x: 24, top: 3.6, y: 24.5, d: 18.8 },
  lazo: { x: 33, y: 10.6, s: 0.85, r: 22 },
};
const FITS: Fit[] = [
  /* 0 Gato */ {
    gorra: { x: 24, y: 19.2, w: 25 }, corona: { x: 24, y: 17.4, w: 13 },
    vincha: { y1: 17.4, y2: 21.4, head: [24, 28, 15.6, 13.6] },
    anteojos: { x: 24, y: 26.2, d: 5.8, s: 3.8 }, auriculares: { x: 24, top: 12.4, y: 27.4, d: 15.4 },
    lazo: { x: 31.4, y: 16.2, s: 0.85, r: 18 },
  },
  /* 1 Oso */ {
    gorra: { x: 24, y: 18.4, w: 25 }, corona: { x: 24, y: 15.8, w: 13 },
    vincha: { y1: 16.8, y2: 20.8, head: [24, 28, 15.2, 15.2] },
    anteojos: { x: 24, y: 25.4, d: 6, s: 3.8 }, auriculares: { x: 24, top: 11, y: 27.4, d: 15 },
    lazo: { x: 32.6, y: 15.4, s: 0.85, r: 18 },
  },
  /* 2 Zorro */ {
    gorra: { x: 24, y: 17.8, w: 25 }, corona: { x: 24, y: 15.4, w: 13 },
    vincha: { y1: 15.6, y2: 19.6, head: [24, 23, 15.6, 10.6] },
    anteojos: { x: 24, y: 24, d: 6.6, s: 4 }, auriculares: { x: 24, top: 10.8, y: 24, d: 15.4 },
    lazo: { x: 32.6, y: 14.8, s: 0.85, r: 18 },
  },
  /* 3 Conejo */ {
    gorra: { x: 24, y: 22.4, w: 21 }, corona: { x: 24, y: 20, w: 12 },
    vincha: { y1: 20.4, y2: 24.4, head: [24, 30.6, 13.4, 13.4] },
    anteojos: { x: 24, y: 28.6, d: 5.2, s: 3.6 }, auriculares: { x: 24, top: 15.4, y: 30.4, d: 13.2 },
    lazo: { x: 30.2, y: 18, s: 0.8, r: 15 },
  },
  /* 4 Búho: la gorra angosta deja asomar los penachos; gorra y vincha terminan antes de lo blanco de los ojos (y 17.1) */ {
    gorra: { x: 24, y: 15.6, w: 19 }, corona: { x: 24, y: 14.4, w: 12 },
    vincha: { y1: 12.4, y2: 15.5, head: [24, 27, 16, 15.6], sag: 0.8 },
    anteojos: { x: 24, y: 23.6, d: 6.1, s: 5.8 }, auriculares: { x: 24, top: 9.6, y: 25.4, d: 15.6 },
    lazo: { x: 31.6, y: 12.6, s: 0.8, r: 20 },
  },
  /* 5 Rana: los ojos están ARRIBA de la cabeza → gorra y corona se apoyan sobre los ojos sin tocarlos (lo blanco
     arranca en y 10.1); la vincha la ciñe justo debajo (los ojos asoman por arriba, como en las ranas con vincha) */ {
    gorra: { x: 24, y: 8.8, w: 18, h: 7.4 }, corona: { x: 24, y: 10.4, w: 12 },
    vincha: { y1: 20.1, y2: 23.3, head: [24, 29.6, 18.6, 12.8], sag: 0.6 },
    anteojos: { x: 24, y: 14.9, d: 9, s: 5.2 }, auriculares: { x: 24, top: 4.6, y: 24.4, d: 18.2, k: 0.4, side: 1.2 },
    lazo: { x: 30, y: 8.4, s: 0.72, r: -8 },
  },
  /* 6 Panda */ {
    gorra: { x: 24, y: 18.2, w: 25 }, corona: { x: 24, y: 15.6, w: 13 },
    vincha: { y1: 16, y2: 20, head: [24, 28, 15.4, 15.4] },
    anteojos: { x: 24, y: 26.6, d: 6.3, s: 4.3 }, auriculares: { x: 24, top: 11, y: 28, d: 15.2 },
    lazo: { x: 32.8, y: 15.2, s: 0.85, r: 18 },
  },
  /* 7 León */ {
    gorra: { x: 24, y: 13.6, w: 22 }, corona: { x: 24, y: 12.6, w: 13 },
    vincha: { y1: 17.6, y2: 21.6, head: [24, 27.6, 11.2, 11.2] },
    anteojos: { x: 24, y: 25.6, d: 4.4, s: 3.4 }, auriculares: { x: 24, top: 5.2, y: 26.6, d: 16.6 },
    lazo: { x: 33, y: 11.4, s: 0.85, r: 20 },
  },
  /* 8 Robot */ {
    gorra: { x: 24, y: 15.6, w: 27 }, corona: { x: 30.6, y: 13.6, w: 12, r: 12 },
    // la cabeza es un rectángulo redondeado (esquinas de radio 7.4 con centro en 17|31, 19.4): la banda sigue las esquinas
    vincha: { path: 'M12.67 13.4H35.33A7.4 7.4 0 0 1 38 17H10A7.4 7.4 0 0 1 12.67 13.4Z', stripe: 'M10.5 15.2H37.5', t: 3.6 },
    // sobre el visor oscuro los vidrios no se verían: el robot los lleva en la frente (los ojos de luz siguen a la vista)
    anteojos: { x: 24, y: 15.2, d: 5.2, s: 2.8 }, auriculares: { x: 24, top: 9.6, y: 26.8, d: 15.6, s: 1.1 },
    lazo: { x: 24, y: 10.4, s: 0.78 },
  },
  /* 9 Marciano */ {
    gorra: { x: 24, y: 17.6, w: 24 }, corona: { x: 24, y: 13.4, w: 10 },
    vincha: { y1: 15.2, y2: 18.8, head: [24, 26.6, 15.8, 15.6] },
    anteojos: { x: 24, y: 26, d: 7, s: 5.6, tilt: 28, oval: true }, auriculares: { x: 24, top: 9.4, y: 27, d: 15.4 },
    lazo: { x: 31.8, y: 10.2, s: 0.7, r: 35 },
  },
  /* 10 Monstruo */ {
    gorra: { x: 24, y: 14.6, w: 20 }, corona: { x: 24, y: 13.4, w: 9 },
    // el ojo único arranca en y 15.8: la vincha (con su curva) termina antes
    vincha: { y1: 11.9, y2: 14.6, head: [24, 26.6, 16, 15], sag: 0.6 },
    anteojos: { x: 24, y: 23.6, d: 0, s: 7.4, one: true }, auriculares: { x: 24, top: 9.6, y: 27, d: 16 },
    lazo: { x: 31.4, y: 11, s: 0.7, r: 22 },
  },
  /* 11 Dino (de perfil, mira a la derecha) */ {
    gorra: { x: 33, y: 15.4, w: 17, r: -6 }, corona: { x: 32.4, y: 12.6, w: 11, r: -6 },
    // de costado: la banda cruza la cabeza de la nuca (en diagonal, sobre el cuello) a la frente (curva del hocico)
    vincha: { path: 'M21.1 16.7L25.6 13.4C30 12.4 35.6 12.4 40.2 13.4Q42 14.6 42.9 16.9C36.6 16.4 29.4 16.4 21.1 16.7Z', stripe: 'M23.6 15Q32 14 41.6 15.1', t: 3.4 },
    anteojos: 'side', auriculares: 'side',
    lazo: { x: 26.8, y: 12.6, s: 0.8, r: -20 },
  },
  /* 12 Astronauta */ {
    gorra: { x: 24, y: 13, w: 22 }, corona: { x: 24, y: 10.6, w: 12 },
    vincha: { y1: 21.8, y2: 25.2, head: [24, 27.4, 12.4, 12.4] },
    anteojos: { x: 24, y: 28.4, d: 4.6, s: 3.5 }, auriculares: { x: 24, top: 7.6, y: 26.6, d: 17.2, s: 1.1 },
    lazo: { x: 33.6, y: 11.6, s: 0.8, r: 25 },
  },
  /* 13 Gorra: la gorra nueva TAPA la suya (misma copa); corona y vincha van sin gorra (bare) */ {
    gorra: { x: 24, y: 23.4, w: 27.6, h: 15.6 }, corona: { x: 24, y: 17.4, w: 13 },
    vincha: { y1: 19.2, y2: 23, head: [24, 29.8, 12.9, 12.9] },
    anteojos: { x: 24, y: 29.8, d: 4.8, s: 3.6 }, auriculares: { x: 24, top: 7, y: 30, d: 13.6 },
    lazo: { x: 14.6, y: 15.6, s: 0.8, r: -22 },
  },
  /* 14 Rulos */ {
    gorra: { x: 24, y: 14.6, w: 25 }, corona: { x: 24, y: 10.4, w: 12 },
    vincha: { y1: 19.6, y2: 23.4, head: [24, 22, 16.8, 18] },
    anteojos: { x: 24, y: 29.6, d: 5, s: 5 }, auriculares: { x: 24, top: 3.6, y: 26, d: 17.6 },
    lazo: { x: 33.4, y: 11.8, s: 0.85, r: 20 },
  },
  /* 15 Gorro de lana: gorra, corona y vincha van sin el gorro (bare) */ {
    gorra: { x: 24, y: 21.4, w: 24 }, corona: { x: 24, y: 18.2, w: 13 },
    vincha: { y1: 19.8, y2: 23.6, head: [24, 30.2, 12.6, 12.6] },
    anteojos: { x: 24, y: 31.4, d: 4.8, s: 3.6 }, auriculares: { x: 24, top: 7.2, y: 31, d: 13.4 },
    lazo: { x: 14.4, y: 16.4, s: 0.8, r: -22 },
  },
];

/** Dibuja un accesorio con el calce de ese personaje (o el de las iniciales). */
function Wear({ id, fit }: { id: WearId; fit: Fit }) {
  switch (id) {
    case 'gorra': return <Cap {...fit.gorra} />;
    case 'corona': return <Crown {...fit.corona} />;
    case 'vincha': return <Band {...fit.vincha} />;
    case 'anteojos': return fit.anteojos === 'side' ? <ShadesSide /> : <Shades {...fit.anteojos} />;
    case 'auriculares': return fit.auriculares === 'side' ? <PhonesSide /> : <Phones {...fit.auriculares} />;
    case 'lazo': return <Bow {...fit.lazo} />;
  }
}

/* ---------- componente ---------- */
type Props = {
  /** Nick: da la inicial del default (y nada más: el avatar es decorativo, el nombre va al lado). */
  name: string;
  /** Color del círculo de iniciales (el default). */
  color: string;
  /** Personaje dibujado; null/ausente = iniciales. Si trae `accessory`, se lo pone (así viaja el de Ian). */
  look?: AvatarLook;
  /** Accesorio puesto, cuando NO viaja en el look (amigos: Friend.accessory). Manda sobre look.accessory; con iniciales
   *  también se dibuja (alrededor de la letra, sin taparla). Un id que no es del set no dibuja nada. */
  accessory?: string | null;
  /** Lado en px. Sin esto manda el CSS de la sección (.fdk-item .av3 {width…}). */
  size?: number;
  className?: string;
  style?: CSSProperties;
};

/** Avatar de un usuario: personaje dibujado (look) o la inicial sobre su color (el default típico), con la ropa del
 *  guardarropas encima si tiene una puesta. `<Avatar name color />` sigue siendo exactamente el de siempre. */
export function Avatar({ name, color, look, accessory, size, className, style }: Props) {
  const v = look ? VARIANTS[look.variant] : undefined;
  const accId = accessory !== undefined ? accessory : look?.accessory;
  const acc = accId && isWearId(accId) ? accId : undefined;
  const box: CSSProperties | undefined = size ? { width: size, height: size, fontSize: Math.round(size * 0.44) } : undefined;
  const cls = (base: string) => (className ? `${base} ${className}` : base);
  if (!look || !v) {
    if (!acc) return <span className={cls('av3')} style={{ background: color, ...box, ...style }}>{name[0]}</span>;
    return (
      <span className={cls('av3 idav-ini')} data-acc={acc} style={{ background: color, ...box, ...style }}>
        {name[0]}
        <svg className="idav-acc" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><Wear id={acc} fit={FIT_INITIALS} /></svg>
      </span>
    );
  }
  const k = kitFor(look.color);
  const bare = acc && v.bare?.for.includes(acc);
  return (
    <span className={cls('av3 idav')} data-variant={look.variant} data-acc={acc} style={{ background: k.bg, ...box, ...style }}>
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        {bare ? v.bare!.draw(k) : v.draw(k)}
        {acc && <Wear id={acc} fit={FITS[look.variant]} />}
        {acc && v.over?.for.includes(acc) && v.over.draw(k)}
      </svg>
    </span>
  );
}
