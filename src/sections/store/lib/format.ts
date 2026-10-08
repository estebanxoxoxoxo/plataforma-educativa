// Helpers sin UI de la Tienda: formato de Energy Coin (es-AR), fechas legibles, orden de la grilla y
// las filas de la lista de deseos.
import type { MarketItem } from '../../../api/types';

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

/* Fechas legibles para un chico: "Hoy · 15:42", "Ayer · 10:05", "5 oct · 18:20" (otro año: con el año). */
const hhmm = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dayMonth = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
const full = new Intl.DateTimeFormat('es-AR', { dateStyle: 'full', timeStyle: 'short', hourCycle: 'h23' });
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function fmtWhen(ts: number, now = new Date()): string {
  const d = new Date(ts);
  const ayer = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const day = sameDay(d, now) ? 'Hoy' : sameDay(d, ayer) ? 'Ayer' : (d.getFullYear() === now.getFullYear() ? dayMonth : dayMonthYear).format(d);
  return `${day} · ${hhmm.format(d)}`;
}
/** Para el title/tooltip: "jueves, 8 de octubre de 2026, 15:42" */
export const fmtFull = (ts: number) => full.format(new Date(ts));
export const isoOf = (ts: number) => new Date(ts).toISOString();
