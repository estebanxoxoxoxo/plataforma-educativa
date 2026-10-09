import { useEffect, useState } from 'react';

/** true cuando la tipografía `font` (ej. '800 14.5px Nunito') ya está cargada para `text`.
 *  Para qué: UnderlineTabs (compartido) mide el subrayado solo cuando cambia la solapa; en Ligas las solapas aparecen
 *  junto con el primer texto en Nunito 800, así que se medían con la fuente de reemplazo y el subrayado quedaba ~3px
 *  más ancho. El contenedor las re-monta (key) cuando la fuente llega: se vuelven a medir con la fuente real. */
export function useFontReady(font: string, text: string): boolean {
  const [ready, setReady] = useState(() => typeof document === 'undefined' || !document.fonts || document.fonts.check(font, text));
  useEffect(() => {
    if (ready || !document.fonts) return;
    let alive = true;
    const done = () => { if (alive) setReady(true); };
    document.fonts.load(font, text).then(done, done);
    return () => { alive = false; };
  }, [font, text, ready]);
  return ready;
}
