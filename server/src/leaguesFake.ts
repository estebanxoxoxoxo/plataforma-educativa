// ============================== SERVER FAKE DE LIGAS ==============================
// La asignación real de ligas (por resultados, ciclos semanales, zona y país con chicos reales) TODAVÍA NO EXISTE
// — ver docs/VISION.md §7 "Competencia". Este módulo la simula (patrón feedFake.ts) manteniendo las formas de
// src/api/types.ts, con UNA parte real: el puntaje de "Vos" es weekXp() de ./progress, el MISMO número en las
// tres tablas (liga, zona y país). Si practica y suma, sube de puesto en vivo.
//   GET /api/leagues/mine          → AssignedLeague (pos = su XP real ordenada contra los 11 NPCs)
//   GET /api/leagues/standing?id=  → LeagueStanding (12 filas, "Vos" = XP real)
//   GET /api/leagues/geo?scope=zona|pais → GeoRanking (top 10 FAKE + mi puesto por fórmula, me.xp = XP real)
// Para conectar el backend real: reemplazar myLeague()/standing()/geoRanking() manteniendo las formas.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { config } from './config'
import { weekXp } from './progress'
import { send } from './web'

/* ---------- datos de demo (los que mostraba el mock del navegador) ---------- */
const LEAGUE = { id: 'lg-cometa', name: 'Liga Cometa', color: '#F2A81D', total: 12, closes: 'el domingo' }
const NICKS = ['NachoNova', 'EmiFósil', 'ValenOrbita', 'GuadaGalaxia', 'FeliTrex', 'AguMeteoro', 'PiliCometa', 'BautiLava', 'JoaquiSaturno', 'ZoeVolcan', 'FrancoPlaneta', 'MiliEclipse', 'LautiCrater', 'RenataLuna', 'SantiAsteroide', 'OliviaNebula']
const COLS = ['#3A5BD9', '#13A39A', '#F26B3A', '#8A5CF5', '#E5487A', '#F2A81D', '#1C9BD6', '#18A957']
const ME_COLOR = '#FFC23D'
/** XP semanal del demo: con esta XP, Ian queda 7.º de 12, #37 en Palermo y #4.812 en Argentina (los números de siempre). */
const DEMO_XP = 1240
/* Diferencia de cada puesto del demo con respecto a esos 1.240 XP (el 0 era el lugar de Ian). Pasos irregulares para que
   parezca real. Los 11 NPCs quedan FIJOS en 1.240 + diff (escalados por el día de la semana, ver weekRamp). */
const LEAGUE_DIFFS = [331, 274, 203, 146, 88, 39, 0, -47, -103, -151, -198, -252]
/* Nicks propios de los rankings geográficos: si apareciera un compañero de mi liga acá con otro puntaje, se rompería la
   regla de "un solo puntaje semanal". */
const GEO_NICKS = ['SofiAurora', 'ThiagoFoton', 'CamiCuarzo', 'BrunoTornado', 'AlmaBrisa', 'IkerMagma', 'LunaBoreal', 'DanteOrion', 'MiaTundra', 'TeoGranizo', 'VeraCeleste', 'SimonQuasar']
/* Zona y país: top del ranking, puesto de Ian con DEMO_XP y cantidad de chicos (el último puesto posible). */
const GEO = {
  zona: { name: 'Palermo', off: 0, top: 4980, demoPos: 37, size: 420 },
  pais: { name: 'Argentina', off: 6, top: 12650, demoPos: 4812, size: 61250 },
} as const
type Scope = keyof typeof GEO

const myNick = () => config.apodo || 'Explorador'

/** FAKE: cuánto de la semana ya cosecharon los demás. La XP de Ian vuelve a 0 cada lunes (./progress), así que los
 *  NPCs y los rankings geo también arrancan bajos: lunes 25 %, martes 50 %, miércoles 75 %, de jueves a domingo 100 %
 *  (cambia solo a medianoche: dentro de un día los números de los demás son fijos). */
function weekRamp(d = new Date()): number {
  const dow = (d.getDay() + 6) % 7 // 0 = lunes
  return Math.min(1, (dow + 1) / 4)
}

/* ---------- mi liga ---------- */
interface Row { pos: number; nick: string; color: string; xp: number; me?: true }
function standing(): Row[] {
  const r = weekRamp()
  // Los 11 chicos de la liga: mismos nicks y colores que el mock (el lugar 6, el de Ian en el demo, no es un NPC).
  const npcs = LEAGUE_DIFFS.flatMap((diff, i) => (diff === 0 ? [] : [{ nick: NICKS[i % NICKS.length], color: COLS[i % COLS.length], xp: Math.round((DEMO_XP + diff) * r) }]))
  const me = { nick: myNick(), color: ME_COLOR, xp: weekXp(), me: true as const }
  // Empate: el NPC queda arriba (para pasarlo hay que superarlo).
  return [...npcs, me].sort((a, b) => b.xp - a.xp || ('me' in a ? 1 : 0) - ('me' in b ? 1 : 0)).map((x, i) => ({ pos: i + 1, ...x }))
}
export function myLeague() {
  const pos = standing().findIndex(r => r.me) + 1
  return { id: LEAGUE.id, name: LEAGUE.name, color: LEAGUE.color, pos, total: LEAGUE.total, closes: LEAGUE.closes, xp: weekXp() }
}

/* ---------- zona y país ---------- */
/** FAKE: puesto por fórmula monotónica (más XP ⇒ mejor puesto). Potencia que pasa por dos anclas:
 *  con DEMO_XP (escalada por weekRamp) da el puesto del demo (#37 Palermo / #4.812 Argentina) y con la XP del 10.º del
 *  top da #11. Nunca entra al top 10 (la tabla muestra a esos 10 aparte) ni pasa del último puesto (size).
 *  Ej. con 1.240 XP: #37 / #4.812; con 1.300: #35 / #4.093; con 1.600: #26 / #2.011. */
function geoPos(scope: Scope, xp: number): number {
  const G = GEO[scope], r = weekRamp()
  if (xp <= 0) return G.size
  const x0 = DEMO_XP * r, tenth = G.top * r * (1 - 9 * 0.045)
  const k = Math.log((G.demoPos - 1) / 10) / Math.log(tenth / x0)
  const pos = 1 + (G.demoPos - 1) * Math.pow(x0 / xp, k)
  return Math.min(G.size, Math.max(11, Math.round(pos)))
}
export function geoRanking(scope: Scope) {
  const G = GEO[scope], r = weekRamp(), xp = weekXp()
  return {
    scope, name: G.name,
    top: Array.from({ length: 10 }, (_, i) => ({ nick: GEO_NICKS[(i + G.off) % GEO_NICKS.length], color: COLS[(i + G.off) % COLS.length], xp: Math.round(G.top * (1 - i * 0.045) * r) })),
    me: { nick: myNick(), pos: geoPos(scope, xp), xp },
  }
}

/** Lo que muestra la barra lateral del feed: los MISMOS números que la página de Ligas. */
export function leagueSidebar() {
  const xp = weekXp(), l = myLeague()
  return { name: l.name, pos: l.pos, total: l.total, zone: { name: GEO.zona.name, pos: geoPos('zona', xp) }, country: { name: GEO.pais.name, pos: geoPos('pais', xp) } }
}

/* ---------- rutas ---------- */
export function leaguesRoutes(req: IncomingMessage, res: ServerResponse, url: URL): void {
  if (req.method !== 'GET') return send(res, 405, { error: 'method' })
  if (url.pathname === '/api/leagues/mine') return send(res, 200, myLeague())
  if (url.pathname === '/api/leagues/standing') {
    if (url.searchParams.get('id') !== LEAGUE.id) return send(res, 404, { error: 'Esa liga no es tuya' })
    const rows = standing()
    const pos = rows.findIndex(r => r.me) + 1
    return send(res, 200, { league: { id: LEAGUE.id, name: LEAGUE.name, color: LEAGUE.color, total: LEAGUE.total, pos }, rows })
  }
  if (url.pathname === '/api/leagues/geo') {
    const scope = url.searchParams.get('scope')
    if (scope !== 'zona' && scope !== 'pais') return send(res, 400, { error: 'scope: zona | pais' })
    return send(res, 200, geoRanking(scope))
  }
  return send(res, 404, { error: 'not found' })
}
