// Formatos del panel del padre (es-AR, registro adulto): números, fechas, etiquetas y stock.
import type { DriveItem, ParentAlert, ParentFeatures } from '../../../api/types';
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
