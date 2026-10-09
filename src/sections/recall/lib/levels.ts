import type { RecallLevel } from '../../../api/types';

/** Mismos umbrales que server/src/recall.ts: < 40 floja · 40-79 mejorando · ≥ 80 firme. (El nivel que manda el
 *  server es la verdad; esto solo sirve para pintar el "antes" de una carta: fuerza − delta.) */
export const levelOf = (strength: number): RecallLevel => (strength < 40 ? 'floja' : strength < 80 ? 'mejorando' : 'firme');
export const RANK: Record<RecallLevel, number> = { floja: 0, mejorando: 1, firme: 2 };

/** Cómo se nombra cada nivel en la UI (son "cartas": floja / mejorando / firme). */
export const LEVEL: Record<RecallLevel, { label: string; many: string; hint: string }> = {
  floja: { label: 'Floja', many: 'Flojas', hint: 'para reforzar' },
  mejorando: { label: 'Mejorando', many: 'Mejorando', hint: 'van bien' },
  firme: { label: 'Firme', many: 'Firmes', hint: 'ya las sabés' },
};

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Unos 5 minutos": una carta lleva medio minuto, más o menos. */
export const minutesFor = (cards: number) => {
  const m = Math.max(1, Math.round(cards * 0.5));
  return m === 1 ? 'Un minutito' : `Unos ${m} minutos`;
};

/** La cita es TEXTUAL (regla de oro): no se toca ni una palabra. Solo se marca con "…" cuando es un pedazo de
 *  oración: arranca en minúscula, o termina en coma / punto y coma / dos puntos (que se sacan). Una fila de tabla
 *  («Codo | Elbow») queda tal cual. */
export function presentCite(raw: string): string {
  let s = raw.trim().replace(/\s+/g, ' ');
  if (!s) return s;
  const cut = /[,;:]$/.test(s);
  if (cut) s = s.slice(0, -1).trimEnd() + '…';
  if (/^\p{Ll}/u.test(s)) s = '…' + s;
  return s;
}

/** Mensaje del resumen según cómo le fue (cálido siempre: equivocarse en un repaso es parte de aprender). */
export function finishMessage(correct: number, total: number): string {
  if (total > 0 && correct === total) return '¡Perfecto! Te acordaste de todas.';
  if (total > 0 && correct / total >= 0.6) return '¡Muy bien! Lo que estaba flojo se está poniendo firme.';
  if (correct > 0) return '¡Bien ahí por repasar! Las que costaron van a volver pronto para que las afiances.';
  return 'Las que costaron van a volver pronto: así es como se aprenden de verdad.';
}
