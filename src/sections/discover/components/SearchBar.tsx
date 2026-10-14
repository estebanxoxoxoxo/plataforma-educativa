import { useRef } from 'react';
import type { Tab } from '../../../api/types';
import { IcClose, IcSearchG } from '../../../shared/components/icons';

export function SearchBar({ value, onChange, onSubmit, placeholder = 'Buscá lo que quieras' }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <form className="sbar" onSubmit={(e) => { e.preventDefault(); ref.current?.blur(); onSubmit(); }}>
      <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label="Buscar" />
      {value && <button type="button" aria-label="Borrar" onClick={() => { onChange(''); ref.current?.focus(); }}><IcClose className="sx" /></button>}
      <span className="sdiv" />
      <button type="submit" aria-label="Buscar"><IcSearchG className="si" /></button>
    </form>
  );
}
/** Las solapas de Buscar: las de contenido (Tab de types.ts) + Personas (tanda F2: buscar chicos por su nombre de usuario;
 *  solo con Amigos prendido por la familia) + Mentores (tanda U2: clases particulares que contrata el ADULTO; el chico no
 *  la tiene). En la URL: `?tab=people` · `?tab=mentors`. */
export type SearchTab = Tab | 'people' | 'mentors';
export const SEARCH_TABS: { id: SearchTab; label: string }[] = [
  { id: 'pages', label: 'Páginas' }, { id: 'images', label: 'Imágenes' }, { id: 'videos', label: 'Videos' },
];
export const PEOPLE_TAB: { id: SearchTab; label: string } = { id: 'people', label: 'Personas' };
export const MENTORS_TAB: { id: SearchTab; label: string } = { id: 'mentors', label: 'Mentores' };
/** ¿Es una solapa de CONTENIDO (las que gastan las búsquedas moderadas)? Personas y Mentores buscan aparte. */
export const isContentTab = (t: SearchTab): t is Tab => t !== 'people' && t !== 'mentors';
