// Horarios por sección (porte Smarty W7) — el "candado por reloj" de HORARIOS.md del POC, server-side. En el POC vivía en
// localStorage del navegador ("todo en localStorage, que el niño puede editar": nota de seguridad del informe 03 §6); acá
// el server es la VERDAD y además ENFORCEA: fuera de la franja, la API de esa sección responde 403 (index.ts).
// Modelo EXACTO del POC (lib/featureSchedule.ts): por sección `{ restrictionActive, week }`, `week` = 7 días indexados con
// getDay() de JS (0 = domingo), cada día `{ open, from: "HH:MM", to: "HH:MM" }` abierto en [from, to). Sin entrada para
// una sección (o `restrictionActive:false`) = siempre abierta. El FEED (la home) nunca se gatea.
// CONFIG del padre (regla 9): PERSISTE en server/data/schedules.json, FUERA de /api/demo/reset.
// U3 (27-oct, docs/USUARIOS.md §9): los horarios son POR INTEGRANTE. schedules.json v2 = { version: 2, members: { [id]:
// secciones } } (un integrante sin entrada = sin horarios: todo abierto); el v1 (el objeto entero eran las secciones de
// ian) migra solo al cargar (familyMigrate.ts, puro) y el original queda UNA vez en schedules.json.pre-v2.
//
//   GET  /api/schedules[?member] → { schedules, serverNow, tz, member }   (público: el menú del chico y la pantalla
//        "cerrado" pintan con esto; serverNow para evaluar la franja con la hora del SERVER y no con el reloj del cliente;
//        tz = la zona horaria de la FAMILIA, IANA o null = la del server). Chico activo → los SUYOS (member ignorado:
//        nunca los de un hermano). Adulto → los del integrante de `?member=` (users.ts:memberFor; ausente = el primero;
//        uno que no es de la familia → 400); adulto sin integrantes → { schedules: {}, serverNow, tz } sin member (la
//        TopBar del adulto lo lee para el reloj: nunca 400 sin member).
//   POST /api/parent/schedules?member {patch} → { schedules, serverNow, tz, member }   (vive en parent.ts, con la sesión;
//        valida con `checkPatch` y guarda con `patchSchedules(member, …)`)
//
// Semántica fiel del POC (`isFeatureOpen`): día con open:false = cerrada todo el día; from == to = las 24 h; to < from =
// cruza la medianoche; datos incompletos o inválidos (un archivo editado a mano) = ABIERTA ("nunca encerramos al niño por
// un horario mal cargado; cerrar es siempre EXPLÍCITO"). `nextOpenLabel` = "se abre de nuevo a las HH:MM" solo si HOY abre
// más tarde (v1 del POC: no mira días siguientes).
// QUIRK FIEL (informe 03 §6): cerrar la franja NO corta el audio de fondo que ya sonaba (el server no puede, y el cliente
// a propósito no lo toca).
// ZONA HORARIA DE LA FAMILIA (deuda 14-oct): el día y la hora de la franja se leen en la zona IANA que eligió el padre
// (parent.json `tz`, Zona de padres → Límites) con el helper Intl compartido con el cliente (src/shared/lib/zonedClock.ts);
// sin zona (Automática), en la del server, como antes. El dato lo tiene parent.ts y lo PRESTA con setFamilyTzSource (así
// este módulo no importa parent.ts: parent.ts ya importa éste).
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { SERVER_ROOT } from './config'
import { isObject, upgradeSchedulesRaw } from './familyMigrate'
import { DEFAULT_USER_ID, actingUser, memberFor } from './users'
import { send } from './web'
import { wallClock } from '../../src/shared/lib/zonedClock'

export type SectionKey = 'chat' | 'buscar' | 'mytube' | 'aprender' | 'tienda' | 'calendario' | 'espacio' | 'afterday'
export interface DaySchedule { open: boolean; from: string; to: string }
export interface FeatureSchedule { restrictionActive: boolean; week: DaySchedule[] }
export type Schedules = Partial<Record<SectionKey, FeatureSchedule>>
/** schedules.json v2 (U3): los horarios de cada integrante. */
interface SchedulesFile { version: 2; members: Record<string, Schedules> }

const KEYS: SectionKey[] = ['chat', 'buscar', 'mytube', 'aprender', 'tienda', 'calendario', 'espacio', 'afterday']
const LABEL: Record<SectionKey, string> = {
  chat: 'Chat', buscar: 'Buscar', mytube: 'MyTube', aprender: 'Aprender', tienda: 'Tienda', calendario: 'Calendario', espacio: 'Mi espacio', afterday: 'After Day',
}
const DAY_NAME = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const FILE = join(SERVER_ROOT, 'data', 'schedules.json')

function load(): SchedulesFile {
  if (!existsSync(FILE)) return { version: 2, members: {} } // todo abierto; no se escribe hasta el primer guardado
  let text: string, up: ReturnType<typeof upgradeSchedulesRaw>
  try {
    text = readFileSync(FILE, 'utf8')
    up = upgradeSchedulesRaw(JSON.parse(text), DEFAULT_USER_ID)
  } catch (e) {
    console.error('[schedule] schedules.json ilegible → todo abierto (como el POC); copia en .roto-*:', e)
    try { renameSync(FILE, `${FILE}.roto-${Date.now()}`) } catch { /* sin copia: seguimos igual */ }
    return { version: 2, members: {} }
  }
  // Lo raro se evalúa igual con isOpenIn (falla en abierto); acá solo se descarta lo que ni siquiera es un objeto. Un
  // integrante que ya no es dependiente de nadie se conserva (no se pierde config) y no se sirve.
  const members: Record<string, Schedules> = {}
  for (const [id, v] of Object.entries(up.raw.members)) if (id !== '__proto__') members[id] = isObject(v) ? (v as Schedules) : {}
  const s: SchedulesFile = { version: 2, members }
  if (up.from === 1) {
    try { if (!existsSync(`${FILE}.pre-v2`)) { writeFileSync(`${FILE}.pre-v2`, text); console.log('[schedule] respaldo de la versión anterior en schedules.json.pre-v2') } }
    catch (e) { console.error('[schedule] no pude escribir el respaldo schedules.json.pre-v2:', e) }
    if (write(s)) console.log(`[schedule] schedules.json → v2 (los horarios de antes pasan a ${DEFAULT_USER_ID})`)
  }
  return s
}

function write(next: SchedulesFile): boolean {
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
let file: SchedulesFile = load()

/* ---------- la zona horaria de la familia (la presta parent.ts, dueño del dato) ---------- */
let tzSource: () => string | null = () => null
export function setFamilyTzSource(fn: () => string | null): void { tzSource = fn }
/** La zona IANA de la familia, o null = la del server. */
export const familyTzNow = (): string | null => tzSource()

/** Los horarios de un integrante (sin entrada = ninguno: todo abierto). */
export function schedulesOf(member: string): Schedules { return Object.hasOwn(file.members, member) ? file.members[member] : {} }
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

/** ¿Abierta en `now` según este horario? Fail-safe: sin restricción o con datos incompletos/inválidos ⇒ abierta.
 *  `tz` = la zona de la familia (null/ausente = la del server). */
export function isOpenIn(sched: FeatureSchedule | undefined, now: Date, tz?: string | null): boolean {
  try {
    if (!sched || !sched.restrictionActive) return true
    const week = sched.week
    if (!week || typeof week !== 'object') return true // forma inválida (ej. week ausente) → fail-safe abierto
    const clock = wallClock(now, tz)
    const day = (week as Record<number, DaySchedule | undefined>)[clock.day]
    if (!day) return true // día sin datos → no encerrar
    if (!day.open) return false // día explícitamente cerrado
    const from = parseHHMM(day.from), to = parseHHMM(day.to)
    if (from == null || to == null) return true // datos inválidos → fail-safe abierto
    const cur = clock.minutes
    if (to <= from) return cur >= from || cur < to // ventana que cruza medianoche (o 24 h si from == to)
    return cur >= from && cur < to
  } catch {
    return true // dato corrupto: NUNCA encierra al chico (fail-open, el contrato del POC)
  }
}
/** "Se abre de nuevo a las HH:MM" si HOY abre más tarde; null si no se puede precisar. */
export function nextOpenLabelIn(sched: FeatureSchedule | undefined, now: Date, tz?: string | null): string | null {
  try {
    if (!sched || !sched.restrictionActive) return null
    const clock = wallClock(now, tz)
    const day = (sched.week as Record<number, DaySchedule | undefined> | undefined)?.[clock.day]
    if (day?.open) {
      const from = parseHHMM(day.from)
      const cur = clock.minutes
      if (from != null && cur < from) return day.from
    }
    return null
  } catch { return null }
}
/** ¿La sección está abierta AHORA para este integrante (reloj del server, en la zona de la familia)? */
export function isOpen(key: SectionKey, member: string, now: Date = new Date()): boolean { return isOpenIn(schedulesOf(member)[key], now, tzSource()) }
export function nextOpenLabel(key: SectionKey, member: string, now: Date = new Date()): string | null { return nextOpenLabelIn(schedulesOf(member)[key], now, tzSource()) }

/* ---------- edición del padre ---------- */
type Check<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
/** Un patch por sección: el horario COMPLETO de esa sección, o null = "sin horario" (se borra la entrada). */
export type SchedulePatch = Partial<Record<SectionKey, FeatureSchedule | null>>

/** "8:00" → "08:00" (se guarda canónico: HH:MM con dos dígitos; parseHHMM ya lo validó). */
const hhmm = (s: string) => { const [h, m] = s.trim().split(':'); return `${h.padStart(2, '0')}:${m}` }
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
      week.push({ open: day.open, from: hhmm(day.from), to: hhmm(day.to) })
    }
    out[k] = { restrictionActive: s.restrictionActive, week }
  }
  return { ok: true, value: out }
}

const isDefaultWeek = (w: DaySchedule[]) => w.length === 7 && w.every(d => d.open === DEFAULT_DAY.open && d.from === DEFAULT_DAY.from && d.to === DEFAULT_DAY.to)

/** Merge por sección sobre los horarios de UN integrante: cada sección del patch REEMPLAZA su horario completo. null —o
 *  "sin restringir" con la semana de fábrica, que es lo mismo que no tener entrada— la borra; "sin restringir" con una
 *  semana PROPIA se guarda, porque el editor del POC la recuerda al volver a tildar. Escribe el archivo ENTERO (los demás
 *  integrantes intactos). null si no se pudo escribir (no cambia nada). */
export function patchSchedules(member: string, patch: SchedulePatch): Schedules | null {
  const next: Schedules = { ...schedulesOf(member) }
  for (const k of Object.keys(patch) as SectionKey[]) {
    if (!isSectionKey(k)) continue
    const v = patch[k]
    if (!v || (!v.restrictionActive && isDefaultWeek(v.week))) delete next[k]
    else next[k] = { restrictionActive: v.restrictionActive, week: v.week.map(d => ({ open: d.open, from: d.from, to: d.to })) }
  }
  const nextFile: SchedulesFile = { version: 2, members: { ...file.members, [member]: next } }
  if (!write(nextFile)) return null
  file = nextFile
  const on = KEYS.filter(k => next[k]?.restrictionActive)
  console.log(`[schedule] horarios de ${member} guardados → ${on.length ? `restringidas: ${on.join(', ')}` : 'ninguna sección restringida'}`)
  return next
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
   · calendario = /api/calendar: la sección Calendario DEL CHICO (cada usuario lee ahí SUS clases; los horarios solo se
     miran con un chico activo —index.ts, 14-oct—, así que al adulto no lo alcanzan).
   · /api/mentors* (tanda U2: Buscar → Mentores y Familia → Mentorías, SOLO del adulto) NO es de ninguna sección: no
     matchea ningún prefijo de acá —ni siquiera el de buscar, que es /api/search/*— y así tiene que quedar: como
     /api/mytube/admin/*, lo del adulto siempre es alcanzable (y un chico igual recibe 401 ahí).
   · NUNCA se gatean: /api/feed*, /api/friends*, /api/progress*, /api/leagues*, /api/parent/*, /api/demo/*, /api/me,
     /api/identity, /api/video, /api/article, /api/schedules, /api/mentors*, /api/mytube/admin/*. */
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

/** La sección CERRADA para este integrante a la que pertenece este pedido (con el "se abre a las…"), o null si pasa. */
export function closedSectionFor(pathname: string, member: string, now: Date = new Date()): { key: SectionKey; opensAt: string | null } | null {
  const key = sectionForApi(pathname)
  if (!key || isOpen(key, member, now)) return null
  return { key, opensAt: nextOpenLabel(key, member, now) }
}

export async function scheduleRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  if (url.pathname === '/api/schedules' && req.method === 'GET') {
    const me = actingUser(req)
    const reply = (member?: string) => send(res, 200, { schedules: member ? schedulesOf(member) : {}, serverNow: Date.now(), tz: tzSource(), ...(member ? { member } : {}) })
    // Un chico ve SUS horarios (member ignorado). El adulto: los del integrante pedido; sin integrantes y sin member, nada
    // (lee esto para el reloj de la TopBar: nunca 400 sin member).
    if (me.kind === 'child') return reply(me.id)
    if (!me.dependents?.length && !(url.searchParams.get('member') ?? '').trim()) return reply()
    const m = memberFor(req, url)
    return m.ok ? reply(m.id) : send(res, m.status, { error: m.error })
  }
  return send(res, 404, { error: 'No existe.' })
}
