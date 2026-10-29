// La semana de la LIGA DE LA FAMILIA (U5-A, docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §2-§4): la lógica PURA del cierre —orden de
// la tabla, marcas alcanzables, la copa, el total cooperativo y quién se lleva el premio del adulto— y la coherencia de los
// seeds con la racha. Sin estado y sin imports de módulos con estado (solo tipos): el ESTADO de la familia vive en
// leaguesFake.ts (regla 7 de docs/AGENTS.md: el ciclo semanal tiene UNA fuente) y progress.ts usa seedWeekDays/bestRun para
// sembrar y servir los días. Tests: server/src/__tests__/familyWeek.test.ts.
//
// Lo que este módulo garantiza (guardarraíles de la spec, §1 y §2.2):
//   · NADA negativo: las únicas marcas son 🏆 'gano' (solo el 1.º, con XP > 0 y ≥ 2 filas), ↑ 'supero' (sumó más que SU
//     semana anterior registrada) y ✨ 'siete' (aprendió algo nuevo los 7 días). No existe "último", "bajó" ni diferencias.
//   · El premio es SOLO para los chicos (kind 'child'), sin sorteo ni desempate inventado: con 'gana-la-semana' empatar es
//     ganar los dos; si la mayor XP entre los chicos es 0, nadie.
// Formas espejo de src/api/types.ts (el server no importa de src/; las de U5 se congelaron en la tanda U5-A).

export type FamilyPrizeCondition = 'supera-su-semana' | 'gana-la-semana'
export const PRIZE_CONDITIONS: readonly FamilyPrizeCondition[] = ['supera-su-semana', 'gana-la-semana']
/** El premio de la semana de la familia: un TEXTO fijo que promete el adulto (sin ⚡, sin sorteo, sin magnitud variable). */
export interface FamilyWeekPrize {
  emoji: string; title: string; desc?: string
  condition: FamilyPrizeCondition
  /** El adulto que lo prometió ("Te lo da Andrés"). */ by: { id: string; name: string }
  /** Copiado de un premio de la Tienda de un chico (informativo: no lo ata) o null = escrito en la hoja. */
  from: { member: string; itemId: number } | null
  setAt: number
}
export type FamilyWeekMark = 'gano' | 'supero' | 'siete'
export interface FamilyWeekClosedRow {
  id: string; name: string; kind: 'adult' | 'child'; xp: number
  /** días con aprendizaje nuevo esa semana (0-7) */ days: number
  marks: FamilyWeekMark[]
  /** se llevó el premio de esa semana */ prize?: true
}
/** Una semana cerrada TAL COMO SE GUARDA (sin `label`: el rótulo "la semana pasada" lo arma leaguesFake al servir, por
 *  posición en el historial). */
export interface FamilyWeekClosedRaw {
  /** 0 = la "semana pasada" del seed; cada cierre suma 1 */ week: number
  closedAt: number
  /** botón de demo (true) o lunes real / seed (false) */ simulated: boolean
  /** en el orden de la tabla al cerrar */ rows: FamilyWeekClosedRow[]
  /** "Entre todos sumaron N XP" */ total: number
  /** el premio que estaba en juego; winners [] = nadie lo ganó AL CERRAR (si sigue en juego HOY lo dice `prizeInPlay`, que
   *  leaguesFake arma al servir: el adulto puede cambiarlo o quitarlo, y un cierre posterior puede consumirlo) */
  prize: (FamilyWeekPrize & { winners: string[] }) | null
}

/** Una fila de la tabla de la semana que se cierra (la "foto"): lo que hace falta para ordenar y repartir. */
export interface FamilyWeekInputRow {
  id: string; name: string; kind: 'adult' | 'child'
  /** XP de la semana que cierra */ xp: number
  /** días con aprendizaje nuevo en esa semana (0-7) */ days: number
  /** XP de SU semana anterior registrada; null = no hay contra qué compararse (la primera semana fija la marca) */
  prevXp: number | null
  /** desempate de la tabla (U4 D2): racha, después orden del seed */ streakDays: number
  seedIdx: number
}

/** El orden de la tabla de la familia (U4 D2, sin cambios): XP de la semana desc → racha desc → orden del seed. Copia. */
export function sortFamilyRows<T extends { xp: number; streakDays: number; seedIdx: number }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => b.xp - a.xp || b.streakDays - a.streakDays || a.seedIdx - b.seedIdx)
}

/** ↑ "superó su semana": sumó MÁS que su semana anterior registrada (sin semana anterior, no hay marca; con prevXp 0
 *  —estuvo y no sumó— cualquier XP la supera). Alcanzable por todos, adulto incluido. */
export const beatsLastWeek = (r: Pick<FamilyWeekInputRow, 'xp' | 'prevXp'>): boolean => r.prevXp !== null && r.xp > r.prevXp

/** Ganadores del premio, SOLO entre los chicos de la tabla, en el orden de la tabla:
 *  · 'supera-su-semana' → cada chico que superó su semana anterior;
 *  · 'gana-la-semana'   → el o los chicos con la MAYOR XP entre los chicos (empate exacto = los dos; nada de desempatar por
 *    racha o seed: le daría el premio a alguien por un criterio que nadie eligió). Si esa XP es 0, nadie.
 *  Si gana la tabla un adulto, con 'gana-la-semana' se lo lleva el chico mejor ubicado: el adulto "empuja", no le saca el
 *  premio a sus hijos. */
export function prizeWinners(rows: readonly FamilyWeekInputRow[], condition: FamilyPrizeCondition): string[] {
  const kids = sortFamilyRows(rows).filter(r => r.kind === 'child')
  if (condition === 'supera-su-semana') return kids.filter(beatsLastWeek).map(r => r.id)
  const top = Math.max(0, ...kids.map(r => r.xp))
  return top > 0 ? kids.filter(r => r.xp === top).map(r => r.id) : []
}

/** El cierre de una semana de la familia (§2.2): ordena, reparte las marcas (la copa SOLO al 1.º, con XP > 0 y ≥ 2 filas;
 *  ↑ y ✨ alcanzables por todos), suma el total cooperativo y resuelve el premio (ganadores con `prize: true`; sin ganadores,
 *  `winners: []` = el premio sigue en juego: lo decide quien llama). Puro: `meta` trae la semana, el instante y el origen. */
export function closeFamilyWeek(
  rows: readonly FamilyWeekInputRow[],
  prize: FamilyWeekPrize | null,
  meta: { week: number; closedAt: number; simulated: boolean },
): FamilyWeekClosedRaw {
  const sorted = sortFamilyRows(rows)
  const winners = prize ? prizeWinners(sorted, prize.condition) : []
  const cup = sorted.length >= 2 && sorted[0].xp > 0 ? sorted[0].id : null
  const out: FamilyWeekClosedRow[] = sorted.map(r => {
    const marks: FamilyWeekMark[] = []
    if (r.id === cup) marks.push('gano')
    if (beatsLastWeek(r)) marks.push('supero')
    if (r.days === 7) marks.push('siete')
    return {
      id: r.id, name: r.name, kind: r.kind, xp: r.xp, days: clampDays(r.days), marks,
      ...(winners.includes(r.id) ? { prize: true as const } : {}),
    }
  })
  return {
    week: meta.week, closedAt: meta.closedAt, simulated: meta.simulated, rows: out,
    total: sorted.reduce((n, r) => n + r.xp, 0),
    prize: prize ? { ...prize, by: { ...prize.by }, from: prize.from ? { ...prize.from } : null, winners } : null,
  }
}

const clampDays = (n: number) => Math.max(0, Math.min(7, Math.round(n)))

/** El tramo de días CONSECUTIVOS más largo de un conjunto de números de día (la variante "seguidos" del reto, D2: también
 *  solo sube dentro de la semana). Repetidos y desorden, sin problema. [] → 0. */
export function bestRun(dayNums: readonly number[]): number {
  const ds = [...new Set(dayNums)].sort((a, b) => a - b)
  let best = 0, run = 0
  for (let i = 0; i < ds.length; i++) {
    run = i > 0 && ds[i] === ds[i - 1] + 1 ? run + 1 : 1
    if (run > best) best = run
  }
  return best
}

/** Días con aprendizaje de ESTA semana y de la PASADA para un seed, coherentes con su racha (§4.3). `streak` = días
 *  seguidos que terminan HOY; `dow` = día de la semana de hoy con 0 = lunes; `wantedLastWeek` = lo deseado para la pasada.
 *  · esta semana: min(streak, dow + 1) días que terminan hoy;
 *  · la pasada: spill = streak − (dow + 1) → spill ≥ 7: 7 · spill > 0: entre spill y 6 (el día anterior al arranque de la
 *    racha fue hueco) · spill = 0: como mucho 6 (el domingo fue hueco) · si no, lo deseado (0..7). */
export function seedWeekDays(streak: number, dow: number, wantedLastWeek: number): { thisWeek: number; lastWeek: number } {
  const s = Math.max(0, Math.floor(streak)), d = Math.max(0, Math.min(6, Math.floor(dow)))
  const wanted = clampDays(wantedLastWeek)
  const thisWeek = Math.min(s, d + 1)
  const spill = s - (d + 1)
  const lastWeek = spill >= 7 ? 7 : spill > 0 ? Math.max(spill, Math.min(6, wanted)) : spill === 0 ? Math.min(6, wanted) : wanted
  return { thisWeek, lastWeek }
}
