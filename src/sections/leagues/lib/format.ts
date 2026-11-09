import { isEn } from '../../../shared/lib/lang';

export const MEDAL = ['#E8A317', '#9AA3B5', '#C07A43'];
export const fmt = (n: number) => n.toLocaleString(isEn() ? 'en-US' : 'es-AR');
/** Ordinal en inglés: 1st · 2nd · 3rd · 4th · 11th · 12th · 13th · 21st. */
export const ordEn = (n: number) => {
  const t = n % 100;
  const s = t >= 11 && t <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${s}`;
};
