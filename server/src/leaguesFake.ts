// ============================== SERVER FAKE DE LIGAS ==============================
// La asignación real de ligas (por resultados, ciclos semanales, zona y país con chicos reales) TODAVÍA NO EXISTE
// — ver docs/VISION.md §7 "Competencia". Este módulo la simula (patrón feedFake.ts) manteniendo las formas de
// src/api/types.ts, con UNA parte real: el puntaje de "Vos" es weekXp() de ./progress, el MISMO número en las
// tres tablas (liga, zona y país). Si practica y suma, sube de puesto en vivo.
// POR USUARIO desde U4 (docs/USUARIOS.md §10): cada integrante de la familia tiene SU liga pública —su ciclo, su tabla,
// sus medallas y su "Simular cierre"— con un pool de NPCs PROPIO y DISJUNTO del de los demás (leaguePools.ts; regla 7: un
// NPC tiene UN puntaje y está en UNA tabla: si Luna e Ian compartieran nicks, "Simular NPCs" de uno le cambiaría el
// puntaje al NPC en la tabla del otro). Ian = exactamente lo de siempre (Liga Cometa, 7.º, la semana pasada 🥈); Luna =
// Liga Estrella con chicos de 11-13; Andrés (el adulto, D4) = Liga Chispa con OTROS GRANDES que aprenden. El ciclo de cada
// uno es un slice de perUser() (el del usuario del pedido, por el contexto de U3): las funciones conservan su firma y
// operan sobre el del activo. Zona y país usan la MISMA fórmula y anclas para todos (son de la zona, no del chico): dos
// hermanos con la misma XP quedan en el mismo puesto de Palermo. Lo único que depende de quién mira es QUIÉN encabeza:
// los chicos ven el top de chicos de siempre y el adulto, el de GRANDES (U4-B2, 28-oct; GEO_POOLS de leaguePools.ts) — su
// puesto lo da su XP de la semana, la misma de su liga (regla 7).
// CICLO SEMANAL (VISION §7, capa 4). docs/AGENTS.md regla 7: el ciclo tiene UNA sola fuente, ESTE módulo (closesInDays,
// lastWeek/medalla, la liga asignada, quién está en tu tabla y las fechas del cierre que usa el feed).
//   - El calendario del ciclo (qué día es, cuántos faltan para el domingo, "anoche", "hace 3 días") se lee en la ZONA
//     HORARIA DE LA FAMILIA (parent.ts familyTz; null = la del server) con el helper Intl compartido
//     (src/shared/lib/zonedClock.ts), como la franja del Feed y las clases de los mentores.
//   - Semana del SEED (week 0): lunes a domingo, igual que ./progress. closesInDays es REAL (días que faltan para el fin
//     del domingo según la fecha de la familia; 0 = hoy) y lastWeek es seed (la semana pasada Ian salió 2º en la Liga
//     Cometa → plata; Luna 5.ª en la Estrella, sin medalla; Andrés 9.º en la Chispa).
//   - CIERRE SIMULADO (botón de demo "Simular cierre de semana" en Ligas → POST /api/leagues/close-week, closeWeek()): cierra
//     SOLO la liga del usuario activo (U4 A6: el cierre de toda la familia a la vez es U5).
//     1. congela la tabla ACTUAL (la XP real del activo contra sus 11 NPC) y reparte medallas al podio;
//     2. re-asigna la liga por resultados en la escalera LADDER (podio sube una, 10º-12º baja una, el resto queda; en las
//        puntas no se pasa de largo) — cada NPC también queda en la liga que le tocó (si vuelve a cruzarse con el activo,
//        está donde corresponde);
//     3. arranca la semana nueva: progress.startNewWeek() (XP semanal → 0; EC, racha y total intactos), NPCs de la liga
//        nueva con XP chicas (0-90) y closesInDays = 7 (corrimiento en RAM: cuenta los días reales desde el cierre);
//     4. el resultado pasa a ser lastWeek (estandarte de Ligas, medallita del aside, noticia de la liga del feed) y
//        feedFake.injectLeagueClose() mete arriba del feed DEL ACTIVO las noticias del cierre.
//     Varios cierres seguidos = varias semanas seguidas (lastWeek es siempre el ÚLTIMO).
//   - "Simular NPCs" (feedFake.simulateNpcs): UN compañero de tu tabla practica por ráfaga (npcPractice; otro que el de
//     la ráfaga anterior si se puede) y su XP de la semana sube DE VERDAD acá; el feed lo cuenta ("te pasó", "subió al 5º
//     puesto").
//   Todo vive en RAM: resetLeagues(userId?) vuelve al seed el ciclo de ese usuario (sin id, el de todos) — va en
//   POST /api/demo/reset, como el resto de la economía del demo.
//   El CIERRE REAL (el domingo a la noche, con chicos reales y sus amigos viendo las medallas) es del backend futuro.
// LIGA DE LA FAMILIA (U4 D2, audios 1008-1011: "podemos estar los tres… una liga donde competimos"): GET /api/leagues/family
//   → FamilyLeague = la tabla de la SEMANA EN CURSO con todos los integrantes —grandes y chicos— por su XP de la semana
//   (los ⚡ que ganó aprendiendo: el MISMO número de su liga, zona y país), con su racha y el avatar que eligió. No es una
//   liga de la escalera (no se asigna, no tiene NPCs): es un ranking, como zona y país. Un chico con Ligas apagadas por su
//   familia no aparece (y si es él quien mira, 403). Desde U5-A tiene semana con cierre, historial y premio (abajo).
//   GET  /api/leagues/mine          → AssignedLeague (pos = su XP real ordenada contra los 11 NPCs + closesInDays + lastWeek)
//   GET  /api/leagues/standing?id=  → LeagueStanding (12 filas, "Vos" = XP real)
//   GET  /api/leagues/geo?scope=zona|pais → GeoRanking (top 10 FAKE —de chicos o, al adulto, de grandes— + mi puesto por
//                                            fórmula, me.xp = XP real)
//   GET  /api/leagues/family        → FamilyLeague (la tabla de la semana de la familia)
//   POST /api/leagues/close-week    → CloseWeekResult (demo: cierre simulado de TU liga)
// LA LIGA DE LA FAMILIA COMPLETA (U5-A, 28-oct; docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §2-§4 y docs/USUARIOS.md §12): la tabla
//   de la familia pasa a tener SEMANA con estado de la FAMILIA (una vez por familia, clave users.familyKeyOf: en el seed,
//   'andres'), historial de hasta 8 semanas, la copa 🏆 del 1.º, marcas alcanzables por todos (↑ superó su semana · ✨ los 7
//   días), el premio del ADULTO (un texto fijo: sin ⚡, sin sorteo) y el reto de constancia "¿quién aprende más días?" (los
//   días de cada uno salen de progress.weekFactsOf). La lógica PURA del cierre vive en familyWeek.ts; el ESTADO, acá (regla 7).
//   · Cierre SIMULADO (botón de demo del adulto, D4): POST /api/leagues/family/close-week → foto de la tabla → premio (canje
//     "de la liga" en el slice de cada ganador: market.grantFamilyPrize) → copa → historial → cierre de las ligas PÚBLICAS de
//     TODOS los integrantes (runAsUser(id, closeWeek), también los chicos con Ligas apagadas: el lunes le corta la semana a
//     todos) → las medallas de cada integrante (U5-B: syncMedals bajo SU runAsUser; también tras cada closeWeek y al final
//     del cierre real perezoso). Después, la semana de la familia sigue el calendario corrido del demo (closesInDays 7 − días
//     reales desde el cierre) y el cierre real perezoso queda APAGADO para esa familia hasta {scope:'all'}.
//   · Cierre REAL (perezoso, familyCloseIfDue; lo dispara index.ts antes de rutear /api/leagues/*, /api/parent/activity,
//     /api/market/redemptions y /api/medals*, y el reset del activo ANTES de re-sembrarlo —demoReset.ts—): si no hubo cierre
//     simulado y el lunes de la familia ya pasó, cierra la semana que estaba abierta con el `lastWeek` que guardó el corte de
//     cada uno (progress.ts) y reparte copa y premio. Las ligas PÚBLICAS no cierran solas el lunes (backend futuro;
//     asimetría aceptada, §2.3).
//   · Seed de la familia: la "semana pasada" armada con closeFamilyWeek sobre el lastWeek SEMBRADO de cada uno
//     (progress.seedLastWeekOf; nunca el progreso vivo): Luna 1.350 · Ian 1.180 · Andrés 300 → 🏆 Luna (crowns {luna: 1}).
//   · RAM de la FAMILIA, como los avisos al padre: el reset por usuario (el F5 de un integrante) NO la toca; la vuelven al
//     seed POST /api/demo/reset {scope:'all'} (resetFamilyWeeks) y reiniciar el server.
//   GET  /api/leagues/family/prize-options → FamilyPrizeOptions (solo adulto)
//   POST /api/leagues/family/prize {FamilyPrizeRequest} → FamilyLeague (solo adulto; reemplaza al anterior)
//   POST /api/leagues/family/prize/clear   → FamilyLeague (solo adulto)
//   POST /api/leagues/family/close-week    → FamilyCloseResult {closed, mine} (solo adulto; ≥ 2 filas)
// Para conectar el backend real: reemplazar myLeague()/standing()/geoRanking()/closeWeek()/familyLeague() manteniendo las formas.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { config } from './config'
import { injectLeagueClose } from './feedFake'
import {
  PRIZE_CONDITIONS, closeFamilyWeek, sortFamilyRows,
  type FamilyPrizeCondition, type FamilyWeekClosedRaw, type FamilyWeekInputRow, type FamilyWeekPrize,
} from './familyWeek'
import { lookOf, type AvatarLook } from './identity'
import { ADULT_LEAGUE, GEO_POOLS, LEAGUE_NICKS, LUNA_LEAGUE, NICKS } from './leaguePools'
import { grantFamilyPrize } from './market'
import { ensureMedals, registerMedalFacts, syncMedals } from './medals'
import { checkPrizeFields, familyTz, featureOn, memberItemsOf } from './parent'
import { perUser } from './perUser'
import { familyWeekStart, seedLastWeekOf, startNewWeek, summaryOf, weekFactsOf, weekXp, weekXpOf } from './progress'
import { currentUser, runAsUser } from './requestContext'
import { actingUser, familyKeyOf, familyOf, userById, users, type UserInfo } from './users'
import { readJson, send } from './web'
import { wallClock, wallDate } from '../../src/shared/lib/zonedClock'

/* ---------- escalera de ligas (se ASIGNAN por resultados: nunca se eligen ni se buscan) ---------- */
export type Medal = 'oro' | 'plata' | 'bronce'
export type Movement = 'sube' | 'baja' | 'queda'
interface LeagueDef { id: string; name: string; color: string; emoji: string; /** XP típica de una semana completa de sus chicos */ pace: number }
/** De abajo hacia arriba. Cometa es la del seed de Ian; Chispa (la de JuanchiRayo y NicoRobot en Amigos, y la de Andrés)
 *  y Estrella (la de MateoDino, que subió con el oro, y la de Luna) ya existían en el mundo del demo: la escalera las respeta. */
const LADDER: readonly LeagueDef[] = [
  { id: 'lg-chispa', name: 'Liga Chispa', color: '#F26B3A', emoji: '✨', pace: 760 },
  { id: 'lg-cometa', name: 'Liga Cometa', color: '#F2A81D', emoji: '☄️', pace: 1280 },
  { id: 'lg-estrella', name: 'Liga Estrella', color: '#1C9BD6', emoji: '⭐', pace: 1750 },
  { id: 'lg-supernova', name: 'Liga Supernova', color: '#8A5CF5', emoji: '💥', pace: 2300 },
  { id: 'lg-galaxia', name: 'Liga Galaxia', color: '#3A5BD9', emoji: '🌌', pace: 2900 },
]
const TOTAL = 12

/* ---------- datos de demo (los nicks viven en leaguePools.ts: puro y con test de disjuntos) ---------- */
const COLS = ['#3A5BD9', '#13A39A', '#F26B3A', '#8A5CF5', '#E5487A', '#F2A81D', '#1C9BD6', '#18A957']
const ME_COLOR = '#FFC23D'
/** XP semanal del demo DE IAN: con esta XP queda 7.º de 12, #37 en Palermo y #4.812 en Argentina (los números de
 *  siempre). Es el ancla GLOBAL de la fórmula de zona/país (de la zona, no del chico: U4 A5). */
const DEMO_XP = 1240
/* Diferencia de cada puesto del demo con respecto a la XP de la semana del seed de cada usuario (el 0 es el lugar de
   "Vos"). Pasos irregulares para que parezca real. Los 11 NPCs del seed quedan FIJOS en demoXp + diff (escalados por el
   día de la semana, ver weekRamp). */
const LEAGUE_DIFFS = [331, 274, 203, 146, 88, 39, 0, -47, -103, -151, -198, -252]
/** Los diffs de los 11 NPCs, en el orden de su tabla del seed (sin el lugar de "Vos"). */
const NPC_DIFFS = LEAGUE_DIFFS.filter(d => d !== 0)
/* Zona y país: top del ranking, puesto de Ian con DEMO_XP y cantidad de participantes (el último puesto posible). GLOBALES:
   las MISMAS anclas para chicos y grandes; quién encabeza (los nicks del top) sale de GEO_POOLS según quién mira. */
const GEO = {
  zona: { name: 'Palermo', off: 0, top: 4980, demoPos: 37, size: 420 },
  pais: { name: 'Argentina', off: 6, top: 12650, demoPos: 4812, size: 61250 },
} as const
type Scope = keyof typeof GEO
/** U4-B2: el adulto ve el top de GRANDES de la zona y del país (leaguePools.ts); un chico —o fuera de un pedido, ian—, el
 *  de siempre (el MISMO array: su respuesta no cambia ni un byte). */
const geoNicks = (scope: Scope): readonly string[] => GEO_POOLS[scope][currentUser()?.kind ?? 'child']

/** La liga pública de cada usuario del seed (U4, docs/USUARIOS.md §10). */
interface LeagueSeed {
  /** Índice en LADDER de la liga de la semana del seed */
  tier: number
  /** La XP de la semana del seed de ese usuario (progress.ts): el ancla de los 11 NPCs de SU tabla */
  demoXp: number
  /** Cómo terminó "la semana pasada" del seed (medalla si ≤ 3) */
  lastWeekPos: number
  /** Los 11 NPCs de la tabla del seed, en el orden de LEAGUE_DIFFS sin el 0 */
  table: readonly { nick: string; color: string }[]
  /** Nicks para las semanas simuladas (weekNpcs); DISJUNTO entre usuarios (leaguePools.ts, con test) */
  pool: readonly string[]
}
const tableOf = (nicks: readonly string[]) => nicks.map((nick, i) => ({ nick, color: COLS[i % COLS.length] }))
const LEAGUE_SEEDS: Record<string, LeagueSeed> = {
  // Ian: los 11 de siempre (NICKS[i] con COLS[i % 8], i = 0..11 salvo el 6, el lugar de Ian) y su pool EN EL MISMO ORDEN:
  // sus semanas simuladas salen idénticas a las de antes de U4.
  ian: { tier: 1, demoXp: 1240, lastWeekPos: 2, table: LEAGUE_DIFFS.flatMap((d, i) => (d === 0 ? [] : [{ nick: NICKS[i % NICKS.length], color: COLS[i % COLS.length] }])), pool: LEAGUE_NICKS },
  luna: { tier: 2, demoXp: 1290, lastWeekPos: 5, table: tableOf(LUNA_LEAGUE.table), pool: LUNA_LEAGUE.pool },
  andres: { tier: 0, demoXp: 450, lastWeekPos: 9, table: tableOf(ADULT_LEAGUE.table), pool: ADULT_LEAGUE.pool },
}
// TODO usuario del seed tiene su liga: fallar fuerte al arrancar (un pool inventado al vuelo rompería la regla 7). Sumar un
// usuario al seed = sumar su LeagueSeed con un pool nuevo y disjunto en leaguePools.ts.
for (const u of users()) {
  if (!LEAGUE_SEEDS[u.id]) throw new Error(`[leagues] el usuario «${u.id}» del seed no tiene su liga (LEAGUE_SEEDS en leaguesFake.ts): sumale una con un pool de NPCs nuevo y disjunto (leaguePools.ts)`)
}
const seedOf = (uid: string): LeagueSeed => {
  const s = LEAGUE_SEEDS[uid]
  if (!s) throw new Error(`[leagues] «${uid}» no tiene liga`)
  return s
}

/** El nick de "Vos": el del usuario del pedido (fuera de un pedido, el de siempre). */
const myNick = () => currentUser()?.nick ?? (config.apodo || 'Explorador')

/* ---------- utilidades del demo (determinísticas: cada demo cuenta la misma historia) ---------- */
/** PRNG mulberry32: las semanas simuladas y las ráfagas de NPCs salen iguales en cada demo (reproducible). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
/** FNV-1a de 32 bits (semillas y colores estables por nick). */
export function hashOf(s: string): number {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}
export function shuffle<T>(xs: readonly T[], r: () => number): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
/** Color del círculo de iniciales: el del seed para los 11 de cada tabla del seed (los pools son disjuntos: un nick, un
 *  color); el resto, estable por nick. */
const SEED_COLOR = new Map(Object.values(LEAGUE_SEEDS).flatMap(s => s.table.map(t => [t.nick, t.color] as const)))
const colorOf = (nick: string) => SEED_COLOR.get(nick) ?? COLS[hashOf(nick) % COLS.length]

/* ---------- estado del ciclo (RAM, POR USUARIO) ---------- */
interface Row { pos: number; nick: string; color: string; xp: number; me?: true }
interface WeekNpc { nick: string; color: string; /** XP con la que arrancó la semana */ base: number; /** XP de su semana completa */ pace: number }
interface Closed { tier: number; pos: number; total: number; medal: Medal | null; xp: number; movement: Movement }
interface Cycle {
  /** De quién es este ciclo (su LeagueSeed: tabla, pool, ancla y semana pasada del seed) */
  uid: string
  /** 0 = la semana del seed; cada cierre simulado suma 1 */
  week: number
  /** Índice en LADDER de la liga de esta semana */
  tier: number
  /** Cuándo fue el cierre simulado que abrió esta semana (null = semana del seed: calendario real) */
  closedAt: number | null
  /** Los 11 NPC de la semana (null = los del seed: su tabla con LEAGUE_DIFFS escalados por weekRamp) */
  npcs: WeekNpc[] | null
  /** XP que sumó cada NPC esta semana con "Simular NPCs" */
  boost: Record<string, number>
  /** El último cierre simulado (null = el del seed: lastWeekPos de su LeagueSeed) */
  last: Closed | null
  /** En qué liga quedó cada NPC que pasó por las tablas de este usuario */
  homes: Record<string, number>
}
const seedCycle = (uid: string): Cycle => ({ uid, week: 0, tier: seedOf(uid).tier, closedAt: null, npcs: null, boost: {}, last: null, homes: {} })
/** Un ciclo por usuario: now() = el del usuario del pedido (fuera de un pedido, ian). */
const cycles = perUser(seedCycle)
const cy = () => cycles.now()

/** Vuelve al seed el ciclo de ese usuario; sin id, el de TODOS (lo dispara POST /api/demo/reset, como el resto de la
 *  economía del demo). */
export function resetLeagues(userId?: string): void { cycles.reset(userId) }

const leagueOf = (t = cy().tier) => LADDER[t]
const brief = (L: LeagueDef) => ({ id: L.id, name: L.name, color: L.color })

/* ---------- tiempo del ciclo (en la ZONA HORARIA DE LA FAMILIA; sin zona, la del server) ---------- */
const DAY = 864e5
/** Número de día del calendario de pared de la familia (restar dos = días de calendario entre esos instantes). */
const dayNum = (t: number) => { const w = wallDate(t, familyTz()); return Math.round(Date.UTC(w.y, w.m, w.d) / DAY) }
/** Día de la semana de pared de la familia, con 0 = lunes. */
const weekdayOf = (d = new Date()) => (wallClock(d, familyTz()).day + 6) % 7
/** Días REALES desde el cierre simulado que abrió esta semana (0 = el mismo día del cierre). */
const daysIn = (c = cy()) => (c.closedAt === null ? 0 : Math.max(0, dayNum(Date.now()) - dayNum(c.closedAt)))
/** Semana del ciclo del activo (0 = la del seed; cada cierre simulado suma 1). */
export const cycleWeek = () => cy().week

/** FAKE: cuánto de la semana ya cosecharon los demás. La XP de cada uno vuelve a 0 cada lunes (./progress), así que los
 *  NPCs y los rankings geo también arrancan bajos: lunes 25 %, martes 50 %, miércoles 75 %, de jueves a domingo 100 %
 *  (cambia solo a medianoche de la familia: dentro de un día los números de los demás son fijos). */
function weekRamp(d = new Date()): number {
  return Math.min(1, (weekdayOf(d) + 1) / 4)
}
/** Semana simulada recién arrancada: los líderes de zona/país ya juntaron un poquito (~3 % de su semana). */
const FRESH = 0.03
/** Escala de las XP de zona/país (y de la fórmula del puesto). Seed: weekRamp. Semana simulada: recién arrancada el día
 *  del cierre y después como el seed (1/4 por día real), con una variación propia de cada semana. Es lo único del ciclo
 *  del activo que mira la fórmula (la fórmula y sus anclas son globales). */
function geoScale(): number {
  const c = cy()
  if (c.closedAt === null) return weekRamp()
  const d = daysIn(c)
  return (d === 0 ? FRESH : Math.min(1, d / 4)) * (0.85 + 0.3 * rng(hashOf(`geo:${c.week}`))())
}

/* ---------- ciclo semanal: cierre, medallas y fechas ---------- */
/** Solo el podio del cierre gana medalla. */
export const medalFor = (pos: number): Medal | null => (pos === 1 ? 'oro' : pos === 2 ? 'plata' : pos === 3 ? 'bronce' : null)
export const MEDAL_EMOJI: Record<Medal, string> = { oro: '🥇', plata: '🥈', bronce: '🥉' }

/** Días que faltan para el domingo de la semana del calendario de la familia (lunes 6 … sábado 1, domingo 0). Es el
 *  cierre de la semana del seed y el de la tabla de la familia. */
const calendarClosesInDays = () => 6 - weekdayOf()
/** Días que faltan para el cierre de la liga del activo. Semana del seed: REAL (fin del domingo; domingo 0 = "¡cierra
 *  hoy!", misma semana lunes→domingo que ./progress). Semana simulada: 7 el día del cierre y uno menos por cada día real
 *  que pasa (nunca negativo). */
export function closesInDays(): number {
  const c = cy()
  if (c.closedAt === null) return calendarClosesInDays()
  return Math.max(0, 7 - daysIn(c))
}
/** El "cierra …" de la liga (tooltip del chip y noticia del feed). */
const closesText = (n: number) => (cy().closedAt === null ? 'el domingo' : n <= 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`)

/** "recién", "hace 5 min", "hace 2 h", "ayer", "hace 3 días" (hora real; los días, en el calendario de la familia). */
export function sinceLabel(at: number, now = Date.now()): string {
  const min = Math.floor((now - at) / 60000)
  if (min < 1) return 'recién'
  const days = dayNum(now) - dayNum(at)
  if (days <= 0) return min < 60 ? `hace ${min} min` : `hace ${Math.floor(min / 60)} h`
  return days === 1 ? 'ayer' : `hace ${days} días`
}
/** Lo que pasó hace `n` semanas del ciclo (cada cierre simulado es una semana). */
export const weeksAgoLabel = (n: number) => (n <= 1 ? 'la semana pasada' : `hace ${n} semanas`)

/** Cuándo fue el último cierre del activo, para fechar lo que reparte (medallas, ascensos). Semana del seed: el lunes fue
 *  "anoche"; el domingo, el de hoy todavía no pasó y el último es el de la semana anterior (días de la familia). Semana
 *  simulada: desde el cierre. */
export function lastCloseLabel(): string {
  const c = cy()
  if (c.closedAt !== null) return sinceLabel(c.closedAt)
  const dow = weekdayOf()
  return dow === 0 ? 'anoche' : dow === 6 ? 'el domingo pasado' : 'el domingo'
}

/** Cómo terminó el activo el último cierre: el del seed (FAKE: su lastWeekPos; con el backend real sale de la tabla
 *  congelada de ese cierre) o el del ÚLTIMO cierre simulado. */
export function lastWeek(): { pos: number; medal: Medal | null } | null {
  const c = cy(), l = c.last
  if (l) return { pos: l.pos, medal: l.medal }
  const pos = seedOf(c.uid).lastWeekPos
  return { pos, medal: medalFor(pos) }
}
/** El último cierre SIMULADO del activo con su liga (que puede no ser la de ahora): lo cuenta la noticia de la liga del
 *  feed. null = semana del seed. */
export function lastClose(): { from: string; pos: number; medal: Medal | null; movement: Movement; top: boolean } | null {
  const l = cy().last
  return l ? { from: LADDER[l.tier].name, pos: l.pos, medal: l.medal, movement: l.movement, top: l.tier === LADDER.length - 1 } : null
}

/** Re-asignación por resultados: el podio sube una liga, 10º-12º baja una, el resto queda. En las puntas de la
 *  escalera no se pasa de largo (el podio de la más alta y el fondo de la más baja se quedan). */
function moveOf(tier: number, pos: number): { movement: Movement; next: number } {
  if (pos <= 3 && tier < LADDER.length - 1) return { movement: 'sube', next: tier + 1 }
  if (pos >= TOTAL - 2 && tier > 0) return { movement: 'baja', next: tier - 1 }
  return { movement: 'queda', next: tier }
}

/* ---------- mi liga ---------- */
function npcRows(c = cy()): Omit<Row, 'pos'>[] {
  const extra = (nick: string) => c.boost[nick] ?? 0
  if (!c.npcs) {
    const r = weekRamp(), s = seedOf(c.uid)
    // Los 11 chicos (o grandes) de la tabla del seed de ese usuario, cada uno con su diff (el lugar de "Vos" no es un NPC).
    return s.table.map((t, k) => ({ nick: t.nick, color: t.color, xp: Math.round((s.demoXp + NPC_DIFFS[k]) * r) + extra(t.nick) }))
  }
  // Semana simulada: el día del cierre, la XP de arranque; después, lo que lleva cada uno de su semana (1/4 por día).
  const d = daysIn(c)
  return c.npcs.map(n => ({ nick: n.nick, color: n.color, xp: (d === 0 ? n.base : Math.max(n.base, Math.round(n.pace * Math.min(1, d / 4)))) + extra(n.nick) }))
}
function standing(): Row[] {
  const me = { nick: myNick(), color: ME_COLOR, xp: weekXp(), me: true as const }
  // Empate: el NPC queda arriba (para pasarlo hay que superarlo).
  return [...npcRows(), me].sort((a, b) => b.xp - a.xp || ('me' in a ? 1 : 0) - ('me' in b ? 1 : 0)).map((x, i) => ({ pos: i + 1, ...x }))
}
export function myLeague() {
  const L = leagueOf(), n = closesInDays()
  const pos = standing().findIndex(r => r.me) + 1
  return { id: L.id, name: L.name, color: L.color, pos, total: TOTAL, closes: closesText(n), xp: weekXp(), closesInDays: n, lastWeek: lastWeek() }
}

/* ---------- zona y país ---------- */
/** FAKE: puesto por fórmula monotónica (más XP ⇒ mejor puesto). Potencia que pasa por dos anclas:
 *  con DEMO_XP (escalada por geoScale) da el puesto del demo (#37 Palermo / #4.812 Argentina) y con la XP del 10.º del
 *  top da #11. Nunca entra al top 10 (la tabla muestra a esos 10 aparte) ni pasa del último puesto (size).
 *  Ej. con 1.240 XP: #37 / #4.812; con 1.300: #35 / #4.093; con 1.600: #26 / #2.011. La MISMA para todos los usuarios. */
function geoPos(scope: Scope, xp: number): number {
  const G = GEO[scope], s = geoScale()
  if (xp <= 0) return G.size
  const x0 = DEMO_XP * s, tenth = G.top * s * (1 - 9 * 0.045)
  const k = Math.log((G.demoPos - 1) / 10) / Math.log(tenth / x0)
  const pos = 1 + (G.demoPos - 1) * Math.pow(x0 / xp, k)
  return Math.min(G.size, Math.max(11, Math.round(pos)))
}
export function geoRanking(scope: Scope) {
  const G = GEO[scope], s = geoScale(), xp = weekXp(), nicks = geoNicks(scope)
  const rot = 5 * cy().week // cada semana lidera otra gente
  return {
    scope, name: G.name,
    top: Array.from({ length: 10 }, (_, i) => ({ nick: nicks[(i + rot) % nicks.length], color: COLS[(i + G.off + rot) % COLS.length], xp: Math.round(G.top * (1 - i * 0.045) * s) })),
    me: { nick: myNick(), pos: geoPos(scope, xp), xp },
  }
}

/* ---------- cierre de semana (demo) ---------- */
/** XP de arranque de una semana nueva: chicas y variadas (0-90). Uno o dos todavía no arrancaron; nadie repite número. */
function startXps(r: () => number): number[] {
  const xs = r() < 0.5 ? [0] : [0, 0]
  while (xs.length < TOTAL - 1) { const v = 5 + Math.floor(r() * 86); if (!xs.includes(v)) xs.push(v) }
  return xs.sort((a, b) => b - a)
}
/** Los 11 de la semana nueva en la liga `tier`, sacados del POOL de ese usuario: los que hicieron el MISMO movimiento que
 *  él siguen en su tabla (caras conocidas, hasta 5) y el resto llega de otras tablas — nuevos o que ya están en esta liga,
 *  nunca uno que quedó en otra. Anota en `homes` dónde queda cada uno. */
function weekNpcs(week: number, tier: number, prev: Row[], homes: Record<string, number>, pool: readonly string[]): WeekNpc[] {
  const r = rng(hashOf(`liga:${week}:${tier}`))
  const carry = shuffle(prev.filter(x => !x.me && homes[x.nick] === tier), r).slice(0, 5).map(x => ({ nick: x.nick, color: x.color }))
  const taken = new Set(prev.map(x => x.nick)) // los de la tabla que cerró y no siguen: en otras tablas
  const fits = (n: string) => !taken.has(n) && (homes[n] === undefined || homes[n] === tier)
  const fill = [
    ...shuffle(pool.filter(n => fits(n) && homes[n] === undefined), r),
    ...shuffle(pool.filter(n => fits(n) && homes[n] === tier), r),
  ].slice(0, TOTAL - 1 - carry.length)
  // Si algún día se agotara el pool (muchísimos cierres), antes que una tabla corta: chicos de otras tablas.
  if (carry.length + fill.length < TOTAL - 1) {
    fill.push(...shuffle(pool.filter(n => !fill.includes(n) && !carry.some(c => c.nick === n)), r).slice(0, TOTAL - 1 - carry.length - fill.length))
  }
  const people = shuffle([...carry, ...fill.map(nick => ({ nick, color: colorOf(nick) }))], r)
  const bases = startXps(r)
  const L = LADDER[tier]
  return people.map((p, i) => {
    homes[p.nick] = tier
    return { ...p, base: bases[i], pace: Math.round(L.pace * (0.72 + r() * 0.56)) }
  })
}

/** Lo que el cierre le pasa al feed (feedFake.injectLeagueClose) para contarlo. */
export interface CloseNews {
  /** La semana que arranca (1 = la primera después del seed) */
  week: number
  me: { nick: string; color: string; pos: number; medal: Medal | null }
  from: { name: string; emoji: string }
  to: { name: string; emoji: string }
  movement: Movement
  /** El podio SIN "Vos", en orden. `up` = la liga a la que suben (null en la más alta); `withMe` = suben con vos. */
  podium: { nick: string; color: string; pos: number; medal: Medal; up: { name: string; emoji: string } | null; withMe: boolean }[]
}

/** Cierre SIMULADO de la semana de la liga DEL ACTIVO (botón de demo en Ligas; U4 A6: no toca las ligas de los demás).
 *  Forma de CloseWeekResult (src/api/types.ts). */
export function closeWeek() {
  const c = cy()
  // U5-B: el slice de medallas del activo existe ANTES del corte (si naciera después, su "Superaste tu semana" de este
  // corte entraría al seed como "ya vista" y no llegaría como medalla nueva).
  ensureMedals(c.uid)
  const rows = standing() // la tabla ACTUAL, congelada: de acá sale todo
  const me = rows.find(r => r.me)!
  const from = c.tier
  const { movement, next } = moveOf(from, me.pos)
  const medal = medalFor(me.pos)
  const homes = { ...c.homes }
  for (const r of rows) if (!r.me) homes[r.nick] = moveOf(from, r.pos).next
  const label = (L: LeagueDef) => ({ name: L.name, emoji: L.emoji })
  const podium = rows.filter(r => !r.me && r.pos <= 3).map(r => {
    const up = moveOf(from, r.pos).movement === 'sube'
    return { nick: r.nick, color: r.color, pos: r.pos, medal: medalFor(r.pos)!, up: up ? label(LADDER[from + 1]) : null, withMe: up && movement === 'sube' }
  })
  const week = c.week + 1
  Object.assign(c, {
    week, tier: next, closedAt: Date.now(), boost: {}, homes,
    npcs: weekNpcs(week, next, rows, homes, seedOf(c.uid).pool),
    last: { tier: from, pos: me.pos, total: rows.length, medal, xp: me.xp, movement },
  } satisfies Omit<Cycle, 'uid'>)
  startNewWeek() // XP semanal del activo → 0: la que compite es la de la semana; la EC, la racha y el total NO se tocan
  const feedAdded = injectLeagueClose({ week, me: { nick: me.nick, color: me.color, pos: me.pos, medal }, from: label(LADDER[from]), to: label(LADDER[next]), movement, podium })
  // U5-B: el corte movió los hechos de las medallas (pbWeeks/fullWeeks de progress.ts): las nuevas y su noticia, en el feed
  // del activo (este cierre corre con él como contexto: el suyo o el runAsUser del cierre de la familia). La noticia de
  // medalla no entra en `feedAdded` (ese número es el de las noticias del cierre de liga, contrato CloseWeekResult).
  const medalsNew = syncMedals(c.uid)
  console.log(`[leagues] cierre simulado de ${c.uid} → semana ${week}: ${me.nick} ${me.pos}º de ${rows.length} en la ${LADDER[from].name} con ${me.xp} XP (${medal ?? 'sin medalla'}) · ${movement} → ${LADDER[next].name} · feed +${feedAdded}${medalsNew.length ? ` · medallas nuevas: ${medalsNew.map(m => m.id).join(', ')}` : ''}`)
  return {
    closed: { league: brief(LADDER[from]), pos: me.pos, total: rows.length, medal, xp: me.xp },
    next: { league: brief(LADDER[next]), movement, closesInDays: closesInDays() },
    feedAdded,
  }
}

/* ---------- "Simular NPCs": los compañeros de tu tabla también practican ---------- */
export interface NpcRace { nick: string; color: string; gain: number; from: number; to: number; passedMe: boolean; league: string }
/** `count` compañeros de la tabla del activo practican un rato: su XP de la semana sube DE VERDAD (la misma tabla que se
 *  ve en Ligas). Como mucho uno por ráfaga, y a veces, es el que viene justo atrás de "Vos" y lo pasa ("estoy a dos pasos
 *  de mengano", audio 24). Devuelve qué pasó, para que el feed lo cuente. `avoid` (tanda "Feed diverso", 28-oct): nicks
 *  que se prefiere NO repetir (los de la ráfaga anterior: entre ráfagas seguidas cambia el protagonista); si no queda
 *  otro, se usan igual. */
export function npcPractice(r: () => number, count: number, avoid: ReadonlySet<string> = new Set()): NpcRace[] {
  const c = cy()
  const out: NpcRace[] = []
  let chased = false
  for (let k = 0; k < count; k++) {
    const rows = standing(), me = rows.find(x => x.me)!
    const all = rows.filter(x => !x.me && !out.some(o => o.nick === x.nick))
    const fresh = all.filter(x => !avoid.has(x.nick))
    const free = fresh.length ? fresh : all
    if (!free.length) break
    const behind = free.find(x => x.pos === me.pos + 1)
    let who: Row, gain: number
    if (!chased && behind && me.xp - behind.xp <= 70 && r() < 0.5) {
      chased = true
      who = behind
      gain = me.xp - behind.xp + 3 + Math.floor(r() * 20)
    } else {
      who = free[Math.floor(r() * free.length)]
      gain = 15 + Math.floor(r() * 46) // unos ejercicios: 15-60 XP
    }
    c.boost[who.nick] = (c.boost[who.nick] ?? 0) + gain
    const after = standing()
    const to = after.find(x => !x.me && x.nick === who.nick)!.pos
    out.push({ nick: who.nick, color: who.color, gain, from: who.pos, to, passedMe: who.pos > me.pos && to < after.find(x => x.me)!.pos, league: leagueOf().name })
  }
  return out
}

/* ---------- liga de la familia (U4 D2 + U5-A; forma de FamilyLeague en src/api/types.ts) ---------- */
export interface FamilyLeagueRow {
  pos: number; id: string; name: string; nick: string; kind: 'adult' | 'child'
  /** XP de la semana = los ⚡ que ganó aprendiendo esta semana (1:1); el MISMO número de su liga, zona y país. */
  xp: number
  /** U4 (compat: la fila de U5 ya no la pinta; sigue en el Feed y acá) */ streakDays: number
  /** El avatar ELEGIDO (identity.json v2); null = iniciales. */
  look: AvatarLook
  me?: boolean
  /** U5: días con aprendizaje nuevo en la semana abierta (0-7; el reto "N de 7 días") */ days: number
  /** U5: el tramo de días seguidos más largo dentro de la semana (la variante D2 "seguidos") */ bestRun: number
  /** U5: XP de SU semana anterior registrada (null = no hay): el ↑ es `prevXp !== null && xp > prevXp` */ prevXp: number | null
  /** U5: ganó la copa de la semana pasada (history[0]) */ wonLastWeek?: true
  /** U5: es un CHICO de la tabla: puede llevarse el premio de la semana (lo haya o no; el adulto juega pero no lo cobra) */
  prizeEligible?: true
}
/** U5: una semana cerrada como se SIRVE: la guardada + su rótulo por posición ("la semana pasada", "hace 2 semanas") +
 *  (revisión de U5) si su premio SIGUE en juego hoy: `prize.winners: []` solo dice que nadie lo ganó AL CERRAR. */
export type FamilyWeekClosed = FamilyWeekClosedRaw & { label: string; prizeInPlay: boolean }
export interface FamilyLeague {
  closesInDays: number; rows: FamilyLeagueRow[]
  /** U5 */ prize: FamilyWeekPrize | null
  /** U5: el más nuevo primero, ≤ 8 */ history: FamilyWeekClosed[]
  /** U5: el que mira es adulto (pone el premio y simula el cierre de la familia) */ canManage: boolean
  /** U5: 0 = la semana del seed; cada cierre de la familia suma 1 (= history[0].week) */ week: number
}

/** El estado de la semana de la familia (RAM de la FAMILIA, una vez por familia; §2.1). */
interface FamilyWeekState {
  /** familyKeyOf (el primer adulto guardián; en el seed, 'andres') */ key: string
  /** número de día (de la familia) del LUNES de la semana ABIERTA */ weekStart: number
  /** 0 = la del seed; cada cierre suma 1 (= history[0].week) */ week: number
  /** el último cierre SIMULADO (null = calendario real: el perezoso del lunes está prendido) */ closedAt: number | null
  prize: FamilyWeekPrize | null
  /** el más nuevo primero, tope HISTORY_CAP */ history: FamilyWeekClosedRaw[]
  /** copas ganadas por integrante: contador MONOTÓNICO (no se recorta con el tope del historial; el hecho de la medalla
   *  `semana-familia` de U5-B) */ crowns: Record<string, number>
}
const HISTORY_CAP = 8
const families = new Map<string, FamilyWeekState>()

/** El LUNES (número de día de la familia) de la semana de hoy: el MISMO corte de la XP (progress.familyWeekStart). */
const familyThisWeek = () => familyWeekStart(Date.now(), familyTz())
/** El instante del lunes 00:00 de la familia de la semana en curso (para fechar un cierre real o el seed; un cambio de
 *  horario en el medio corre como mucho una hora: no importa para "cerró el 26 oct"). */
function familyMondayAt(now = Date.now()): number {
  const c = wallClock(new Date(now), familyTz())
  return now - ((((c.day + 6) % 7) * 1440 + c.minutes) * 60_000) - (now % 60_000)
}

/** Los integrantes de la TABLA de la familia de `viewerId` (con su índice del seed para el desempate): todos los de
 *  familyOf menos los CHICOS con Ligas apagadas (si la familia no quiere que compita, no aparece en ninguna tabla; los
 *  adultos siempre aparecen: los candados son de los dependientes). */
function familyTable(viewerId: string): { u: UserInfo; seedIdx: number }[] {
  return familyOf(viewerId).map((u, seedIdx) => ({ u, seedIdx })).filter(({ u }) => u.kind === 'adult' || featureOn('ligas', u.id))
}

/** El seed de la familia (§2.6): la "semana pasada" sale de closeFamilyWeek sobre el lastWeek SEMBRADO de cada integrante
 *  (progress.seedLastWeekOf: puro sobre los seeds, NUNCA el progreso vivo). La semana anterior a ésa no existe (prevXp null:
 *  ningún ↑ inventado). Entran todos los de la familia: es historia de la familia (en el seed todos jugaban). */
function seedFamily(key: string): FamilyWeekState {
  const members = familyOf(key)
  // Los slices de progreso nacen perezosos: que nazcan YA, en la semana de la familia (si uno naciera después de un lunes,
  // su semana empezaría en otra y el cierre real perezoso lo tomaría con 0).
  for (const u of members) weekXpOf(u.id)
  const rows: FamilyWeekInputRow[] = members.map((u, seedIdx) => {
    const lw = seedLastWeekOf(u.id)
    return { id: u.id, name: u.name, kind: u.kind, xp: lw?.xp ?? 0, days: lw?.days ?? 0, prevXp: null, streakDays: 0, seedIdx }
  })
  const closed = closeFamilyWeek(rows, null, { week: 0, closedAt: familyMondayAt(), simulated: false })
  const crowns: Record<string, number> = {}
  const cup = closed.rows.find(r => r.marks.includes('gano'))
  if (cup) crowns[cup.id] = 1
  return { key, weekStart: familyThisWeek(), week: 0, closedAt: null, prize: null, history: [closed], crowns }
}
/** El estado de la familia de un usuario (nace con su seed la primera vez que alguien de la familia lo pide). */
function familyState(userId: string): FamilyWeekState {
  const key = familyKeyOf(userId)
  let s = families.get(key)
  if (!s) { s = seedFamily(key); families.set(key, s) }
  return s
}
/** Vuelve al seed la semana de TODAS las familias (POST /api/demo/reset {scope:'all'}: la semana de la familia es RAM de la
 *  familia, como los avisos; el reset de UN usuario no la toca). */
export function resetFamilyWeeks(): void { families.clear() }
/** Copas de la familia ganadas por `id` (hecho de la medalla `semana-familia`, U5-B). */
export const crownsOf = (id: string): number => (userById(id) ? familyState(id).crowns[id] ?? 0 : 0)
// U5-B: el hecho de la medalla `semana-familia` (contador MONOTÓNICO de la familia: el F5 de uno no lo toca, así la copa se
// re-deriva tras su reset —§5.6—).
registerMedalFacts((uid) => ({ crowns: crownsOf(uid) }), 'copas de la familia')

/** Días que faltan para el cierre de la semana de la familia: calendario real (al domingo) o, tras un cierre SIMULADO, 7 el
 *  día del cierre y uno menos por día real (nunca negativo), como closesInDays() de un ciclo con closedAt. */
const familyClosesInDays = (st: FamilyWeekState) =>
  st.closedAt === null ? calendarClosesInDays() : Math.max(0, 7 - Math.max(0, dayNum(Date.now()) - dayNum(st.closedAt)))

/** La foto de la tabla EN VIVO (XP de la semana, racha, días y la semana anterior de cada uno, con accesos explícitos). */
function liveRows(viewerId: string): (FamilyWeekInputRow & { u: UserInfo; bestRun: number })[] {
  return familyTable(viewerId).map(({ u, seedIdx }) => {
    const s = summaryOf(u.id), f = weekFactsOf(u.id)
    return { u, id: u.id, name: u.name, kind: u.kind, xp: s.xpWeek, streakDays: s.streakDays, seedIdx, days: f.days, bestRun: f.bestRun, prevXp: f.lastWeek ? f.lastWeek.xp : null }
  })
}

/** ¿El premio de esa semana SIGUE en juego hoy? Solo si quedó sin ganadores y es el MISMO que está vigente (mismo `setAt`):
 *  el adulto no lo cambió ni lo quitó, y ningún cierre posterior lo consumió. Con un premio arrastrado varias semanas, da
 *  true en cada una de ellas (es la misma promesa). */
const prizeInPlay = (st: FamilyWeekState, h: FamilyWeekClosedRaw): boolean =>
  !!h.prize && h.prize.winners.length === 0 && !!st.prize && st.prize.setAt === h.prize.setAt
const servedHistory = (st: FamilyWeekState): FamilyWeekClosed[] =>
  st.history.map((h, i) => ({ ...h, label: weeksAgoLabel(i + 1), prizeInPlay: prizeInPlay(st, h) }))
const copyPrize = (p: FamilyWeekPrize): FamilyWeekPrize => ({ ...p, by: { ...p.by }, from: p.from ? { ...p.from } : null })

/** La tabla de la semana de la familia de `viewer` (U4) + lo de U5: días, mejor tramo, semana anterior, la 🏆 chiquita de
 *  la semana pasada, el premio en juego, el historial con rótulos y si el que mira lo administra. XP y racha de CADA UNO con
 *  accesos explícitos (summaryOf): nunca del usuario del pedido. Orden: XP de la semana desc → racha desc → orden del seed;
 *  puestos 1..n sin empates. */
export function familyLeague(viewer: UserInfo): FamilyLeague {
  const st = familyState(viewer.id)
  const cupId = st.history[0]?.rows.find(r => r.marks.includes('gano'))?.id
  const rows = sortFamilyRows(liveRows(viewer.id)).map(({ u, xp, streakDays, days, bestRun, prevXp }, i): FamilyLeagueRow => ({
    pos: i + 1, id: u.id, name: u.name, nick: u.nick, kind: u.kind, xp, streakDays, look: lookOf(u),
    ...(u.id === viewer.id ? { me: true } : {}),
    days, bestRun, prevXp,
    ...(u.id === cupId ? { wonLastWeek: true as const } : {}),
    ...(u.kind === 'child' ? { prizeEligible: true as const } : {}),
  }))
  return {
    closesInDays: familyClosesInDays(st), rows,
    prize: st.prize ? copyPrize(st.prize) : null,
    history: servedHistory(st),
    canManage: viewer.kind === 'adult',
    week: st.week,
  }
}

/** Reparte lo que dejó un cierre (simulado o real): el premio a cada ganador como canje "de la liga" en SU slice (con
 *  ganadores el premio se consume; sin ganadores SIGUE EN JUEGO: que un premio prometido se evapore sería justo la pérdida
 *  que la evidencia desaconseja), la copa (contador monotónico) y el historial (tope 8). */
function settleFamilyClose(st: FamilyWeekState, closed: FamilyWeekClosedRaw): void {
  const p = closed.prize
  if (p && p.winners.length) {
    for (const w of p.winners) grantFamilyPrize(w, { emoji: p.emoji, title: p.title }, closed.closedAt)
    st.prize = null
  }
  const cup = closed.rows.find(r => r.marks.includes('gano'))
  if (cup) st.crowns[cup.id] = (st.crowns[cup.id] ?? 0) + 1
  st.history = [closed, ...st.history].slice(0, HISTORY_CAP)
  st.week = closed.week
}
const closeLog = (st: FamilyWeekState, c: FamilyWeekClosedRaw, how: string) =>
  `[leagues] cierre ${how} de la familia ${st.key} → semana ${c.week}: ${c.rows.map(r => `${r.id} ${r.xp} XP ${r.days}/7${r.marks.length ? ` [${r.marks.join(',')}]` : ''}${r.prize ? ' 🎁' : ''}`).join(' · ')} · total ${c.total}${c.prize ? ` · premio «${c.prize.title}» → ${c.prize.winners.length ? c.prize.winners.join(', ') : 'nadie: sigue en juego'}` : ''}`

/** CIERRE REAL de la semana de la familia, PEREZOSO (§2.3). Lo disparan index.ts antes de rutear los cuatro lectores de lo
 *  que el cierre produce (/api/leagues/*, /api/parent/activity, /api/market/redemptions, /api/medals*), antes del 403 de
 *  Ligas apagadas —cerrar la semana no le muestra nada a quien la dispara—, y el reset del activo ANTES de re-sembrarlo
 *  (demoReset.ts: abrir la app resetea primero al que abre; si la foto se sacara después, tomaría su "semana pasada" del
 *  SEED, que cae justo en la semana abierta). Si la familia NO tuvo cierre simulado y su lunes ya pasó, cierra la semana
 *  ABIERTA con el `lastWeek` que guardó el corte de cada uno (el rollWeek de progress.ts; quien no tiene ESA semana
 *  registrada entra con 0) y deja abierta la de hoy. Varias semanas sin que nadie abra la app → se cierra UNA (la que estaba
 *  abierta, la última con datos); las del medio no existen y el rótulo sale de la posición (borde aceptado). Las ligas
 *  PÚBLICAS no se tocan. En DOS tiempos: la FOTO (corta la semana de cada uno y arma el resumen) y el REPARTO (canjes del
 *  premio, copa, historial y las medallas de cada uno); `afterPhoto` corre entre los dos —el reset del que abre: así lo que
 *  este cierre le da a él (el canje, la copa) entra DESPUÉS de su re-siembra—. Devuelve si cerró (true ⇔ corrió afterPhoto). */
export function familyCloseIfDue(viewerId: string, afterPhoto?: () => void): boolean {
  if (!userById(viewerId)) return false
  const st = familyState(viewerId)
  if (st.closedAt !== null) return false // tras un cierre simulado, la familia sigue el calendario corrido del demo
  const tw = familyThisWeek()
  if (tw <= st.weekStart) return false
  // U5-B: los slices de medallas de TODA la familia existen ANTES de cortar las semanas y repartir la copa (si nacieran
  // después, lo que este cierre gana entraría al seed como "ya visto").
  const members = familyOf(viewerId)
  for (const u of members) ensureMedals(u.id)
  // 1. La FOTO: la semana que se cierra de cada integrante de la tabla.
  const rows: FamilyWeekInputRow[] = familyTable(viewerId).map(({ u, seedIdx }) => {
    const f = weekFactsOf(u.id) // corta la semana de ese integrante si todavía no lo había hecho
    const lw = f.lastWeek && f.lastWeek.weekStart === st.weekStart ? f.lastWeek : null
    return { id: u.id, name: u.name, kind: u.kind, xp: lw?.xp ?? 0, days: lw?.days ?? 0, prevXp: lw ? lw.prevXp : null, streakDays: summaryOf(u.id).streakDays, seedIdx }
  })
  const closedAt = familyMondayAt() - (tw - (st.weekStart + 7)) * DAY // el lunes 00:00 que de verdad la cerró
  const closed = rows.length ? closeFamilyWeek(rows, st.prize, { week: st.week + 1, closedAt, simulated: false }) : null
  st.weekStart = tw // ya está cerrada: nada de lo que corra en el medio la vuelve a cerrar
  try {
    afterPhoto?.()
  } finally {
    // 2. El REPARTO y las medallas de cada integrante (copa, "superaste tu semana", "semana completa"), cada uno bajo SU
    // runAsUser: el contexto de este pedido es el de quien abrió la app y la noticia tiene que caer en el feed de CADA uno.
    if (closed) {
      settleFamilyClose(st, closed)
      console.log(closeLog(st, closed, 'real (lunes)'))
    }
    for (const u of members) runAsUser(u.id, () => syncMedals(u.id))
  }
  return true
}

/** CIERRE SIMULADO de la semana de la familia (botón de demo del ADULTO, D4; §2.4), todo síncrono y en este orden:
 *  0. < 2 filas → 400 · 1. foto de la tabla (antes de poner nada en 0) → closeFamilyWeek · 2. premio (canje "de la liga" a
 *  cada ganador) · 3. copa · 4. historial, week++ y closedAt (calendario corrido) · 5. las ligas PÚBLICAS de TODOS los
 *  integrantes (familyOf, orden del seed, también los chicos con Ligas apagadas: cada uno cierra SU liga, su noticia en SU
 *  feed, y su startNewWeek guarda su lastWeek y mueve sus contadores) · 6. medallas de cada integrante (U5-B, bajo su
 *  runAsUser; antes de todo, sus slices de medallas existen) · 7. {closed, mine}. */
export function closeFamilyWeekNow(viewer: UserInfo):
  | { ok: true; result: { closed: FamilyWeekClosed; mine: ReturnType<typeof closeWeek> } }
  | { ok: false; status: 400; error: string } {
  const rows = liveRows(viewer.id)
  if (rows.length < 2) return { ok: false, status: 400, error: 'La liga de la familia necesita al menos dos integrantes.' }
  // U5-B: los slices de medallas de TODA la familia existen ANTES de la copa y de los cortes (ver familyCloseIfDue).
  const members = familyOf(viewer.id)
  for (const u of members) ensureMedals(u.id)
  const st = familyState(viewer.id)
  const now = Date.now()
  const closed = closeFamilyWeek(rows, st.prize, { week: st.week + 1, closedAt: now, simulated: true })
  settleFamilyClose(st, closed)
  st.closedAt = now
  st.weekStart = familyThisWeek()
  console.log(closeLog(st, closed, `simulado (lo cerró ${viewer.id})`))
  let mine: ReturnType<typeof closeWeek> | null = null
  for (const u of members) {
    const r = runAsUser(u.id, () => closeWeek())
    if (u.id === viewer.id) mine = r
  }
  // 6. (U5-B) medallas de cada integrante, cada uno bajo SU runAsUser (la noticia cae en SU feed). El closeWeek de cada uno
  // ya sincronizó tras su corte (la copa ya estaba sumada en el paso 3): esto es la red de seguridad (idempotente).
  for (const u of members) runAsUser(u.id, () => syncMedals(u.id))
  return { ok: true, result: { closed: servedHistory(st)[0], mine: mine ?? runAsUser(viewer.id, () => closeWeek()) } }
}

/* ---------- el premio del adulto (§3): un TEXTO fijo, sin ⚡, sin sorteo; solo condiciones positivas ---------- */
export interface FamilyPrizeOptions { groups: { member: string; name: string; items: { itemId: number; emoji: string; title: string; desc?: string }[] }[] }
/** Los premios NO archivados de cada dependiente del adulto, en el orden de `dependents` ("De la Tienda de Ian"…). */
export function familyPrizeOptions(viewer: UserInfo): FamilyPrizeOptions {
  return {
    groups: (viewer.dependents ?? []).flatMap(d => {
      const u = userById(d)
      return u ? [{ member: d, name: u.name, items: memberItemsOf(d).map(i => ({ itemId: i.id, emoji: i.emoji, title: i.title, ...(i.desc ? { desc: i.desc } : {}) })) }] : []
    }),
  }
}
const toPosInt = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*\d{1,9}\s*$/.test(v) ? Number(v) : NaN
  return Number.isSafeInteger(n) && n > 0 ? n : null
}
/** Pone (o reemplaza) el premio de la semana. `from` COPIA emoji, título y descripción de un premio de la Tienda de un chico
 *  (lo prometido no cambia si después lo edita o lo archiva, y no toca su stock ni sus canjes); si no, "Uno nuevo" con la
 *  MISMA validación que un premio de la Tienda (parent.checkPrizeFields). Errores con los textos LITERALES de §6.2. */
export function setFamilyPrize(viewer: UserInfo, b: Record<string, unknown>): { ok: true; league: FamilyLeague } | { ok: false; error: string } {
  const condition = b.condition
  if (typeof condition !== 'string' || !(PRIZE_CONDITIONS as readonly string[]).includes(condition)) return { ok: false, error: 'Elegí para quién es el premio.' }
  let fields: { emoji: string; title: string; desc?: string }
  let from: FamilyWeekPrize['from'] = null
  if (b.from !== undefined && b.from !== null) {
    const f = typeof b.from === 'object' && !Array.isArray(b.from) ? (b.from as Record<string, unknown>) : {}
    const member = typeof f.member === 'string' ? f.member.trim().toLowerCase() : ''
    if (!member || !(viewer.dependents ?? []).includes(member)) return { ok: false, error: 'Ese integrante no es de tu familia.' }
    const itemId = toPosInt(f.itemId)
    const it = itemId === null ? undefined : memberItemsOf(member).find(i => i.id === itemId)
    if (!it || itemId === null) return { ok: false, error: `Ese premio ya no está en la Tienda de ${userById(member)?.name ?? member}.` }
    fields = { emoji: it.emoji, title: it.title, ...(it.desc ? { desc: it.desc } : {}) }
    from = { member, itemId }
  } else {
    const c = checkPrizeFields(b)
    if (!c.ok) return { ok: false, error: c.error }
    fields = c.value
  }
  if (!familyTable(viewer.id).some(({ u }) => u.kind === 'child')) return { ok: false, error: 'Ninguno de tus chicos está jugando la liga de la familia (tienen Ligas apagadas).' }
  const st = familyState(viewer.id)
  st.prize = { ...fields, condition: condition as FamilyPrizeCondition, by: { id: viewer.id, name: viewer.name }, from, setAt: Date.now() }
  console.log(`[leagues] premio de la semana de la familia ${st.key}: ${st.prize.emoji} ${st.prize.title} · ${condition}${from ? ` (copiado del #${from.itemId} de ${from.member})` : ''} · lo pone ${viewer.id}`)
  return { ok: true, league: familyLeague(viewer) }
}
/** Quita el premio de la semana (rige al instante para todos; no se le avisa a nadie). */
export function clearFamilyPrize(viewer: UserInfo): FamilyLeague {
  const st = familyState(viewer.id)
  if (st.prize) console.log(`[leagues] premio de la semana de la familia ${st.key} quitado por ${viewer.id}`)
  st.prize = null
  return familyLeague(viewer)
}

/* ---------- rutas ---------- */
const PRIZE_ADULT = { error: 'El premio de la semana lo pone un adulto de la familia.' }
const CLOSE_ADULT = { error: 'El cierre de la semana de la familia lo hace un adulto.' }
/** /api/leagues/family/* (U5-A). Ya pasó el 403 de Ligas apagadas del chico (primera línea de leaguesRoutes). Un adulto
 *  nunca recibe 403 acá; un chico, en todo lo que no es leer la tabla (D4: solo el adulto cierra y pone el premio). */
async function familyRoutes(req: IncomingMessage, res: ServerResponse, path: string, me: UserInfo): Promise<void> {
  switch (path) {
    case '/api/leagues/family/close-week': {
      if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido: usá POST.' })
      if (me.kind !== 'adult') return send(res, 403, CLOSE_ADULT)
      const r = closeFamilyWeekNow(me)
      return r.ok ? send(res, 200, r.result) : send(res, r.status, { error: r.error })
    }
    case '/api/leagues/family/prize': {
      if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido: usá POST.' })
      if (me.kind !== 'adult') return send(res, 403, PRIZE_ADULT)
      let b: Record<string, unknown>
      try {
        const raw = await readJson<unknown>(req)
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('no es un objeto')
        b = raw as Record<string, unknown>
      } catch { return send(res, 400, { error: 'Pedido inválido (se esperaba JSON).' }) }
      const r = setFamilyPrize(me, b)
      return r.ok ? send(res, 200, r.league) : send(res, 400, { error: r.error })
    }
    case '/api/leagues/family/prize/clear': {
      if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido: usá POST.' })
      if (me.kind !== 'adult') return send(res, 403, PRIZE_ADULT)
      return send(res, 200, clearFamilyPrize(me))
    }
    case '/api/leagues/family/prize-options': {
      if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido: usá GET.' })
      if (me.kind !== 'adult') return send(res, 403, PRIZE_ADULT)
      return send(res, 200, familyPrizeOptions(me))
    }
  }
  return send(res, 404, { error: 'not found' })
}

export async function leaguesRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  // Ligas apagadas por el padre: no existen, ni por URL (fail-closed, antes que nada; mismo patrón que market/amigos). Es un
  // candado del CHICO —el de ESE chico, U3—: con un adulto como usuario activo no rige (docs/USUARIOS.md §4). Vale también
  // para la tabla de la familia y TODO /api/leagues/family/* (U5).
  const me = actingUser(req)
  if (me.kind === 'child' && !featureOn('ligas', me.id)) return send(res, 403, { error: 'Las ligas están apagadas por tu familia' })
  // U5-A: la liga de la familia completa (premio, opciones y cierre de la familia), ANTES del 405 genérico de abajo.
  if (url.pathname.startsWith('/api/leagues/family/')) return familyRoutes(req, res, url.pathname.replace(/\/+$/, ''), me)
  // Botón de demo "Simular cierre de semana" (Ligas): cierra TU liga; el efecto vive en RAM y una recarga vuelve al seed.
  if (url.pathname === '/api/leagues/close-week') {
    if (req.method !== 'POST') return send(res, 405, { error: 'method' })
    return send(res, 200, closeWeek())
  }
  if (req.method !== 'GET') return send(res, 405, { error: 'method' })
  if (url.pathname === '/api/leagues/mine') return send(res, 200, myLeague())
  if (url.pathname === '/api/leagues/family') return send(res, 200, familyLeague(me))
  if (url.pathname === '/api/leagues/standing') {
    const L = leagueOf()
    if (url.searchParams.get('id') !== L.id) return send(res, 404, { error: 'Esa liga no es tuya' })
    const rows = standing()
    const pos = rows.findIndex(r => r.me) + 1
    return send(res, 200, { league: { id: L.id, name: L.name, color: L.color, total: TOTAL, pos }, rows })
  }
  if (url.pathname === '/api/leagues/geo') {
    const scope = url.searchParams.get('scope')
    if (scope !== 'zona' && scope !== 'pais') return send(res, 400, { error: 'scope: zona | pais' })
    return send(res, 200, geoRanking(scope))
  }
  return send(res, 404, { error: 'not found' })
}
