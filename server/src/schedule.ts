// Horarios por sección (porte Smarty W7) — el "candado por reloj" de HORARIOS.md del POC, server-side. En el POC vivía en
// localStorage del navegador ("todo en localStorage, que el niño puede editar": nota de seguridad del informe 03 §6); acá
// el server es la VERDAD y además ENFORCEA: fuera de la franja, la API de esa sección responde 403 (index.ts).
// Modelo EXACTO del POC (lib/featureSchedule.ts): por sección `{ restrictionActive, week }`, `week` = 7 días indexados con
// getDay() de JS (0 = domingo), cada día `{ open, from: "HH:MM", to: "HH:MM" }` abierto en [from, to). Sin entrada para
// una sección (o `restrictionActive:false`) = siempre abierta. El FEED (la home) nunca se gatea.
// CONFIG del padre (regla 9): PERSISTE en server/data/schedules.json, FUERA de /api/demo/reset.
//
//   GET  /api/schedules → { schedules, serverNow }   (público: el menú del chico y la pantalla "cerrado" pintan con esto;
//        serverNow para evaluar la franja con la hora del SERVER y no con el reloj del cliente)
//   POST /api/parent/schedules {patch} → { schedules, serverNow }   (vive en parent.ts, con la sesión; valida con
//        `checkPatch` y guarda con `patchSchedules`)
//
// Semántica fiel del POC (`isFeatureOpen`): día con open:false = cerrada todo el día; from == to = las 24 h; to < from =
// cruza la medianoche; datos incompletos o inválidos (un archivo editado a mano) = ABIERTA ("nunca encerramos al niño por
// un horario mal cargado; cerrar es siempre EXPLÍCITO"). `nextOpenLabel` = "se abre de nuevo a las HH:MM" solo si HOY abre
// más tarde (v1 del POC: no mira días siguientes).
// QUIRK FIEL (informe 03 §6): cerrar la franja NO corta el audio de fondo que ya sonaba (el server no puede, y el cliente
// a propósito no lo toca).
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
const LABEL: Record<SectionKey, string> = {
  chat: 'Chat', buscar: 'Buscar', mytube: 'MyTube', aprender: 'Aprender', tienda: 'Tienda', calendario: 'Calendario', espacio: 'Mi espacio', afterday: 'After Day',
}
const DAY_NAME = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const FILE = join(SERVER_ROOT, 'data', 'schedules.json')

function load(): Schedules {
  if (!existsSync(FILE)) return {}
  try {
    const raw: unknown = JSON.parse(readFileSync(FILE, 'utf8'))
    // Lo raro se evalúa igual con isOpenIn (falla en abierto); acá solo se descarta lo que ni siquiera es un objeto.
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Schedules) : {}
  } catch (e) {
    console.error('[schedule] schedules.json ilegible → todo abierto (como el POC); copia en .roto-*:', e)
    try { renameSync(FILE, `${FILE}.roto-${Date.now()}`) } catch { /* sin copia: seguimos igual */ }
    return {}
  }
}
let schedules: Schedules = load()

function write(next: Schedules): boolean {
  try {
    const tmp = `${FILE}.tmp`
    writeFileSync(tmp, JSON.stringify(next, null, 1))
    renameSync(tmp, FILE)
    return true
  } catch (e) {
    console.error('[schedule] no pude guardar schedules.json:', e)
    return false
  }
}

export function allSchedules(): Schedules { return schedules }
export function isSectionKey(k: string): k is SectionKey { return (KEYS as string[]).includes(k) }

/* ---------- evaluación: port EXACTO de isFeatureOpen / nextOpenLabel del POC (sin los interruptores beta
   learnActivo/searchActivo, que en Innerith no existen: el on-off del padre es otra capa, parent.ts) ---------- */

/** Default del editor (defaultSchedule del POC): los 7 días abiertos de 08:00 a 20:00. */
const DEFAULT_DAY: DaySchedule = { open: true, from: '08:00', to: '20:00' }

function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((s ?? '').trim())
  if (!m) return null
  const h = +m[1], min = +m[2]
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** ¿Abierta en `now` según este horario? Fail-safe: sin restricción o con datos incompletos/inválidos ⇒ abierta. */
export function isOpenIn(sched: FeatureSchedule | undefined, now: Date): boolean {
  try {
    if (!sched || !sched.restrictionActive) return true
    const week = sched.week
    if (!week || typeof week !== 'object') return true // forma inválida (ej. week ausente) → fail-safe abierto
    const day = (week as Record<number, DaySchedule | undefined>)[now.getDay()]
    if (!day) return true // día sin datos → no encerrar
    if (!day.open) return false // día explícitamente cerrado
    const from = parseHHMM(day.from), to = parseHHMM(day.to)
    if (from == null || to == null) return true // datos inválidos → fail-safe abierto
    const cur = now.getHours() * 60 + now.getMinutes()
    if (to <= from) return cur >= from || cur < to // ventana que cruza medianoche (o 24 h si from == to)
    return cur >= from && cur < to
  } catch {
    return true // dato corrupto: NUNCA encierra al chico (fail-open, el contrato del POC)
  }
}
/** "Se abre de nuevo a las HH:MM" si HOY abre más tarde; null si no se puede precisar. */
export function nextOpenLabelIn(sched: FeatureSchedule | undefined, now: Date): string | null {
  try {
    if (!sched || !sched.restrictionActive) return null
    const day = (sched.week as Record<number, DaySchedule | undefined> | undefined)?.[now.getDay()]
    if (day?.open) {
      const from = parseHHMM(day.from)
      const cur = now.getHours() * 60 + now.getMinutes()
      if (from != null && cur < from) return day.from
    }
    return null
  } catch { return null }
}
/** ¿La sección está abierta AHORA (reloj del server)? */
export function isOpen(key: SectionKey, now: Date = new Date()): boolean { return isOpenIn(schedules[key], now) }
export function nextOpenLabel(key: SectionKey, now: Date = new Date()): string | null { return nextOpenLabelIn(schedules[key], now) }

/* ---------- edición del padre ---------- */
type Check<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
/** Un patch por sección: el horario COMPLETO de esa sección, o null = "sin horario" (se borra la entrada). */
export type SchedulePatch = Partial<Record<SectionKey, FeatureSchedule | null>>

/** Valida la forma del patch (cada sección conocida; 7 días; open booleano; from/to HH:MM válidas). Todo o nada. */
export function checkPatch(raw: unknown): Check<SchedulePatch> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('Los horarios tienen que venir como un objeto {sección: horario}.')
  const out: SchedulePatch = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isSectionKey(k)) return fail(`No hay una sección «${k.slice(0, 40)}» (son: ${KEYS.join(', ')}).`)
    if (v === null) { out[k] = null; continue }
    const s = v as Record<string, unknown>
    if (!s || typeof s !== 'object' || Array.isArray(s)) return fail(`El horario de ${LABEL[k]} tiene que ser un objeto.`)
    if (typeof s.restrictionActive !== 'boolean') return fail(`Falta si ${LABEL[k]} se restringe por horario (restrictionActive).`)
    if (!Array.isArray(s.week) || s.week.length !== 7) return fail(`El horario de ${LABEL[k]} tiene que traer los 7 días (0 = domingo … 6 = sábado).`)
    const week: DaySchedule[] = []
    for (let d = 0; d < 7; d++) {
      const day = s.week[d] as Record<string, unknown> | null
      if (!day || typeof day !== 'object' || typeof day.open !== 'boolean') return fail(`${LABEL[k]}, ${DAY_NAME[d]}: falta si está abierto.`)
      if (typeof day.from !== 'string' || typeof day.to !== 'string' || parseHHMM(day.from) == null || parseHHMM(day.to) == null) {
        return fail(`${LABEL[k]}, ${DAY_NAME[d]}: las horas tienen que ser HH:MM (de 00:00 a 23:59).`)
      }
      week.push({ open: day.open, from: day.from.trim(), to: day.to.trim() })
    }
    out[k] = { restrictionActive: s.restrictionActive, week }
  }
  return { ok: true, value: out }
}

const isDefaultWeek = (w: DaySchedule[]) => w.length === 7 && w.every(d => d.open === DEFAULT_DAY.open && d.from === DEFAULT_DAY.from && d.to === DEFAULT_DAY.to)

/** Merge por sección: cada sección del patch REEMPLAZA su horario completo. null —o "sin restringir" con la semana de
 *  fábrica, que es lo mismo que no tener entrada— la borra; "sin restringir" con una semana PROPIA se guarda, porque el
 *  editor del POC la recuerda al volver a tildar. null si no se pudo escribir (no cambia nada). */
export function patchSchedules(patch: SchedulePatch): Schedules | null {
  const next: Schedules = { ...schedules }
  for (const k of Object.keys(patch) as SectionKey[]) {
    if (!isSectionKey(k)) continue
    const v = patch[k]
    if (!v || (!v.restrictionActive && isDefaultWeek(v.week))) delete next[k]
    else next[k] = { restrictionActive: v.restrictionActive, week: v.week.map(d => ({ open: d.open, from: d.from, to: d.to })) }
  }
  if (!write(next)) return null
  schedules = next
  const on = KEYS.filter(k => next[k]?.restrictionActive)
  console.log(`[schedule] horarios guardados → ${on.length ? `restringidas: ${on.join(', ')}` : 'ninguna sección restringida'}`)
  return schedules
}

/* ---------- ENFORCEMENT: a qué sección pertenece cada pedido de API (lo usa index.ts antes de rutear) ----------
   Mapa del contrato W7, afinado para no cerrar lo que el POC NO cerraba: en el POC el horario gatea la SECCIÓN (su vista);
   el lector, el reproductor y el selector de carpeta son overlays del shell y siguen andando con la sección cerrada. Por eso:
   · buscar = solo /api/search/* (las búsquedas). /api/article (el lector) y /api/video (el reproductor) NO se gatean: los
     usan el Feed, Mi espacio, el chat, MyTube y las postas de lectura de Aprender.
   · espacio = solo el Drive (/api/space/drive*: la vista, la papelera, mover, borrar, restaurar), MENOS crear carpeta
     (POST /api/space/drive/folder), que también usa la hoja "¿Dónde lo guardás?" (como el FolderPicker del POC). Seguir
     canales y Mis listas (/api/space/follow, /api/space/playlist*) son de MyTube; guardar (/api/space/save) y el árbol de
     carpetas (/api/space/folders) son del selector compartido.
   · calendario = /api/calendar. /api/teachers* es la pantalla Profesores de la Zona de padres: como /api/mytube/admin/*,
     SIEMPRE pasa (el padre siempre es alcanzable).
   · NUNCA se gatean: /api/feed*, /api/friends*, /api/progress*, /api/leagues*, /api/parent/*, /api/demo/*, /api/me,
     /api/identity, /api/video, /api/article, /api/schedules, /api/teachers*, /api/mytube/admin/*. */
export function sectionForApi(pathname: string): SectionKey | null {
  const p = pathname.replace(/\/+$/, '')
  const under = (pre: string) => p === pre || p.startsWith(pre + '/')
  if (under('/api/mytube/admin')) return null // la ingesta de YouTube del padre: siempre pasa
  if (under('/api/mytube')) return 'mytube'
  if (under('/api/chat')) return 'chat'
  if (under('/api/search')) return 'buscar'
  if (under('/api/learn') || under('/api/learn-routes') || under('/api/create')) return 'aprender'
  if (under('/api/market')) return 'tienda'
  if (under('/api/calendar')) return 'calendario'
  if (under('/api/space/drive') && p !== '/api/space/drive/folder') return 'espacio'
  if (under('/api/afterday')) return 'afterday'
  return null
}

/** La sección CERRADA a la que pertenece este pedido (con el "se abre a las…"), o null si pasa. */
export function closedSectionFor(pathname: string, now: Date = new Date()): { key: SectionKey; opensAt: string | null } | null {
  const key = sectionForApi(pathname)
  if (!key || isOpen(key, now)) return null
  return { key, opensAt: nextOpenLabel(key, now) }
}

export async function scheduleRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (url.pathname === '/api/schedules' && req.method === 'GET') {
    return send(res, 200, { schedules, serverNow: Date.now() })
  }
  return send(res, 404, { error: 'No existe.' })
}
