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
export const SEARCH_TABS: { id: Tab; label: string }[] = [
  { id: 'pages', label: 'Páginas' }, { id: 'images', label: 'Imágenes' }, { id: 'videos', label: 'Videos' },
];
