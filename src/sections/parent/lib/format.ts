// Formatos del panel del padre (es-AR, registro adulto): números, fechas, etiquetas y stock.
import type { DriveItem } from '../../../api/types';
import type { ParentItemView, ParentProtections } from './types';

/** 1.240 */
export const fmtNum = (n: number) => Math.round(n).toLocaleString('es-AR');

const dayMonth = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
const hhmm = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const full = new Intl.DateTimeFormat('es-AR', { dateStyle: 'full', timeStyle: 'short', hourCycle: 'h23' });
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** "Hoy, 15:42" · "Ayer, 10:05" · "5 oct, 18:20" · "5 oct 2025, 18:20" */
export function fmtWhen(ts: number, now = new Date()): string {
  const d = new Date(ts);
  const ayer = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const day = sameDay(d, now) ? 'Hoy' : sameDay(d, ayer) ? 'Ayer' : (d.getFullYear() === now.getFullYear() ? dayMonth : dayMonthYear).format(d);
  return `${day}, ${hhmm.format(d)}`;
}
/** Para el title/tooltip: "jueves, 8 de octubre de 2026, 15:42" */
export const fmtFull = (ts: number) => full.format(new Date(ts));
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
