// Términos de la familia (temas blancos/negros y palabras bloqueadas) del lado del panel. La validación es un ESPEJO
// de server/src/parent.ts (checkTerm/checkTerms): el server valida igual y es el que manda (si rechaza algo que acá
// pasó —p. ej. un choque con la otra lista que esta pestaña no veía—, su motivo llega en el ApiError y el panel lo
// muestra: rejectedReason de adultGate.ts); acá se avisa ANTES de mandar, sin ida y vuelta, y con las mismas palabras.
// Mismo criterio de "repetido" que el filtro de palabras: sin tildes, sin mayúsculas, espacios colapsados.

export type TermKind = 'tema' | 'palabra';
export const TERM_LIMITS = { topics: 30, words: 100, topicLen: 60, wordLen: 40 } as const;

export const termKey = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
/** Lo que se escribe en el campo: uno o varios, separados por coma, punto y coma o enter. */
export const splitTerms = (s: string) => s.split(/[,;\n]+/).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);

const TOO_COMMON = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'u', 'a', 'al', 'en', 'con', 'por', 'para', 'que', 'se', 'su', 'sus', 'lo', 'le', 'les', 'mi', 'tu', 'es', 'no', 'si', 'me', 'te', 'ya', 'muy', 'mas', 'como', 'pero', 'the', 'and', 'of', 'to']);
const TOPIC_STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'e', 'o', 'u', 'a', 'al', 'en', 'con', 'por', 'para', 'sobre', 'su', 'sus', 'lo', 'que', 'sin']);

/** null = válido; si no, el motivo (rioplatense, registro adulto). */
export function termError(t: string, kind: TermKind, kid: string): string | null {
  const max = kind === 'tema' ? TERM_LIMITS.topicLen : TERM_LIMITS.wordLen;
  if (t.length < 2 || t.length > max) return `Cada ${kind} tiene que tener entre 2 y ${max} caracteres («${t.slice(0, 50)}»).`;
  if ((t.match(/[\p{L}\p{N}]/gu) ?? []).length < 2) return `«${t}» no ${kind === 'tema' ? 'es un tema válido' : 'es una palabra válida'}: tiene que tener letras.`;
  if (kind === 'palabra' && TOO_COMMON.has(termKey(t))) return `«${t}» es demasiado común: bloquearía casi todo lo que lee ${kid}.`;
  if (kind === 'tema' && !termKey(t).split(/[^a-z0-9]+/).some((w) => w && !TOPIC_STOP.has(w))) return `«${t}» no dice de qué tema se trata.`;
  return null;
}
