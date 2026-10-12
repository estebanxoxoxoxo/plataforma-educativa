// Dial de animación del Feed v6 (calmo / normal / vivo): lo fija el PADRE (Zona de padres → Protecciones) y llega en cada
// respuesta del feed (FeedResponse.motion; si falta, 'normal'). El movimiento reducido del sistema manda SIEMPRE: fuerza
// 'calmo' acá y también en el CSS (home.css). Los tokens (--m-dur/--m-travel/--m-press) viven en #v-feed[data-motion].
import { useEffect, useState } from 'react';
import type { FeedMotion } from '../../../api/types';

const QUERY = '(prefers-reduced-motion: reduce)';
const reducedNow = () => window.matchMedia?.(QUERY).matches === true;

/** ¿El sistema pide movimiento reducido? (vivo: si el chico lo cambia, el feed se entera al toque). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(reducedNow);
  useEffect(() => {
    const m = window.matchMedia?.(QUERY);
    if (!m) return;
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** El dial que rige de verdad. */
export const effectiveMotion = (m: FeedMotion | undefined, reduced: boolean): FeedMotion => (reduced ? 'calmo' : m ?? 'normal');
