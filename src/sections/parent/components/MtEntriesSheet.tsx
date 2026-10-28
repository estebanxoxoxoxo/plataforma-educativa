import { useEffect, useRef, type ComponentProps } from 'react';
import { MtEntryList } from './MtEntryList';

/** El menú ⋮ de una tarjeta de Familia → MyTube (patrón global .shov/.shcard, como el ⋮ de una lista del MyTube del chico):
 *  qué entradas de la familia trajeron ese canal, con Reingestar y Eliminar. `note` = cómo terminó la última operación.
 *  Esc o tocar afuera la cierran. Pura. */
export function MtEntriesSheet({ title, note, onClose, ...list }: ComponentProps<typeof MtEntryList> & {
  title: string;
  note: { text: string; err: boolean } | null;
  onClose: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const live = useRef(onClose);
  useEffect(() => { live.current = onClose; });
  useEffect(() => {
    card.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); live.current(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div className="shov pz-mt-ov" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="shcard pz-mt-sheet" ref={card} role="dialog" aria-modal="true" aria-labelledby="pz-mt-sheet-t">
        <div className="pz-mt-sheet-head">
          <h3 className="pz-mt-sheet-t" id="pz-mt-sheet-t">{title}</h3>
          <button type="button" className="pz-link pz-link--quiet" onClick={onClose}>Cerrar</button>
        </div>
        <p className="pz-help">Lo que sumó tu familia de este canal. Reingestar actualiza nombres y descripciones; Eliminar lo saca de Innerith.</p>
        <MtEntryList {...list} />
        {note && <p className={note.err ? 'pz-form-err' : 'pz-yt-msg'} role={note.err ? 'alert' : 'status'}>{note.text}</p>}
      </div>
    </div>
  );
}
