// Mentores (ex Profesores) + Calendario por usuario — visión audios 30 y 67; línea 14-oct-2026 (docs/USUARIOS.md §3 y §6).
// FAKE de servidor con las formas finales (src/api/types.ts: Teacher, TeacherSlot, MentorPlan, MentorContract, Mentor,
// TakenSlot, MentorsResponse, ContractResult, ScheduleResult, CalendarEvent). El archivo conserva su nombre de antes.
// Pedido de Esteban (14-oct, tanda U2): los mentores le aparecen al ADULTO en Buscar como un tipo de recurso más. Al
// contratar elige CUÁNTO paga (plan: 1, 2 o 3 clases por semana) y PARA QUIÉN (él o un dependiente suyo); después del pago
// viene el POST-COMPRA: elige LOS DÍAS (tantos como pagó), cada uno con su hora. Las clases aparecen en el calendario del
// BENEFICIARIO. En Familia → Mentorías el adulto administra lo contratado. El chico no ve nada de esto: solo sus clases.
// (Antes —11-oct, "un marketplace de profesores en la sección padres"— el padre contrataba en Familia → Profesores con
// /api/teachers*: ese contrato se retiró con esta tanda.)
//
// Contrato HTTP (formas exactas en src/api/types.ts):
//   GET  /api/mentors                → MentorsResponse { mentors, taken, people }
//        mentors = el catálogo (orden fijo) con los contratos del adulto y de sus dependientes (sin `since`) · taken = por
//        beneficiario, las horas que ya ocupan sus contratos activos · people = id → nombre (el adulto y sus dependientes).
//   POST /api/mentors/contract {teacherId, daysPerWeek, beneficiary} → ContractResult { ok, error?, contract? }
//        crea el contrato `pending` (pagado, todavía sin días): el "pago" del demo es instantáneo y no cobra nada.
//   POST /api/mentors/schedule {contractId, slots}                   → ScheduleResult { ok, error?, contract?, eventsAdded? }
//        el post-compra: tantos días como el plan → `active`; eventsAdded = CLASSES_PER_SLOT × días.
//   POST /api/mentors/cancel   {contractId}                          → { ok, error? }  (pendiente o activo: sus clases salen)
//   GET  /api/calendar               → { events: CalendarEvent[] }  (las clases del usuario ACTIVO como beneficiario: SIN
//        precios, por inicio)
//   slot = { weekday 0=lunes … 6=domingo, hour en punto entre HOUR_MIN y HOUR_MAX }
// SOLO ADULTO: todo /api/mentors* pide un adulto como usuario activo (isAdultReq de users.ts: la sesión implícita de
// Familia, docs/USUARIOS.md §4); un chico → 401 { error: 'Solo para adultos.' }. GET /api/calendar es PÚBLICO: cada usuario
// lee SUS clases (por eso no lleva precios).
// Rechazos de NEGOCIO → HTTP 200 + ok:false + `error` legible para el adulto (patrón market.ts: el cliente tira ApiError
// ante !r.ok y perdería el motivo): mentor fuera del catálogo, plan que no es 1-3, beneficiario que no es de la familia,
// contrato repetido (mismo mentor y beneficiario), días que no son tantos como el plan, día u hora fuera de rango, dos
// clases el mismo día, hora que el beneficiario ya tiene con otro mentor, contrato que ya tiene sus días o que no existe.
// Pedido mal formado (cuerpo que no es un objeto JSON, sin teacherId / contractId) → 400 · método equivocado → 405 ·
// subruta desconocida → 404 · no se pudo guardar → 500.
// RETIRADOS (U2, 14-oct): GET /api/teachers · POST /api/teachers/hire · POST /api/teachers/cancel. Ya no llegan acá:
// index.ts les responde 404.
//
// MODELO: un contrato = mentor + beneficiario + plan (daysPerWeek) + sus días (slots) + estado. `pending` = pagado, falta
// elegir los días (slots []). `active` = cada día/hora (slot) lleva su `since` (inicio de la PRIMERA clase de SU serie,
// epoch ms). Las clases NO se guardan: se DERIVAN al leer — por cada slot, desde la primera que todavía no terminó,
// CLASSES_PER_SLOT seguidas, una por semana, de DURATION_MIN minutos. Así la serie "corre" sola y el demo nunca se ve
// vencido: siempre hay 4 por día contratado (la primera puede estar en curso). Agendar = la próxima ocurrencia
// ESTRICTAMENTE futura de cada día/hora y las 3 siguientes. Un contrato por (mentor, beneficiario) —el MISMO mentor puede
// tener uno para Ian y otro para Andrés— y un beneficiario nunca tiene dos clases a la misma hora (otro beneficiario sí: son
// personas distintas).
// FECHAS en hora DE PARED de la ZONA HORARIA DE LA FAMILIA (tanda B1: la que eligió el adulto en Familia → Límites; la
// presta schedule.ts con familyTzNow; null = Automática = la local del server, lo de siempre): "miércoles 17:00" son las
// 17:00 del reloj de la familia, esté donde esté el server y vea el calendario desde donde lo vea (el cliente pinta en esa
// misma zona). Se calcula con el helper Intl compartido (src/shared/lib/zonedClock.ts, como schedule.ts y feedFake.ts) y
// sumando SEMANAS EN HORA DE PARED, no milisegundos: con el cambio de horario de verano la clase de las 17 sigue a las 17.
// La serie de cada día se deriva al leer en la zona VIGENTE: si la familia cambia de zona, "los miércoles a las 17:00"
// pasan a ser las 17:00 de la zona nueva (`since` solo marca desde qué semana corre: la primera clase es el inicio de ese día
// y hora más cercano a él).
//
// PERSISTENCIA: server/data/teachers.json v2 { version: 2, seq, contracts: [...] } = CONFIG de la familia (regla 9 de
// docs/AGENTS.md: la config persiste y NO entra en /api/demo/reset). Escritura atómica (tmp + rename, como
// space.ts/parent.ts) e INMEDIATA. `seq` (tanda B1, ADITIVO) = el próximo id de contrato: SOLO CRECE y viaja en cada
// escritura, así un id cancelado nunca se reusa (una pestaña vieja de Mentorías o un `?agendar=<id>` viejo no pueden tocar
// otro contrato); un archivo sin `seq` (o con uno que no supera al id más alto) lo inicializa en máx(id) + 1. La PRIMERA
// vez (sin archivo) se escribe el seed: Matemática con Caro (miércoles 17:00) como contrato activo de Ian, para que su
// Calendario nazca vivo. MIGRACIÓN v1 → v2 al cargar: cada contratación vieja ({ hires: [{ teacherId, slot, since }] }, que
// eran del chico) pasa a un contrato `active` de ian con 1 clase por semana y su slot con su `since` (la serie sigue
// idéntica). Archivo ilegible o sin lista de contratos → copia en .roto-* y arranca del seed. Al cargar se sanea: mentor que
// no está en el catálogo, beneficiario que no es un usuario del demo (users.ts), plan o estado inválidos, contrato repetido
// (mismo mentor y beneficiario: queda el primero) o activo con días inválidos (no son tantos como el plan, día u hora fuera
// de rango, dos el mismo día, o a la misma hora que otra clase de su beneficiario) → se saltea con un aviso; un pendiente
// con días → se vacían; un `since` que no es un instante (entero de epoch ms) → arranca en la próxima clase; un id que no
// es un entero positivo o está repetido → se renumera con `seq`.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { SERVER_ROOT } from './config'
import { quarantine, tryWriteFileAtomic } from './durable'
import { familyTzNow } from './schedule'
import { DEFAULT_USER_ID, actingUser, isAdultReq, userById, type UserInfo } from './users'
import { readJson, send } from './web'
import { wallClock } from '../../src/shared/lib/zonedClock'

/* ---------- formas (espejo de src/api/types.ts: los tipos no se importan de src/; el reloj de pared sí, zonedClock.ts) ---------- */
interface TeacherSlot { weekday: number; hour: number }
interface Teacher { id: string; name: string; emoji: string; color: string; subject: string; pricePerHour: number; bio: string; rating: number }
type MentorPlan = 1 | 2 | 3
type ContractStatus = 'pending' | 'active'
interface MentorContract { id: number; teacherId: string; beneficiary: string; daysPerWeek: MentorPlan; slots: TeacherSlot[]; status: ContractStatus }
interface Mentor extends Teacher { contracts: MentorContract[] }
interface TakenSlot extends TeacherSlot { subject: string; mentorName: string }
interface MentorsResponse { mentors: Mentor[]; taken: Record<string, TakenSlot[]>; people: Record<string, string> }
interface CalendarEvent { id: number; teacherId: string; title: string; subject: string; emoji: string; color: string; start: number; durationMin: number }
type Body = { ok: boolean; error?: string; contract?: MentorContract; eventsAdded?: number }
type Out = { status: number; body: Body }

/* ---------- reglas ---------- */
/** Clases en punto entre estas horas (la última empieza a las 19 y termina a las 20): horario razonable para un chico. */
const HOUR_MIN = 9
const HOUR_MAX = 19
const DURATION_MIN = 60
/** Clases que se ven por cada día contratado (la serie corre sola: siempre las próximas 4). */
const CLASSES_PER_SLOT = 4
const DURATION_MS = DURATION_MIN * 60_000
const WEEK_MS = 7 * 86_400_000
/** Los planes: clases por semana (el precio semanal = plan × precio por hora). */
const PLANS: readonly MentorPlan[] = [1, 2, 3]
/** 0 = lunes … 6 = domingo (el weekday del contrato). */
const DAYS_PL = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'] as const

/* ---------- catálogo (datos del demo) ----------
   Mercado homeschooler de EE.UU. (VISION §1) con la UI en rioplatense: mentores bilingües y nativos, materias del día a
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
/** Seed de la PRIMERA vez: Caro ya le da Matemática a Ian, para que su Calendario nazca vivo. */
const SEED = { teacherId: 'caro-mendez', beneficiary: DEFAULT_USER_ID, slot: { weekday: 2, hour: 17 } } as const

const firstName = (name: string) => name.split(' ')[0]
const hh = (hour: number) => `${hour}:00`
const teacherDef = (id: string) => CATALOG.find(t => t.id === id)
/** "los miércoles a las 17:00" */
const slotEvery = (s: TeacherSlot) => `los ${DAYS_PL[s.weekday]} a las ${hh(s.hour)}`
/** "a, b y c" · "a, b o c" */
const listEs = (xs: string[], last = 'y') => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${last} ${xs[xs.length - 1]}`)
const slotsEvery = (slots: readonly TeacherSlot[]) => listEs(slots.map(slotEvery))
const planLabel = (n: number) => `${n} ${n === 1 ? 'clase' : 'clases'} por semana`
const obj = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as Record<string, unknown>
const byTime = (a: TeacherSlot, b: TeacherSlot) => a.weekday - b.weekday || a.hour - b.hour

/* ---------- la familia del adulto (users.ts) ---------- */
/** El adulto y sus dependientes que existen en el seed, en ese orden. */
function familyOf(adult: UserInfo): UserInfo[] {
  return [adult, ...(adult.dependents ?? []).flatMap(id => { const u = userById(id); return u ? [u] : [] })]
}
const nameOf = (id: string) => userById(id)?.name ?? id

/* ---------- fechas (hora de PARED en la zona de la familia; null = la local del server) ---------- */
type Tz = string | null
const MIN_MS = 60_000
const WEEK_MIN = 7 * 24 * 60
/** Minuto de la semana (0 = lunes 00:00) que marca el reloj de pared de `tz` en el instante `t`. wallClock (el helper
 *  compartido) devuelve el día como getDay() (0 = domingo) y, sin zona o con una que este motor no conoce, la local. */
function weekMinuteAt(t: number, tz: Tz): number {
  const w = wallClock(new Date(t), tz)
  return ((w.day + 6) % 7) * 24 * 60 + w.minutes
}
/** El inicio de clase de ese día y hora DE PARED en `tz` más cercano a `t` (a menos de media semana). Corre el instante
 *  lo que le falta al reloj de pared para marcar ese día y hora, y repite: el corrimiento del horario de verano (±1 h) o
 *  el de un ancla de otra zona (hasta ±26 h) se resuelve en una o dos vueltas. Así sumar semanas es sumarlas EN HORA DE
 *  PARED: el miércoles 17:00 sigue siendo el miércoles 17:00 de la familia aunque cambie el horario de verano. */
function snapToSlot(t: number, slot: TeacherSlot, tz: Tz): number {
  const target = slot.weekday * 24 * 60 + slot.hour * 60
  let x = Math.floor(t / MIN_MS) * MIN_MS // las zonas de hoy corren en minutos enteros
  for (let i = 0; i < 4; i++) {
    let d = (((target - weekMinuteAt(x, tz)) % WEEK_MIN) + WEEK_MIN) % WEEK_MIN
    if (d > WEEK_MIN / 2) d -= WEEK_MIN
    if (d === 0) break
    x += d * MIN_MS
  }
  return x
}
/** Inicio de la clase k de la serie de un día (k = 0 → la más cercana a `since`), en la pared de `tz`. */
const nthStart = (s: StoredSlot, k: number, tz: Tz): number => snapToSlot(s.since + k * WEEK_MS, s, tz)
/** Primer inicio ESTRICTAMENTE posterior a `now` con ese día y esa hora de pared en `tz`. */
function nextStart(slot: TeacherSlot, now: number, tz: Tz): number {
  const t = snapToSlot(now, slot, tz) // a menos de media semana: si ya pasó, la que sigue es la de la semana próxima
  return t > now ? t : snapToSlot(t + WEEK_MS, slot, tz)
}
/** ¿`since` es un instante usable como ancla de la serie? (entero de epoch ms; el día y la hora los pone el slot). */
const isInstant = (since: unknown): since is number => typeof since === 'number' && Number.isSafeInteger(since)
/** Para los logs: "28/10/2026, 17:00:00 (America/Argentina/Buenos_Aires)" · sin zona, la local del server. */
function whenLabel(t: number, tz: Tz): string {
  try { return `${new Date(t).toLocaleString('es-AR', { hourCycle: 'h23', timeZone: tz ?? undefined })}${tz ? ` (${tz})` : ''}` }
  catch { return new Date(t).toLocaleString('es-AR', { hourCycle: 'h23' }) }
}
const sameSlot = (a: TeacherSlot, b: TeacherSlot) => a.weekday === b.weekday && a.hour === b.hour

/* ---------- estado ---------- */
interface StoredSlot extends TeacherSlot { /** inicio de la PRIMERA clase de la serie de este día (epoch ms) */ since: number }
interface Contract { id: number; teacherId: string; beneficiary: string; daysPerWeek: MentorPlan; slots: StoredSlot[]; status: ContractStatus }
/** `seq` = el próximo id de contrato (solo crece: un id cancelado no vuelve a nacer). */
interface Store { version: 2; seq: number; contracts: Contract[] }

/** Las clases vigentes de un día contratado, en la pared de `tz`: desde la primera que todavía no terminó (y nunca antes
 *  de la primera de la serie). */
function classesOf(s: StoredSlot, now: number, tz: Tz): number[] {
  // Arranca una semana antes de la estimada (horario de verano, ancla de otra zona) y avanza hasta la primera que no terminó.
  let k = Math.max(0, Math.floor((now - s.since) / WEEK_MS) - 1)
  while (nthStart(s, k, tz) + DURATION_MS <= now) k++
  return Array.from({ length: CLASSES_PER_SLOT }, (_, i) => nthStart(s, k + i, tz))
}

/** weekday 0-6 y hora en punto dentro del rango. Solo números enteros (la UI manda números). */
function parseSlot(v: unknown): TeacherSlot | null {
  const { weekday, hour } = obj(v)
  if (typeof weekday !== 'number' || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) return null
  if (typeof hour !== 'number' || !Number.isInteger(hour) || hour < HOUR_MIN || hour > HOUR_MAX) return null
  return { weekday, hour }
}
const parsePlan = (v: unknown): MentorPlan | null => (typeof v === 'number' && (PLANS as readonly number[]).includes(v) ? v as MentorPlan : null)

/* ---------- persistencia ---------- */
const FILE = join(SERVER_ROOT, 'data', 'teachers.json')

/** FS-BASE-B: el helper común (durable.ts: tmp + fsync + rename, un solo formato de log). */
const writeAtomic = (s: Store): boolean => tryWriteFileAtomic(FILE, JSON.stringify(s, null, 2), 'mentors')
function seed(): Store {
  const { weekday, hour } = SEED.slot
  return { version: 2, seq: 2, contracts: [{ id: 1, teacherId: SEED.teacherId, beneficiary: SEED.beneficiary, daysPerWeek: 1,
    slots: [{ weekday, hour, since: nextStart({ weekday, hour }, Date.now(), familyTzNow()) }], status: 'active' }] }
}
/** Una contratación de la v1 ({teacherId, slot, since}: eran todas del chico) como contrato v2 (lo valida sanitize). */
function fromV1(it: unknown, i: number): Record<string, unknown> {
  const o = obj(it), s = obj(o.slot)
  return { id: i + 1, teacherId: o.teacherId, beneficiary: DEFAULT_USER_ID, daysPerWeek: 1,
    slots: [{ weekday: s.weekday, hour: s.hour, since: o.since }], status: 'active' }
}
/** Valida lo leído de disco (y migra la v1). null = no tiene forma de archivo de contratos (se trata como ilegible). */
function sanitize(raw: unknown): { store: Store; fixed: boolean } | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  let items: unknown[]
  let fixed: boolean
  if (Array.isArray(r.contracts)) { items = r.contracts; fixed = r.version !== 2 }
  else if (Array.isArray(r.hires)) {
    items = r.hires.map(fromV1)
    fixed = true
    console.log(`[mentors] teachers.json v1 → v2: ${items.length} contratación(es) pasan a contratos activos de ${DEFAULT_USER_ID} (1 clase por semana, la misma serie)`)
  } else return null
  const now = Date.now()
  const tz = familyTzNow()
  const out: Contract[] = []
  const renumber: Contract[] = []
  for (const it of items) {
    const o = obj(it)
    const teacherId = typeof o.teacherId === 'string' ? o.teacherId : ''
    const beneficiary = typeof o.beneficiary === 'string' ? o.beneficiary : ''
    const plan = parsePlan(o.daysPerWeek)
    const status: ContractStatus | null = o.status === 'pending' || o.status === 'active' ? o.status : null
    const rawSlots = Array.isArray(o.slots) ? o.slots : []
    const parsed = rawSlots.map(parseSlot)
    const slots = parsed.filter((s): s is TeacherSlot => !!s)
    const why = !teacherDef(teacherId) ? 'mentor que no está en el catálogo'
      : !userById(beneficiary) ? 'beneficiario que no es un usuario del demo'
      : !plan ? 'plan inválido (1 a 3 clases por semana)'
      : !status ? 'estado inválido'
      : out.some(c => c.teacherId === teacherId && c.beneficiary === beneficiary) ? 'contrato repetido (mismo mentor y beneficiario)'
      : status === 'pending' ? null
      : slots.length !== parsed.length ? 'día u hora inválidos'
      : slots.length !== plan ? `${slots.length} día(s) para un plan de ${plan}`
      : new Set(slots.map(s => s.weekday)).size !== slots.length ? 'dos clases el mismo día'
      : out.some(c => c.status === 'active' && c.beneficiary === beneficiary && c.slots.some(x => slots.some(s => sameSlot(x, s))))
        ? `misma hora que otra clase de ${beneficiary}`
      : null
    if (why || !plan || !status) {
      console.warn(`[mentors] contrato inválido en teachers.json (${why}), lo salteo: ${JSON.stringify(it).slice(0, 160)}`)
      fixed = true
      continue
    }
    const c: Contract = { id: 0, teacherId, beneficiary, daysPerWeek: plan, slots: [], status }
    if (status === 'pending') {
      if (rawSlots.length) { fixed = true; console.warn(`[mentors] contrato pendiente con días en teachers.json (#${String(o.id)}): se vacían`) }
    } else {
      c.slots = slots.map((s, i) => {
        // Un `since` de otra zona (la familia la cambió) o corrido NO se toca: la serie se deriva al leer en la zona vigente
        // y arranca en el inicio de ese día y hora más cercano a él. Solo se rehace si ni siquiera es un instante.
        let since: unknown = obj(rawSlots[i]).since
        if (!isInstant(since)) {
          since = nextStart(s, now, tz)
          fixed = true
          console.warn(`[mentors] contrato #${String(o.id)} (${teacherId}): la serie de ${slotEvery(s)} no tenía un inicio válido; arranca el ${whenLabel(since as number, tz)}`)
        }
        return { weekday: s.weekday, hour: s.hour, since: since as number }
      })
    }
    const id = o.id
    if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0 && !out.some(x => x.id === id)) c.id = id
    else { renumber.push(c); fixed = true }
    out.push(c)
  }
  // El contador: nunca por debajo del id más alto + 1 (sin `seq` —archivo de antes de B1, v1 migrado— o editado a mano).
  const max = out.reduce((m, c) => Math.max(m, c.id), 0)
  let seq = typeof r.seq === 'number' && Number.isSafeInteger(r.seq) && r.seq > max ? r.seq : max + 1
  if (seq !== r.seq) {
    fixed = true
    if (r.seq !== undefined) console.warn(`[mentors] seq inválido en teachers.json (${JSON.stringify(r.seq)}): sigue en ${seq}`)
  }
  for (const c of renumber) {
    c.id = seq++
    console.warn(`[mentors] contrato sin id válido (${c.teacherId} para ${c.beneficiary}): pasa a ser el #${c.id}`)
  }
  return { store: { version: 2, seq, contracts: out }, fixed }
}
function load(): Store {
  if (!existsSync(FILE)) {
    const s = seed()
    writeAtomic(s) // primera vez: queda escrito ya, no espera a un cambio
    console.log(`[mentors] teachers.json creado (v2): seed con Matemática con Caro para ${SEED.beneficiary}, ${slotEvery(SEED.slot)}`)
    return s
  }
  try {
    const r = sanitize(JSON.parse(readFileSync(FILE, 'utf8')))
    if (!r) throw new Error('sin la lista de contratos (contracts) ni la de contrataciones de la v1 (hires)')
    if (r.fixed) writeAtomic(r.store)
    return r.store
  } catch (e) {
    console.error('[mentors] teachers.json ilegible → arranco del seed; copia en .roto-*:', e)
    quarantine(FILE, 'mentors') // .roto-<ms>; sin copia, seguimos igual
    const s = seed()
    writeAtomic(s)
    return s
  }
}
const store: Store = load()
const save = () => writeAtomic(store) // `seq` viaja en cada escritura
/** El id del contrato que nace: el contador persistente, que solo crece (no se devuelve ni si el guardado falla: ese id no
 *  llegó a ningún cliente, y saltearlo es inofensivo). */
const nextId = () => store.seq++

/* ---------- vistas ---------- */
const catalogView = (t: TeacherDef): Teacher => ({
  id: t.id, name: t.name, emoji: t.emoji, color: t.color, subject: t.subject, pricePerHour: t.pricePerHour, bio: t.bio, rating: t.rating,
})
/** El contrato como viaja al cliente: los slots SIN `since`. */
const contractView = (c: Contract): MentorContract => ({
  id: c.id, teacherId: c.teacherId, beneficiary: c.beneficiary, daysPerWeek: c.daysPerWeek,
  slots: c.slots.map(({ weekday, hour }) => ({ weekday, hour })), status: c.status,
})
/** Las horas que ya ocupa un beneficiario: las de sus contratos ACTIVOS (los pagara quien los pagara), por día y hora. */
function takenOf(beneficiary: string): TakenSlot[] {
  const out: TakenSlot[] = []
  for (const c of store.contracts) {
    const t = c.status === 'active' && c.beneficiary === beneficiary ? teacherDef(c.teacherId) : undefined
    if (t) for (const s of c.slots) out.push({ weekday: s.weekday, hour: s.hour, subject: t.subject, mentorName: t.name })
  }
  return out.sort(byTime)
}
/** GET /api/mentors: el catálogo con los contratos de la familia del adulto, las horas ocupadas y los nombres. */
function mentorsView(adult: UserInfo): MentorsResponse {
  const fam = familyOf(adult)
  const ids = fam.map(u => u.id)
  const mine = store.contracts.filter(c => ids.includes(c.beneficiary))
  const taken: Record<string, TakenSlot[]> = {}
  const people: Record<string, string> = {}
  for (const u of fam) { people[u.id] = u.name; taken[u.id] = takenOf(u.id) }
  return { mentors: CATALOG.map(t => ({ ...catalogView(t), contracts: mine.filter(c => c.teacherId === t.id).map(contractView) })), taken, people }
}

/** Las clases de un usuario (sin precios): las vigentes de cada día de sus contratos activos, por inicio. El id es
 *  estable por mentor + inicio (minutos desde epoch × 100 + posición en el catálogo), así una relectura no cambia las keys
 *  de la UI; dos días del mismo contrato no chocan (empiezan en momentos distintos) y dos mentores tampoco (un
 *  beneficiario nunca tiene dos clases a la misma hora). */
function calendar(userId: string, now = Date.now()): CalendarEvent[] {
  const tz = familyTzNow() // la zona VIGENTE de la familia: "miércoles 17:00" es su reloj de pared
  const out: CalendarEvent[] = []
  for (const c of store.contracts) {
    if (c.status !== 'active' || c.beneficiary !== userId) continue
    const i = CATALOG.findIndex(t => t.id === c.teacherId)
    if (i < 0) continue
    const t = CATALOG[i]
    for (const s of c.slots) {
      for (const start of classesOf(s, now, tz)) {
        out.push({
          id: Math.floor(start / 60_000) * 100 + i + 1, teacherId: t.id, title: `Clase de ${t.subject} con ${firstName(t.name)}`,
          subject: t.subject, emoji: t.emoji, color: t.color, start, durationMin: DURATION_MIN,
        })
      }
    }
  }
  return out.sort((a, b) => a.start - b.start || a.id - b.id)
}

/* ---------- lógica ---------- */
const fail = (error: string): Out => ({ status: 200, body: { ok: false, error } })
/** Un contrato de la familia del adulto (uno de otra familia es como si no existiera). */
function findOwn(adult: UserInfo, id: number): Contract | undefined {
  const ids = familyOf(adult).map(u => u.id)
  return store.contracts.find(c => c.id === id && ids.includes(c.beneficiary))
}

/** El pago (instantáneo en el demo): el contrato nace `pending`, sin días. */
function createContract(adult: UserInfo, teacherId: string, rawPlan: unknown, rawBeneficiary: unknown): Out {
  const t = teacherDef(teacherId)
  if (!t) return fail('Ese mentor no está en el catálogo.')
  const plan = parsePlan(rawPlan)
  if (!plan) return fail('Elegí cuántas clases por semana: 1, 2 o 3.')
  const fam = familyOf(adult)
  const beneficiary = typeof rawBeneficiary === 'string' ? rawBeneficiary.trim() : ''
  if (!fam.some(u => u.id === beneficiary)) {
    return fail(`Las clases pueden ser ${listEs(['para vos', ...fam.slice(1).map(u => `para ${u.name}`)], 'o')}.`)
  }
  const self = beneficiary === adult.id
  const dup = store.contracts.find(c => c.teacherId === t.id && c.beneficiary === beneficiary)
  if (dup) {
    return fail(dup.status === 'active'
      ? `${t.name} ya ${self ? 'te da clases' : `le da clases a ${nameOf(beneficiary)}`} ${slotsEvery(dup.slots)}. Para cambiar los días, cancelá esas clases en Familia → Mentorías y volvé a contratar.`
      : `Ya contrataste a ${t.name} para ${self ? 'vos' : nameOf(beneficiary)}: falta elegir los días. Elegilos desde su tarjeta o desde Familia → Mentorías.`)
  }
  const c: Contract = { id: nextId(), teacherId: t.id, beneficiary, daysPerWeek: plan, slots: [], status: 'pending' }
  store.contracts.push(c)
  if (!save()) {
    store.contracts.pop()
    return { status: 500, body: { ok: false, error: 'No pude guardar la contratación. Probá de nuevo.' } }
  }
  console.log(`[mentors] contrato #${c.id}: ${t.name} (${t.subject}) para ${beneficiary} · ${planLabel(plan)} → pagado, falta elegir los días`)
  return { status: 200, body: { ok: true, contract: contractView(c) } }
}

/** El post-compra: los días del contrato pendiente (tantos como el plan, distintos, en punto y libres para SU beneficiario). */
function scheduleContract(adult: UserInfo, contractId: number, rawSlots: unknown): Out {
  const c = findOwn(adult, contractId)
  if (!c) return fail('Esa contratación ya no existe: puede que se haya cancelado desde otra pestaña.')
  if (c.status === 'active') {
    return fail(`Esas clases ya tienen sus días: ${slotsEvery(c.slots)}. Para cambiarlos, cancelá esas clases en Familia → Mentorías y volvé a contratar.`)
  }
  const n = c.daysPerWeek
  const raws = Array.isArray(rawSlots) ? rawSlots : []
  if (raws.length !== n) return fail(`El plan es de ${planLabel(n)}: elegí ${n === 1 ? 'un día' : `${n} días`}, cada uno con su hora.`)
  const parsed = raws.map(parseSlot)
  const slots = parsed.filter((s): s is TeacherSlot => !!s)
  if (slots.length !== n) return fail(`Elegí días de lunes a domingo y horas en punto entre las ${hh(HOUR_MIN)} y las ${hh(HOUR_MAX)}.`)
  if (new Set(slots.map(s => s.weekday)).size !== n) return fail('Cada clase va en un día distinto de la semana.')
  const taken = takenOf(c.beneficiary)
  for (const s of slots) {
    const clash = taken.find(x => sameSlot(x, s))
    if (clash) {
      const who = c.beneficiary === adult.id ? 'tenés' : `${nameOf(c.beneficiary)} tiene`
      return fail(`Ese horario ya está ocupado: ${slotEvery(s)} ${who} ${clash.subject} con ${clash.mentorName}. Elegí otro.`)
    }
  }
  const now = Date.now()
  const tz = familyTzNow()
  c.slots = [...slots].sort(byTime).map(s => ({ weekday: s.weekday, hour: s.hour, since: nextStart(s, now, tz) }))
  c.status = 'active'
  if (!save()) {
    c.slots = []
    c.status = 'pending'
    return { status: 500, body: { ok: false, error: 'No pude guardar los días. Probá de nuevo.' } }
  }
  const added = CLASSES_PER_SLOT * c.slots.length
  const first = Math.min(...c.slots.map(s => s.since))
  console.log(`[mentors] contrato #${c.id} con días: ${teacherDef(c.teacherId)?.name ?? c.teacherId} para ${c.beneficiary} · ${slotsEvery(c.slots)} → ${added} clases desde el ${whenLabel(first, tz)}`)
  return { status: 200, body: { ok: true, contract: contractView(c), eventsAdded: added } }
}

/** Cancelar: sale el contrato (pendiente o con días) y, con él, todas sus clases. */
function cancelContract(adult: UserInfo, contractId: number): Out {
  const c = findOwn(adult, contractId)
  if (!c) return fail('Esa contratación ya no estaba: puede que se haya cancelado desde otra pestaña.')
  const i = store.contracts.indexOf(c)
  store.contracts.splice(i, 1)
  if (!save()) {
    store.contracts.splice(i, 0, c)
    return { status: 500, body: { ok: false, error: 'No pude guardar el cambio. Probá de nuevo.' } }
  }
  console.log(`[mentors] contrato #${c.id} cancelado: ${teacherDef(c.teacherId)?.name ?? c.teacherId} para ${c.beneficiary}${c.slots.length ? ` (${slotsEvery(c.slots)}): sus clases salen del calendario` : ' (estaba pendiente de días)'}`)
  return { status: 200, body: { ok: true } }
}

/* ---------- rutas ---------- */
export async function teachersRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const path = url.pathname.replace(/\/+$/, '')
  const method = req.method ?? 'GET'

  // El calendario: PÚBLICO, las clases del usuario ACTIVO (cada uno ve las suyas; sin precios).
  if (path === '/api/calendar') {
    if (method !== 'GET') return send(res, 405, { error: 'Método no permitido: usá GET.' })
    return send(res, 200, { events: calendar(actingUser(req).id) })
  }
  if (path !== '/api/mentors' && !path.startsWith('/api/mentors/')) return send(res, 404, { error: 'not found' })
  // Mentores: SOLO con un adulto como usuario activo (la sesión implícita de Familia). Un chico no ve precios ni contrata.
  if (!isAdultReq(req)) return send(res, 401, { error: 'Solo para adultos.' })
  const adult = actingUser(req)
  if (path === '/api/mentors') {
    if (method !== 'GET') return send(res, 405, { error: 'Método no permitido: usá GET.' })
    return send(res, 200, mentorsView(adult))
  }
  if (path !== '/api/mentors/contract' && path !== '/api/mentors/schedule' && path !== '/api/mentors/cancel') return send(res, 404, { error: 'not found' })
  if (method !== 'POST') return send(res, 405, { ok: false, error: 'Método no permitido: usá POST.' })

  let b: Record<string, unknown>
  try {
    const raw = await readJson<unknown>(req)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('no es un objeto')
    b = raw as Record<string, unknown>
  } catch { return send(res, 400, { ok: false, error: 'Pedido inválido (se esperaba un objeto JSON).' }) }

  if (path === '/api/mentors/contract') {
    const teacherId = typeof b.teacherId === 'string' ? b.teacherId.trim() : ''
    if (!teacherId) return send(res, 400, { ok: false, error: 'Falta el mentor (teacherId).' })
    const r = createContract(adult, teacherId, b.daysPerWeek, b.beneficiary)
    return send(res, r.status, r.body)
  }
  const contractId = b.contractId
  if (typeof contractId !== 'number' || !Number.isSafeInteger(contractId)) return send(res, 400, { ok: false, error: 'Falta la contratación (contractId).' })
  const r = path === '/api/mentors/schedule' ? scheduleContract(adult, contractId, b.slots) : cancelContract(adult, contractId)
  return send(res, r.status, r.body)
}
