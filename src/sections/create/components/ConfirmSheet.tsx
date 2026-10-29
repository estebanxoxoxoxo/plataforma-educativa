import { useEffect, useLayoutEffect, useRef } from 'react';
import { useVeil } from '../../store/lib/sheet';

/** Confirmación de /crear (patrón global .shov/.shcard): el confirm() del POC con el sistema visual de Innerith. Muestra el
 *  MISMO texto y devuelve sí/no; la acción sigue solo con "sí". Teclado: Esc = no, Tab queda adentro. En lo destructivo
 *  (borrar la ruta) el foco arranca en "Cancelar". Pura: la respuesta la resuelve el contenedor. */
export function ConfirmSheet({ text, confirmLabel = 'Aceptar', danger = false, onAnswer }: {
  text: string;
  confirmLabel?: string;
  danger?: boolean;
  onAnswer: (yes: boolean) => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const live = useRef(onAnswer);
  useLayoutEffect(() => { live.current = onAnswer; });

  useEffect(() => {
    card.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = card.current;
      if (!c) return;
      if (e.key === 'Escape') { e.preventDefault(); live.current(false); return; }
      if (e.key !== 'Tab') return;
      const els = [...c.querySelectorAll<HTMLElement>('button:not(:disabled)')];
      if (!els.length) { e.preventDefault(); c.focus(); return; }
      const first = els[0], last = els[els.length - 1], at = document.activeElement;
      const leaving = e.shiftKey ? at === first || at === c || !c.contains(at) : at === last || !c.contains(at);
      if (leaving) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const veil = useVeil(() => onAnswer(false));

  return (
    <div className="shov cr-ov" onMouseDown={veil}>
      <div className={`shcard cr-cf${danger ? ' is-danger' : ''}`} ref={card} tabIndex={-1} role="alertdialog" aria-modal="true" aria-describedby="cr-cf-t">
        <p className="cr-cf-t" id="cr-cf-t">{text}</p>
        <div className="cr-cf-btns">
          <button type="button" className="cr-btn cr-btn--ghost" data-autofocus={danger ? true : undefined} onClick={() => onAnswer(false)}>Cancelar</button>
          <button type="button" className={`cr-btn${danger ? ' cr-btn--danger' : ''}`} data-autofocus={danger ? undefined : true} onClick={() => onAnswer(true)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
