// U5-C (docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §2.6, §3, §4; docs/USUARIOS.md §12): lo PURO de la liga de la familia del lado
// del cliente — los textos (marcas, copa, "Entre todos…", condición del premio vista por un chico o por el adulto, la línea
// del premio de una semana cerrada) y el borrador de la hoja del premio. Sin estado ni fetch: lo usan los componentes puros
// de leagues/ y la tarjeta del premio de la Tienda.
// Reglas de tono (guardarraíles §2.2 y §3.5): solo marcas POSITIVAS y alcanzables (↑, ✨, la copa); nada de "último",
// "perdió", "bajó" ni "te faltan N"; un premio sin ganadores "sigue en juego" (nunca "nadie lo ganó").
import type {
  FamilyCloseResult, FamilyLeague, FamilyLeagueRow, FamilyPrizeCondition, FamilyPrizeOptions, FamilyPrizeRequest, FamilyWeekClosed,
  FamilyWeekPrize,
} from '../../../api/types';
import { closeCopy } from './cycle';

const fmt = (n: number) => n.toLocaleString('es-AR');
/** "la semana pasada" → "La semana pasada" (el rótulo lo arma el server por posición). */
export const capFirst = (s: string) => (s ? s[0].toLocaleUpperCase('es-AR') + s.slice(1) : s);

/** "Ian" · "Ian y Luna" · "Ian, Luna y Andrés" */
export function namesList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/* ---------- la fila en vivo (§4.5) ---------- */
/** Días del reto, entero de 0 a 7 (un dato raro no rompe los puntitos). */
export const clampDays = (n: number | undefined): number => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(7, Math.floor(n))) : 0);
/** "5 de 7 días" (D2: el reto cuenta días de la semana, no seguidos). */
export const daysText = (n: number) => `${clampDays(n)} de 7 días`;
/** ↑ "superó su semana": SOLO cuando se logró (`prevXp != null && xp > prevXp`); mientras no, no hay nada que mostrar. */
export const beatLastWeek = (r: Pick<FamilyLeagueRow, 'xp' | 'prevXp'>): boolean => r.prevXp != null && r.xp > r.prevXp;
/** Con premio "supera su semana", el ↑ de un CHICO lleva el emoji del premio ("↑ 🚲": ya se lo ganó si nadie cierra antes;
 *  la XP de la semana no baja). El adulto juega la tabla pero el premio no es para él. */
export const upPrizeEmoji = (r: Pick<FamilyLeagueRow, 'xp' | 'prevXp' | 'prizeEligible'>, prize: FamilyWeekPrize | null | undefined): string | null =>
  prize && prize.condition === 'supera-su-semana' && r.prizeEligible && beatLastWeek(r) ? prize.emoji : null;

/* ---------- una semana cerrada (§2.6): copa, marcas, total y premio ---------- */
/** La copa de esa semana (solo el 1.º con XP > 0 y ≥ 2 filas: la marca `gano` que puso el server). */
export function cupOf(w: FamilyWeekClosed): { id: string; name: string; xp: number } | null {
  const r = w.rows.find((x) => x.marks.includes('gano'));
  return r ? { id: r.id, name: r.name, xp: r.xp } : null;
}
/** "🏆 Ganó Luna · 1.350 XP"; si nadie sumó, "Nadie sumó esa semana." (`when` = 'esta' en el aviso del cierre recién
 *  hecho). Sin copa pero con XP (una tabla de uno): null. */
export function cupLine(w: FamilyWeekClosed, when: 'esa' | 'esta' = 'esa'): string | null {
  const c = cupOf(w);
  if (c) return `🏆 Ganó ${c.name} · ${fmt(c.xp)} XP`;
  return w.total === 0 ? `Nadie sumó ${when} semana.` : null;
}
export type MarkChip = { id: string; name: string; text: string };
/** Las marcas alcanzables por TODOS (↑ superó su semana · ✨ los 7 días), una ficha por integrante que logró alguna, en el
 *  orden de la tabla al cerrar. La copa va aparte (cupLine). Quien no logró ninguna no aparece: nada negativo. */
export function marksOf(w: FamilyWeekClosed): MarkChip[] {
  return w.rows.flatMap((r) => {
    const parts = [r.marks.includes('supero') && '↑ superó su semana', r.marks.includes('siete') && '✨ los 7 días'].filter(Boolean) as string[];
    return parts.length ? [{ id: r.id, name: r.name, text: parts.join(' · ') }] : [];
  });
}
/** "Ian ↑ superó su semana · Andrés ✨ los 7 días" (una línea; '' si nadie logró ninguna). */
export const marksText = (w: FamilyWeekClosed) => marksOf(w).map((m) => `${m.name} ${m.text}`).join(' · ');
/** La línea cooperativa (G10: feedback sin premio). */
export const totalLine = (total: number) => `Entre todos sumaron ${fmt(total)} XP`;
/** La línea del premio de una semana cerrada: "🚲 1 hora de bici → para Luna (se lo da Andrés)" · sin premio, null · sin
 *  ganadores, según `prizeInPlay` (revisión de U5, lo manda el server): "🚲 1 hora de bici sigue en juego" SOLO si sigue
 *  en juego HOY y es la última semana cerrada (`latest`: history[0] o el cierre recién hecho); si no —el adulto lo cambió
 *  o lo quitó, o es una semana vieja de un premio arrastrado—, en pasado y neutro: "🚲 1 hora de bici pasó a la semana
 *  siguiente" (nunca "nadie lo ganó"). Sin el campo (server viejo): "sigue en juego", como antes. `meId` = quien mira
 *  ("para vos", "se lo das vos"). */
export function closedPrizeLine(w: FamilyWeekClosed, meId?: string, latest = true): string | null {
  const p = w.prize;
  if (!p) return null;
  if (!p.winners.length) {
    if (w.prizeInPlay === undefined || (w.prizeInPlay && latest)) return `${p.emoji} ${p.title} sigue en juego`;
    return `${p.emoji} ${p.title} pasó a la semana siguiente`;
  }
  const nameOf = (id: string) => (id === meId ? 'vos' : w.rows.find((r) => r.id === id)?.name ?? id);
  // "vos" al final ("Luna y vos"), como se dice.
  const ids = [...p.winners.filter((id) => id !== meId), ...p.winners.filter((id) => id === meId)];
  const by = p.by.id === meId ? 'se lo das vos' : `se lo da ${p.by.name}`;
  return `${p.emoji} ${p.title} → para ${namesList(ids.map(nameOf))} (${by})`;
}

/* ---------- el premio en juego (§3.2-§3.3) ---------- */
/** D1: arranca preseleccionada "para todos los que superen su semana" ("el que gane la semana" a un toque). */
export const DEFAULT_CONDITION: FamilyPrizeCondition = 'supera-su-semana';
export const CONDITIONS: { id: FamilyPrizeCondition; label: string; help: string }[] = [
  { id: 'supera-su-semana', label: 'Para todos los que superen su semana anterior', help: 'Cada chico compite contra su propia semana: lo pueden ganar todos.' },
  { id: 'gana-la-semana', label: 'Para el que gane la semana', help: 'Se lo lleva el chico que más sume (si empatan, los dos).' },
];
/** La condición en palabras: para un chico "Si superás tu semana anterior" / "Si ganás la semana"; para el adulto, la
 *  etiqueta de la hoja ("Para todos los que superen su semana anterior" / "Para el que gane la semana"). */
export function conditionText(c: FamilyPrizeCondition, audience: 'child' | 'adult'): string {
  if (audience === 'child') return c === 'supera-su-semana' ? 'Si superás tu semana anterior' : 'Si ganás la semana';
  return CONDITIONS.find((x) => x.id === c)?.label ?? '';
}
/** "Te lo da Andrés" (chico) · "Lo prometiste vos" / "Lo prometió Andrés" (adulto). */
export function prizeByText(p: FamilyWeekPrize, audience: 'child' | 'adult', meId?: string): string {
  if (audience === 'child') return `Te lo da ${p.by.name}`;
  return p.by.id === meId ? 'Lo prometiste vos' : `Lo prometió ${p.by.name}`;
}
/** ¿El premio de hoy es el mismo que quedó sin ganadores la semana pasada? ("Sigue en juego"). Con `prizeInPlay` (lo manda
 *  el server) manda ese dato; sin el campo (server viejo), la misma identidad que usa el server: sin ganadores y mismo setAt. */
export function prizeCarried(f: Pick<FamilyLeague, 'prize' | 'history'>): boolean {
  const w = f.history?.[0];
  const last = w?.prize;
  if (!f.prize || !last) return false;
  if (w.prizeInPlay !== undefined) return w.prizeInPlay;
  return last.winners.length === 0 && last.setAt === f.prize.setAt;
}
/** El premio que el adulto puede "Repetir": hoy no hay ninguno y el de la semana pasada se consumió (tuvo ganadores). */
export function repeatablePrize(f: Pick<FamilyLeague, 'prize' | 'history'>): FamilyWeekPrize | null {
  const last = f.history?.[0]?.prize;
  if (f.prize || !last || !last.winners.length) return null;
  return { emoji: last.emoji, title: last.title, ...(last.desc ? { desc: last.desc } : {}), condition: last.condition, by: last.by, from: last.from, setAt: last.setAt };
}
/** Lo prometido, en texto literal (la forma "Uno nuevo" del pedido). */
const literalRequest = (condition: FamilyPrizeCondition, p: Pick<FamilyWeekPrize, 'emoji' | 'title' | 'desc'>): FamilyPrizeRequest =>
  ({ condition, emoji: p.emoji, title: p.title, ...(p.desc ? { desc: p.desc } : {}) });
/** El pedido que re-envía ese premio TAL CUAL se prometió: SIEMPRE el texto copiado (emoji, título y descripción), aunque
 *  haya venido de la Tienda. `from` es informativo y no lo ata (types.ts): re-enviarlo hacía que el server re-copiara el
 *  ítem de HOY (otro texto si el adulto lo editó, o 400 «Ese premio ya no está…» si lo archivó). */
export function repeatRequest(p: FamilyWeekPrize): FamilyPrizeRequest {
  return literalRequest(p.condition, p);
}
/** El chip de demo del pie, en la solapa Familia, es el de la FAMILIA solo para el adulto y con ≥ 2 filas (D4). */
export const familyCloseOn = (f: Pick<FamilyLeague, 'canManage' | 'rows'> | null | undefined): boolean => !!f?.canManage && f.rows.length >= 2;
/** El premio que ve el chico activo en su Tienda: solo si está en la tabla de la familia (elegible) y hay premio. */
export function storePrizeFor(f: Pick<FamilyLeague, 'prize' | 'rows'> | null | undefined): FamilyWeekPrize | null {
  if (!f?.prize) return null;
  return f.rows.some((r) => r.me && r.prizeEligible) ? f.prize : null;
}

/* ---------- la hoja del premio: borrador (validación SOLO de forma; el motivo real lo da el 400) ---------- */
export type PrizeMode = 'tienda' | 'nuevo';
export type PrizeDraft = {
  mode: PrizeMode;
  /** el premio de la Tienda elegido (modo 'tienda') */ pick: { member: string; itemId: number } | null;
  emoji: string; title: string; desc: string;
  condition: FamilyPrizeCondition;
  /** "Cambiar" de un premio que vino de la Tienda: lo prometido (su origen y su texto literal). Mientras el elegido siga
   *  siendo ese origen, el pedido manda el TEXTO prometido, no `from` (no se re-ata al ítem de hoy). */
  kept?: { from: { member: string; itemId: number }; emoji: string; title: string; desc?: string };
};
/** Sugerencias de emoji del modo "Uno nuevo" (premios de dinámica familiar, audio 1006). */
export const PRIZE_EMOJIS = ['🚲', '🍿', '🍦', '🎮', '🎬', '🍕', '🏕️', '🎨', '⚽', '📚', '🎁'];
/** El borrador con que abre la hoja: el premio vigente ("Cambiar") o uno nuevo con la condición de D1. */
export function draftFrom(p: FamilyWeekPrize | null | undefined): PrizeDraft {
  if (!p) return { mode: 'tienda', pick: null, emoji: '', title: '', desc: '', condition: DEFAULT_CONDITION };
  return p.from
    ? { mode: 'tienda', pick: { ...p.from }, emoji: '', title: '', desc: '', condition: p.condition,
        kept: { from: { ...p.from }, emoji: p.emoji, title: p.title, ...(p.desc ? { desc: p.desc } : {}) } }
    : { mode: 'nuevo', pick: null, emoji: p.emoji, title: p.title, desc: p.desc ?? '', condition: p.condition };
}
const samePick = (a: { member: string; itemId: number } | null, b: { member: string; itemId: number } | undefined) =>
  !!a && !!b && a.member === b.member && a.itemId === b.itemId;
/** "Cambiar" un premio de la Tienda cuando llegan las opciones: si su ítem ya NO está (archivado) o su texto cambió (el
 *  adulto lo editó), la hoja pasa a "Uno nuevo" con el texto PROMETIDO (si no, quedaba sin radio marcado, o marcado con un
 *  texto que no es el que sigue en juego). Si el ítem sigue igual, o el adulto ya eligió otra cosa, no cambia nada. */
export function reconcileDraft(d: PrizeDraft, options: FamilyPrizeOptions | null | 'error'): PrizeDraft {
  if (d.mode !== 'tienda' || !d.kept || !samePick(d.pick, d.kept.from) || !options || options === 'error') return d;
  const k = d.kept;
  const it = options.groups.find((g) => g.member === k.from.member)?.items.find((i) => i.itemId === k.from.itemId);
  if (it && it.emoji === k.emoji && it.title === k.title && (it.desc ?? '') === (k.desc ?? '')) return d;
  return { ...d, mode: 'nuevo', pick: null, emoji: k.emoji, title: k.title, desc: k.desc ?? '' };
}
/** El pedido listo para mandar, o null si falta algo (para habilitar el botón). Solo forma: un premio elegido, o un emoji y un
 *  título no vacíos. Los límites (2 a 60 caracteres, ≤ 140, 1-2 emojis) los valida el SERVER y su motivo se muestra tal cual.
 *  Con "Cambiar" y el mismo premio de la Tienda elegido, va el texto prometido (sin `from`: ver `kept`). */
export function prizeRequest(d: PrizeDraft): FamilyPrizeRequest | null {
  if (d.condition !== 'supera-su-semana' && d.condition !== 'gana-la-semana') return null;
  if (d.mode === 'tienda') {
    if (!d.pick) return null;
    if (d.kept && samePick(d.pick, d.kept.from)) return literalRequest(d.condition, d.kept);
    return { condition: d.condition, from: { member: d.pick.member, itemId: d.pick.itemId } };
  }
  const emoji = d.emoji.trim(), title = d.title.trim(), desc = d.desc.trim();
  if (!emoji || !title) return null;
  return { condition: d.condition, emoji, title, ...(desc ? { desc } : {}) };
}

/* ---------- el aviso del cierre de la familia (§2.6) ---------- */
/** Lo que cuenta el aviso al adulto que apretó: título, copa, marcas, total, premio y la línea de SU liga pública (con el
 *  closeCopy de siempre: "Tu liga también cerró: saliste 9º de 12 en la Liga Chispa con 450 XP."). */
export function familyCloseCopy(r: FamilyCloseResult, meId?: string) {
  const mine = closeCopy(r.mine).result;
  return {
    title: '¡Cerró la semana de la familia!',
    cup: cupLine(r.closed, 'esta'),
    marks: marksOf(r.closed),
    total: totalLine(r.closed.total),
    prize: closedPrizeLine(r.closed, meId),
    mine: `Tu liga también cerró: ${mine.charAt(0).toLocaleLowerCase('es-AR')}${mine.slice(1)}`,
  };
}
