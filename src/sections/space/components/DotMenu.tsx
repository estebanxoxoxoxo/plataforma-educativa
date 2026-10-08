import { useEffect, useRef, useState } from 'react';
import { IcDots } from '../../../shared/components/icons';

/** Menú ⋯ chiquito por tarjeta (Renombrar / Mover / Borrar…). Se cierra al clickear afuera. */
export function DotMenu({ actions }: { actions: { label: string; danger?: boolean; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <div className="dmenu" ref={box} onClick={(e) => e.stopPropagation()}>
      <button className="dm-btn" aria-label="Más acciones" onClick={() => setOpen((o) => !o)}><IcDots /></button>
      {open && (
        <div className="dm-pop">
          {actions.map((a) => (
            <button key={a.label} className={a.danger ? 'danger' : ''} onClick={() => { setOpen(false); a.onClick(); }}>{a.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
