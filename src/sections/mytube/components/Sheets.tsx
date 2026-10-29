import { useEffect, useRef, useState } from 'react';
import { IcListMusic, IcTrash } from '../../../shared/components/icons';
import { useReturnFocus, useVeil } from '../../store/lib/sheet';
import { IcMtPencil } from './MtIcons';

/** Esc cierra la hoja (los overlays del POC se cerraban tocando afuera). */
function useEsc(onClose: () => void) {
  const live = useRef(onClose);
  useEffect(() => { live.current = onClose; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); live.current(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

/** NewListModal del POC: nombre de una lista nueva («Lista nueva» / «Crear») o renombrar («Renombrar lista» / «Guardar»).
 *  Enter o el botón mandan el nombre si no está vacío; `busy` mientras el server responde. */
export function NameSheet({ title = 'Lista nueva', cta = 'Crear', initial = '', busy = false, onSubmit, onClose }: {
  title?: string; cta?: string; initial?: string; busy?: boolean; onSubmit: (name: string) => void; onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  useReturnFocus(); // al cerrar, el foco vuelve a quien la abrió (antes quedaba en <body>)
  useEsc(onClose);
  const veil = useVeil(onClose);
  const ok = !!name.trim() && !busy;
  return (
    <div className="shov mt-ov" onMouseDown={veil}>
      <div className="shcard mt-sheet" role="dialog" aria-modal="true" aria-labelledby="mt-name-t">
        <h3 className="shtitle" id="mt-name-t">{title}</h3>
        <input className="mt-input" autoFocus value={name} maxLength={60} placeholder="Nombre (ej. Para la tarde)"
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && ok) onSubmit(name); }} />
        <div className="mt-sheet-btns">
          <button type="button" className="mt-ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="mt-btn" disabled={!ok} onClick={() => { if (ok) onSubmit(name); }}>{cta}</button>
        </div>
      </div>
    </div>
  );
}

/** El menú ⋮ de una lista (ListActionSheet del POC): Renombrar o Borrar lista. */
export function ListActionSheet({ name, onRename, onDelete, onClose }: { name: string; onRename: () => void; onDelete: () => void; onClose: () => void }) {
  useReturnFocus();
  useEsc(onClose);
  const veil = useVeil(onClose);
  return (
    <div className="shov mt-ov" onMouseDown={veil}>
      <div className="shcard mt-sheet" role="dialog" aria-modal="true" aria-labelledby="mt-acts-t">
        <h3 className="mt-sheet-h" id="mt-acts-t"><IcListMusic /><span>{name}</span></h3>
        <div className="mt-sheet-list">
          <button type="button" className="mt-sheet-act" autoFocus onClick={onRename}><IcMtPencil />Renombrar</button>
          <button type="button" className="mt-sheet-act danger" onClick={onDelete}><IcTrash />Borrar lista</button>
        </div>
      </div>
    </div>
  );
}
