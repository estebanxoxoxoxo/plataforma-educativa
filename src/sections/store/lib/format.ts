// Helpers sin UI de la Tienda: formato de Energy Coin (es-AR), fechas legibles, orden de la grilla y
// las filas de la lista de deseos.
import type { MarketItem } from '../../../api/types';
import { wallDate, type WallDate } from '../../../shared/lib/zonedClock';

/** Saldo y precios en formato es-AR: 1.240 */
export const fmtEc = (n: number) => Math.round(n).toLocaleString('es-AR');

/** Cuánto falta para pagar `price` con `ec` (0 si alcanza). */
export const missingFor = (price: number, ec: number) => Math.max(0, price - ec);
/** Mismo texto que devuelve el server cuando rechaza un canje por saldo. */
export const faltan = (n: number) => `Te faltan ${fmtEc(n)} ⚡`;

export const isSoldOut = (it: MarketItem) => it.stock !== null && it.stock <= 0;
export const stockText = (stock: number) => (stock === 1 ? 'Queda 1' : `Quedan ${fmtEc(stock)}`);
export const sourceText = (s: MarketItem['source']) => (s === 'padre' ? 'De papá y mamá' : 'De Innerith');

/** Fondo suave del recuadro del emoji (tonos de la paleta de la app), estable por premio. */
const TINTS = ['#FFF1D6', '#E7ECFD', '#FDEBE3', '#E2F5F3', '#EFE8FE', '#FBE9F0', '#E8F6D8', '#E3F3FB'];
export const tintFor = (itemId: number) => TINTS[Math.abs(itemId - 1) % TINTS.length];

/** La grilla va SIEMPRE por precio (el server manda primero los deseados para dar la recencia de la lista). */
export const byPrice = (items: MarketItem[]) => items.slice().sort((a, b) => a.price - b.price || a.id - b.id);

/** Los premios deseados en el orden de la lista (del más reciente al más viejo). */
export function wishedItems(items: MarketItem[], order: number[]) {
  const byId = new Map(items.map((i) => [i.id, i]));
  return order.flatMap((id) => { const it = byId.get(id); return it ? [it] : []; });
}

/** Cuánto del precio ya cubre el saldo (0–100). */
export const pctOf = (ec: number, price: number) => Math.max(0, Math.min(100, Math.floor((ec / price) * 100)));

/* Fechas legibles para un chico: "Hoy · 15:42", "Ayer · 10:05", "5 oct · 18:20" (otro año: con el año). EN LA ZONA DE LA
   FAMILIA (QA-U5-E): `tz` = useCycle().tz (la de la familia o, en Automática, la del server), la misma pared que la barra
   superior; sin zona —o una que este navegador no conoce— la local, como wallClock (shared/lib/zonedClock). Antes era
   siempre la del navegador: con la familia en otra zona, un canje de las 00:30 de la familia decía «Hoy · 11:30». */
const HHMM = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;
const DAY_MONTH = { day: 'numeric', month: 'short' } as const;
const DAY_MONTH_YEAR = { day: 'numeric', month: 'short', year: 'numeric' } as const;
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
const isDay = (w: WallDate, y: number, m: number, d: number) => w.y === y && w.m === m && w.d === d;

export function fmtWhen(ts: number, now = new Date(), tz?: string | null): string {
  const d = wallDate(ts, tz), n = wallDate(now.getTime(), tz);
  const ayer = new Date(Date.UTC(n.y, n.m, n.d - 1));
  const day = isDay(d, n.y, n.m, n.d) ? 'Hoy'
    : isDay(d, ayer.getUTCFullYear(), ayer.getUTCMonth(), ayer.getUTCDate()) ? 'Ayer'
    : d.y === n.y ? inTz('dm', DAY_MONTH, tz).format(ts) : inTz('dmy', DAY_MONTH_YEAR, tz).format(ts);
  return `${day} · ${inTz('hm', HHMM, tz).format(ts)}`;
}
/** Para el title/tooltip: "jueves, 8 de octubre de 2026, 15:42" (en la pared de `tz`). */
export const fmtFull = (ts: number, tz?: string | null) => inTz('full', FULL, tz).format(ts);
export const isoOf = (ts: number) => new Date(ts).toISOString();
