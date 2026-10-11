// ============================== SERVER FAKE DE LIGAS ==============================
// La asignación real de ligas (por resultados, ciclos semanales, zona y país con chicos reales) TODAVÍA NO EXISTE
// — ver docs/VISION.md §7 "Competencia". Este módulo la simula (patrón feedFake.ts) manteniendo las formas de
// src/api/types.ts, con UNA parte real: el puntaje de "Vos" es weekXp() de ./progress, el MISMO número en las
// tres tablas (liga, zona y país). Si practica y suma, sube de puesto en vivo.
// CICLO SEMANAL (VISION §7, capa 4). docs/AGENTS.md regla 7: el ciclo tiene UNA sola fuente, ESTE módulo (closesInDays,
// lastWeek/medalla, la liga asignada, quién está en tu tabla y las fechas del cierre que usa el feed).
//   - Semana del SEED (week 0): lunes a domingo, igual que ./progress. closesInDays es REAL (días que faltan para el fin
//     del domingo según la fecha del server; 0 = hoy) y lastWeek es seed (la semana pasada Ian salió 2º en la Liga
//     Cometa → plata).
//   - CIERRE SIMULADO (botón de demo "Simular cierre de semana" en Ligas → POST /api/leagues/close-week, closeWeek()):
//     1. congela la tabla ACTUAL (la XP real de Ian contra los 11 NPC) y reparte medallas al podio;
//     2. re-asigna la liga por resultados en la escalera LADDER (podio sube una, 10º-12º baja una, el resto queda; en las
//        puntas no se pasa de largo) — cada NPC también queda en la liga que le tocó (si vuelve a cruzarse con Ian, está
//        donde corresponde);
//     3. arranca la semana nueva: progress.startNewWeek() (XP semanal → 0; EC, racha y total intactos), NPCs de la liga
//        nueva con XP chicas (0-90) y closesInDays = 7 (corrimiento en RAM: cuenta los días reales desde el cierre);
//     4. el resultado pasa a ser lastWeek (estandarte de Ligas, medallita del aside, noticia de la liga del feed) y
//        feedFake.injectLeagueClose() mete arriba del feed las noticias del cierre.
//     Varios cierres seguidos = varias semanas seguidas (lastWeek es siempre el ÚLTIMO).
//   - "Simular NPCs" (feedFake.simulateNpcs): los compañeros de tu tabla practican (npcPractice) y su XP de la semana
//     sube DE VERDAD acá; el feed lo cuenta ("te pasó", "subió al 5º puesto").
//   Todo vive en RAM: resetLeagues() vuelve al seed (va en POST /api/demo/reset, como el resto de la economía del demo).
//   El CIERRE REAL (el domingo a la noche, con chicos reales y sus amigos viendo las medallas) es del backend futuro.
//   GET  /api/leagues/mine          → AssignedLeague (pos = su XP real ordenada contra los 11 NPCs + closesInDays + lastWeek)
//   GET  /api/leagues/standing?id=  → LeagueStanding (12 filas, "Vos" = XP real)
//   GET  /api/leagues/geo?scope=zona|pais → GeoRanking (top 10 FAKE + mi puesto por fórmula, me.xp = XP real)
//   POST /api/leagues/close-week    → CloseWeekResult (demo: cierre simulado)
// Para conectar el backend real: reemplazar myLeague()/standing()/geoRanking()/closeWeek() manteniendo las formas.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { config } from './config'
import { injectLeagueClose } from './feedFake'
import { featureOn } from './parent'
import { startNewWeek, weekXp } from './progress'
import { send } from './web'

/* ---------- escalera de ligas (se ASIGNAN por resultados: nunca se eligen ni se buscan) ---------- */
export type Medal = 'oro' | 'plata' | 'bronce'
export type Movement = 'sube' | 'baja' | 'queda'
interface LeagueDef { id: string; name: string; color: string; emoji: string; /** XP típica de una semana completa de sus chicos */ pace: number }
/** De abajo hacia arriba. Cometa es la del seed; Chispa (la de JuanchiRayo y NicoRobot en Amigos) y Estrella (la de
 *  MateoDino, que subió con el oro) ya existían en el mundo del demo: la escalera las respeta. */
const LADDER: readonly LeagueDef[] = [
  { id: 'lg-chispa', name: 'Liga Chispa', color: '#F26B3A', emoji: '✨', pace: 760 },
  { id: 'lg-cometa', name: 'Liga Cometa', color: '#F2A81D', emoji: '☄️', pace: 1280 },
  { id: 'lg-estrella', name: 'Liga Estrella', color: '#1C9BD6', emoji: '⭐', pace: 1750 },
  { id: 'lg-supernova', name: 'Liga Supernova', color: '#8A5CF5', emoji: '💥', pace: 2300 },
  { id: 'lg-galaxia', name: 'Liga Galaxia', color: '#3A5BD9', emoji: '🌌', pace: 2900 },
]
const SEED_TIER = 1
const TOTAL = 12

/* ---------- datos de demo (los que mostraba el mock del navegador) ---------- */
const NICKS = ['NachoNova', 'EmiFósil', 'ValenOrbita', 'GuadaGalaxia', 'FeliTrex', 'AguMeteoro', 'PiliCometa', 'BautiLava', 'JoaquiSaturno', 'ZoeVolcan', 'FrancoPlaneta', 'MiliEclipse', 'LautiCrater', 'RenataLuna', 'SantiAsteroide', 'OliviaNebula']
/** Más chicos para las tablas de las semanas simuladas (ninguno es de zona/país ni amigo de Ian: un chico tiene UN
 *  solo puntaje y aparece en UNA tabla de liga). */
const MORE_NICKS = ['TobiPulsar', 'CandeMarea', 'RamiTitan', 'AbriCoral', 'GonzaGlaciar', 'MaiaPrisma', 'LeoCiclon', 'AnaKiwi', 'PanchoMamut', 'JoseOrca', 'SolCaracol', 'DelfiDelfin', 'IvoMarte', 'LolaKoala', 'NinaNube', 'MatiAtomo', 'CamiloCanguro', 'ElenaCascada', 'GaelGeiser', 'PedroBambu', 'UmaTucan', 'LuchoHalcon', 'ClaraArcoiris', 'BenjaDuna', 'IaraPinguino', 'FacuBrujula', 'JazminFaro', 'PatoOla', 'RoccoSelva', 'LaraTortuga', 'CiroJaguar', 'BiancaCondor', 'MorePuma', 'LichiBisonte', 'JuanaLince', 'LoloBallena', 'TinoPulpo', 'IsaMedusa', 'BeniCristal', 'AmbarZorro', 'JuliPanda', 'VicenTrueno', 'PazNieve', 'MaxiRadar']
const LEAGUE_NICKS = [...NICKS, ...MORE_NICKS]
const COLS = ['#3A5BD9', '#13A39A', '#F26B3A', '#8A5CF5', '#E5487A', '#F2A81D', '#1C9BD6', '#18A957']
const ME_COLOR = '#FFC23D'
/** XP semanal del demo: con esta XP, Ian queda 7.º de 12, #37 en Palermo y #4.812 en Argentina (los números de siempre). */
const DEMO_XP = 1240
/* Diferencia de cada puesto del demo con respecto a esos 1.240 XP (el 0 era el lugar de Ian). Pasos irregulares para que
   parezca real. Los 11 NPCs quedan FIJOS en 1.240 + diff (escalados por el día de la semana, ver weekRamp). */
const LEAGUE_DIFFS = [331, 274, 203, 146, 88, 39, 0, -47, -103, -151, -198, -252]
/* Nicks propios de los rankings geográficos, DISJUNTOS entre sí y con las ligas: si un mismo chico apareciera en dos
   tablas con dos puntajes distintos, se rompería la regla de "un solo puntaje semanal". */
const GEO_NICKS = ['SofiAurora', 'ThiagoFoton', 'CamiCuarzo', 'BrunoTornado', 'AlmaBrisa', 'IkerMagma', 'LunaBoreal', 'DanteOrion', 'MiaTundra', 'TeoGranizo', 'VeraCeleste', 'SimonQuasar']
const GEO_NICKS_PAIS = ['RenzoPolaris', 'MiluVega', 'KiaraAndromeda', 'ManuLucero', 'AinaCenit', 'GaspiHorizonte', 'EmmaSolsticio', 'LucasRelampago', 'TatiArrecife', 'AxelMistral', 'AmpiSequoia', 'RomiEquinoccio']
/* Zona y país: top del ranking, puesto de Ian con DEMO_XP y cantidad de chicos (el último puesto posible). */
const GEO = {
  zona: { name: 'Palermo', nicks: GEO_NICKS, off: 0, top: 4980, demoPos: 37, size: 420 },
  pais: { name: 'Argentina', nicks: GEO_NICKS_PAIS, off: 6, top: 12650, demoPos: 4812, size: 61250 },
} as const
type Scope = keyof typeof GEO

const myNick = () => config.apodo || 'Explorador'

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
/** Color del círculo de iniciales: el del seed para los 11 de la tabla de siempre; el resto, estable por nick. */
const SEED_COLOR = new Map(LEAGUE_DIFFS.flatMap((d, i) => (d === 0 ? [] : [[NICKS[i % NICKS.length], COLS[i % COLS.length]] as const])))
const colorOf = (nick: string) => SEED_COLOR.get(nick) ?? COLS[hashOf(nick) % COLS.length]

/* ---------- estado del ciclo (RAM) ---------- */
interface Row { pos: number; nick: string; color: string; xp: number; me?: true }
interface WeekNpc { nick: string; color: string; /** XP con la que arrancó la semana */ base: number; /** XP de su semana completa */ pace: number }
interface Closed { tier: number; pos: number; total: number; medal: Medal | null; xp: number; movement: Movement }
interface Cycle {
  /** 0 = la semana del seed; cada cierre simulado suma 1 */
  week: number
  /** Índice en LADDER de la liga de esta semana */
  tier: number
  /** Cuándo fue el cierre simulado que abrió esta semana (null = semana del seed: calendario real) */
  closedAt: number | null
  /** Los 11 NPC de la semana (null = los del seed: LEAGUE_DIFFS escalados por weekRamp) */
  npcs: WeekNpc[] | null
  /** XP que sumó cada NPC esta semana con "Simular NPCs" */
  boost: Record<string, number>
  /** El último cierre simulado (null = el del seed: 2º → plata en la Liga Cometa) */
  last: Closed | null
  /** En qué liga quedó cada NPC que pasó por las tablas de Ian */
  homes: Record<string, number>
}
const seedCycle = (): Cycle => ({ week: 0, tier: SEED_TIER, closedAt: null, npcs: null, boost: {}, last: null, homes: {} })
let cycle: Cycle = seedCycle()

/** Vuelve al seed (lo dispara POST /api/demo/reset en cada carga de página, como el resto de la economía del demo). */
export function resetLeagues(): void { cycle = seedCycle() }

const leagueOf = (t = cycle.tier) => LADDER[t]
const brief = (L: LeagueDef) => ({ id: L.id, name: L.name, color: L.color })

/* ---------- tiempo del ciclo ---------- */
const DAY = 864e5
const midnight = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }
/** Días REALES desde el cierre simulado que abrió esta semana (0 = el mismo día del cierre). */
const daysIn = () => (cycle.closedAt === null ? 0 : Math.max(0, Math.round((midnight(Date.now()) - midnight(cycle.closedAt)) / DAY)))
/** Semana del ciclo (0 = la del seed; cada cierre simulado suma 1). */
export const cycleWeek = () => cycle.week

/** FAKE: cuánto de la semana ya cosecharon los demás. La XP de Ian vuelve a 0 cada lunes (./progress), así que los
 *  NPCs y los rankings geo también arrancan bajos: lunes 25 %, martes 50 %, miércoles 75 %, de jueves a domingo 100 %
 *  (cambia solo a medianoche: dentro de un día los números de los demás son fijos). */
function weekRamp(d = new Date()): number {
  const dow = (d.getDay() + 6) % 7 // 0 = lunes
  return Math.min(1, (dow + 1) / 4)
}
/** Semana simulada recién arrancada: los líderes de zona/país ya juntaron un poquito (~3 % de su semana). */
const FRESH = 0.03
/** Escala de las XP de zona/país (y de la fórmula del puesto). Seed: weekRamp. Semana simulada: recién arrancada el día
 *  del cierre y después como el seed (1/4 por día real), con una variación propia de cada semana. */
function geoScale(): number {
  if (cycle.closedAt === null) return weekRamp()
  const d = daysIn()
  return (d === 0 ? FRESH : Math.min(1, d / 4)) * (0.85 + 0.3 * rng(hashOf(`geo:${cycle.week}`))())
}

/* ---------- ciclo semanal: cierre, medallas y fechas ---------- */
/** Solo el podio del cierre gana medalla. */
export const medalFor = (pos: number): Medal | null => (pos === 1 ? 'oro' : pos === 2 ? 'plata' : pos === 3 ? 'bronce' : null)
export const MEDAL_EMOJI: Record<Medal, string> = { oro: '🥇', plata: '🥈', bronce: '🥉' }

/** Días que faltan para el cierre. Semana del seed: REAL (fin del domingo; lunes 6 … sábado 1, domingo 0 = "¡cierra
 *  hoy!", misma semana lunes→domingo y hora local que ./progress). Semana simulada: 7 el día del cierre y uno menos por
 *  cada día real que pasa (nunca negativo). */
export function closesInDays(): number {
  if (cycle.closedAt === null) return 6 - ((new Date().getDay() + 6) % 7)
  return Math.max(0, 7 - daysIn())
}
/** El "cierra …" de la liga (tooltip del chip y noticia del feed). */
const closesText = (n: number) => (cycle.closedAt === null ? 'el domingo' : n <= 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`)

/** "recién", "hace 5 min", "hace 2 h", "ayer", "hace 3 días" (hora real). */
export function sinceLabel(at: number, now = Date.now()): string {
  const min = Math.floor((now - at) / 60000)
  if (min < 1) return 'recién'
  const days = Math.round((midnight(now) - midnight(at)) / DAY)
  if (days <= 0) return min < 60 ? `hace ${min} min` : `hace ${Math.floor(min / 60)} h`
  return days === 1 ? 'ayer' : `hace ${days} días`
}
/** Lo que pasó hace `n` semanas del ciclo (cada cierre simulado es una semana). */
export const weeksAgoLabel = (n: number) => (n <= 1 ? 'la semana pasada' : `hace ${n} semanas`)

/** Cuándo fue el último cierre, para fechar lo que reparte (medallas, ascensos). Semana del seed: el lunes fue "anoche";
 *  el domingo, el de hoy todavía no pasó y el último es el de la semana anterior. Semana simulada: desde el cierre. */
export function lastCloseLabel(): string {
  if (cycle.closedAt !== null) return sinceLabel(cycle.closedAt)
  const dow = (new Date().getDay() + 6) % 7 // 0 = lunes
  return dow === 0 ? 'anoche' : dow === 6 ? 'el domingo pasado' : 'el domingo'
}

/** FAKE (seed del demo): cómo terminó Ian el cierre de la semana pasada. Con el backend real sale de la tabla
 *  congelada de ese cierre (null = no compitió). */
const LAST_WEEK_POS = 2
/** Cómo terminó Ian el último cierre: el del seed o el del ÚLTIMO cierre simulado. */
export function lastWeek(): { pos: number; medal: Medal | null } | null {
  const l = cycle.last
  return l ? { pos: l.pos, medal: l.medal } : { pos: LAST_WEEK_POS, medal: medalFor(LAST_WEEK_POS) }
}
/** El último cierre SIMULADO con su liga (que puede no ser la de ahora): lo cuenta la noticia de la liga del feed.
 *  null = semana del seed. */
export function lastClose(): { from: string; pos: number; medal: Medal | null; movement: Movement; top: boolean } | null {
  const l = cycle.last
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
function npcRows(): Omit<Row, 'pos'>[] {
  const extra = (nick: string) => cycle.boost[nick] ?? 0
  if (!cycle.npcs) {
    const r = weekRamp()
    // Los 11 chicos del seed: mismos nicks y colores que el mock (el lugar 6, el de Ian en el demo, no es un NPC).
    return LEAGUE_DIFFS.flatMap((diff, i) => {
      const nick = NICKS[i % NICKS.length]
      return diff === 0 ? [] : [{ nick, color: COLS[i % COLS.length], xp: Math.round((DEMO_XP + diff) * r) + extra(nick) }]
    })
  }
  // Semana simulada: el día del cierre, la XP de arranque; después, lo que lleva cada uno de su semana (1/4 por día).
  const d = daysIn()
  return cycle.npcs.map(n => ({ nick: n.nick, color: n.color, xp: (d === 0 ? n.base : Math.max(n.base, Math.round(n.pace * Math.min(1, d / 4)))) + extra(n.nick) }))
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
 *  Ej. con 1.240 XP: #37 / #4.812; con 1.300: #35 / #4.093; con 1.600: #26 / #2.011. */
function geoPos(scope: Scope, xp: number): number {
  const G = GEO[scope], s = geoScale()
  if (xp <= 0) return G.size
  const x0 = DEMO_XP * s, tenth = G.top * s * (1 - 9 * 0.045)
  const k = Math.log((G.demoPos - 1) / 10) / Math.log(tenth / x0)
  const pos = 1 + (G.demoPos - 1) * Math.pow(x0 / xp, k)
  return Math.min(G.size, Math.max(11, Math.round(pos)))
}
export function geoRanking(scope: Scope) {
  const G = GEO[scope], s = geoScale(), xp = weekXp()
  const rot = 5 * cycle.week // cada semana lidera otra gente
  return {
    scope, name: G.name,
    top: Array.from({ length: 10 }, (_, i) => ({ nick: G.nicks[(i + rot) % G.nicks.length], color: COLS[(i + G.off + rot) % COLS.length], xp: Math.round(G.top * (1 - i * 0.045) * s) })),
    me: { nick: myNick(), pos: geoPos(scope, xp), xp },
  }
}

/** Lo que muestra la barra lateral del feed: los MISMOS números que la página de Ligas (y la MISMA medalla del cierre
 *  pasado que su estandarte). */
export function leagueSidebar() {
  const xp = weekXp(), l = myLeague()
  return { name: l.name, pos: l.pos, total: l.total, zone: { name: GEO.zona.name, pos: geoPos('zona', xp) }, country: { name: GEO.pais.name, pos: geoPos('pais', xp) }, medal: l.lastWeek?.medal ?? null }
}

/* ---------- cierre de semana (demo) ---------- */
/** XP de arranque de una semana nueva: chicas y variadas (0-90). Uno o dos todavía no arrancaron; nadie repite número. */
function startXps(r: () => number): number[] {
  const xs = r() < 0.5 ? [0] : [0, 0]
  while (xs.length < TOTAL - 1) { const v = 5 + Math.floor(r() * 86); if (!xs.includes(v)) xs.push(v) }
  return xs.sort((a, b) => b - a)
}
/** Los 11 chicos de la semana nueva en la liga `tier`: los que hicieron el MISMO movimiento que Ian siguen con él (caras
 *  conocidas, hasta 5) y el resto llega de otras tablas — chicos nuevos o que ya están en esta liga, nunca uno que quedó
 *  en otra. Anota en `homes` dónde queda cada uno. */
function weekNpcs(week: number, tier: number, prev: Row[], homes: Record<string, number>): WeekNpc[] {
  const r = rng(hashOf(`liga:${week}:${tier}`))
  const carry = shuffle(prev.filter(x => !x.me && homes[x.nick] === tier), r).slice(0, 5).map(x => ({ nick: x.nick, color: x.color }))
  const taken = new Set(prev.map(x => x.nick)) // los de la tabla que cerró y no siguen con Ian: en otras tablas
  const fits = (n: string) => !taken.has(n) && (homes[n] === undefined || homes[n] === tier)
  const fill = [
    ...shuffle(LEAGUE_NICKS.filter(n => fits(n) && homes[n] === undefined), r),
    ...shuffle(LEAGUE_NICKS.filter(n => fits(n) && homes[n] === tier), r),
  ].slice(0, TOTAL - 1 - carry.length)
  // Si algún día se agotara el pool (muchísimos cierres), antes que una tabla corta: chicos de otras tablas.
  if (carry.length + fill.length < TOTAL - 1) {
    fill.push(...shuffle(LEAGUE_NICKS.filter(n => !fill.includes(n) && !carry.some(c => c.nick === n)), r).slice(0, TOTAL - 1 - carry.length - fill.length))
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
  /** El podio SIN Ian, en orden. `up` = la liga a la que suben (null en la más alta); `withMe` = suben con Ian. */
  podium: { nick: string; color: string; pos: number; medal: Medal; up: { name: string; emoji: string } | null; withMe: boolean }[]
}

/** Cierre SIMULADO de la semana (botón de demo en Ligas). Forma de CloseWeekResult (src/api/types.ts). */
export function closeWeek() {
  const rows = standing() // la tabla ACTUAL, congelada: de acá sale todo
  const me = rows.find(r => r.me)!
  const from = cycle.tier
  const { movement, next } = moveOf(from, me.pos)
  const medal = medalFor(me.pos)
  const homes = { ...cycle.homes }
  for (const r of rows) if (!r.me) homes[r.nick] = moveOf(from, r.pos).next
  const label = (L: LeagueDef) => ({ name: L.name, emoji: L.emoji })
  const podium = rows.filter(r => !r.me && r.pos <= 3).map(r => {
    const up = moveOf(from, r.pos).movement === 'sube'
    return { nick: r.nick, color: r.color, pos: r.pos, medal: medalFor(r.pos)!, up: up ? label(LADDER[from + 1]) : null, withMe: up && movement === 'sube' }
  })
  const week = cycle.week + 1
  cycle = {
    week, tier: next, closedAt: Date.now(), boost: {}, homes,
    npcs: weekNpcs(week, next, rows, homes),
    last: { tier: from, pos: me.pos, total: rows.length, medal, xp: me.xp, movement },
  }
  startNewWeek() // XP semanal → 0: la que compite es la de la semana; la EC, la racha y el total NO se tocan
  const feedAdded = injectLeagueClose({ week, me: { nick: me.nick, color: me.color, pos: me.pos, medal }, from: label(LADDER[from]), to: label(LADDER[next]), movement, podium })
  console.log(`[leagues] cierre simulado → semana ${week}: ${me.nick} ${me.pos}º de ${rows.length} en la ${LADDER[from].name} con ${me.xp} XP (${medal ?? 'sin medalla'}) · ${movement} → ${LADDER[next].name} · feed +${feedAdded}`)
  return {
    closed: { league: brief(LADDER[from]), pos: me.pos, total: rows.length, medal, xp: me.xp },
    next: { league: brief(LADDER[next]), movement, closesInDays: closesInDays() },
    feedAdded,
  }
}

/* ---------- "Simular NPCs": los compañeros de tu tabla también practican ---------- */
export interface NpcRace { nick: string; color: string; gain: number; from: number; to: number; passedMe: boolean; league: string }
/** `count` compañeros de la tabla de Ian practican un rato: su XP de la semana sube DE VERDAD (la misma tabla que se ve en
 *  Ligas). Como mucho uno por ráfaga, y a veces, es el que viene justo atrás de Ian y lo pasa ("estoy a dos pasos de
 *  mengano", audio 24). Devuelve qué pasó, para que el feed lo cuente. */
export function npcPractice(r: () => number, count: number): NpcRace[] {
  const out: NpcRace[] = []
  let chased = false
  for (let k = 0; k < count; k++) {
    const rows = standing(), me = rows.find(x => x.me)!
    const free = rows.filter(x => !x.me && !out.some(o => o.nick === x.nick))
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
    cycle.boost[who.nick] = (cycle.boost[who.nick] ?? 0) + gain
    const after = standing()
    const to = after.find(x => !x.me && x.nick === who.nick)!.pos
    out.push({ nick: who.nick, color: who.color, gain, from: who.pos, to, passedMe: who.pos > me.pos && to < after.find(x => x.me)!.pos, league: leagueOf().name })
  }
  return out
}

/* ---------- rutas ---------- */
export function leaguesRoutes(req: IncomingMessage, res: ServerResponse, url: URL): void {
  // Ligas apagadas por el padre: no existen, ni por URL (fail-closed, antes que nada; mismo patrón que market/amigos).
  if (!featureOn('ligas')) return send(res, 403, { error: 'Las ligas están apagadas por tu familia' })
  // Botón de demo "Simular cierre de semana" (Ligas): el efecto vive en RAM y una recarga vuelve al seed.
  if (url.pathname === '/api/leagues/close-week') {
    if (req.method !== 'POST') return send(res, 405, { error: 'method' })
    return send(res, 200, closeWeek())
  }
  if (req.method !== 'GET') return send(res, 405, { error: 'method' })
  if (url.pathname === '/api/leagues/mine') return send(res, 200, myLeague())
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
