// Lo que de una AUDITORÍA de veracidad (/crear: create.ts) puede ver un CHICO (tanda FS-BASE-A; hallazgo create.ts:211 del
// workflow base-review). La auditoría busca con Serper AMPLIO —sin la lista blanca infantil: es herramienta del editor, fiel
// al POC— y devolvía sus fuentes (título, url y resumen de CUALQUIER sitio) y el resumen del modelo tal cual; /crear vive en la
// zona del chico, así que un chico recibía links de la web abierta. Con un chico activo: las fuentes pasan la lista blanca de
// sitios (isAllowedArticleSite: la del lector) y las palabras de su política (fábrica + familia + nombres de la lista negra:
// el veto de medios del chat); si el resumen o la corrección del modelo traen una palabra bloqueada, la auditoría entera no se
// muestra (null). Lo usan la ruta de la auditoría (create.ts) y la reapertura de una ruta en /crear (learnRoutes.ts: el
// inventario guardado en `editorial` trae las auditorías que hizo el adulto, con sus fuentes de la web abierta).
import { isAllowedArticleSite, matchBlockedWord } from './filters'
import { blackTopicsAll } from './parent'

/** ¿El texto trae una palabra bloqueada de la política vigente o el nombre de un tema de la lista negra? */
export function childBlocked(text: string): boolean {
  if (!text) return false
  return matchBlockedWord(text) !== null || matchBlockedWord(text, blackTopicsAll().map(t => t.name).filter(Boolean)) !== null
}

interface SourceLike { title?: unknown; url?: unknown; snippet?: unknown }
/** Una fuente se le muestra a un chico si es de un sitio de la lista blanca y su título y resumen pasan las palabras. */
export const childSafeSource = (s: SourceLike): boolean =>
  !!s && typeof s.url === 'string' && isAllowedArticleSite(s.url) && !childBlocked(`${typeof s.title === 'string' ? s.title : ''} ${typeof s.snippet === 'string' ? s.snippet : ''}`)

/** La auditoría como la ve un chico: solo las fuentes seguras; null = no se muestra (resumen o corrección con una palabra
 *  bloqueada, o forma rota). No muta el original. */
export function auditForChild<T extends { summary?: unknown; correction?: unknown; sources?: unknown }>(a: T): T | null {
  if (!a || typeof a !== 'object') return null
  const text = `${typeof a.summary === 'string' ? a.summary : ''} ${typeof a.correction === 'string' ? a.correction : ''}`
  if (childBlocked(text)) return null
  const sources = Array.isArray(a.sources) ? (a.sources as SourceLike[]).filter(childSafeSource) : []
  return { ...a, sources }
}
