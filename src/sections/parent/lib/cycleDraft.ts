// Ciclo del día (tanda F2, 28-oct; docs/USUARIOS.md §11) — lo PURO del editor de Familia → Ciclo del día: el borrador de
// los rangos, agregar/sacar secciones, armar el POST y los textos de cada rango. Sin React ni API (tests en
// __tests__/cycleDraft.test.ts). LA VALIDACIÓN ES DEL SERVER: el editor manda la lista entera tal cual (también una hora
// vacía) y muestra el motivo del 400 en sus palabras («Tarde»: las horas tienen que ser HH:MM…); acá no se duplica.
import type { CycleRange, CycleSaveRequest, SectionKey } from '../../../api/types';
import { CYCLE_LIMITS, SECTION_KEYS, hhmm, parseHHMM, rangeCovers } from '../../../shared/lib/cycleRules';

/** Un rango en el editor. `key` = identidad estable para React (los nuevos todavía no tienen `id`: lo pone el server). */
export type RangeDraft = { key: string; id?: string; name: string; from: string; to: string; sections: SectionKey[] };

/** Tope de rangos por integrante (el mismo del server). */
export const MAX_RANGES = CYCLE_LIMITS.ranges;

/** Lo guardado → el borrador (copias: editar el borrador nunca toca lo guardado). */
export function toDrafts(ranges: readonly CycleRange[]): RangeDraft[] {
  return ranges.map((r) => ({ key: `id:${r.id}`, id: r.id, name: r.name, from: r.from, to: r.to, sections: [...r.sections] }));
}

/** Un rango nuevo al final: nombre "Rango N" libre; arranca donde termina el último (3 h) o, si no hay, de 08:00 a 12:00;
 *  sin secciones (el padre elige cuáles). */
export function newRange(drafts: readonly RangeDraft[]): RangeDraft {
  const names = new Set(drafts.map((d) => d.name.trim().toLowerCase()));
  let n = drafts.length + 1;
  while (names.has(`rango ${n}`)) n++;
  const keys = new Set(drafts.map((d) => d.key));
  let k = drafts.length + 1;
  while (keys.has(`new:${k}`)) k++;
  const lastTo = parseHHMM(drafts[drafts.length - 1]?.to);
  const from = lastTo ?? 8 * 60;
  const to = lastTo == null ? 12 * 60 : (lastTo + 180) % 1440;
  return { key: `new:${k}`, name: `Rango ${n}`, from: hhmm(from), to: hhmm(to), sections: [] };
}

/** Prende o apaga una sección en el rango, conservando el orden del menú. */
export function toggleSection(sections: readonly SectionKey[], key: SectionKey): SectionKey[] {
  return SECTION_KEYS.filter((k) => (k === key ? !sections.includes(k) : sections.includes(k)));
}

/** El cuerpo del POST /api/parent/cycle: la lista COMPLETA, tal cual (los nuevos sin id). */
export function toRequest(drafts: readonly RangeDraft[]): CycleSaveRequest['ranges'] {
  return drafts.map(({ id, name, from, to, sections }) => (id ? { id, name, from, to, sections: [...sections] } : { name, from, to, sections: [...sections] }));
}

/** ¿El borrador difiere de lo guardado? (un rango nuevo, uno borrado, otro orden o cualquier campo cambiado). */
export function isDirty(drafts: readonly RangeDraft[], saved: readonly CycleRange[]): boolean {
  if (drafts.length !== saved.length) return true;
  return drafts.some((d, i) => {
    const s = saved[i];
    return d.id !== s.id || d.name !== s.name || d.from !== s.from || d.to !== s.to || d.sections.join() !== s.sections.join();
  });
}

/** "de 14:00 a 18:00" · "de 21:00 a 07:00 (cruza la medianoche)" · "todo el día"; null si alguna hora no es HH:MM. */
export function spanLabel(from: string, to: string): string | null {
  const a = parseHHMM(from), b = parseHHMM(to);
  if (a == null || b == null) return null;
  if (a === b) return 'todo el día';
  return `de ${hhmm(a)} a ${hhmm(b)}${b < a ? ' (cruza la medianoche)' : ''}`;
}

/** El rótulo corto de un rango para el selector de la demo: "Tarde · 14:00–18:00" / "Noche · todo el día". */
export function rangeOptionLabel(r: Pick<CycleRange, 'name' | 'from' | 'to'>): string {
  const a = parseHHMM(r.from), b = parseHHMM(r.to);
  if (a == null || b == null) return r.name;
  return a === b ? `${r.name} · todo el día` : `${r.name} · ${hhmm(a)}–${hhmm(b)}`;
}

/** ¿El rango cubre el minuto `cur`? Solo con horas válidas (para marcar "ahora"; la regla fail-open es otra cosa). */
export function coversNow(r: Pick<CycleRange, 'from' | 'to'>, cur: number): boolean {
  return parseHHMM(r.from) != null && parseHHMM(r.to) != null && rangeCovers(r, cur);
}

/** Las secciones que no figuran en NINGÚN rango del borrador: siempre disponibles (la regla del ciclo). */
export function freeSections(drafts: readonly Pick<RangeDraft, 'sections'>[]): SectionKey[] {
  return SECTION_KEYS.filter((k) => !drafts.some((d) => d.sections.includes(k)));
}
