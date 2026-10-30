import { useSyncExternalStore } from 'react';
import type { Sec } from '../components/Sidebar';

/* El circulito de destacados del menú (pedido de Esteban, 30-oct: «toda sección que tenga menú contextual, el punto de
   menú tiene que tener un círculo con un número de cantidad de ítems destacados»). Store de módulo con
   useSyncExternalStore (patrón sections/parent/lib/features.ts), con DOS niveles:
   · el Sidebar lo SIEMBRA (seedNavHighlights) con lecturas livianas — solicitudes → Feed, próxima clase → Calendario,
     premio de la familia en juego → Tienda — para que los números estén aunque nunca se haya entrado a la sección;
   · una sección que ARMA su menú contextual lo PISA con la cuenta real (publishNavHighlight): el Feed suma su hero
     «tu siguiente paso», que el Sidebar no puede saber sin pedir el feed entero (QA de Esteban, 30-oct: decía 1 con el
     hero y una solicitud a la vista). Una clave publicada deja de aceptar siembras: la cuenta de la sección manda. */
export type NavHighlights = Partial<Record<Sec, number>>;

let snap: NavHighlights = {};
const strong = new Set<Sec>();
const listeners = new Set<() => void>();

function apply(patch: NavHighlights) {
  const keys = Object.keys(patch) as Sec[];
  if (keys.every((k) => patch[k] === snap[k])) return;
  snap = { ...snap, ...patch };
  listeners.forEach((l) => l());
}

/** La siembra del Sidebar: solo escribe claves que ninguna sección publicó todavía. */
export function seedNavHighlights(patch: NavHighlights) {
  const weak = Object.fromEntries(Object.entries(patch).filter(([k]) => !strong.has(k as Sec))) as NavHighlights;
  apply(weak);
}

/** La cuenta REAL de una sección (pisa la siembra y la bloquea de ahí en más). */
export function publishNavHighlight(sec: Sec, n: number) {
  strong.add(sec);
  apply({ [sec]: n });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useNavHighlights = (): NavHighlights => useSyncExternalStore(subscribe, () => snap);
