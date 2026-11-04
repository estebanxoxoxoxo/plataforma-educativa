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
const SKIN = { light: '#F7D3B7', medium: '#E3AE84', tan: '#C68A5E', deep: '#8A5A3C' } as const;
const HAIR = { brown: '#4A3324', dark: '#2B1D16', sandy: '#B07A3E', auburn: '#7A3E22' } as const;

/** Mezcla lineal de dos colores #RRGGBB (t = cuánto del segundo). */
function mix(a: string, b: string, t: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t).toString(16).padStart(2, '0')).join('');
}
/** Colores de un personaje a partir de su color: cuerpo, sombra (hacia la tinta), luz y el fondo del círculo. */
type Kit = { c: string; d: string; l: string; bg: string };
const kitFor = (c: string): Kit => ({ c, d: mix(c, INK, 0.3), l: mix(c, WHITE, 0.55), bg: mix(c, WHITE, 0.8) });

/* ---------- piezas comunes (viewBox 48 × 48; el círculo lo recorta el CSS) ----------
   TEEN (4-nov): el set dejó el chibi de jardín. Ojos chicos y almendrados (no botones con brillo grande), cejas con una
   apenas levantada, media sonrisa de costado en vez de la «u», sin cachetes rosados; los humanos son un busto (cuello y
   hombros) con la cara más larga. Todo sigue leyéndose a 26-36 px: siluetas distintas, trazos de 1.1 o más. */
const Eyes = ({ x1, x2, y, r = 1.6, fill = INK }: { x1: number; x2: number; y: number; r?: number; fill?: string }) => (
  <>
    <ellipse cx={x1} cy={y} rx={r} ry={r * 1.14} fill={fill} /><ellipse cx={x2} cy={y} rx={r} ry={r * 1.14} fill={fill} />
    <circle cx={x1 + r * 0.38} cy={y - r * 0.42} r={r * 0.3} fill={WHITE} /><circle cx={x2 + r * 0.38} cy={y - r * 0.42} r={r * 0.3} fill={WHITE} />
  </>
);
/** Cejas: la izquierda pareja, la derecha un poco más alta (la media actitud del set). */
const Brows = ({ x1, x2, y, w = 3.4, sw = 1.35, c = INK, lift = 0.7 }: { x1: number; x2: number; y: number; w?: number; sw?: number; c?: string; lift?: number }) => (
  <path d={`M${x1 - w / 2} ${y + 0.4}Q${x1} ${y - 0.6} ${x1 + w / 2} ${y}M${x2 - w / 2} ${y - lift}Q${x2} ${y - lift - 0.7} ${x2 + w / 2} ${y - lift + 0.5}`}
    fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" />
);
/** Media sonrisa de costado: sube del lado derecho. */
const Smirk = ({ cx, y, w = 2.6, sw = 1.35 }: { cx: number; y: number; w?: number; sw?: number }) => (
  <path d={`M${cx - w} ${y}Q${cx + 0.3} ${y + w * 0.55} ${cx + w} ${y - w * 0.35}`} fill="none" stroke={INK} strokeWidth={sw} strokeLinecap="round" />
);
/** Polígono con puntas redondeadas (orejas, crestas): mismo color de relleno y de trazo. */
const Soft = ({ d, fill, w = 2.4 }: { d: string; fill: string; w?: number }) => (
  <path d={d} fill={fill} stroke={fill} strokeWidth={w} strokeLinejoin="round" />
);
/** Espeja un path de coordenadas absolutas sobre el eje x = 24 (solo comandos con pares x,y absolutos). */
const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${+(48 - Number(x)).toFixed(2)} ${y}`);

/* ---------- los humanos: un busto común (cuello, hombros, orejas, cara) y la cara con su gesto ---------- */
const FACE = 'M24 12.4C31 12.4 35.6 17 35.6 24C35.6 31.4 30.6 37.6 24 37.6S12.4 31.4 12.4 24C12.4 17 17 12.4 24 12.4Z';
const SHIRT = 'M4.6 48C5.2 42.6 11 39.4 18.4 39C20 40.8 21.8 41.6 24 41.6S28 40.8 29.6 39C37 39.4 42.8 42.6 43.4 48Z';
const Bust = ({ skin, shirt, ears = true }: { skin: string; shirt: string; ears?: boolean }) => <>
  <path d="M20.4 31H27.6V42H20.4Z" fill={mix(skin, INK, 0.18)} />
  <path d={SHIRT} fill={shirt} />
  {ears && <><circle cx={12.7} cy={25.4} r={2.5} fill={skin} /><circle cx={35.3} cy={25.4} r={2.5} fill={skin} /></>}
  <path d={FACE} fill={skin} />
</>;
const Face = ({ skin, brow, eyes = true }: { skin: string; brow: string; eyes?: boolean }) => <>
  <Brows x1={19.6} x2={28.4} y={21.4} c={brow} />
  {eyes && <Eyes x1={19.6} x2={28.4} y={25} r={1.45} />}
  <path d="M24.5 26.6q.9 1.9-.7 2.5" fill="none" stroke={mix(skin, INK, 0.35)} strokeWidth={1.1} strokeLinecap="round" />
  <Smirk cx={24} y={31.8} w={2.5} />
</>;

/* ---------- el set: 16 personajes (APPEND-ONLY: el índice es lo que se guarda en identity.json) ----------
   TEEN (4-nov, dos pasadas): los índices de los animalitos tiernos se REUSARON con personajes de 13 (0 Gato → Casco de
   moto, 1 Oso → Mochilero, 3 Conejo → Lentes, 4 Búho → Pelo largo, 5 Rana → DJ, 6 Panda → Gamer, 7 León → Rapado,
   9 Marciano → Cuello alto, 10 Monstruo → Capucha, 11 Dino → Skater). El 2 es el Zorro (la mascota de la marca, ahora
   geométrico): ese índice NO se mueve. Quedan dos no-humanos (Zorro y Robot); el resto son bustos que se distinguen por
   la silueta de la cabeza (casco, capucha, gorra, gorro, rulos, pelo largo, jopo, rapado…).
   `bare` y `over` son SOLO para la ropa (guardarropas, más abajo): sin accesorio puesto se dibuja `draw`, igual que siempre.
     · bare: el personaje sin su prenda propia, para los accesorios que la REEMPLAZAN (una corona no va arriba de una gorra;
       los auriculares del Gamer no se duplican; la bandana no se pisa con los auriculares al cuello del DJ).
     · over: piezas que se vuelven a pintar ARRIBA del accesorio (la antena del robot atraviesa la gorra, los cuernos del
       casco del Robot asoma). */
type Variant = {
  name: string;
  draw: (k: Kit) => ReactNode;
  bare?: { for: readonly WearId[]; draw: (k: Kit) => ReactNode };
  over?: { for: readonly WearId[]; draw: (k: Kit) => ReactNode };
};

const RobotAntenna = ({ d }: { d: string }) => <>
  <path d="M24 6V11.8" stroke={d} strokeWidth={1.8} strokeLinecap="round" />
  <rect x={21.8} y={3.2} width={4.4} height={3} rx={0.8} fill="#7CF0DC" stroke={d} strokeWidth={0.9} />
</>;

/* pelos y prendas propias de los humanos (cada uno en su versión con y sin la prenda) */
const GamerHair = () => <Soft fill={HAIR.brown} w={1}
  d="M12.6 23C11.4 15.4 16 10.4 24 10.4S36.6 15.4 35.4 23C34.4 20 33 18.6 31.4 17.8L30.6 20.2L28.4 17.2L26.4 19.8L24.6 16.8L22.2 19.6L20.8 17L18.4 19.6L17.4 17.6C15.4 18.6 13.6 20.4 12.6 23Z" />;
const CapucHair = () => <path fill={HAIR.dark}
  d="M12.6 22C12.4 15.8 17 12.2 24 12.2S35.6 15.8 35.4 22C33.4 18.8 30.4 17.6 27.6 18.2C24.8 19.2 21.2 19.6 18.4 18.8C15.8 18.6 13.8 19.8 12.6 22Z" />;
const SkaterHair = () => <Soft fill={HAIR.sandy} w={1}
  d="M12 24.6C10.8 15.6 15.8 10.6 24 10.6S37.2 15.6 36 24.6L34.4 20.8L33 23L31.6 18.8C28.6 17.4 25 17.8 22 19.2C19.6 18 17.4 18 15.6 19.2L14.6 22.8L13.4 20.4Z" />;
const SideHair = ({ fill }: { fill: string }) => <path fill={fill}
  d="M12.4 23.6C11.8 15.4 16.6 10.8 24 10.8S36.2 15.4 35.6 23.6C34.6 20.2 32.6 18.2 29.6 17.4C26.4 19.4 20.8 19.8 16.8 18.4C14.8 19.4 13.2 21.2 12.4 23.6Z" />;
const MOCHI_HAIR = 'M12.2 24.4C10.6 16 15.6 10.6 24 10.6S37.4 16 35.8 24.4C35 21.4 33.6 19.8 31.6 19C30.4 20.6 28 21 26.4 19.6C24.6 21 21.6 21.2 20 19.4C18 20.8 15.4 20.6 14.8 19.2C13.6 20.4 12.6 22.2 12.2 24.4Z';
const QUIFF = 'M12.4 23.4C11.4 16 14.4 11.2 19.6 9.8C23 8.4 28.6 7.8 32.4 10.4C35.6 12.6 36.2 17.6 35.6 23.4C34.8 20.4 33.4 18.8 31.4 18.2C27 18.8 21 18.6 16.4 17.8C14.4 19 13 21 12.4 23.4Z';
const SWEPT = 'M12.6 22.6C12 15.4 16.6 11 24 11C30.6 11 35.6 14 36 19.4C33.6 17.6 30.6 17.2 27.6 17.8C23.6 18.8 19.6 20.6 15.8 20.4C14.4 21 13.2 21.6 12.6 22.6Z';
const ShortCurls = () => <>
  <path d="M12.6 25C12.2 18.6 16.8 14.6 24 14.6S35.8 18.6 35.4 25C33.4 21.6 29.6 20.4 24 20.4S14.6 21.6 12.6 25Z" fill={HAIR.dark} />
  {[[14.2, 20.8, 2.9], [16.8, 17.4, 3.2], [20.8, 15.4, 3.4], [25.4, 15, 3.4], [29.6, 16.4, 3.2], [33, 19.4, 3]].map(([x, y, r], i) =>
    <circle key={i} cx={x} cy={y} r={r} fill={HAIR.dark} />)}
</>;

const VARIANTS: Variant[] = [
  // Casco de moto integral, con la visera levantada: se le ven los ojos por la ventana; la mentonera tapa la boca.
  /* 0 */ { name: 'Casco de moto', draw: ({ c, d }) => <>
    <path d={SHIRT} fill={d} />
    <path d="M24 4.6C35.6 4.6 41.6 12.6 41.6 24.4C41.6 31.6 39.4 37 36.4 40.8H11.6C8.6 37 6.4 31.6 6.4 24.4C6.4 12.6 12.4 4.6 24 4.6Z" fill={c} />
    <path d="M21.6 4.9H26.4L26.8 12H21.2Z" fill={WHITE} opacity={0.85} />
    <rect x={12.6} y={18.6} width={22.8} height={12} rx={5} fill={SKIN.light} stroke={INK} strokeWidth={1} />
    <path d="M11.8 19.4C15.4 14.8 32.6 14.8 36.2 19.4L36 13.2C31.6 9.8 16.4 9.8 12 13.2Z" fill={INK} />
    <path d="M15.4 13.6Q20 12 25 12.2" fill="none" stroke={WHITE} strokeWidth={1.1} strokeLinecap="round" opacity={0.6} />
    <circle cx={10.4} cy={20.6} r={1.7} fill={d} /><circle cx={37.6} cy={20.6} r={1.7} fill={d} />
    <Brows x1={19.6} x2={28.4} y={22} w={3.2} c={HAIR.brown} />
    <Eyes x1={19.6} x2={28.4} y={25.4} r={1.45} />
    <path d="M19.6 34.4H28.4M20.8 36.8H27.2" stroke={d} strokeWidth={1.3} strokeLinecap="round" />
  </>,
    // sin el casco (gorra, corona, vincha y auriculares van sobre el pelo)
    bare: { for: ['gorra', 'corona', 'vincha', 'auriculares'], draw: ({ d }) => <>
      <Bust skin={SKIN.light} shirt={d} />
      <SideHair fill={HAIR.brown} />
      <Face skin={SKIN.light} brow={HAIR.brown} />
    </> } },
  /* 1 */ { name: 'Mochilero', draw: ({ c, d }) => <>
    <path d="M8.2 42Q8.6 35.4 14 35.2H34Q39.4 35.4 39.8 42Z" fill={mix(d, INK, 0.25)} />
    <Bust skin={SKIN.tan} shirt={c} />
    <path d="M14.2 40.2Q13 44 13.6 48M33.8 40.2Q35 44 34.4 48" fill="none" stroke={mix(d, INK, 0.25)} strokeWidth={3.2} strokeLinecap="round" />
    <rect x={11.8} y={43.2} width={3.6} height={2.2} rx={0.6} fill={WHITE} opacity={0.85} /><rect x={32.6} y={43.2} width={3.6} height={2.2} rx={0.6} fill={WHITE} opacity={0.85} />
    <path d={MOCHI_HAIR} fill={HAIR.brown} />
    <Face skin={SKIN.tan} brow={HAIR.brown} />
  </> },
  // La mascota de la marca, madurada en serio: geométrico y angular (facetas planas, ojos rasgados), nada de peluche.
  // Índice 2 FIJO (identity.json lo puede tener guardado).
  /* 2 */ { name: 'Zorro', draw: ({ c, d }) => {
    const ear = 'M9.4 22.6L10.4 3.4L21.2 12.8Z', inner = 'M12.4 16.8L12.9 9L17.6 12.9Z', eye = 'M14.4 21.6Q18.2 19.8 21.4 23Q17.6 24.6 14.4 21.6Z';
    return <>
      <Soft d={ear} fill={c} w={1} /><Soft d={mirror(ear)} fill={c} w={1} />
      <Soft d={inner} fill={d} w={0.8} /><Soft d={mirror(inner)} fill={d} w={0.8} />
      <Soft d="M7.8 21L14 12.4L24 11L34 12.4L40.2 21L37.4 28.8L24 43.8L10.6 28.8Z" fill={c} w={1} />
      <path d="M24 11.2L20.4 18.4L24 23.6L27.6 18.4Z" fill={d} opacity={0.35} />
      <Soft d="M8.4 22.2L17.6 27L24 35.6L30.4 27L39.6 22.2L37.2 29L24 43.6L10.8 29Z" fill={WHITE} w={0.8} />
      <path d="M14 19.2L20.6 20.4M34 18.6L27.4 20" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
      <path d={eye} fill={INK} /><path d={mirror(eye)} fill={INK} />
      <circle cx={18.6} cy={21.9} r={0.55} fill={WHITE} /><circle cx={30.2} cy={21.9} r={0.55} fill={WHITE} />
      <path d="M22 38.6H26L24 41.2Z" fill={INK} stroke={INK} strokeWidth={0.8} strokeLinejoin="round" />
    </>;
  } },
  // Anteojos de sol puestos (aviador) y jopo: los del guardarropas los reemplazan (bare).
  /* 3 */ { name: 'Lentes', draw: ({ c }) => {
    const lens = 'M15 22.4H22.4Q23.2 22.4 22.8 24.6Q22 28.4 18.6 28.4Q15.4 28.4 14.8 24.8Q14.4 22.4 15 22.4Z';
    return <>
      <Bust skin={SKIN.medium} shirt={c} />
      <path d={QUIFF} fill={HAIR.dark} />
      <path d="M20 11.4Q25.4 9.4 30.4 11.2" fill="none" stroke={WHITE} strokeWidth={0.9} strokeLinecap="round" opacity={0.35} />
      <Face skin={SKIN.medium} brow={HAIR.dark} eyes={false} />
      <path d={lens} fill={INK} stroke="#C9962A" strokeWidth={0.9} strokeLinejoin="round" />
      <path d={mirror(lens)} fill={INK} stroke="#C9962A" strokeWidth={0.9} strokeLinejoin="round" />
      <path d="M22.6 23.2Q24 22.4 25.4 23.2M14.8 23.2H12.6M33.2 23.2H35.4" fill="none" stroke="#C9962A" strokeWidth={0.9} strokeLinecap="round" />
      <path d="M16.6 24.2Q17.4 23.4 18.6 23.4M27.6 24.2Q28.4 23.4 29.6 23.4" fill="none" stroke={WHITE} strokeWidth={0.8} strokeLinecap="round" opacity={0.75} />
    </>;
  },
    bare: { for: ['anteojos'], draw: ({ c }) => <>
      <Bust skin={SKIN.medium} shirt={c} />
      <path d={QUIFF} fill={HAIR.dark} />
      <Face skin={SKIN.medium} brow={HAIR.dark} />
    </> } },
  /* 4 */ { name: 'Pelo largo', draw: ({ d }) => <>
    <path d="M10.6 26C9.6 15 15 9.6 24 9.6S38.4 15 37.4 26L38.6 42.6C35 44.6 31.6 43.4 30.4 41H17.6C16.4 43.4 13 44.6 9.4 42.6Z" fill={HAIR.auburn} />
    <Bust skin={SKIN.light} shirt={d} ears={false} />
    <path d="M12.4 27C11.6 17.6 16.6 12.2 24 12.2C21.4 15.6 18.6 18.4 14.6 19.8C13.4 21.8 12.8 24.2 12.4 27ZM35.6 27C36.4 17.6 31.4 12.2 24 12.2C26.6 15.6 29.4 18.4 33.4 19.8C34.6 21.8 35.2 24.2 35.6 27Z" fill={HAIR.auburn} />
    <Face skin={SKIN.light} brow={mix(HAIR.auburn, INK, 0.3)} />
  </> },
  /* 5 */ { name: 'DJ', draw: ({ c, d }) => <>
    <Bust skin={SKIN.deep} shirt={d} />
    <path d="M13 20.4C12.6 15 13 9.6 15 7.4H33C35 9.6 35.4 15 35 20.4C33.4 17.6 30 16.6 24 16.6S14.6 17.6 13 20.4Z" fill={HAIR.dark} />
    <Face skin={SKIN.deep} brow={HAIR.dark} />
    <path d="M16 37.6Q24 46.4 32 37.6" fill="none" stroke={INK} strokeWidth={2.8} strokeLinecap="round" />
    <path d="M16 37.6Q24 46.4 32 37.6" fill="none" stroke={c} strokeWidth={1.6} strokeLinecap="round" />
    <rect x={12.6} y={34.6} width={5.6} height={7.4} rx={2.4} fill={c} stroke={INK} strokeWidth={0.8} transform="rotate(-14 15.4 38.3)" />
    <rect x={29.8} y={34.6} width={5.6} height={7.4} rx={2.4} fill={c} stroke={INK} strokeWidth={0.8} transform="rotate(14 32.6 38.3)" />
  </>,
    // sin sus auriculares al cuello (los del guardarropas van en la cabeza; la bandana ocupa el cuello)
    bare: { for: ['auriculares', 'lazo'], draw: ({ d }) => <>
      <Bust skin={SKIN.deep} shirt={d} />
      <path d="M13 20.4C12.6 15 13 9.6 15 7.4H33C35 9.6 35.4 15 35 20.4C33.4 17.6 30 16.6 24 16.6S14.6 17.6 13 20.4Z" fill={HAIR.dark} />
      <Face skin={SKIN.deep} brow={HAIR.dark} />
    </> } },
  /* 6 */ { name: 'Gamer', draw: ({ c, d }) => <>
    <Bust skin={SKIN.light} shirt={d} />
    <GamerHair />
    <Face skin={SKIN.light} brow={HAIR.brown} />
    <path d="M11.6 23.6C11 12.8 16.4 8 24 8S37 12.8 36.4 23.6" fill="none" stroke={INK} strokeWidth={3.4} strokeLinecap="round" />
    <path d="M11.6 23.6C11 12.8 16.4 8 24 8S37 12.8 36.4 23.6" fill="none" stroke={c} strokeWidth={2.1} strokeLinecap="round" />
    <path d="M11.6 30Q12.8 35 19.2 33.8" fill="none" stroke={INK} strokeWidth={1.3} strokeLinecap="round" />
    <circle cx={19.6} cy={33.7} r={1.2} fill={INK} />
    <rect x={8.8} y={21} width={5.8} height={9.4} rx={2.6} fill={c} stroke={INK} strokeWidth={0.8} />
    <rect x={33.4} y={21} width={5.8} height={9.4} rx={2.6} fill={c} stroke={INK} strokeWidth={0.8} />
  </>,
    // sin sus auriculares (los del guardarropas los reemplazan; la corona va directo sobre el pelo)
    bare: { for: ['auriculares', 'corona'], draw: ({ d }) => <>
      <Bust skin={SKIN.light} shirt={d} />
      <GamerHair />
      <Face skin={SKIN.light} brow={HAIR.brown} />
    </> } },
  /* 7 */ { name: 'Rapado', draw: ({ c, d }) => <>
    <Bust skin={SKIN.deep} shirt={c} />
    <path d="M20.4 39.4L24 44.4L27.6 39.4Z" fill={WHITE} />
    <path d="M17.4 39Q24 45.4 30.6 39" fill="none" stroke={d} strokeWidth={2.6} strokeLinecap="round" />
    <path d="M24 44.6V48" stroke={d} strokeWidth={1.2} strokeLinecap="round" />
    <path d="M12.6 22.4C12.6 15.6 17.4 12.4 24 12.4S35.4 15.6 35.4 22.4C33 19.6 29 18.8 24 18.8S15 19.6 12.6 22.4Z" fill={HAIR.dark} opacity={0.88} />
    <Face skin={SKIN.deep} brow={HAIR.dark} />
  </> },
  /* 8 */ { name: 'Robot', draw: ({ c, d }) => <>
    <RobotAntenna d={d} />
    <rect x={6.4} y={20.4} width={4.4} height={11.4} rx={1.4} fill={d} /><rect x={37.2} y={20.4} width={4.4} height={11.4} rx={1.4} fill={d} />
    <rect x={9.8} y={11.6} width={28.4} height={29} rx={5} fill={c} />
    <path d="M13.6 14.8H34.4" stroke={d} strokeWidth={1} strokeLinecap="round" opacity={0.7} />
    <circle cx={12.8} cy={37.6} r={0.9} fill={d} /><circle cx={35.2} cy={37.6} r={0.9} fill={d} />
    <rect x={12.6} y={18.2} width={22.8} height={11.6} rx={3.4} fill={INK} />
    <rect x={15.6} y={22.6} width={6.2} height={2.6} rx={1.3} fill="#7CF0DC" transform="rotate(7 18.7 23.9)" />
    <rect x={26.2} y={22.6} width={6.2} height={2.6} rx={1.3} fill="#7CF0DC" transform="rotate(-7 29.3 23.9)" />
    <path d="M20 34.4Q24 36 28.2 33.6" fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
  </>,
    // la antena atraviesa la gorra (y queda delante de la vincha de los auriculares)
    over: { for: ['gorra', 'auriculares'], draw: ({ d }) => <RobotAntenna d={d} /> } },
  /* 9 */ { name: 'Cuello alto', draw: ({ c, d }) => <>
    <Bust skin={SKIN.medium} shirt={c} />
    <path d="M19.2 33H28.8Q29.6 37.6 29.8 40.4Q24 43 18.2 40.4Q18.4 37.6 19.2 33Z" fill={c} />
    <path d="M19 35.6Q24 37.2 29 35.6M18.8 38.2Q24 40 29.2 38.2" fill="none" stroke={d} strokeWidth={0.9} strokeLinecap="round" />
    <path d={SWEPT} fill={HAIR.dark} />
    <Face skin={SKIN.medium} brow={HAIR.dark} />
  </> },
  /* 10 */ { name: 'Capucha', draw: ({ c, d }) => <>
    <path d={SHIRT} fill={c} />
    <path d="M24 5.6C35 5.6 41.4 13.4 41 24.6C40.8 31.6 38.4 36.8 35.4 40.4H12.6C9.6 36.8 7.2 31.6 7 24.6C6.6 13.4 13 5.6 24 5.6Z" fill={c} />
    <path d="M24 9.6C32.4 9.6 36.8 15.6 36.6 24C36.4 31.6 32.4 38 24 39.6C15.6 38 11.6 31.6 11.4 24C11.2 15.6 15.6 9.6 24 9.6Z" fill={d} />
    <path d={FACE} fill={SKIN.tan} />
    <CapucHair />
    <Face skin={SKIN.tan} brow={HAIR.dark} />
    <path d="M12.6 40.4Q24 44.6 35.4 40.4" fill="none" stroke={d} strokeWidth={1.1} strokeLinecap="round" />
    <path d="M19.6 40.8V45.6M28.4 40.8V45.6" stroke={WHITE} strokeWidth={1.2} strokeLinecap="round" />
  </>,
    // con la capucha baja (gorra, corona, vincha y auriculares van sobre el pelo)
    bare: { for: ['gorra', 'corona', 'vincha', 'auriculares'], draw: ({ c, d }) => <>
      <Bust skin={SKIN.tan} shirt={c} />
      <path d="M11.6 42.4C15 38.4 19.4 37.2 24 37.2S33 38.4 36.4 42.4" fill="none" stroke={d} strokeWidth={3} strokeLinecap="round" />
      <CapucHair />
      <Face skin={SKIN.tan} brow={HAIR.dark} />
      <path d="M19.6 41.6V46.2M28.4 41.6V46.2" stroke={WHITE} strokeWidth={1.2} strokeLinecap="round" />
    </> } },
  /* 11 */ { name: 'Skater', draw: ({ c, d }) => <>
    <Bust skin={SKIN.medium} shirt={d} />
    <SkaterHair />
    <path d="M27.4 10.2C30.8 6.4 36.4 4.6 40.2 5.8C38.8 8.8 34.6 10.8 31 11.8Z" fill={d} stroke={d} strokeWidth={1} strokeLinejoin="round" />
    <path d="M11.4 20.8C11.4 12.4 16.6 8.4 24 8.4S36.6 12.4 36.6 20.8Z" fill={c} />
    <path d="M20.4 21Q24 15.8 27.6 21Z" fill={HAIR.sandy} />
    <path d="M21.2 18.6H26.8" stroke={d} strokeWidth={1} strokeLinecap="round" />
    <path d="M11 20.8H37" stroke={d} strokeWidth={1.7} strokeLinecap="round" />
    <circle cx={24} cy={8.6} r={1.5} fill={d} />
    <Face skin={SKIN.medium} brow={mix(HAIR.sandy, INK, 0.35)} />
  </>,
    // sin su gorra al revés (la gorra, la corona y la vincha del guardarropas la reemplazan): pelo despeinado
    bare: { for: ['gorra', 'corona', 'vincha'], draw: ({ d }) => <>
      <Bust skin={SKIN.medium} shirt={d} />
      <SkaterHair />
      <Face skin={SKIN.medium} brow={mix(HAIR.sandy, INK, 0.35)} />
    </> } },
  /* 12 */ { name: 'Astronauta', draw: ({ c, d, l }) => <>
    <rect x={4.4} y={21.6} width={4.8} height={10} rx={2.2} fill={d} /><rect x={38.8} y={21.6} width={4.8} height={10} rx={2.2} fill={d} />
    <circle cx={24} cy={26.6} r={17.6} fill={c} />
    <circle cx={24} cy={27.4} r={13.6} fill={l} />
    <circle cx={24} cy={27.4} r={12.4} fill={SKIN.medium} />
    <path d="M11.8 27C12 18.8 17 15 24 15S36 18.8 36.2 27C35 22.6 32.4 20.6 29 20.2C26 22.2 20.6 22.6 16.6 21.4C14.4 22.4 12.6 24.4 11.8 27Z" fill={HAIR.brown} />
    <Brows x1={20} x2={28} y={25} w={3} c={HAIR.brown} />
    <Eyes x1={20} x2={28} y={28.4} r={1.45} />
    <Smirk cx={24} y={34} w={2.3} />
    <path d="M14.6 21.4A11.6 11.6 0 0 1 21 16.2" fill="none" stroke={WHITE} strokeWidth={1.8} strokeLinecap="round" opacity={0.7} />
  </> },
  /* 13 */ { name: 'Gorra', draw: ({ c, d }) => <>
    <Bust skin={SKIN.tan} shirt={d} />
    <path d="M12.8 26.4C12.2 23.8 12.4 21.6 13 20.4H16.6C15.2 21.8 14.2 23.6 13.9 26.4Z" fill={HAIR.dark} />
    <path d={mirror('M12.8 26.4C12.2 23.8 12.4 21.6 13 20.4H16.6C15.2 21.8 14.2 23.6 13.9 26.4Z')} fill={HAIR.dark} />
    <path d="M11.4 20.4C11.4 11.2 16.6 7.4 24 7.4S36.6 11.2 36.6 20.4Z" fill={c} />
    <path d="M24 7.7V20.2" stroke={d} strokeWidth={1} opacity={0.55} />
    <circle cx={24} cy={8} r={1.6} fill={d} />
    <path d="M30.4 18.2C36.2 16.6 42.6 17 44.4 19.6C42.4 21.8 36.4 22.2 30.4 21.2Z" fill={d} stroke={d} strokeWidth={1} strokeLinejoin="round" />
    <path d="M11 20.2H37" stroke={d} strokeWidth={1.6} strokeLinecap="round" />
    <Face skin={SKIN.tan} brow={HAIR.dark} />
  </>,
    // sin su gorra (la corona y la vincha la reemplazan): pelo oscuro con raya al costado
    bare: { for: ['corona', 'vincha'], draw: ({ d }) => <>
      <Bust skin={SKIN.tan} shirt={d} />
      <SideHair fill={HAIR.dark} />
      <Face skin={SKIN.tan} brow={HAIR.dark} />
    </> } },
  /* 14 */ { name: 'Rulos', draw: ({ c, d }) => <>
    <Bust skin={SKIN.light} shirt={d} />
    {[[13, 21, 4.4], [14.2, 14.8, 4.8], [19, 10.8, 5], [24.4, 9.4, 5], [29.8, 10.8, 5], [34, 14.8, 4.8], [35, 21, 4.4], [24, 15.6, 9.4]].map(([x, y, r], i) =>
      <circle key={i} cx={x} cy={y} r={r} fill={c} />)}
    {[[17.2, 15.8, 3.3], [21.6, 14.4, 3.5], [26.4, 14.4, 3.5], [30.8, 16, 3.2]].map(([x, y, r], i) =>
      <circle key={i} cx={x} cy={y} r={r} fill={c} />)}
    <Brows x1={19.5} x2={28.5} y={20.6} w={3} c={mix(c, INK, 0.45)} />
    <Eyes x1={19.5} x2={28.5} y={25.2} r={1.35} />
    <rect x={15.8} y={22.4} width={7.4} height={5.6} rx={2.2} fill="none" stroke={INK} strokeWidth={1.2} />
    <rect x={24.8} y={22.4} width={7.4} height={5.6} rx={2.2} fill="none" stroke={INK} strokeWidth={1.2} />
    <path d="M23.2 24.2q.8-.7 1.6 0M15.8 24H13.2M32.2 24H34.8" fill="none" stroke={INK} strokeWidth={1.1} strokeLinecap="round" />
    <Smirk cx={24} y={32} w={2.4} />
  </> },
  /* 15 */ { name: 'Gorro de lana', draw: ({ c, d }) => <>
    <Bust skin={SKIN.deep} shirt={c} />
    <path d="M11.8 19C11.4 9.8 16.4 5 24.4 5C31.6 5 36.4 9 36.6 16.6C36.4 17.8 36.3 18.6 36.2 19Z" fill={c} />
    <path d="M12.7 23.8C12.4 22 12.5 20.8 12.9 20H15.6C14.6 21 14 22.2 13.8 23.8ZM35.3 23.8C35.6 22 35.5 20.8 35.1 20H32.4C33.4 21 34 22.2 34.2 23.8Z" fill={HAIR.dark} />
    <path d="M18 8.4Q22 11.2 23.4 15M29.6 8Q30.4 11.6 29.8 15" fill="none" stroke={d} strokeWidth={0.9} strokeLinecap="round" opacity={0.6} />
    <rect x={11} y={14.8} width={26} height={5.6} rx={2.6} fill={d} />
    <path d="M14.6 15.8v3.6M18.2 15.8v3.6M21.8 15.8v3.6M25.4 15.8v3.6M29 15.8v3.6M32.6 15.8v3.6" stroke={c} strokeWidth={1} opacity={0.45} />
    <Face skin={SKIN.deep} brow={HAIR.dark} />
  </>,
    // sin su gorro de lana (la gorra, la corona y la vincha lo reemplazan): pelo corto con rulitos
    bare: { for: ['gorra', 'corona', 'vincha'], draw: ({ c }) => <>
      <Bust skin={SKIN.deep} shirt={c} />
      <ShortCurls />
      <Face skin={SKIN.deep} brow={HAIR.dark} />
    </> } },
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
   Cada personaje tiene su propio calce (FITS): las cabezas son distintas (los humanos son un busto, el robot es un
   rectángulo con antena, el marciano tiene los ojos rasgados) y nada puede quedar flotando ni tapar los ojos (salvo los
   anteojos).
   El id es lo que viaja y se guarda (AvatarLook.accessory, Friend.accessory, MarketItem.accessoryId): APPEND-ONLY.
   TEEN (4-nov): 'lazo' conserva el id y el precio, pero ya no es el moño rosa con lunares: es una BANDANA al cuello.
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
  { id: 'lazo', name: 'Bandana', price: 120, emoji: '🧣', fem: true, plural: false },
  { id: 'anteojos', name: 'Anteojos de sol', price: 150, emoji: '🕶️', fem: false, plural: true },
  { id: 'auriculares', name: 'Auriculares', price: 220, emoji: '🎧', fem: false, plural: true },
  { id: 'corona', name: 'Corona', price: 300, emoji: '👑', fem: true, plural: false },
];
type WearId = 'gorra' | 'vincha' | 'lazo' | 'anteojos' | 'auriculares' | 'corona';
const isWearId = (id: string): id is WearId => ACCESSORIES.some((a) => a.id === id);
/** El accesorio del set con ese id (undefined = no es del set: no se dibuja nada). */
export const accessoryById = (id: string | null | undefined): Accessory | undefined => (id ? ACCESSORIES.find((a) => a.id === id) : undefined);
/** "la gorra", "la bandana", "los anteojos de sol" (minúscula, para meter en una frase). */
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
// bandana: azul marino clásico con el estampado blanco (roja se leía como una lengua debajo del hocico)
const BANDANA = '#24407E', BANDANA_D = '#162A58';
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
 *  tilt = vidrios girados (los ojos rasgados del marciano); oval = vidrios ovalados. */
type ShadesFit = { x: number; y: number; d: number; s: number; r?: number; tilt?: number; oval?: boolean };
function Shades({ x, y, d, s, r = 0, tilt = 0, oval }: ShadesFit) {
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
      <path d={`M${-d + 0.9 * s} ${-0.42 * s}Q0 ${-0.95 * s} ${d - 0.9 * s} ${-0.42 * s}`} fill="none" stroke={INK} strokeWidth={Math.max(1, 0.24 * s)} strokeLinecap="round" />
      {lens(-d, -1)}{lens(d, 1)}
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
 *  · path: la forma exacta (cabezas que no son óvalos: el robot) + el trazo de la raya y su grosor. */
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

/** Bandana al cuello (id 'lazo'): el triángulo que cae sobre el pecho, el rollo anudado arriba y el estampado blanco.
 *  (x, y) = centro del rollo (bajo el mentón); w = ancho; r = giro. */
type BandanaFit = { x: number; y: number; w: number; r?: number };
function Bandana({ x, y, w, r = 0 }: BandanaFit) {
  const a = w / 2, h = w * 0.5;
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <path d={`M${-a} 0Q0 ${0.3 * h} ${a} 0L${0.12 * a} ${h}Q0 ${h + 0.5} ${-0.12 * a} ${h}Z`} fill={BANDANA} {...LINE} strokeWidth={0.8} />
      <path d={`M${-0.62 * a} ${0.28 * h}Q0 ${0.5 * h} ${0.62 * a} ${0.28 * h}`} fill="none" stroke={WHITE} strokeWidth={0.55} strokeDasharray="1 1.1" opacity={0.85} />
      <g fill={WHITE} opacity={0.92}>
        <circle cx={-0.34 * a} cy={0.5 * h} r={0.06 * w} /><circle cx={0.34 * a} cy={0.5 * h} r={0.06 * w} />
        <circle cx={0} cy={0.72 * h} r={0.05 * w} /><circle cx={0} cy={0.42 * h} r={0.035 * w} />
      </g>
      <path d={`M${-a - 0.3} ${-0.1}Q0 ${0.3 * h + 0.3} ${a + 0.3} ${-0.1}`} fill="none" stroke={INK} strokeWidth={0.13 * w + 1.2} strokeLinecap="round" />
      <path d={`M${-a - 0.3} ${-0.1}Q0 ${0.3 * h + 0.3} ${a + 0.3} ${-0.1}`} fill="none" stroke={BANDANA_D} strokeWidth={0.13 * w} strokeLinecap="round" />
    </g>
  );
}

/* ---------- calces por personaje ---------- */
type Fit = { gorra: CapFit; corona: CrownFit; vincha: BandFit; anteojos: ShadesFit; auriculares: PhonesFit; lazo: BandanaFit };
/** Las iniciales: el círculo entero es la cabeza (la letra va al medio, la ropa la rodea sin taparla). */
const FIT_INITIALS: Fit = {
  gorra: { x: 24, y: 14.2, w: 27 },
  corona: { x: 24, y: 12.6, w: 14 },
  vincha: { y1: 8.6, y2: 13, head: [24, 24, 24, 24], sag: 1.2 },
  anteojos: { x: 24, y: 10.4, d: 6.6, s: 3.6 },
  auriculares: { x: 24, top: 3.6, y: 24.5, d: 18.8 },
  lazo: { x: 24, y: 38.6, w: 17 },
};
/** El busto humano común (cara 12.4-37.6, ojos en y 25, cuello en y 38). Cada uno ajusta lo que su pelo/prenda pide. */
const HUMAN: Fit = {
  gorra: { x: 24, y: 18.6, w: 25.4, h: 11 },
  corona: { x: 24, y: 11.6, w: 12 },
  vincha: { y1: 15.4, y2: 19.2, head: [24, 25, 11.6, 12.6] },
  anteojos: { x: 24, y: 25, d: 4.5, s: 3.3 },
  auriculares: { x: 24, top: 9, y: 25.8, d: 13.2 },
  lazo: { x: 24, y: 38.6, w: 17 },
};
const human = (o: Partial<Fit>): Fit => ({ ...HUMAN, ...o });
const FITS: Fit[] = [
  /* 0 Casco de moto: con gorra, corona, vincha o auriculares se saca el casco (bare) */ human({
    anteojos: { x: 24, y: 25.2, d: 4.5, s: 3.3 }, lazo: { x: 24, y: 41.4, w: 17 },
  }),
  /* 1 Mochilero */ human({}),
  /* 2 Zorro (geométrico): ojos en y 22, mentón en punta (y 43.8) */ {
    gorra: { x: 24, y: 16.4, w: 25 }, corona: { x: 24, y: 13.4, w: 12 },
    // la cabeza es un polígono: la banda sigue sus bordes rectos (de 14|12.4 a 7.8|21 y su espejo)
    vincha: { path: 'M12.86 14.2Q24 15.8 35.14 14.2L37.57 17.6Q24 19.2 10.43 17.6Z', stripe: 'M11.7 15.9Q24 17.5 36.3 15.9', t: 3.4 },
    anteojos: { x: 24, y: 22.4, d: 6.2, s: 3.8 }, auriculares: { x: 24, top: 9.4, y: 23, d: 15.6 },
    lazo: { x: 24, y: 43.6, w: 16 },
  },
  /* 3 Lentes: el jopo es alto; los anteojos del guardarropas reemplazan los suyos (bare) */ human({
    corona: { x: 24, y: 8.8, w: 12 }, auriculares: { x: 24, top: 6.8, y: 25.8, d: 13.4 },
  }),
  /* 4 Pelo largo: los auriculares van sobre el pelo suelto */ human({
    corona: { x: 24, y: 10.4, w: 12 }, auriculares: { x: 24, top: 8.4, y: 25.8, d: 13.8 },
    vincha: { y1: 14.6, y2: 18.4, head: [24, 25, 13.6, 15.4] },
  }),
  /* 5 DJ: el high-top queda debajo de la gorra; la corona va arriba del pelo */ human({
    gorra: { x: 24, y: 18.6, w: 25.4, h: 12.4 }, corona: { x: 24, y: 8.2, w: 12 },
    auriculares: { x: 24, top: 6.4, y: 25.8, d: 13.2 },
  }),
  /* 6 Gamer */ human({ corona: { x: 24, y: 11.4, w: 12 }, auriculares: { x: 24, top: 8.2, y: 25.8, d: 13.4 } }),
  /* 7 Rapado */ human({ corona: { x: 24, y: 12.6, w: 12 } }),
  /* 8 Robot */ {
    gorra: { x: 24, y: 15.4, w: 27 }, corona: { x: 30.6, y: 13.2, w: 12, r: 12 },
    // la cabeza es un rectángulo redondeado (esquinas de radio 5, centro de la de arriba en y 16.6): la banda sigue las esquinas
    vincha: { path: 'M11.13 13.2H36.87A5 5 0 0 1 38.2 16.6V16.9H9.8V16.6A5 5 0 0 1 11.13 13.2Z', stripe: 'M10.3 15.05H37.7', t: 3.7 },
    // sobre el visor oscuro los vidrios no se verían: el robot los lleva en la frente (los ojos de luz siguen a la vista)
    anteojos: { x: 24, y: 15, d: 5.2, s: 2.6 }, auriculares: { x: 24, top: 9.4, y: 26.2, d: 15.6, s: 1.1 },
    lazo: { x: 24, y: 42.2, w: 19 },
  },
  /* 9 Cuello alto: la bandana va sobre el cuello del buzo */ human({ lazo: { x: 24, y: 39.8, w: 17 } }),
  /* 10 Capucha: gorra, corona, vincha y auriculares van con la capucha baja (bare); la bandana, sobre el borde */ human({}),
  /* 11 Skater: gorra, corona y vincha reemplazan la suya (bare); los auriculares van arriba de la gorra al revés */ human({
    auriculares: { x: 24, top: 7.4, y: 25.8, d: 13.4 },
  }),
  /* 12 Astronauta */ {
    gorra: { x: 24, y: 13, w: 22 }, corona: { x: 24, y: 10.6, w: 12 },
    vincha: { y1: 21.6, y2: 24.6, head: [24, 27.4, 12.4, 12.4] },
    anteojos: { x: 24, y: 28.4, d: 4.2, s: 3.2 }, auriculares: { x: 24, top: 7.6, y: 26.6, d: 17.2, s: 1.1 },
    lazo: { x: 24, y: 43.6, w: 18.4 },
  },
  /* 13 Gorra: la gorra nueva TAPA la suya (misma copa); corona y vincha van sin gorra (bare) */ human({
    gorra: { x: 24, y: 20.4, w: 25.4, h: 13.2 }, corona: { x: 24, y: 11.6, w: 12 },
  }),
  /* 14 Rulos: los rulos son más altos: corona y gorra van más arriba; la vincha abraza los rulos */ human({
    gorra: { x: 24, y: 17, w: 26.4, h: 11.4 }, corona: { x: 24, y: 6.6, w: 12 },
    vincha: { y1: 14.2, y2: 18, head: [24, 20.6, 15.4, 16.2] },
    anteojos: { x: 24, y: 25.2, d: 4.5, s: 3.4 }, auriculares: { x: 24, top: 3.6, y: 25, d: 15.2 },
  }),
  /* 15 Gorro de lana: gorra, corona y vincha van sin el gorro (bare); los auriculares, arriba del gorro */ human({
    auriculares: { x: 24, top: 4.2, y: 25.8, d: 13.6 },
  }),
];

/** Dibuja un accesorio con el calce de ese personaje (o el de las iniciales). */
function Wear({ id, fit }: { id: WearId; fit: Fit }) {
  switch (id) {
    case 'gorra': return <Cap {...fit.gorra} />;
    case 'corona': return <Crown {...fit.corona} />;
    case 'vincha': return <Band {...fit.vincha} />;
    case 'anteojos': return <Shades {...fit.anteojos} />;
    case 'auriculares': return <Phones {...fit.auriculares} />;
    case 'lazo': return <Bandana {...fit.lazo} />;
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
