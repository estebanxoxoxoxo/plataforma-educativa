// Formatos del panel del padre (es-AR, registro adulto): números, fechas, etiquetas y stock.
import type { DriveItem, ParentAlert, ParentFeatures } from '../../../api/types';
import { wallDate, type WallDate } from '../../../shared/lib/zonedClock';
import type { ParentItemView, ParentProtections } from './types';

/** Nombre corto de cada gran on-off (tarjetas de presets, avisos de qué cambia). */
export const FEATURE_LABEL: Record<keyof ParentFeatures, string> = { chat: 'Chat', amigos: 'Amigos', ligas: 'Ligas', tienda: 'Tienda' };
/** Orden en que se listan (el del menú del chico). */
export const FEATURE_ORDER: (keyof ParentFeatures)[] = ['chat', 'tienda', 'amigos', 'ligas'];
/** Título de cada tipo de aviso. */
export const ALERT_TITLE: Record<ParentAlert['kind'], string> = {
  crisis: 'Mensaje de crisis',
  contacto: 'Intento de contacto',
  bloqueos: 'Insistió con mensajes frenados',
};
/** "el chat con el asistente" → "El chat con el asistente" (los orígenes vienen en minúscula para ir en una oración). */
export const capFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** "Chat, Amigos y Ligas". */
export const listEs = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
/** «a», «b» y «c» */
export const quoted = (xs: string[]) => listEs(xs.map((x) => `«${x}»`));

/** 1.240 */
export const fmtNum = (n: number) => Math.round(n).toLocaleString('es-AR');

/* Fechas EN LA ZONA DE LA FAMILIA (QA-U5-E): `tz` = useCycle().tz (la de la familia o, en Automática, la del server:
   FS-BASE-B), la misma pared que la barra superior; sin zona —o una que este navegador no conoce— la local, como
   wallClock (shared/lib/zonedClock). Antes era siempre la del NAVEGADOR: con la familia en otra zona, el cierre de la
   liga familiar decía «cerró el 1 nov» y la barra «lun 2 nov». */
const DAY_MONTH = { day: 'numeric', month: 'short' } as const;
const DAY_MONTH_YEAR = { day: 'numeric', month: 'short', year: 'numeric' } as const;
const HHMM = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;
const FULL = { dateStyle: 'full', timeStyle: 'short', hourCycle: 'h23' } as const;
const fmts = new Map<string, Intl.DateTimeFormat>();
function inTz(kind: string, opts: Intl.DateTimeFormatOptions, tz?: string | null): Intl.DateTimeFormat {
  const key = `${kind}|${tz ?? ''}`;
  let f = fmts.get(key);
  if (!f) {
    try { f = new Intl.DateTimeFormat('es-AR', tz ? { ...opts, timeZone: tz } : opts); } catch { f = new Intl.DateTimeFormat('es-AR', opts); }
    fmts.set(key, f);
  }
  return f;
}
/** ¿Esa fecha de pared (wallDate) es el día y/m/d? */
const isDay = (w: WallDate, y: number, m: number, d: number) => w.y === y && w.m === m && w.d === d;

/** "Hoy, 15:42" · "Ayer, 10:05" · "5 oct, 18:20" · "5 oct 2025, 18:20" — en la pared de `tz` (la de la familia). */
export function fmtWhen(ts: number, now = new Date(), tz?: string | null): string {
  const d = wallDate(ts, tz), n = wallDate(now.getTime(), tz);
  const ayer = new Date(Date.UTC(n.y, n.m, n.d - 1));
  const day = isDay(d, n.y, n.m, n.d) ? 'Hoy'
    : isDay(d, ayer.getUTCFullYear(), ayer.getUTCMonth(), ayer.getUTCDate()) ? 'Ayer'
    : d.y === n.y ? inTz('dm', DAY_MONTH, tz).format(ts) : inTz('dmy', DAY_MONTH_YEAR, tz).format(ts);
  return `${day}, ${inTz('hm', HHMM, tz).format(ts)}`;
}
/** "28 oct": un día suelto (el cierre de la semana de la familia en DeliveryRow), en la pared de `tz`. */
export const fmtDay = (ts: number, tz?: string | null) => inTz('dm', DAY_MONTH, tz).format(ts);
/** Para el title/tooltip: "jueves, 8 de octubre de 2026, 15:42" (en la pared de `tz`). */
export const fmtFull = (ts: number, tz?: string | null) => inTz('full', FULL, tz).format(ts);
export const isoOf = (ts: number) => new Date(ts).toISOString();

export const TYPE_LABEL: Record<DriveItem['type'], string> = { video: 'Video', articulo: 'Lectura', imagen: 'Imagen' };
export const DOMAIN_MODE: Record<ParentProtections['domainMode'], string> = {
  blanca: 'Solo lista blanca',
  negra: 'Lista negra',
  hibrido: 'Lista blanca + lista negra',
};

/** Stock en la tabla del padre: "Sin límite" · "Quedan 2 de 2" · "Queda 1 de 2" · "Agotado (0 de 1)". */
export function stockLabel(it: Pick<ParentItemView, 'stock' | 'left'>): string {
  if (it.stock === null || it.left === null) return 'Sin límite';
  if (it.left <= 0) return `Agotado (0 de ${fmtNum(it.stock)})`;
  return `${it.left === 1 ? 'Queda' : 'Quedan'} ${fmtNum(it.left)} de ${fmtNum(it.stock)}`;
}
