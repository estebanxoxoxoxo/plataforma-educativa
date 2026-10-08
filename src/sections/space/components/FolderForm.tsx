import { useState } from 'react';

/** Formulario de carpeta (crear o renombrar): solo el nombre — todas las carpetas se ven iguales. */
export function FolderForm({ title, initial, cta, onSubmit, onClose }: {
  title: string; initial?: { name: string }; cta: string;
  onSubmit: (v: { name: string }) => Promise<void>; onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try { await onSubmit({ name: name.trim() }); onClose(); }
    finally { setBusy(false); }
  };

  return (
    <div className="shov show" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="shcard">
        <h3 className="shtitle">{title}</h3>
        <div className="shnew solo">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
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
