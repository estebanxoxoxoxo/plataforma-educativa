// Teclado y foco de las hojas de la ropa (comprar / regalar), mismo comportamiento que la hoja de canje:
// al abrir y en cada cambio de fase el foco va a lo marcado con [data-autofocus] (o a la hoja misma, mientras va al
// server); Esc cierra (salvo mientras espera al server) y Tab queda adentro de la hoja.
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/** Lo que se alcanza con Tab adentro de la hoja (de cada grupo de radios, solo el elegido —o el primero si no hay—). */
function tabbables(c: HTMLElement): HTMLElement[] {
  const els = [...c.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled)')];
  return els.filter((el) => {
    if (!(el instanceof HTMLInputElement) || el.type !== 'radio') return true;
    if (el.checked) return true;
    const group = els.filter((x): x is HTMLInputElement => x instanceof HTMLInputElement && x.type === 'radio' && x.name === el.name);
    return !group.some((x) => x.checked) && group[0] === el;
  });
}

export function useSheetKeys(card: RefObject<HTMLDivElement | null>, phase: string, busy: boolean, onClose: () => void) {
  const live = useRef({ busy, onClose });
  useLayoutEffect(() => { live.current = { busy, onClose }; });

  useEffect(() => {
    const c = card.current;
    if (c) (c.querySelector<HTMLElement>('[data-autofocus]') ?? c).focus();
  }, [card, phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = card.current;
      if (!c) return;
      if (e.key === 'Escape') { e.preventDefault(); if (!live.current.busy) live.current.onClose(); return; }
      if (e.key !== 'Tab') return;
      const els = tabbables(c);
      if (!els.length) { e.preventDefault(); c.focus(); return; }
      const first = els[0], last = els[els.length - 1], at = document.activeElement;
      const leaving = e.shiftKey ? at === first || at === c || !c.contains(at) : at === last || !c.contains(at);
      if (leaving) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [card]);
}
