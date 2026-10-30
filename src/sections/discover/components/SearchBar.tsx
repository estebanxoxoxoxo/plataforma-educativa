import { useRef } from 'react';
import type { Tab } from '../../../api/types';
import { LnSearch, LnX } from './icons';

/** La caja de Buscar, píldora del POC (tanda BUSCARCHAT): lupa + campo + ✕ para borrar. Enter busca (sin botón aparte, como
 *  el POC; en el teléfono el teclado muestra «Buscar» por enterKeyHint). */
export function SearchBar({ value, onChange, onSubmit, placeholder = '¿Qué querés buscar?', autoFocus }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder?: string; autoFocus?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form className="sx-bar" role="search" onSubmit={(e) => { e.preventDefault(); ref.current?.blur(); onSubmit(); }}>
      <LnSearch className="sx-bar-ic" />
      <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label="Buscar"
        autoFocus={autoFocus} enterKeyHint="search" autoComplete="off" spellCheck={false} />
      {value && <button type="button" className="sx-bar-x" aria-label="Borrar" onClick={() => { onChange(''); ref.current?.focus(); }}><LnX /></button>}
    </form>
  );
}
/** Las solapas de Buscar (tanda BUSCARCHAT, pedido del dueño): «Todo» (los tres tipos en grupos de 3, como el POC) + las de
 *  contenido (Tab de types.ts) + Personas (tanda F2: buscar chicos por su nombre de usuario; solo con Amigos prendido por la
 *  familia) + Mentores (tanda U2: clases particulares que contrata el ADULTO; el chico no la tiene).
 *  En la URL: `?tab=all` (o sin tab: es la de entrada) · `?tab=videos` · `?tab=images` · `?tab=pages` · `?tab=people` ·
 *  `?tab=mentors`. La que se ve como «Artículos» sigue siendo `pages` adentro y en la URL: es el Tab del contrato de
 *  /api/search (que no cambia) y así los links viejos (?tab=pages) siguen andando. */
export type SearchTab = Tab | 'all' | 'people' | 'mentors';
export const ALL_TAB: { id: SearchTab; label: string } = { id: 'all', label: 'Todo' };
export const SEARCH_TABS: { id: SearchTab; label: string }[] = [
  { id: 'videos', label: 'Videos' }, { id: 'images', label: 'Imágenes' }, { id: 'pages', label: 'Artículos' },
];
export const PEOPLE_TAB: { id: SearchTab; label: string } = { id: 'people', label: 'Personas' };
export const MENTORS_TAB: { id: SearchTab; label: string } = { id: 'mentors', label: 'Mentores' };
/** ¿Es una solapa de CONTENIDO (las que gastan las búsquedas moderadas; «Todo» incluida)? Personas y Mentores buscan aparte. */
export const isContentTab = (t: SearchTab): t is Tab | 'all' => t !== 'people' && t !== 'mentors';
export const KNOWN_TABS: ReadonlySet<string> = new Set(['all', 'videos', 'images', 'pages', 'people', 'mentors']);
