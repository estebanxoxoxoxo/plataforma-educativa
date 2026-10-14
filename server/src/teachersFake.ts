// Profesores (marketplace del padre) + Calendario del chico — visión audios 30 y 67 (mentores/profesores), v1 demo.
// FAKE de servidor con las formas finales (src/api/types.ts: Teacher, TeacherSlot, HireResult, CalendarEvent).
// Pedido de Esteban (11-oct-2026): "un marketplace de profesores en la sección padres. Cada card indica el precio por
// hora y contactar. Esto genera en la vista de niño un calendario". El padre elige un profe y un horario SEMANAL (día +
// hora en punto) en la Zona de padres (/padres/profesores) y el chico ve sus clases en /calendario.
//
// Contrato HTTP (formas exactas en src/api/types.ts):
//   GET  /api/teachers                 → { teachers: Teacher[] }  (orden del catálogo; hired/slot según lo contratado)
//   POST /api/teachers/hire {id, slot}  → HireResult { ok, error?, teacher?, eventsAdded? }
//        slot = { weekday 0=lunes … 6=domingo, hour en punto entre HOUR_MIN y HOUR_MAX }
//   POST /api/teachers/cancel {id}      → { ok, error? }  (sale la contratación y, con ella, todas sus clases)
//   GET  /api/calendar                 → { events: CalendarEvent[] }  (las clases del CHICO: SIN precios, por start)
// Rechazos de NEGOCIO → HTTP 200 + ok:false + `error` legible para el padre (patrón market.ts: el cliente tira ApiError
// ante !r.ok y perdería el motivo): profe que no está en el catálogo, horario fuera de lo permitido, profe ya contratado,
// horario que el chico ya tiene con otro profe, cancelar algo que no estaba contratado. Pedido mal formado (cuerpo que no
// es un objeto JSON, sin id) → 400 · método equivocado → 405 · subruta desconocida → 404 · no se pudo guardar → 500.
// ADITIVO: `error` en la respuesta de cancel (el contrato dice { ok }); el cliente no lo necesita para funcionar.
//
// MODELO: una contratación = profe + horario semanal + `since` (inicio de la PRIMERA clase de la serie, epoch ms). Las
// clases NO se guardan: se DERIVAN al leer — desde la primera que todavía no terminó, CLASSES_PER_HIRE seguidas, una por
// semana, de DURATION_MIN minutos. Así la serie "corre" sola y el demo nunca se ve vencido: siempre hay 4 por profe
// contratado (la primera puede estar en curso). Contratar = la próxima ocurrencia ESTRICTAMENTE futura de ese día/hora y
// las 3 siguientes (eventsAdded = 4). Un horario por profe (Teacher.slot es uno) y nunca dos profes a la misma hora.
// FECHAS en hora LOCAL del server (= la de la familia en el demo), sumando DÍAS de calendario y no milisegundos: con el
// cambio de horario de verano la clase de las 17 sigue a las 17.
//
// PERSISTENCIA: server/data/teachers.json = CONFIG del padre (regla 9 de docs/AGENTS.md: la config persiste y NO entra
// en /api/demo/reset). Escritura atómica (tmp + rename, como space.ts/parent.ts) e INMEDIATA. La PRIMERA vez (sin
// archivo) se escribe el seed: Matemática con Caro ya contratada (miércoles 17:00), para que el Calendario del chico
// nazca vivo. Archivo ilegible o sin lista de contrataciones → copia en .roto-* y arranca del seed. Una contratación
// inválida (profe que ya no está, horario fuera de rango, repetida o a la misma hora que otra) se saltea con un aviso; un
// `since` que no cuadra con su horario se recalcula. Guardar `since` (y no "cuándo se contrató") hace que volver a
// contratar el mismo horario deje el archivo idéntico.
//
// SESIÓN (deuda saldada 14-oct): los endpoints del PADRE —GET /api/teachers (la lista con precios y lo contratado), POST
// /api/teachers/hire (contratar con su horario) y POST /api/teachers/cancel— piden la sesión del portón (X-Parent-Token, el
// mismo chequeo de parent.ts: hasParentSession); sin ella → 401 { error: 'Sesión del padre vencida. Volvé a entrar con el
// PIN.' }. El calendario (GET /api/calendar) queda PÚBLICO a propósito: lo lee la UI del CHICO (CalendarPage), y por eso
// no lleva precios; ningún otro endpoint de acá lo lee el chico. (El panel del padre también relee /api/calendar tras
// contratar, para contar las clases: público, da igual.)
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { SERVER_ROOT, config } from './config'
import { PARENT_SESSION_EXPIRED, hasParentSession } from './parent'
import { readJson, send } from './web'

/* ---------- formas (espejo de src/api/types.ts; el server no importa de src/) ---------- */
interface TeacherSlot { weekday: number; hour: number }
interface Teacher {
  id: string; name: string; emoji: string; color: string; subject: string
  pricePerHour: number; bio: string; rating: number; hired: boolean; slot: TeacherSlot | null
}
interface CalendarEvent { id: number; teacherId: string; title: string; subject: string; emoji: string; color: string; start: number; durationMin: number }
type HireBody = { ok: boolean; error?: string; teacher?: Teacher; eventsAdded?: number }

/* ---------- reglas ---------- */
/** Clases en punto entre estas horas (la última empieza a las 19 y termina a las 20): horario razonable para un chico. */
const HOUR_MIN = 9
const HOUR_MAX = 19
const DURATION_MIN = 60
const CLASSES_PER_HIRE = 4
const DURATION_MS = DURATION_MIN * 60_000
const WEEK_MS = 7 * 86_400_000
/** 0 = lunes … 6 = domingo (el weekday del contrato). */
const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const
const DAYS_PL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'] as const

/* ---------- catálogo (datos del demo) ----------
   Mercado homeschooler de EE.UU. (VISION §1) con la UI en rioplatense: profes bilingües y nativos, materias del día a
   día de una familia que educa en casa más las "extra" (música, ajedrez, programación). Precios de clase particular
   online (USD 25-60 la hora) y ratings altos pero creíbles. Sin fotos ni assets externos: emoji de la materia sobre un
   color de la paleta del demo. El primer nombre es como lo llama el chico ("Clase de Matemática con Caro"). */
interface TeacherDef { id: string; name: string; emoji: string; color: string; subject: string; pricePerHour: number; bio: string; rating: number }
const CATALOG: readonly TeacherDef[] = [
  { id: 'caro-mendez', name: 'Caro Méndez', subject: 'Matemática', emoji: '🧮', color: '#3A5BD9', pricePerHour: 40, rating: 4.9,
    bio: 'Convierte cada problema en un misterio para resolver: los chicos terminan pidiendo otro.' },
  { id: 'lucia-ferraro', name: 'Lucía Ferraro', subject: 'Lectura y escritura', emoji: '📚', color: '#E5487A', pricePerHour: 38, rating: 4.9,
    bio: 'Arma un club de lectura de a dos y ayuda a escribir los cuentos que tienen en la cabeza.' },
  { id: 'emily-carter', name: 'Emily Carter', subject: 'Inglés', emoji: '🗣️', color: '#F26B3A', pricePerHour: 35, rating: 4.8,
    bio: 'Habla en inglés desde el primer minuto, con canciones y juegos que se pegan solos.' },
  { id: 'sam-rivera', name: 'Sam Rivera', subject: 'Ciencias', emoji: '🔬', color: '#18A957', pricePerHour: 45, rating: 4.7,
    bio: 'Cada clase trae un experimento que se hace con cosas de la cocina.' },
  { id: 'martin-ortega', name: 'Martín Ortega', subject: 'Historia', emoji: '🏛️', color: '#F2A81D', pricePerHour: 36, rating: 4.5,
    bio: 'Cuenta la historia como una aventura, con mapas y personajes de verdad.' },
  { id: 'dev-patel', name: 'Dev Patel', subject: 'Programación', emoji: '💻', color: '#1C9BD6', pricePerHour: 55, rating: 4.6,
    bio: 'Arranca con bloques de colores y en pocas semanas ya programan su propio videojuego.' },
  { id: 'grace-kim', name: 'Grace Kim', subject: 'Música', emoji: '🎹', color: '#8A5CF5', pricePerHour: 50, rating: 4.9,
    bio: 'Piano desde cero: en la primera clase ya sale una canción entera.' },
  { id: 'leo-novak', name: 'Leo Novak', subject: 'Ajedrez', emoji: '♟️', color: '#13A39A', pricePerHour: 28, rating: 4.8,
    bio: 'Enseña a pensar dos jugadas adelante, con partidas cortas y mucha paciencia.' },
]
/** Seed de la PRIMERA vez: un profe ya contratado para que el Calendario del chico nazca vivo. */
const SEED_HIRE = { teacherId: 'caro-mendez', slot: { weekday: 2, hour: 17 } } as const

const kidName = () => config.apodo || 'tu hijo'
const firstName = (name: string) => name.split(' ')[0]
const hh = (hour: number) => `${hour}:00`
const teacherDef = (id: string) => CATALOG.find(t => t.id === id)

/* ---------- fechas (hora local) ---------- */
const weekdayOf = (d: Date) => (d.getDay() + 6) % 7 // JS: 0 = domingo → contrato: 0 = lunes
/** Inicio de la clase k de la serie (k = 0 → `since`): suma días de calendario (a prueba de horario de verano). */
function nthStart(since: number, hour: number, k: number): number {
  const d = new Date(since)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * k, hour, 0, 0, 0).getTime()
}
/** Primer inicio ESTRICTAMENTE posterior a `now` con ese día y esa hora. */
function nextStart(slot: TeacherSlot, now: number): number {
  const d = new Date(now)
  const delta = (slot.weekday - weekdayOf(d) + 7) % 7
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta, slot.hour, 0, 0, 0).getTime()
  return t > now ? t : new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta + 7, slot.hour, 0, 0, 0).getTime()
}
/** ¿`since` es un inicio de clase de ese horario (ese día de la semana, esa hora en punto)? */
function fitsSlot(since: number, slot: TeacherSlot): boolean {
  if (!Number.isSafeInteger(since)) return false
  const d = new Date(since)
  return weekdayOf(d) === slot.weekday && d.getHours() === slot.hour && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0
}
const sameSlot = (a: TeacherSlot, b: TeacherSlot) => a.weekday === b.weekday && a.hour === b.hour

/* ---------- estado ---------- */
interface Hire { teacherId: string; slot: TeacherSlot; /** inicio de la PRIMERA clase de la serie (epoch ms) */ since: number }
interface Store { version: 1; hires: Hire[] }

/** Las clases vigentes de una contratación: desde la primera que todavía no terminó (y nunca antes de `since`). */
function classesOf(h: Hire, now: number): number[] {
  // Arranca una semana antes de la estimada (el horario de verano corre ±1 h) y avanza hasta la primera que no terminó.
  let k = Math.max(0, Math.floor((now - h.since) / WEEK_MS) - 1)
  while (nthStart(h.since, h.slot.hour, k) + DURATION_MS <= now) k++
  return Array.from({ length: CLASSES_PER_HIRE }, (_, i) => nthStart(h.since, h.slot.hour, k + i))
}

/** weekday 0-6 y hora en punto dentro del rango. Solo números enteros (la UI manda números). */
function parseSlot(v: unknown): TeacherSlot | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const { weekday, hour } = v as Record<string, unknown>
  if (typeof weekday !== 'number' || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null
  if (typeof hour !== 'number' || !Number.isInteger(hour) || hour < HOUR_MIN || hour > HOUR_MAX) return null
  return { weekday, hour }
}

/* ---------- persistencia ---------- */
const FILE = join(SERVER_ROOT, 'data', 'teachers.json')

function writeAtomic(s: Store): boolean {
  try { writeFileSync(FILE + '.tmp', JSON.stringify(s, null, 2)); renameSync(FILE + '.tmp', FILE); return true }
  catch (e) { console.error('[teachers] no pude guardar teachers.json:', e); return false }
}
function seed(): Store {
  const slot = { ...SEED_HIRE.slot }
  return { version: 1, hires: [{ teacherId: SEED_HIRE.teacherId, slot, since: nextStart(slot, Date.now()) }] }
}
/** Valida lo leído de disco. null = no tiene forma de archivo de contrataciones (se trata como ilegible). */
function sanitize(raw: unknown): { store: Store; fixed: boolean } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.hires)) return null
  const now = Date.now()
  const hires: Hire[] = []
  let fixed = r.version !== 1
  for (const it of r.hires) {
    const o = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>
    const id = typeof o.teacherId === 'string' ? o.teacherId : ''
    const slot = parseSlot(o.slot)
    const why = !teacherDef(id) ? 'profe que no está en el catálogo'
      : !slot ? 'horario inválido'
      : hires.some(h => h.teacherId === id) ? 'profe repetido'
      : hires.some(h => sameSlot(h.slot, slot)) ? 'misma hora que otra contratación'
      : null
    if (why || !slot) { console.warn(`[teachers] contratación inválida en teachers.json (${why}), la salteo: ${JSON.stringify(it).slice(0, 120)}`); fixed = true; continue }
    let since = typeof o.since === 'number' ? o.since : NaN
    if (!fitsSlot(since, slot)) {
      since = nextStart(slot, now)
      fixed = true
      console.warn(`[teachers] «${id}»: el inicio de la serie no cuadraba con su horario; arranca de nuevo el ${new Date(since).toLocaleString('es-AR')}`)
    }
    hires.push({ teacherId: id, slot, since })
  }
  return { store: { version: 1, hires }, fixed }
}
function load(): Store {
  if (!existsSync(FILE)) {
    const s = seed()
    writeAtomic(s) // primera vez: queda escrito ya, no espera a un cambio
    console.log(`[teachers] teachers.json creado: seed con ${s.hires.length} profe contratado (Matemática, ${DAYS_PL[SEED_HIRE.slot.weekday]} ${hh(SEED_HIRE.slot.hour)})`)
    return s
  }
  try {
    const r = sanitize(JSON.parse(readFileSync(FILE, 'utf8')))
    if (!r) throw new Error('sin la lista de contrataciones (hires)')
    if (r.fixed) writeAtomic(r.store)
    return r.store
  } catch (e) {
    console.error('[teachers] teachers.json ilegible → arranco del seed; copia en .roto-*:', e)
    try { renameSync(FILE, `${FILE}.roto-${Date.now()}`) } catch { /* sin copia: seguimos igual */ }
    const s = seed()
    writeAtomic(s)
    return s
  }
}
const store: Store = load()
const save = () => writeAtomic(store)

/* ---------- vistas ---------- */
function teacherView(t: TeacherDef): Teacher {
  const h = store.hires.find(x => x.teacherId === t.id)
  return {
    id: t.id, name: t.name, emoji: t.emoji, color: t.color, subject: t.subject,
    pricePerHour: t.pricePerHour, bio: t.bio, rating: t.rating, hired: !!h, slot: h ? { ...h.slot } : null,
  }
}
const teachers = () => CATALOG.map(teacherView)

/** Las clases del chico (sin precios): las vigentes de cada contratación, por inicio. El id es estable por profe +
 *  inicio (minutos desde epoch × 100 + posición en el catálogo), así una relectura no cambia las keys de la UI. */
function calendar(now = Date.now()): CalendarEvent[] {
  const out: CalendarEvent[] = []
  for (const h of store.hires) {
    const i = CATALOG.findIndex(t => t.id === h.teacherId)
    if (i < 0) continue
    const t = CATALOG[i]
    for (const start of classesOf(h, now)) {
      out.push({
        id: Math.floor(start / 60_000) * 100 + i + 1, teacherId: t.id, title: `Clase de ${t.subject} con ${firstName(t.name)}`,
        subject: t.subject, emoji: t.emoji, color: t.color, start, durationMin: DURATION_MIN,
      })
    }
  }
  return out.sort((a, b) => a.start - b.start || a.id - b.id)
}

/* ---------- lógica ---------- */
function hire(id: string, rawSlot: unknown): { status: number; body: HireBody } {
  const t = teacherDef(id)
  if (!t) return { status: 200, body: { ok: false, error: 'Ese profe no está en el catálogo.' } }
  const slot = parseSlot(rawSlot)
  if (!slot) return { status: 200, body: { ok: false, error: `Elegí un día de lunes a domingo y una hora en punto entre las ${hh(HOUR_MIN)} y las ${hh(HOUR_MAX)}.` } }
  const kid = kidName()
  const mine = store.hires.find(h => h.teacherId === id)
  if (mine) {
    return { status: 200, body: { ok: false, error: `${t.name} ya le da clases a ${kid}: los ${DAYS_PL[mine.slot.weekday]} a las ${hh(mine.slot.hour)}. Para cambiar el horario, cancelá esas clases y volvé a contratar.` } }
  }
  const clash = store.hires.find(h => sameSlot(h.slot, slot))
  const other = clash && teacherDef(clash.teacherId)
  if (other) {
    return { status: 200, body: { ok: false, error: `Ese horario ya está ocupado: los ${DAYS_PL[slot.weekday]} a las ${hh(slot.hour)} ${kid} tiene ${other.subject} con ${other.name}. Elegí otro.` } }
  }
  const h: Hire = { teacherId: t.id, slot, since: nextStart(slot, Date.now()) }
  store.hires.push(h)
  if (!save()) {
    store.hires.pop()
    return { status: 500, body: { ok: false, error: 'No pude guardar la contratación. Probá de nuevo.' } }
  }
  console.log(`[teachers] contratado: ${t.name} (${t.subject}) · ${DAYS_PL[slot.weekday]} ${hh(slot.hour)} → ${CLASSES_PER_HIRE} clases desde el ${new Date(h.since).toLocaleDateString('es-AR')}`)
  return { status: 200, body: { ok: true, teacher: teacherView(t), eventsAdded: CLASSES_PER_HIRE } }
}

function cancel(id: string): { status: number; body: { ok: boolean; error?: string } } {
  const i = store.hires.findIndex(h => h.teacherId === id)
  if (i < 0) return { status: 200, body: { ok: false, error: teacherDef(id) ? 'Ese profe no estaba contratado.' : 'Ese profe no está en el catálogo.' } }
  const [gone] = store.hires.splice(i, 1)
  if (!save()) {
    store.hires.splice(i, 0, gone)
    return { status: 500, body: { ok: false, error: 'No pude guardar el cambio. Probá de nuevo.' } }
  }
  console.log(`[teachers] cancelado: ${teacherDef(id)?.name ?? id} (${DAYS_PL[gone.slot.weekday]} ${hh(gone.slot.hour)}): sus clases salen del calendario`)
  return { status: 200, body: { ok: true } }
}

/* ---------- rutas ---------- */
export async function teachersRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const path = url.pathname.replace(/\/+$/, '')
  const method = req.method ?? 'GET'
  // Lo del PADRE (/api/teachers*) con la sesión del portón; /api/calendar (del chico) sigue público.
  if (path.startsWith('/api/teachers') && !hasParentSession(req)) return send(res, 401, { error: PARENT_SESSION_EXPIRED })

  if (path === '/api/teachers' || path === '/api/calendar') {
    if (method !== 'GET') return send(res, 405, { error: 'Método no permitido: usá GET.' })
    return path === '/api/teachers' ? send(res, 200, { teachers: teachers() }) : send(res, 200, { events: calendar() })
  }
  if (path !== '/api/teachers/hire' && path !== '/api/teachers/cancel') return send(res, 404, { error: 'not found' })
  if (method !== 'POST') return send(res, 405, { ok: false, error: 'Método no permitido: usá POST.' })

  let b: Record<string, unknown>
  try {
    const raw = await readJson<unknown>(req)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('no es un objeto')
    b = raw as Record<string, unknown>
  } catch { return send(res, 400, { ok: false, error: 'Pedido inválido (se esperaba un objeto JSON).' }) }
  const id = typeof b.id === 'string' ? b.id.trim() : ''
  if (!id) return send(res, 400, { ok: false, error: 'Falta el profe (id).' })

  const r = path.endsWith('/hire') ? hire(id, b.slot) : cancel(id)
  return send(res, r.status, r.body)
}
