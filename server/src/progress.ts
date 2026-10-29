// Progreso del chico: XP semanal (el puntaje ÚNICO que ordena liga/zona/país), Energy Coin
// (billetera que se gasta en la Tienda), racha y "seguí practicando".
// REGLA DEL DEMO (pedido de Esteban, 8-oct-2026): NADA de esto se persiste. Vive en RAM del server
// y cada carga de página vuelve a los valores iniciales (el front hace POST /api/demo/reset al
// arrancar — ver src/hooks/user.tsx). Se resta/suma de verdad mientras navegás; F5 = demo nueva.
// CONTRATO CONGELADO entre quien GANA (desde la tanda W3: Learn, server/src/learnResults.ts —la primera
// partida completada de cada target de una ruta—; antes Practicar, retirado) y la Tienda (GASTA EC acá) —
// cambios solo vía el coordinador. Ver docs/AGENTS.md.
//
// Modelo (audios 20-24 de la visión): cada punto ganado aprendiendo suma 1 XP semanal (compite en
// ligas) y 1 Energy Coin a la billetera (se acumula y se GASTA sin afectar la XP de la semana).
// "Seguí practicando" (summary().continue) ya no se guarda acá: lo DERIVA Learn de sus resultados persistidos
// (la última ruta jugada con su avance real) y lo registra con registerContinue() al cargar.
//
// POR USUARIO desde U4 (docs/USUARIOS.md §10): cada integrante tiene su XP, ⚡ y racha; la RAM y el reset por carga siguen
// (regla 9). Un slice por usuario (perUser.ts): las funciones de siempre (addXp, spendEc, startNewWeek, summary, weekXp,
// las rutas) operan sobre el del USUARIO DEL PEDIDO (contexto de U3); summaryOf/weekXpOf son los accesos EXPLÍCITOS (Familia
// —dentro de /api/parent/* el usuario del pedido es el ADULTO—, la liga de la familia). Cada uno arranca con SU seed
// (PROGRESS_SEEDS: Ian = el de siempre; Luna con su propia historia; Andrés recién arrancando) y POST /api/demo/reset
// vuelve al seed solo al usuario activo (o a todos con {scope:'all'}).
//
// CALENDARIO (remate U4-A, 28-oct): el corte de semana de la XP (lunes 00:00) y el "día" de la racha corren en la ZONA
// HORARIA DE LA FAMILIA (parent.json `tz`; null = la del server), igual que el ciclo de liga (leaguesFake.ts), la franja del
// Feed y los horarios: antes usaban la hora LOCAL del server y, con una zona corrida, la XP podía volver a 0 unas horas
// antes o después del cierre de la liga. parent.ts (dueño del dato) la PRESTA con setProgressTzSource, sin que este módulo
// lo importe (parent ya importa este; además un test de progress no arrastra parent.json). Días = días de calendario de
// pared (src/shared/lib/zonedClock.ts: wallDate), como dayNum de leaguesFake.
//
// U5-A (28-oct; docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §2.3, §4 y §5.4): el corte de semana deja de PERDER la semana. Todo corte
// —el lunes real (rollWeek, perezoso) y el cierre simulado (startNewWeek)— guarda antes `lastWeek = {weekStart, xp, days,
// prevXp}` y mueve los contadores de las medallas (pbWeeks: superó su semana anterior; fullWeeks: aprendió los 7 días). Además:
//   · `weekDays` = los días (números de día de la familia) de la semana ABIERTA con aprendizaje NUEVO (el mismo evento que
//     mueve la racha: addXp con monto > 0). Se marca en addXp, FUERA de touchStreak (ese corta temprano si ya contó hoy: tras
//     un cierre simulado el mismo día, la próxima posta de hoy no contaría en la semana nueva). Solo SUBE dentro de la semana
//     y arranca vacío en cada corte: es el reto "¿quién aprende más días?" (nunca baja, nunca "se rompe").
//   · `bestStreak` (máximo histórico de la racha) y `comebacks` (aprender algo nuevo tras ≥ 3 días de calendario sin hacerlo):
//     hechos de las medallas de U5-B; acá solo se llevan.
//   · Los seeds traen su "semana pasada" (Ian 1.180 · Luna 1.350 · Andrés 300) con días coherentes con la racha
//     (familyWeek.seedWeekDays) y los contadores fijos de las medallas (PROGRESS_SEEDS.medal).
// Accesos nuevos (explícitos, por id): weekFactsOf(id) (lo vivo: días, mejor tramo y la semana anterior) y seedLastWeekOf(id)
// (la del SEED, para el historial sembrado de la familia: nunca del progreso vivo). Las firmas de siempre NO cambian.
import type { IncomingMessage, ServerResponse } from 'node:http'
import { wallDate } from '../../src/shared/lib/zonedClock'
import { bestRun, seedWeekDays } from './familyWeek'
import { registerMedalFacts } from './medals'
import { perUser } from './perUser'
import { send } from './web'

export interface EcTx { id: number; ts: number; kind: 'earn' | 'spend'; amount: number; label: string }
/** La semana que cerró el último corte (U5). `prevXp` = la XP de la semana ANTERIOR a esa con la que se comparó (null = no
 *  había contra qué): con ella se decidió el ↑ "superó su semana" de ese corte. */
export interface LastWeek { weekStart: number; xp: number; days: number; prevXp: number | null }
interface Store {
  seq: number
  /** Número de día (calendario de pared de la familia) del LUNES de la semana de `xpWeek`. */
  weekStart: number
  xpWeek: number
  xpTotal: number
  ec: number
  streakDays: number
  /** Número de día (calendario de pared de la familia) del último día con actividad; null = ninguno. */
  lastDay: number | null
  tx: EcTx[]
  /** U5: la semana que cerró el último corte (null = ninguna registrada: un usuario nuevo). */
  lastWeek: LastWeek | null
  /** U5: números de día (de la familia) de la semana ABIERTA con aprendizaje nuevo, sin repetir. */
  weekDays: number[]
  /** U5 (hechos de medallas): la racha más larga que tuvo (no la de hoy) · veces que volvió tras ≥ 3 días · cortes en los
   *  que superó su semana anterior · cortes con los 7 días. Solo suben (salvo el reset del demo). */
  bestStreak: number
  comebacks: number
  pbWeeks: number
  fullWeeks: number
}

/* ---------- calendario de la FAMILIA ---------- */
let tzSource: () => string | null = () => null
/** parent.ts presta la zona horaria de la familia (la llama al cargar; se LEE recién al atender pedidos). */
export function setProgressTzSource(fn: () => string | null): void { tzSource = fn }
const DAY = 864e5
/** Número de día del calendario de pared de `tz` en el instante `t` (restar dos = días de calendario entre ellos). Sin zona
 *  (o desconocida), el calendario local del server. Puro. */
export function familyDayNum(t: number, tz: string | null): number {
  const w = wallDate(t, tz)
  return Math.round(Date.UTC(w.y, w.m, w.d) / DAY)
}
/** Número de día del LUNES de la semana (lunes a domingo: la liga "cierra el domingo") que contiene `t` en `tz`. Puro. */
export function familyWeekStart(t: number, tz: string | null): number {
  const w = wallDate(t, tz)
  return Math.round(Date.UTC(w.y, w.m, w.d) / DAY) - (w.wd + 6) % 7
}
const today = () => familyDayNum(Date.now(), tzSource())
const thisWeek = () => familyWeekStart(Date.now(), tzSource())

/* Valores INICIALES del demo POR USUARIO (a esto vuelve cada uno con su carga de página). Spec U4 §1.1/§3.1, D3 del dueño:
   Ian IDÉNTICO al seed de siempre (1.240 / 8.460, racha 5, sus 3 movimientos: ids 3..1, seq 4); Luna con su propia historia
   (50 XP más que Ian esta semana: con dos postas él la pasa); Andrés recién arrancando. Todos los movimientos son 'earn',
   del más nuevo al más viejo; los ids son por usuario (solo son claves de la lista de cada uno).
   U5-A: `lastWeek` = la "semana pasada" del seed (XP y los días DESEADOS: los reales salen de seedWeekDays, coherentes con la
   racha y el día de la semana de hoy) y `medal` = los hechos fijos de las medallas (spec U5 §5.4: Luna con una semana
   completa de antes; pbWeeks en 0 a propósito: el primer cierre le da "Superaste tu semana" en vivo a Ian y a Andrés). */
interface ProgressSeed {
  xpWeek: number; xpTotal: number; ec: number; streakDays: number; tx: { daysAgo: number; amount: number; label: string }[]
  lastWeek?: { xp: number; days: number }
  medal?: { bestStreak: number; comebacks: number; pbWeeks: number; fullWeeks: number }
}
const PROGRESS_SEEDS: Record<string, ProgressSeed> = {
  ian: { xpWeek: 1240, xpTotal: 8460, ec: 1240, streakDays: 5, tx: [
    { daysAgo: 1, amount: 440, label: 'Práctica: El sistema solar' },
    { daysAgo: 2, amount: 380, label: 'Práctica: Fracciones' },
    { daysAgo: 3, amount: 420, label: 'Práctica: El sistema solar' } ],
    lastWeek: { xp: 1180, days: 6 }, medal: { bestStreak: 5, comebacks: 0, pbWeeks: 0, fullWeeks: 0 } },
  luna: { xpWeek: 1290, xpTotal: 10980, ec: 1290, streakDays: 9, tx: [
    { daysAgo: 1, amount: 470, label: 'Práctica: Inglés inicial' },
    { daysAgo: 2, amount: 400, label: 'Práctica: El cuerpo humano' },
    { daysAgo: 3, amount: 420, label: 'Práctica: Fracciones' } ],
    lastWeek: { xp: 1350, days: 7 }, medal: { bestStreak: 9, comebacks: 0, pbWeeks: 0, fullWeeks: 1 } },
  andres: { xpWeek: 450, xpTotal: 2310, ec: 450, streakDays: 2, tx: [
    { daysAgo: 1, amount: 240, label: 'Aprender' },
    { daysAgo: 2, amount: 210, label: 'Aprender' } ],
    lastWeek: { xp: 300, days: 3 }, medal: { bestStreak: 2, comebacks: 0, pbWeeks: 0, fullWeeks: 0 } },
}
/** Sin entrada en PROGRESS_SEEDS → un usuario "nuevo": todo en cero, sin movimientos, sin racha y sin semana anterior. */
const NO_SEED: ProgressSeed = { xpWeek: 0, xpTotal: 0, ec: 0, streakDays: 0, tx: [] }
/** Día de la semana de hoy en el calendario de la familia, con 0 = lunes. */
const todayDow = () => today() - thisWeek()

/** Los días de esta semana y de la pasada de un seed, HOY (familyWeek.seedWeekDays: coherentes con su racha). */
function seedDays(s: ProgressSeed): { thisWeek: number; lastWeek: number } {
  return seedWeekDays(s.streakDays, todayDow(), s.lastWeek?.days ?? 0)
}

function seedProgress(userId: string): Store {
  const s = PROGRESS_SEEDS[userId] ?? NO_SEED
  const now = Date.now()
  const n = s.tx.length
  const t = today(), ws = thisWeek()
  const days = seedDays(s)
  return {
    seq: n + 1,
    weekStart: ws,
    xpWeek: s.xpWeek,
    xpTotal: s.xpTotal,
    ec: s.ec,
    streakDays: s.streakDays,
    // con racha, el último día con actividad es hoy (como el seed de siempre); sin racha, ninguno (la primera ganancia la
    // arranca en 1)
    lastDay: s.streakDays > 0 ? t : null,
    // Del más nuevo al más viejo, como el runtime (unshift): el contrato de GET /api/progress/tx.
    tx: s.tx.map((x, i) => ({ id: n - i, ts: now - x.daysAgo * 864e5, kind: 'earn' as const, amount: x.amount, label: x.label })),
    // U5: la semana pasada del seed (la anterior a ESA no existe: prevXp null, no se inventa una comparación) y los días de
    // esta semana = los últimos de la racha, que terminan hoy.
    lastWeek: s.lastWeek ? { weekStart: ws - 7, xp: s.lastWeek.xp, days: days.lastWeek, prevXp: null } : null,
    weekDays: Array.from({ length: days.thisWeek }, (_, k) => t - (days.thisWeek - 1 - k)),
    bestStreak: Math.max(s.streakDays, s.medal?.bestStreak ?? 0),
    comebacks: s.medal?.comebacks ?? 0,
    pbWeeks: s.medal?.pbWeeks ?? 0,
    fullWeeks: s.medal?.fullWeeks ?? 0,
  }
}

const stores = perUser(seedProgress)

/** Vuelve a los valores iniciales: el de un usuario, o sin id TODOS (lo dispara POST /api/demo/reset: el activo en cada
 *  carga de página; todos con {scope:'all'}). */
export function resetProgress(userId?: string) { stores.reset(userId) }

/** U5: corta la semana abierta del store — guarda `lastWeek` (con la comparación contra la semana anterior REGISTRADA), mueve
 *  pbWeeks/fullWeeks y deja la XP de la semana en 0 y los días vacíos. No toca `weekStart` (lo pone quien llama). */
function cutWeek(store: Store) {
  const prevXp = store.lastWeek ? store.lastWeek.xp : null
  const days = Math.min(7, store.weekDays.length)
  if (prevXp !== null && store.xpWeek > prevXp) store.pbWeeks++
  if (days === 7) store.fullWeeks++
  store.lastWeek = { weekStart: store.weekStart, xp: store.xpWeek, days, prevXp }
  store.xpWeek = 0
  store.weekDays = []
}

/** La XP semanal arranca de cero cada lunes 00:00 DE LA FAMILIA (la liga cierra el domingo). U5: antes de ponerla en 0
 *  guarda la semana que terminó (aunque haya sido hace varias: se registra UNA, la que estaba abierta, que es la última con
 *  datos; las del medio no existen). Si el calendario fue para ATRÁS (cambio de zona), como antes: 0 y sin registrar nada. */
function rollWeek(store: Store) {
  const ws = thisWeek()
  if (ws === store.weekStart) return
  if (ws > store.weekStart) cutWeek(store)
  else { store.xpWeek = 0; store.weekDays = [] }
  store.weekStart = ws
}

/** Cierre SIMULADO de semana (botón de demo en Ligas; lo orquesta leaguesFake.closeWeek) del usuario del pedido (A6: cerrar
 *  es de TU liga): la XP semanal vuelve a 0 y "arranca la semana que viene". La billetera (EC), la racha y el
 *  total NO se tocan (audios 20-26: la EC se acumula; la que compite es la XP de la semana). U5: como todo corte, guarda
 *  `lastWeek` y mueve los contadores de las medallas (si había un lunes real pendiente, primero se corta ése). */
export function startNewWeek(): void {
  const store = stores.now()
  rollWeek(store)
  cutWeek(store)
  store.weekStart = thisWeek()
}

/** La racha cuenta días de calendario DE LA FAMILIA: practicar el día siguiente al último la estira; saltear uno la vuelve a 1.
 *  FS-BASE-B (hallazgo progress.ts:206): si el último día quedó en el FUTURO (el adulto cambió la zona de la familia hacia
 *  atrás pasada una medianoche, o el slice nació con la zona vieja), no es "saltear un día": la racha sigue como está (antes
 *  volvía a 1 por algo que hizo el padre). La XP semanal ante un retroceso de SEMANA sigue como antes (rollWeek: 0 y sin
 *  registrar): ese corte se cruza con el cierre de la semana de la familia (U5) y no se cambia sin revisarlo. */
function touchStreak(store: Store) {
  const t = today()
  if (store.lastDay === t) return
  if (store.lastDay !== null && store.lastDay > t) return
  store.streakDays = store.lastDay === t - 1 ? store.streakDays + 1 : 1
  store.lastDay = t
}

/* ---------- API para los módulos del server (imports, no HTTP) ---------- */

/** Suma puntos ganados practicando AL USUARIO DEL PEDIDO: +XP semanal y +EC (1:1). Devuelve el estado para mostrar el
 *  premio. U5: con monto > 0 también marca el día en `weekDays` (fuera de touchStreak), cuenta un regreso (`comebacks`) si
 *  pasaron ≥ 3 días de calendario desde el último día con aprendizaje y lleva `bestStreak`. */
export function addXp(amount: number, label: string): { xp: number; xpWeek: number; ec: number; streakDays: number } {
  const store = stores.now()
  rollWeek(store)
  const a = Math.max(0, Math.round(amount))
  if (a > 0) {
    const t = today()
    if (store.lastDay !== null && t - store.lastDay >= 3) store.comebacks++
    touchStreak(store)
    if (store.streakDays > store.bestStreak) store.bestStreak = store.streakDays
    if (!store.weekDays.includes(t)) store.weekDays.push(t)
    store.xpWeek += a
    store.xpTotal += a
    store.ec += a
    store.tx.unshift({ id: store.seq++, ts: Date.now(), kind: 'earn', amount: a, label: label.slice(0, 80) })
    store.tx = store.tx.slice(0, 200)
  }
  return { xp: a, xpWeek: store.xpWeek, ec: store.ec, streakDays: store.streakDays }
}

/** Gasta EC del usuario del pedido en la Tienda. Nunca deja saldo negativo. */
export function spendEc(amount: number, label: string): { ok: boolean; ec: number } {
  const store = stores.now()
  const a = Math.max(1, Math.round(amount))
  if (store.ec < a) return { ok: false, ec: store.ec }
  store.ec -= a
  store.tx.unshift({ id: store.seq++, ts: Date.now(), kind: 'spend', amount: a, label: label.slice(0, 80) })
  store.tx = store.tx.slice(0, 200)
  return { ok: true, ec: store.ec }
}

/** "Seguí practicando" = la forma `continue` del contrato (courseId = el id de la RUTA desde W3). */
export type ContinueInfo = { courseId: string; title: string; done: number; total: number } | null
let continueOf: (userId: string) => ContinueInfo = () => null
/** Learn (learnResults.ts) registra acá de dónde sale el "seguí practicando" DE UN USUARIO: la última ruta que jugó y su
 *  avance real, derivados de SUS resultados persistidos (no es economía: no lo toca el reset del demo). Sin registro →
 *  null. U4: recibe el id (único cambio de firma del módulo; lo llama solo learnResults.ts). */
export function registerContinue(fn: (userId: string) => ContinueInfo): void { continueOf = fn }

/** El resumen de UN usuario puntual (Familia → Actividad del integrante; la liga de la familia). Misma forma que summary(). */
export function summaryOf(userId: string) {
  const store = stores.of(userId)
  rollWeek(store)
  let cont: ContinueInfo = null
  try { cont = continueOf(userId) } catch (e) { console.warn('[progress] no pude derivar el "seguí practicando":', e) }
  return {
    xpWeek: store.xpWeek,
    ec: store.ec,
    streakDays: store.streakDays,
    continue: cont,
  }
}
/** El resumen del usuario del pedido (la barra superior, la Tienda, el Feed). */
export const summary = () => summaryOf(stores.nowId())
/** La XP de la semana de un usuario puntual (el MISMO número de su liga, zona y país). */
export const weekXpOf = (userId: string) => { const store = stores.of(userId); rollWeek(store); return store.xpWeek }
/** La XP de la semana del usuario del pedido. */
export const weekXp = () => weekXpOf(stores.nowId())

/** U5: lo VIVO de la semana de un usuario puntual (la liga de la familia): días con aprendizaje nuevo de la semana abierta
 *  (0-7), el tramo de días seguidos más largo dentro de ella (la variante D2 "seguidos", también monotónica) y la semana
 *  que cerró el último corte (copia; null = ninguna registrada). Corta la semana si el lunes ya pasó, como weekXpOf. */
export function weekFactsOf(userId: string): { days: number; bestRun: number; lastWeek: LastWeek | null } {
  const store = stores.of(userId)
  rollWeek(store)
  return { days: Math.min(7, store.weekDays.length), bestRun: bestRun(store.weekDays), lastWeek: store.lastWeek ? { ...store.lastWeek } : null }
}
/** U5: la "semana pasada" del SEED de un usuario (no del progreso vivo): el historial sembrado de la liga de la familia sale
 *  de acá, así no depende de quién cerró su liga ni del orden en que nacen los slices. Días coherentes con la racha de HOY
 *  (familyWeek.seedWeekDays). null = sin semana pasada en el seed (un usuario "nuevo"). */
export function seedLastWeekOf(userId: string): { weekStart: number; xp: number; days: number } | null {
  const s = PROGRESS_SEEDS[userId]
  if (!s?.lastWeek) return null
  return { weekStart: thisWeek() - 7, xp: s.lastWeek.xp, days: seedDays(s).lastWeek }
}
/** U5 (para las medallas de U5-B: hechos de progreso, RAM por usuario): racha más larga, regresos, semanas superadas y
 *  semanas completas. Acceso explícito por id (corta la semana si el lunes ya pasó: los contadores se mueven en los cortes). */
export function medalCountersOf(userId: string): { bestStreak: number; comebacks: number; pbWeeks: number; fullWeeks: number } {
  const s = stores.of(userId)
  rollWeek(s)
  return { bestStreak: s.bestStreak, comebacks: s.comebacks, pbWeeks: s.pbWeeks, fullWeeks: s.fullWeeks }
}
// U5-B: los hechos de progreso de las medallas (tres-dias, de-vuelta, semana-completa, mejor-semana). Lee el store TAL CUAL,
// SIN cortar la semana (a diferencia de medalCountersOf): medals.ensureMedals siembra el slice de medallas ANTES de mover un
// hecho y, si leer los hechos cortara un lunes pendiente, ese corte (su "Superaste tu semana") entraría al seed como "ya
// visto" en vez de llegar como medalla nueva. El corte lo hacen los de siempre (rollWeek en addXp/summaryOf/weekXpOf/
// weekFactsOf, el cierre de la familia) y el sync siguiente lo levanta.
registerMedalFacts((uid) => { const s = stores.of(uid); return { bestStreak: s.bestStreak, comebacks: s.comebacks, pbWeeks: s.pbWeeks, fullWeeks: s.fullWeeks } }, 'progreso')

/* ---------- rutas (del usuario activo: el contexto del pedido es el de su cabecera) ---------- */
export function progressRoutes(req: IncomingMessage, res: ServerResponse, url: URL) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method' })
  if (url.pathname === '/api/progress/summary') return send(res, 200, summary())
  if (url.pathname === '/api/progress/tx') return send(res, 200, { tx: stores.now().tx.slice(0, 50) })
  return send(res, 404, { error: 'not found' })
}
