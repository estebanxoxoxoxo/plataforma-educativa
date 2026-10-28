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
import type { IncomingMessage, ServerResponse } from 'node:http'
import { wallDate } from '../../src/shared/lib/zonedClock'
import { perUser } from './perUser'
import { send } from './web'

export interface EcTx { id: number; ts: number; kind: 'earn' | 'spend'; amount: number; label: string }
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
   del más nuevo al más viejo; los ids son por usuario (solo son claves de la lista de cada uno). */
interface ProgressSeed { xpWeek: number; xpTotal: number; ec: number; streakDays: number; tx: { daysAgo: number; amount: number; label: string }[] }
const PROGRESS_SEEDS: Record<string, ProgressSeed> = {
  ian: { xpWeek: 1240, xpTotal: 8460, ec: 1240, streakDays: 5, tx: [
    { daysAgo: 1, amount: 440, label: 'Práctica: El sistema solar' },
    { daysAgo: 2, amount: 380, label: 'Práctica: Fracciones' },
    { daysAgo: 3, amount: 420, label: 'Práctica: El sistema solar' } ] },
  luna: { xpWeek: 1290, xpTotal: 10980, ec: 1290, streakDays: 9, tx: [
    { daysAgo: 1, amount: 470, label: 'Práctica: Inglés inicial' },
    { daysAgo: 2, amount: 400, label: 'Práctica: El cuerpo humano' },
    { daysAgo: 3, amount: 420, label: 'Práctica: Fracciones' } ] },
  andres: { xpWeek: 450, xpTotal: 2310, ec: 450, streakDays: 2, tx: [
    { daysAgo: 1, amount: 240, label: 'Aprender' },
    { daysAgo: 2, amount: 210, label: 'Aprender' } ] },
}
/** Sin entrada en PROGRESS_SEEDS → un usuario "nuevo": todo en cero, sin movimientos y sin racha. */
const NO_SEED: ProgressSeed = { xpWeek: 0, xpTotal: 0, ec: 0, streakDays: 0, tx: [] }

function seedProgress(userId: string): Store {
  const s = PROGRESS_SEEDS[userId] ?? NO_SEED
  const now = Date.now()
  const n = s.tx.length
  return {
    seq: n + 1,
    weekStart: thisWeek(),
    xpWeek: s.xpWeek,
    xpTotal: s.xpTotal,
    ec: s.ec,
    streakDays: s.streakDays,
    // con racha, el último día con actividad es hoy (como el seed de siempre); sin racha, ninguno (la primera ganancia la
    // arranca en 1)
    lastDay: s.streakDays > 0 ? today() : null,
    // Del más nuevo al más viejo, como el runtime (unshift): el contrato de GET /api/progress/tx.
    tx: s.tx.map((t, i) => ({ id: n - i, ts: now - t.daysAgo * 864e5, kind: 'earn' as const, amount: t.amount, label: t.label })),
  }
}

const stores = perUser(seedProgress)

/** Vuelve a los valores iniciales: el de un usuario, o sin id TODOS (lo dispara POST /api/demo/reset: el activo en cada
 *  carga de página; todos con {scope:'all'}). */
export function resetProgress(userId?: string) { stores.reset(userId) }

/** La XP semanal arranca de cero cada lunes 00:00 DE LA FAMILIA (la liga cierra el domingo). */
function rollWeek(store: Store) {
  const ws = thisWeek()
  if (ws !== store.weekStart) { store.weekStart = ws; store.xpWeek = 0 }
}

/** Cierre SIMULADO de semana (botón de demo en Ligas; lo orquesta leaguesFake.closeWeek) del usuario del pedido (A6: cerrar
 *  es de TU liga): la XP semanal vuelve a 0 y "arranca la semana que viene". La billetera (EC), la racha y el
 *  total NO se tocan (audios 20-26: la EC se acumula; la que compite es la XP de la semana). */
export function startNewWeek(): void {
  const store = stores.now()
  store.weekStart = thisWeek()
  store.xpWeek = 0
}

/** La racha cuenta días de calendario DE LA FAMILIA: practicar el día siguiente al último la estira; saltear uno la vuelve a 1. */
function touchStreak(store: Store) {
  const t = today()
  if (store.lastDay === t) return
  store.streakDays = store.lastDay === t - 1 ? store.streakDays + 1 : 1
  store.lastDay = t
}

/* ---------- API para los módulos del server (imports, no HTTP) ---------- */

/** Suma puntos ganados practicando AL USUARIO DEL PEDIDO: +XP semanal y +EC (1:1). Devuelve el estado para mostrar el
 *  premio. */
export function addXp(amount: number, label: string): { xp: number; xpWeek: number; ec: number; streakDays: number } {
  const store = stores.now()
  rollWeek(store)
  const a = Math.max(0, Math.round(amount))
  if (a > 0) {
    touchStreak(store)
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

/* ---------- rutas (del usuario activo: el contexto del pedido es el de su cabecera) ---------- */
export function progressRoutes(req: IncomingMessage, res: ServerResponse, url: URL) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method' })
  if (url.pathname === '/api/progress/summary') return send(res, 200, summary())
  if (url.pathname === '/api/progress/tx') return send(res, 200, { tx: stores.now().tx.slice(0, 50) })
  return send(res, 404, { error: 'not found' })
}
