// Teclado y foco de las hojas de la ropa (comprar / regalar), mismo comportamiento que la hoja de canje:
// al abrir y en cada cambio de fase el foco va a lo marcado con [data-autofocus] (o a la hoja misma, mientras va al
// server); Esc cierra (salvo mientras espera al server) y Tab queda adentro de la hoja.
// Además, el PATRÓN de todas las hojas .shov de la casa: el velo (useVeil) y el foco de vuelta a quien abrió (useReturnFocus,
// con sheetOpener: quién la abrió también en Safari, que no enfoca el botón al clickearlo).
import { useCallback, useEffect, useLayoutEffect, useRef, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';

/** Los primeros ms de una hoja recién abierta en los que tocar el velo NO la cierra (el 2.º toque de un doble toque). */
const VEIL_GRACE_MS = 300;

/** El velo de una hoja (.shov): tocar AFUERA de la tarjeta la cierra. Patrón de la casa (QA-U5D H1 y H2):
 *  - cierra en el mousedown (no en el click: un arrastre que empieza adentro —seleccionar el texto de un campo— y se suelta
 *    afuera no la cierra) y SIN la acción por defecto del mousedown: el navegador ya no le saca el foco a nadie, así el
 *    foco que devuelve el cierre se queda donde lo puso (antes el mousedown lo tiraba a <body> DESPUÉS de devolverlo);
 *  - ignora el 2.º mousedown de un doble clic (`detail > 1`) y los primeros 300 ms de la hoja: el doble clic sobre lo que la
 *    abrió ya no la abre y la cierra en el mismo gesto.
 *  `blocked` = no cerrar (mientras espera al server). `open` = para las hojas que quedan montadas y se abren con una prop
 *  (FolderSheet, ListSheet): la gracia cuenta desde que se abren. Devuelve el onMouseDown del velo. */
export function useVeil(onClose: () => void, blocked = false, open = true) {
  const openedAt = useRef(0);
  useLayoutEffect(() => { if (open) openedAt.current = performance.now(); }, [open]);
  const live = useRef({ onClose, blocked });
  useLayoutEffect(() => { live.current = { onClose, blocked }; });
  return useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget || e.button !== 0) return;
    e.preventDefault();
    if (e.detail > 1 || performance.now() - openedAt.current < VEIL_GRACE_MS) return;
    if (!live.current.blocked) live.current.onClose();
  }, []);
}

/** ¿Se le puede devolver el foco? (sigue en la página, se ve —en el teléfono el cajón cerrado está oculto— y no es el body) */
const canFocus = (el: HTMLElement | null | undefined): el is HTMLElement =>
  !!el && el !== document.body && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

/* El último control que se tocó con mouse, dedo o lápiz (QA-T6 H-T6-5 y QA-U5-E): Safari/WebKit NO enfoca un botón al
   clickearlo ni al tocarlo, así que ahí document.activeElement no dice quién abrió una hoja (queda en <body>: al cerrarla
   el foco moría ahí). Se anota en CAPTURA (antes que cualquier handler, también los que abren la hoja) y se olvida con la
   primera tecla: lo que sigue es teclado, y con teclado el foco sí se mueve en todos los navegadores. */
const PRESSABLE = 'button, a[href], input, select, textarea, summary, [tabindex]';
let pressed: HTMLElement | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => {
    pressed = e.target instanceof Element ? e.target.closest<HTMLElement>(PRESSABLE) : null;
  }, true);
  document.addEventListener('keydown', () => { pressed = null; }, true);
}

/** Quién está abriendo una hoja AHORA: el que tiene el foco o, si el foco está en la nada (<body>: en Safari, abrir con
 *  mouse o toque), el último control tocado. null = no se sabe. Lo usan useReturnFocus y la hoja "Tus medallas"
 *  (ProfileCard). En Chrome/Firefox, y con teclado en todos, es el foco de siempre (no cambia nada). */
export function sheetOpener(): HTMLElement | null {
  const at = document.activeElement;
  if (at instanceof HTMLElement && at !== document.body) return at;
  return pressed?.isConnected ? pressed : null;
}

/** Quién abrió la hoja (sheetOpener), capturado EN EL RENDER al abrirse (QA-T1 H4: en StrictMode el efecto de montaje corre
 *  dos veces y su 2.ª corrida ya veía el foco adentro de la hoja y lo tomaba por quien la abrió → al cerrar, <body>). Al
 *  irse la hoja, si el foco quedó en la nada (<body>: se fue con la hoja), vuelve a quien la abrió o, si ya no está o no se
 *  ve (p. ej. el botón del cajón cerrado del teléfono), a `fallback`. Si una acción lo llevó a otro lado, no se toca.
 *  `open`: para las hojas que quedan montadas y se abren con una prop (FolderSheet, ListSheet): captura al abrirse y
 *  devuelve al cerrarse. (La captura en el render es idempotente: la doble invocación de StrictMode ve el mismo foco.) */
export function useReturnFocus(fallback?: () => HTMLElement | null | undefined, open = true): void {
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) opener.current = sheetOpener();
  wasOpen.current = open;
  const fb = useRef(fallback);
  useLayoutEffect(() => { fb.current = fallback; });
  const restore = useCallback(() => {
    const at = document.activeElement;
    if (at && at !== document.body) return;
    const to = canFocus(opener.current) ? opener.current : fb.current?.();
    if (canFocus(to)) to.focus();
  }, []);
  useEffect(() => { if (!open) restore(); }, [open, restore]);
  useEffect(() => () => restore(), [restore]);
}

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
