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
import type { IncomingMessage, ServerResponse } from 'node:http'
import { send } from './web'

export interface EcTx { id: number; ts: number; kind: 'earn' | 'spend'; amount: number; label: string }
interface Store {
  seq: number
  weekStart: number
  xpWeek: number
  xpTotal: number
  ec: number
  streakDays: number
  lastDay: string // YYYY-MM-DD del último día con actividad
  tx: EcTx[]
}

/** Lunes 00:00 de la semana de `d` (la liga "cierra el domingo"). */
function mondayOf(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (x.getDay() + 6) % 7 // 0 = lunes
  x.setDate(x.getDate() - dow)
  return x.getTime()
}
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/* Valores INICIALES del demo (a esto se vuelve con cada carga de página). */
function seed(): Store {
  const now = Date.now()
  return {
    seq: 4,
    weekStart: mondayOf(new Date()),
    xpWeek: 1240,
    xpTotal: 8460,
    ec: 1240,
    streakDays: 5,
    lastDay: dayKey(new Date()),
    // Del más nuevo al más viejo, como el runtime (unshift): el contrato de GET /api/progress/tx.
    tx: [
      { id: 3, ts: now - 1 * 864e5, kind: 'earn', amount: 440, label: 'Práctica: El sistema solar' },
      { id: 2, ts: now - 2 * 864e5, kind: 'earn', amount: 380, label: 'Práctica: Fracciones' },
      { id: 1, ts: now - 3 * 864e5, kind: 'earn', amount: 420, label: 'Práctica: El sistema solar' },
    ],
  }
}

let store: Store = seed()

/** Vuelve a los valores iniciales (lo dispara POST /api/demo/reset en cada carga de página). */
export function resetProgress() { store = seed() }

/** La XP semanal arranca de cero cada lunes (la liga cierra el domingo). */
function rollWeek() {
  const ws = mondayOf(new Date())
  if (ws !== store.weekStart) { store.weekStart = ws; store.xpWeek = 0 }
}

/** Cierre SIMULADO de semana (botón de demo en Ligas; lo orquesta leaguesFake.closeWeek):
 *  la XP semanal vuelve a 0 y "arranca la semana que viene". La billetera (EC), la racha y el
 *  total NO se tocan (audios 20-26: la EC se acumula; la que compite es la XP de la semana). */
export function startNewWeek(): void {
  store.weekStart = mondayOf(new Date())
  store.xpWeek = 0
}

function touchStreak() {
  const today = dayKey(new Date())
  if (store.lastDay === today) return
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1)
  store.streakDays = store.lastDay === dayKey(ayer) ? store.streakDays + 1 : 1
  store.lastDay = today
}

/* ---------- API para los módulos del server (imports, no HTTP) ---------- */

/** Suma puntos ganados practicando: +XP semanal y +EC (1:1). Devuelve el estado para mostrar el premio. */
export function addXp(amount: number, label: string): { xp: number; xpWeek: number; ec: number; streakDays: number } {
  rollWeek()
  const a = Math.max(0, Math.round(amount))
  if (a > 0) {
    touchStreak()
    store.xpWeek += a
    store.xpTotal += a
    store.ec += a
    store.tx.unshift({ id: store.seq++, ts: Date.now(), kind: 'earn', amount: a, label: label.slice(0, 80) })
    store.tx = store.tx.slice(0, 200)
  }
  return { xp: a, xpWeek: store.xpWeek, ec: store.ec, streakDays: store.streakDays }
}

/** Gasta EC en la Tienda. Nunca deja saldo negativo. */
export function spendEc(amount: number, label: string): { ok: boolean; ec: number } {
  const a = Math.max(1, Math.round(amount))
  if (store.ec < a) return { ok: false, ec: store.ec }
  store.ec -= a
  store.tx.unshift({ id: store.seq++, ts: Date.now(), kind: 'spend', amount: a, label: label.slice(0, 80) })
  store.tx = store.tx.slice(0, 200)
  return { ok: true, ec: store.ec }
}

/** "Seguí practicando" = la forma `continue` del contrato (courseId = el id de la RUTA desde W3). */
export type ContinueInfo = { courseId: string; title: string; done: number; total: number } | null
let continueOf: () => ContinueInfo = () => null
/** Learn (learnResults.ts) registra acá de dónde sale el "seguí practicando": la última ruta jugada y su avance real,
 *  derivados de los resultados persistidos (no es economía: no lo toca el reset del demo). Sin registro → null. */
export function registerContinue(fn: () => ContinueInfo): void { continueOf = fn }

export function summary() {
  rollWeek()
  let cont: ContinueInfo = null
  try { cont = continueOf() } catch (e) { console.warn('[progress] no pude derivar el "seguí practicando":', e) }
  return {
    xpWeek: store.xpWeek,
    ec: store.ec,
    streakDays: store.streakDays,
    continue: cont,
  }
}
export const weekXp = () => { rollWeek(); return store.xpWeek }

/* ---------- rutas ---------- */
export function progressRoutes(req: IncomingMessage, res: ServerResponse, url: URL) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method' })
  if (url.pathname === '/api/progress/summary') return send(res, 200, summary())
  if (url.pathname === '/api/progress/tx') return send(res, 200, { tx: store.tx.slice(0, 50) })
  return send(res, 404, { error: 'not found' })
}
