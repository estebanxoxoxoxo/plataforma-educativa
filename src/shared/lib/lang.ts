// Idioma de la UI (i18n ES/EN, pedido 9-nov): Smarty bilingüe, con el switch de la bandera al lado del nombre en la
// tarjeta del pie de la barra (ProfileCard). Singleton de módulo + useSyncExternalStore (el patrón de la casa:
// sections/parent/lib/features.ts).
// POR QUÉ L() ES UNA FUNCIÓN SUELTA Y NO UN HOOK: al cambiar el idioma, App.tsx REMONTA todo el layout (key={lang} en el
// contenedor interno, el Router queda afuera: la URL no cambia). Cada componente vuelve a montarse y re-evalúa sus L()
// leyendo la variable de módulo, así que no hace falta que cada uno se suscriba ni que cargue un contexto. El costo —se
// pierde el estado de la vista— está aceptado: cambiar de idioma es un acto excepcional. El ÚNICO suscriptor es App.tsx
// (useLang); la bandera de ProfileCard se re-dibuja con el mismo remount.
// Persistencia: localStorage['innerith.lang'] (GLOBAL del navegador; el prefijo innerith. es contrato vivo del rebrand,
// a propósito). Sin dato, con un valor raro o sin almacenamiento (modo privado, tests): 'es', la app de siempre. El
// idioma también viaja al server en cada pedido (api/index.ts: cabecera X-Smarty-Lang) para los textos que arma él.
import { useSyncExternalStore } from 'react';

export type Lang = 'es' | 'en';

const KEY = 'innerith.lang';

let lang: Lang = (() => {
  try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'es'; } catch { return 'es'; }
})();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** El idioma actual (lo lee L(), la cabecera de la API y quien necesite formatear distinto). */
export const getLang = (): Lang => lang;
/** ¿Está en inglés? (para los ternarios de estructuras: arrays de textos, formateadores de fecha). */
export const isEn = (): boolean => lang === 'en';

/** Cambia el idioma: lo guarda y avisa (App.tsx remonta el layout). Mismo idioma → no hace nada. */
export function setLang(next: Lang) {
  if (next === lang) return;
  lang = next;
  try { localStorage.setItem(KEY, next); } catch { /* sin almacenamiento: vale hasta la próxima recarga */ }
  listeners.forEach((l) => l());
}

/** El idioma como estado de React. Lo usa App.tsx para el key del remount (y la bandera, para dibujarse). */
export const useLang = (): Lang => useSyncExternalStore(subscribe, getLang, getLang);

/** El texto en el idioma ACTUAL: `L('castellano exacto', 'English')`. Sin hook a propósito (ver arriba: el remount). */
export const L = (es: string, en: string): string => (lang === 'en' ? en : es);
