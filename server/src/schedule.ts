// Horarios por sección (porte Smarty W7) — el "candado por reloj" de HORARIOS.md del POC, server-side
// (en el POC vivía en localStorage del navegador: acá el server es la verdad y la UI solo pinta).
// Modelo EXACTO del POC: por sección `{ restrictionActive, week: [7 días con getDay(): 0=domingo] }`,
// cada día `{ open, from: "HH:MM", to: "HH:MM" }` abierto en [from, to); sin entrada = siempre abierta.
// `restrictionActive:false` (default) = siempre abierta. El FEED (la home) nunca se gatea.
// CONFIG del padre (regla 9): PERSISTE en server/data/schedules.json, FUERA de /api/demo/reset.
//
//   GET /api/schedules → { schedules, serverNow }   (público: el menú del chico y la pantalla
//        "cerrado por hoy" pintan con esto; serverNow para no depender del reloj del cliente)
//   El editor del padre (POST /api/parent/schedules {patch}) vive en parent.ts (sesión) y llama
//   a `patchSchedules`.
//
// ESQUELETO del coordinador (contrato congelado). PENDIENTE W7 (la tanda): el ENFORCEMENT por
// prefijo de API en index.ts (403 {error:'horario', opensAt}) y el gate/filtrado en el cliente.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { SERVER_ROOT } from './config'
import { send } from './web'

export type SectionKey = 'chat' | 'buscar' | 'mytube' | 'aprender' | 'tienda' | 'calendario' | 'espacio' | 'afterday'
export interface DaySchedule { open: boolean; from: string; to: string }
export interface FeatureSchedule { restrictionActive: boolean; week: DaySchedule[] }
export type Schedules = Partial<Record<SectionKey, FeatureSchedule>>

const KEYS: SectionKey[] = ['chat', 'buscar', 'mytube', 'aprender', 'tienda', 'calendario', 'espacio', 'afterday']
const FILE = join(SERVER_ROOT, 'data', 'schedules.json')

function load(): Schedules {
  if (!existsSync(FILE)) return {}
  try { return JSON.parse(readFileSync(FILE, 'utf8')) as Schedules } catch { return {} }
}
let schedules: Schedules = load()

function save(): void {
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(schedules, null, 1))
  renameSync(tmp, FILE)
}

export function allSchedules(): Schedules { return schedules }
export function isSectionKey(k: string): k is SectionKey { return (KEYS as string[]).includes(k) }

/** Merge por sección (un patch por clave reemplaza SU horario completo; null/undefined la vuelve "sin restricción"). */
export function patchSchedules(patch: Schedules): Schedules {
  const next: Schedules = { ...schedules }
  for (const k of Object.keys(patch) as SectionKey[]) {
    if (!isSectionKey(k)) continue
    const v = patch[k]
    if (!v || v.restrictionActive === false) delete next[k]
    else next[k] = { restrictionActive: true, week: v.week }
  }
  schedules = next
  save()
  return schedules
}

const mins = (hhmm: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  return m ? Math.min(23, +m[1]) * 60 + Math.min(59, +m[2]) : 0
}

/** ¿La sección está abierta AHORA? El POC: día con open:false = cerrada; si no, [from, to). Un
 *  horario inválido o sin restricción = abierta (falla en abierto, como isFeatureOpen del POC). */
export function isOpen(key: SectionKey, now: Date = new Date()): boolean {
  const s = schedules[key]
  if (!s || !s.restrictionActive) return true
  const d = s.week[now.getDay()]
  if (!d) return true
  if (!d.open) return false
  const t = now.getHours() * 60 + now.getMinutes()
  return t >= mins(d.from) && t < mins(d.to)
}

export async function scheduleRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (url.pathname === '/api/schedules' && req.method === 'GET') {
    return send(res, 200, { schedules, serverNow: Date.now() })
  }
  return send(res, 404, { error: 'No existe.' })
}
