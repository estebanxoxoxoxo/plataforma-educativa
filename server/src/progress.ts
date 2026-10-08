// Progreso del chico: XP semanal (el puntaje ÚNICO que ordena liga/zona/país), Energy Coin
// (billetera que se gasta en la Tienda), racha y "seguí practicando".
// REGLA DEL DEMO (pedido de Esteban, 8-oct-2026): NADA de esto se persiste. Vive en RAM del server
// y cada carga de página vuelve a los valores iniciales (el front hace POST /api/demo/reset al
// arrancar — ver src/hooks/user.tsx). Se resta/suma de verdad mientras navegás; F5 = demo nueva.
// CONTRATO CONGELADO entre la tanda 1 (Practicar real: gana XP acá) y la tanda 2 (Tienda: gasta EC
// acá) — cambios solo vía el coordinador. Ver docs/AGENTS.md.
//
// Modelo (audios 20-24 de la visión): cada punto ganado practicando suma 1 XP semanal (compite en
// ligas) y 1 Energy Coin a la billetera (se acumula y se GASTA sin afectar la XP de la semana).
import type { IncomingMessage, ServerResponse } from 'node:http'
import { send } from './web'

export interface EcTx { id: number; ts: number; kind: 'earn' | 'spend'; amount: number; label: string }
interface CourseProg { name: string; done: number; total: number }
interface Store {
  seq: number
  weekStart: number
  xpWeek: number
  xpTotal: number
  ec: number
  streakDays: number
  lastDay: string // YYYY-MM-DD del último día con actividad
  lastCourse: string | null
  course: Record<string, CourseProg>
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
    lastCourse: 'solar',
    course: { solar: { name: 'El sistema solar', done: 2, total: 36 } }, // total = nodos reales del journey
    tx: [
      { id: 1, ts: now - 3 * 864e5, kind: 'earn', amount: 420, label: 'Práctica: El sistema solar' },
      { id: 2, ts: now - 2 * 864e5, kind: 'earn', amount: 380, label: 'Práctica: Fracciones' },
      { id: 3, ts: now - 1 * 864e5, kind: 'earn', amount: 440, label: 'Práctica: El sistema solar' },
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

/** Marca por dónde va el chico en un curso (alimenta "Seguí practicando"). */
export function setCourseProgress(courseId: string, name: string, done: number, total: number) {
  store.course[courseId] = { name: name.slice(0, 80), done: Math.max(0, done), total: Math.max(1, total) }
  store.lastCourse = courseId
}
export function courseDone(courseId: string): number { return store.course[courseId]?.done ?? 0 }

export function summary() {
  rollWeek()
  const c = store.lastCourse ? store.course[store.lastCourse] : null
  return {
    xpWeek: store.xpWeek,
    ec: store.ec,
    streakDays: store.streakDays,
    continue: c && store.lastCourse ? { courseId: store.lastCourse, title: c.name, done: c.done, total: c.total } : null,
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
