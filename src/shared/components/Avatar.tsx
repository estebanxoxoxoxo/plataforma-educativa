import type { CSSProperties, ReactNode } from 'react';
import type { AvatarLook } from '../../api/types';

/* Identidad (visión §9 y §13: el avatar es un ACTIVO del chico). Dos formas de verse:
     · `look` dibujado: un personaje de este set (variant) en un color de la paleta. SVG propio, sin assets
       externos (nada que moderar ni que bajar: funciona offline y no depende de ningún proveedor).
     · `look` null/ausente: el default típico, la inicial sobre un color (la .av3 de siempre).
   El tamaño lo dan las reglas de cada sección sobre .av3 (.fr .av3, .rk .av3…) o la prop `size`.
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

/* ---------- el set: 16 personajes (APPEND-ONLY: el índice es lo que se guarda en identity.json) ---------- */
type Variant = { name: string; draw: (k: Kit) => ReactNode };
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
  </> },
  { name: 'Marciano', draw: ({ c, d }) => <>
    <path d="M18.6 14.4Q15.6 10 13.8 6.6M29.4 14.4Q32.4 10 34.2 6.6" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" />
    <circle cx={13.4} cy={6.2} r={2.9} fill={d} /><circle cx={34.6} cy={6.2} r={2.9} fill={d} />
    <path d="M24 11C34.6 11 40.2 18.6 39.6 26.6C39 35.6 31.6 42.6 24 42.6S9 35.6 8.4 26.6C7.8 18.6 13.4 11 24 11Z" fill={c} />
    <ellipse cx={17} cy={26} rx={4.4} ry={6} transform="rotate(-28 17 26)" fill={INK} />
    <ellipse cx={31} cy={26} rx={4.4} ry={6} transform="rotate(28 31 26)" fill={INK} />
    <circle cx={16.4} cy={23.8} r={1.4} fill={WHITE} /><circle cx={30} cy={23.8} r={1.4} fill={WHITE} />
    <Smile cx={24} y={35.2} w={2.6} />
  </> },
  { name: 'Monstruo', draw: ({ c, d }) => <>
    <Soft d="M14.2 15.6 Q11.6 10.4 14 5.6 Q16.4 10.6 19.6 12.8 Z" fill={d} w={1.4} />
    <Soft d="M33.8 15.6 Q36.4 10.4 34 5.6 Q31.6 10.6 28.4 12.8 Z" fill={d} w={1.4} />
    <rect x={8} y={11.6} width={32} height={42} rx={15} fill={c} />
    <circle cx={12.4} cy={31.6} r={1.5} fill={d} /><circle cx={36} cy={34.4} r={1.9} fill={d} /><circle cx={33.6} cy={16.8} r={1.2} fill={d} />
    <circle cx={24} cy={23.6} r={7.8} fill={WHITE} />
    <circle cx={24.6} cy={24.2} r={3.8} fill={INK} /><circle cx={26} cy={22.6} r={1.3} fill={WHITE} />
    <path d="M16.6 32.4Q24 41.4 31.4 32.4Z" fill={INK} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
    <path d="M20.4 33.2h3.2v2.2q-1.6 1-3.2 0Z" fill={WHITE} />
  </> },
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
  </> },
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
  </> },
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

/* ---------- componente ---------- */
type Props = {
  /** Nick: da la inicial del default (y nada más: el avatar es decorativo, el nombre va al lado). */
  name: string;
  /** Color del círculo de iniciales (el default). */
  color: string;
  /** Personaje dibujado; null/ausente = iniciales. */
  look?: AvatarLook;
  /** Lado en px. Sin esto manda el CSS de la sección (.fr .av3 {width…}). */
  size?: number;
  className?: string;
  style?: CSSProperties;
};

/** Avatar de un usuario: personaje dibujado (look) o la inicial sobre su color (el default típico).
 *  `<Avatar name color />` sigue siendo exactamente el de siempre. */
export function Avatar({ name, color, look, size, className, style }: Props) {
  const v = look ? VARIANTS[look.variant] : undefined;
  const box: CSSProperties | undefined = size ? { width: size, height: size, fontSize: Math.round(size * 0.44) } : undefined;
  const cls = (base: string) => (className ? `${base} ${className}` : base);
  if (!look || !v) return <span className={cls('av3')} style={{ background: color, ...box, ...style }}>{name[0]}</span>;
  const k = kitFor(look.color);
  return (
    <span className={cls('av3 idav')} data-variant={look.variant} style={{ background: k.bg, ...box, ...style }}>
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">{v.draw(k)}</svg>
    </span>
  );
}
