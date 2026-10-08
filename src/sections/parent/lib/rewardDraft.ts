// Borrador del formulario "Publicar premio" / "Editar premio": validación espejo de la del server
// (server/src/parent.ts) para avisar antes de mandar, y el patch mínimo de una edición.
import type { NewMarketItem } from '../../../api/types';
import type { ParentItemPatch, ParentItemView } from './types';

export type Draft = { emoji: string; title: string; desc: string; price: string; stock: string };
export type DraftErrors = Partial<Record<keyof Draft, string>>;

export const EMPTY_DRAFT: Draft = { emoji: '', title: '', desc: '', price: '', stock: '' };
export const EMOJI_SUGGESTIONS = ['🎮', '🍿', '🍦', '🚲', '📚', '🎨', '🧩', '⚽', '🎬', '🍕', '🏕️', '🎁'];
export const LIMITS = { title: 60, desc: 140, price: 100_000, stock: 9_999 } as const;

const graphemes = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const KEYCAP = String.fromCodePoint(0x20e3);
const clean = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim();
const count = (s: string) => (graphemes ? [...graphemes.segment(s)].length : [...s].length);

export function draftFrom(it?: ParentItemView): Draft {
  if (!it) return { ...EMPTY_DRAFT };
  return { emoji: it.emoji, title: it.title, desc: it.desc ?? '', price: String(it.price), stock: it.stock === null ? '' : String(it.stock) };
}

/** Errores por campo (vacío = todo bien) y, si no hay errores, el premio listo para mandar. */
export function validateDraft(d: Draft): { errors: DraftErrors; value?: NewMarketItem } {
  const errors: DraftErrors = {};
  const emoji = d.emoji.trim();
  const n = count(emoji);
  if (!(n >= 1 && n <= 2 && emoji.length <= 16 && (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(emoji) || emoji.includes(KEYCAP)))) {
    errors.emoji = 'Elegí un emoji (podés tocar una de las sugerencias).';
  }
  const title = clean(d.title);
  if (title.length < 2 || title.length > LIMITS.title) errors.title = `Escribí un título de 2 a ${LIMITS.title} caracteres.`;
  const desc = clean(d.desc);
  if (desc.length > LIMITS.desc) errors.desc = `La descripción admite hasta ${LIMITS.desc} caracteres.`;
  const p = d.price.trim();
  const price = /^\d{1,9}$/.test(p) ? Number(p) : NaN;
  if (!(price >= 1 && price <= LIMITS.price)) errors.price = 'Poné un precio entero entre 1 y 100.000.';
  const s = d.stock.trim();
  const stock = s === '' ? null : /^\d{1,9}$/.test(s) ? Number(s) : NaN;
  if (stock !== null && !(stock >= 0 && stock <= LIMITS.stock)) errors.stock = 'Dejalo vacío (sin límite) o poné un número entero.';
  if (Object.keys(errors).length) return { errors };
  return { errors, value: { emoji, title, ...(desc ? { desc } : {}), price, stock } };
}

/** Solo lo que cambió (desc '' = borrarla). */
export function patchFrom(it: ParentItemView, v: NewMarketItem): ParentItemPatch {
  const patch: ParentItemPatch = {};
  if (v.emoji !== it.emoji) patch.emoji = v.emoji;
  if (v.title !== it.title) patch.title = v.title;
  if ((v.desc ?? '') !== (it.desc ?? '')) patch.desc = v.desc ?? '';
  if (v.price !== it.price) patch.price = v.price;
  if (v.stock !== it.stock) patch.stock = v.stock;
  return patch;
}
