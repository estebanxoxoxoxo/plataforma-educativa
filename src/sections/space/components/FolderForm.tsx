import { useId, useRef, useState } from 'react';
import { useReturnFocus, useSheetKeys, useVeil } from '../../store/lib/sheet';

/** Formulario de carpeta (crear o renombrar): solo el nombre — todas las carpetas se ven iguales.
 *  Teclado como las hojas de la casa (store/lib/sheet): Esc cierra (salvo mientras guarda), Tab queda adentro, el foco
 *  arranca en el nombre y, al cerrar, vuelve a quien la abrió (antes quedaba en <body>: QA-T4 H5). */
export function FolderForm({ title, initial, cta, onSubmit, onClose }: {
  title: string; initial?: { name: string }; cta: string;
  onSubmit: (v: { name: string }) => Promise<void>; onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [busy, setBusy] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useReturnFocus();
  useSheetKeys(card, 'edit', busy, onClose);
  const veil = useVeil(onClose, busy);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try { await onSubmit({ name: name.trim() }); onClose(); }
    finally { setBusy(false); }
  };

  return (
    <div className="shov show" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={veil}>
      <div className="shcard" ref={card} tabIndex={-1}>
        <h3 className="shtitle" id={titleId}>{title}</h3>
        <div className="shnew solo">
          <input autoFocus data-autofocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Nombre de la carpeta" maxLength={40} />
        </div>
        <div className="shbtns end">
          <button className="sbtn ghost" onClick={onClose}>Cancelar</button>
          <button className="sbtn" disabled={!name.trim() || busy} onClick={submit}>{cta}</button>
        </div>
      </div>
    </div>
  );
}
