// U5-B (28-oct; docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §5.2-§5.3 y docs/USUARIOS.md §12): las REGLAS de las medallas de la
// plataforma (audio 1016: "medallas como GitHub" por logros de uso y de desempeño). PURO: sin estado ni I/O; lo único que
// importa es learnProgress.ts (también puro: "ruta completa" usa la regla del camino de Aprender sobre las partidas
// COMPLETADAS).
// Cinco reglas duras (§5.1) que este archivo respeta por construcción:
//   1. Solo las ganadas: el catálogo (MEDALS) vive acá y NO viaja nunca al cliente (medals.ts sirve solo las ganadas).
//   2. No pagan, no se compran, no destraban: ninguna regla mira ⚡ ni canjes (por eso no hay "primer regalo").
//   3. Nada se pierde: las reglas son sobre HECHOS acumulados (contadores que solo suben, máximos históricos, "≥ 1 vez");
//      ninguna premia "no fallar". Que una medalla ganada no se quite lo garantiza medals.ts (agrega, nunca saca).
//   4. Texto informativo: describe lo que hiciste, nunca a la persona; neutro en género.
//   5. Cada uno ve las suyas: `domain` marca las que dependen de un candado del chico (Amigos / Ligas apagados → se
//      ESCONDEN al servir, no se borran).
// Las medallas se DERIVAN de hechos (nunca se "entregan" a mano): `earnedFrom(facts)` dice cuáles se cumplen HOY, con su
// cantidad (las repetibles) y su fecha (si el hecho la trae).
import { routeRuns } from './learnProgress'

/* ---------- formas (espejo de src/api/types.ts: el server no importa de src/) ---------- */
export type MedalId = 'primera-posta' | 'diez-objetivos' | 'ruta-completa' | 'posta-perfecta' | 'primer-repaso' | 'primer-guardado'
  | 'ruta-creada' | 'primer-amigo' | 'tres-dias' | 'de-vuelta' | 'semana-completa' | 'mejor-semana' | 'semana-familia'
/** Una medalla GANADA, como la sirve el server (GET /api/medals, la noticia del Feed, Familia → Actividad). */
export interface EarnedMedal {
  id: MedalId; emoji: string; title: string; text: string
  /** desde cuándo (null = del seed, sin fecha) */ at: number | null
  /** solo las repetibles con 2 o más ("×3") */ times?: number
  /** todavía no la vio en "Tus medallas" */ fresh?: true
}
export type MedalDomain = 'amigos' | 'ligas'
export interface MedalDef { emoji: string; title: string; text: string; domain: MedalDomain | null; repeatable: boolean }

/** El catálogo inicial (13), con los textos LITERALES de la spec §5.2. En el orden de la tabla: es el orden de desempate de
 *  la pila (las sin fecha van al final en este orden). */
export const MEDALS: Record<MedalId, MedalDef> = {
  'primera-posta': { emoji: '🎯', title: 'Primera posta', text: 'Completaste tu primera posta en Aprender.', domain: null, repeatable: false },
  'diez-objetivos': { emoji: '🧠', title: 'Diez objetivos', text: 'Completaste 10 objetivos distintos en Aprender.', domain: null, repeatable: false },
  'ruta-completa': { emoji: '🗺️', title: 'Ruta completa', text: 'Completaste todas las postas de una ruta.', domain: null, repeatable: true },
  'posta-perfecta': { emoji: '💯', title: 'Sin un error', text: 'Resolviste una posta entera sin errores.', domain: null, repeatable: false },
  'primer-repaso': { emoji: '🔁', title: 'Primer repaso', text: 'Hiciste tu primer repaso con Active recall.', domain: null, repeatable: false },
  'primer-guardado': { emoji: '📁', title: 'Tu primer guardado', text: 'Guardaste algo en Mi espacio por primera vez.', domain: null, repeatable: false },
  'ruta-creada': { emoji: '✏️', title: 'Tu primera ruta', text: 'Armaste tu primera ruta en Crear.', domain: null, repeatable: false },
  'primer-amigo': { emoji: '🤝', title: 'Primer amigo', text: 'Sumaste tu primer amigo en Innerith.', domain: 'amigos', repeatable: false },
  'tres-dias': { emoji: '🗓️', title: 'Tres días seguidos', text: 'Aprendiste algo nuevo tres días seguidos.', domain: null, repeatable: false },
  'de-vuelta': { emoji: '🌱', title: 'De vuelta', text: 'Volviste a aprender algo nuevo después de unos días sin hacerlo.', domain: null, repeatable: false },
  'semana-completa': { emoji: '✨', title: 'Semana completa', text: 'Aprendiste algo nuevo los 7 días de una semana.', domain: null, repeatable: true },
  'mejor-semana': { emoji: '📈', title: 'Superaste tu semana', text: 'Sumaste más XP que la semana anterior.', domain: null, repeatable: true },
  'semana-familia': { emoji: '🏆', title: 'Copa de la familia', text: 'Ganaste una semana de la liga de tu familia.', domain: 'ligas', repeatable: true },
}
/** Los ids en el orden del catálogo. */
export const MEDAL_IDS = Object.keys(MEDALS) as MedalId[]

/* ---------- los hechos ---------- */
/** Los HECHOS de un usuario de los que se derivan sus medallas. Cada módulo dueño de un dato aporta su parte (medals.ts:
 *  registerMedalFacts); lo que falte vale cero / null / false. Aditivo sobre la interfaz de la spec §5.3: las fechas de los
 *  hechos que la tienen (`*At`), para que la pila diga "Desde el 23 de octubre" también tras un F5. */
export interface MedalFacts {
  // Learn (persistido: learn-results.json v2) — learnResults.ts, con learnFactsFrom (abajo)
  /** objetivos (targets) distintos con una fila `completed` que no es `rollup` */ completedTargets: number
  /** la primera de esas filas */ firstCompletedAt: number | null
  /** la fila con la que se llegó al 10.º objetivo distinto */ tenthTargetAt: number | null
  /** una fila `completed` no `rollup` con pct 1 */ perfect: boolean; perfectAt: number | null
  /** una fila `completed` con source 'active-recall' */ recall: boolean; recallAt: number | null
  /** rutas del catálogo con todas sus postas logradas con partidas COMPLETADAS (routeRuns sobre esas filas: done === total
   *  > 0) */ routesCompleted: number
  /** la fila con la que la PRIMERA de esas rutas quedó completa */ firstRouteCompletedAt: number | null
  // Catálogo (persistido: learn-routes.json, campo createdBy) — learnRoutes.ts
  routesCreated: number; firstRouteCreatedAt: number | null
  // Mi espacio (persistido: space.json v2) — space.ts (papelera incluida: lo purgado ya no existe)
  savedEver: number; firstSavedAt: number | null
  // Amigos (RAM por usuario) — friendsFake.ts
  friends: number
  // Progreso (RAM por usuario, con seed) — progress.ts
  bestStreak: number; comebacks: number; pbWeeks: number; fullWeeks: number
  // Familia (RAM de la familia) — leaguesFake.ts
  crowns: number
}
export const emptyFacts = (): MedalFacts => ({
  completedTargets: 0, firstCompletedAt: null, tenthTargetAt: null, perfect: false, perfectAt: null, recall: false, recallAt: null,
  routesCompleted: 0, firstRouteCompletedAt: null, routesCreated: 0, firstRouteCreatedAt: null, savedEver: 0, firstSavedAt: null, friends: 0,
  bestStreak: 0, comebacks: 0, pbWeeks: 0, fullWeeks: 0, crowns: 0,
})

/** Lo mínimo de una fila de resultados de Learn (ActivityResultRow de learnResults.ts). */
export interface LearnRowLike { target: string; source?: string; outcome: string; pct: number; finishedAt: number; rollup?: boolean }
/** Lo mínimo de una ruta del catálogo (la de learnProgress.routeRuns). */
type RouteLike = Parameters<typeof routeRuns>[0][number]
/** Los hechos de Learn de un usuario a partir de SUS filas y del catálogo vigente. Puro.
 *  · Cuentan las filas `completed`; las `rollup` (el agregado de un multi, que el POC marca para no contar dos veces el
 *    esfuerzo de los hijos —la misma regla que la economía—) no cuentan como objetivo, ni como primera posta, ni como
 *    perfecta; un repaso (source 'active-recall') cuenta aunque sea rollup (la spec no lo excluye).
 *  · "Ruta completa" usa la regla del camino (learnProgress.routeRuns: una posta está lograda con ≥ 1 intento, o con su
 *    umbral si lo tiene; los repasos no cuentan) pero SOLO sobre las partidas COMPLETADAS (revisión de U5): el camino del
 *    POC también da por lograda una posta abandonada o vencida (quirk 1, que queda en el camino), y «Completaste todas las
 *    postas de una ruta» con postas abandonadas no describiría lo que hiciste (regla 4 de §5.1). Su fecha: la de la fila
 *    con la que la PRIMERA ruta quedó completa. Una ruta borrada del catálogo deja de contar (borde de §5.6). */
export function learnFactsFrom(rows: readonly LearnRowLike[], routes: readonly RouteLike[]):
  Pick<MedalFacts, 'completedTargets' | 'firstCompletedAt' | 'tenthTargetAt' | 'perfect' | 'perfectAt' | 'recall' | 'recallAt' | 'routesCompleted' | 'firstRouteCompletedAt'> {
  const sorted = [...rows].sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0))
  const targets = new Set<string>()
  let firstCompletedAt: number | null = null, tenthTargetAt: number | null = null, perfectAt: number | null = null, recallAt: number | null = null
  for (const r of sorted) {
    if (r.outcome !== 'completed') continue
    if (r.source === 'active-recall' && recallAt === null) recallAt = r.finishedAt
    if (r.rollup) continue
    if (firstCompletedAt === null) firstCompletedAt = r.finishedAt
    if (r.pct >= 1 && perfectAt === null) perfectAt = r.finishedAt
    if (!targets.has(r.target)) {
      targets.add(r.target)
      if (targets.size === 10) tenthTargetAt = r.finishedAt
    }
  }
  const done = sorted.filter(r => r.outcome === 'completed')
  const complete = (rs: readonly LearnRowLike[]) => routeRuns(routes, rs).filter(r => r.total > 0 && r.done === r.total).length
  const routesCompleted = complete(done)
  // La fecha: el prefijo MÁS CORTO de esas filas (en orden de fecha) que ya completa alguna ruta. Las postas logradas solo
  // suben fila a fila (más intentos, mejor %), así que la cuenta es monótona y alcanza con una búsqueda binaria.
  let firstRouteCompletedAt: number | null = null
  if (routesCompleted > 0) {
    let lo = 1, hi = done.length
    while (lo < hi) { const mid = (lo + hi) >> 1; if (complete(done.slice(0, mid)) > 0) hi = mid; else lo = mid + 1 }
    firstRouteCompletedAt = done[lo - 1].finishedAt
  }
  return {
    completedTargets: targets.size, firstCompletedAt, tenthTargetAt,
    perfect: perfectAt !== null, perfectAt, recall: recallAt !== null, recallAt, routesCompleted, firstRouteCompletedAt,
  }
}

/* ---------- las reglas ---------- */
/** Una medalla que hoy se cumple: `times` solo en las repetibles; `at` solo si el hecho trae fecha. */
export interface MedalHit { id: MedalId; times?: number; at?: number }
type Rule = (f: MedalFacts) => { ok: boolean; times?: number; at?: number | null }
const RULES: Record<MedalId, Rule> = {
  'primera-posta': f => ({ ok: f.completedTargets >= 1, at: f.firstCompletedAt }),
  'diez-objetivos': f => ({ ok: f.completedTargets >= 10, at: f.tenthTargetAt }),
  'ruta-completa': f => ({ ok: f.routesCompleted >= 1, times: f.routesCompleted, at: f.firstRouteCompletedAt }),
  'posta-perfecta': f => ({ ok: f.perfect, at: f.perfectAt }),
  'primer-repaso': f => ({ ok: f.recall, at: f.recallAt }),
  'primer-guardado': f => ({ ok: f.savedEver >= 1, at: f.firstSavedAt }),
  'ruta-creada': f => ({ ok: f.routesCreated >= 1, at: f.firstRouteCreatedAt }),
  'primer-amigo': f => ({ ok: f.friends >= 1 }),
  // el MÁXIMO histórico de la racha, no la de hoy: una vez y para siempre (monotónica)
  'tres-dias': f => ({ ok: f.bestStreak >= 3 }),
  'de-vuelta': f => ({ ok: f.comebacks >= 1 }),
  'semana-completa': f => ({ ok: f.fullWeeks >= 1, times: f.fullWeeks }),
  'mejor-semana': f => ({ ok: f.pbWeeks >= 1, times: f.pbWeeks }),
  'semana-familia': f => ({ ok: f.crowns >= 1, times: f.crowns }),
}

/** Las medallas que HOY se cumplen con estos hechos, en el orden del catálogo, con su cantidad (solo las repetibles) y su
 *  fecha si el hecho la trae. Puro. */
export function earnedFrom(f: MedalFacts): MedalHit[] {
  const out: MedalHit[] = []
  for (const id of MEDAL_IDS) {
    const r = RULES[id](f)
    if (!r.ok) continue
    out.push({
      id,
      ...(MEDALS[id].repeatable ? { times: Math.max(1, Math.floor(r.times ?? 1)) } : {}),
      ...(typeof r.at === 'number' && Number.isFinite(r.at) ? { at: r.at } : {}),
    })
  }
  return out
}

/** Orden de la pila (§5.5b): las más nuevas primero; las sin fecha al final, en el orden del catálogo. Puro. */
export function sortMedals<T extends { id: MedalId; at: number | null }>(xs: readonly T[]): T[] {
  const idx = (id: MedalId) => MEDAL_IDS.indexOf(id)
  return [...xs].sort((a, b) => {
    if (a.at !== null && b.at !== null && a.at !== b.at) return b.at - a.at
    if (a.at === null && b.at !== null) return 1
    if (a.at !== null && b.at === null) return -1
    return idx(a.id) - idx(b.id)
  })
}
