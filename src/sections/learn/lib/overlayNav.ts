import { useEffect, useRef, useState } from 'react';

/* PILA central de overlays, sincronizada con UNA sola escucha de `popstate`.

   Problema que resuelve: antes cada overlay (lector, player, zen, resultados) registraba SU
   propio listener de `popstate`. Con dos overlays montados (resultados + detalle), un solo
   "atrás" disparaba TODOS los listeners → se cerraba todo y caías al chat. Por eso las vistas
   de resultados se forzaban a cerrar (`history.back()` + timeout) antes de abrir el detalle,
   y "Volver" del detalle nunca regresaba a los resultados.

   Solución: un único listener saca SOLO el overlay de arriba de la pila. Así el anidamiento
   resultados → detalle funciona como un stack natural:
   - abrir detalle desde el chat:        pila [detalle]            → Volver → chat
   - abrir detalle desde resultados:      pila [resultados, detalle] → Volver → resultados → Volver → chat

   Cada overlay hace UN `history.pushState` al montarse (para integrarse con el botón/gesto
   "atrás" del navegador) y se registra acá. `close()` (botón Volver / cierre programático)
   hace `history.back()`, que dispara el popstate y saca el tope. */

/* PORTE INNERITH (W3): port de smarty-poc app/src/lib/overlayNav.ts (useOverlay) para los overlays de Learn
   (ActivityOverlay, ReadingView, VideoReadingView): misma pila, mismo "Atrás" (cierra el de ARRIBA de la pila).
   Ojo, comportamiento REAL del POC (verificado en E2E; el informe 02, trampa 31, lo infirió distinto): cuando una posta
   abre directo en su fase de contenido, el ActivityOverlay devuelve el lector/video como hijo y React corre los efectos
   del hijo ANTES que los del padre → el lector se apila primero y el ActivityOverlay queda ARRIBA. Por eso "Atrás"
   durante la lectura/el video de una posta CIERRA el overlay entero (y deja la entrada del lector colgada: un "atrás"
   extra), no pasa a las preguntas; el CTA "Empezar preguntas →" sí pasa (cambia la fase directo). Se porta igual.
   Tres ajustes de integración, sin cambiar el comportamiento:
   1. la entrada que se empuja COPIA el state del historial actual (el de React Router: {usr, key, idx}) → para el router
      "atrás" desde un overlay vuelve a la MISMA ubicación (delta 0) y sus índices no se rompen;
   2. StrictMode (dev) monta/desmonta/monta los efectos: el pushState se hace UNA vez por overlay (ref), si no el dev dejaba
      dos entradas por overlay (producción no cambia: ahí el efecto corre una sola vez);
   3. el z-index arranca en 100 (no en 50 como el POC): los overlays de Learn van a pantalla completa por ENCIMA del dock de
      Mensajes (55), los popovers de la barra (70) y las hojas (80) de Innerith. */

type Entry = { close: () => void };
const stack: Entry[] = [];
let installed = false;

function onPopState() {
  const top = stack.pop();
  if (top) top.close();
}

function ensureInstalled() {
  if (installed) return;
  installed = true;
  window.addEventListener('popstate', onPopState);
}

/* close() compartido: el overlay visible es SIEMPRE el tope de la pila, así que `history.back()`
   dispara el popstate que lo saca a él. */
function closeTop() {
  history.back();
}

/* z-index monótono creciente: el overlay abierto MÁS RECIENTE siempre queda arriba, sin
   importar el orden en que se rendericen (todos comparten z, así que sin esto el orden del DOM decidía). */
let zCounter = 100;

/* Registra un overlay en la pila (pushState + entrada) y devuelve `close()` para el botón
   Volver / backdrop / cierres programáticos + el `z` a aplicar al overlay. El cierre por "atrás"
   del navegador lo maneja el listener compartido. Importante: el overlay debe cerrarse SIEMPRE
   vía el `close()` devuelto (o el "atrás" del navegador), nunca llamando a su onClose directo,
   para que la pila y el historial queden sincronizados. */
export function useOverlay(onClose: () => void): { close: () => void; z: number } {
  const [z] = useState(() => ++zCounter);
  const pushed = useRef(false);
  useEffect(() => {
    ensureInstalled();
    const entry: Entry = { close: onClose };
    if (!pushed.current) {
      pushed.current = true;
      const st = history.state && typeof history.state === 'object' ? (history.state as Record<string, unknown>) : {};
      history.pushState({ ...st, innerithOverlay: true }, '');
    }
    stack.push(entry);
    return () => {
      // Desmontaje sin pasar por "atrás" (cierre programático directo o el padre dejó de
      // renderizarlo): lo sacamos de la pila. La entrada de historial que quede colgada es
      // benigna (un "atrás" extra que cae en la misma página). NO hacemos history.back() acá: dispararía
      // el popstate y cerraría el overlay de abajo por error.
      const i = stack.indexOf(entry);
      if (i !== -1) stack.splice(i, 1);
    };
    // onClose se captura al montar (los overlays pasan `() => setState(null)`, estable).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { close: closeTop, z };
}
