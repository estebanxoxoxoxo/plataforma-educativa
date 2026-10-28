// Ciclo del día (tanda F1, 28-oct; docs/USUARIOS.md §11) — las reglas PURAS: sin fs, sin usuarios, sin estado. Reemplaza
// a los "Horarios por sección" del porte W7 (la semana por sección del POC). server/src/schedule.ts es el dueño del archivo
// (schedules.json v3), del override de demo y del 403; acá vive SOLO la lógica, para testearla sin tocar datos reales
// (server/src/__tests__/cycleRules.test.ts).
// F2 (28-oct): MUDADO de server/src/ a src/shared/lib/ (como zonedClock.ts, su único import): el MISMO código evalúa el ciclo
// en los dos lados — el server (schedule.ts: el 403 y GET /api/schedules) y el cliente (sections/parent/lib/cycle.ts: el
// menú del chico, la pantalla "descansando" y el selector de demo; el editor de Familia → Ciclo del día). Sin cambios de
// lógica en la mudanza.
//
// MODELO. Cada integrante tiene una lista de RANGOS horarios: {id, name, from, to, sections}. `from`/`to` = "HH:MM"
// canónicas; el rango cubre [from, to); `to < from` cruza la medianoche; `from == to` = las 24 h. Sin día de la semana: los
// rangos rigen TODOS los días. `sections` = qué puntos de menú están disponibles en ese rango.
//
// REGLA DE DISPONIBILIDAD (para el CHICO activo; al adulto nunca lo alcanza: eso lo decide quien llama):
//   · una sección que NO figura en ningún rango → siempre disponible;
//   · una que figura en ≥ 1 rango → disponible SOLO cuando el reloj (minuto del día en la ZONA DE LA FAMILIA) cae dentro de
//     alguno de SUS rangos (los rangos que se solapan suman: alcanza con uno);
//   · datos inválidos = disponible (fail-open, la regla de la casa desde el POC: "nunca encerramos al chico por un horario
//     mal cargado; cerrar es siempre EXPLÍCITO"): un rango con horas que no son HH:MM abre sus secciones las 24 h, una lista
//     que no es lista no cierra nada, y cualquier excepción → disponible.
//   · OVERRIDE DE DEMO (`demoRangeId`, POST /api/demo/cycle): se evalúa COMO SI el reloj estuviera dentro de ESE rango —sus
//     secciones, disponibles; las que figuran en otros rangos y no en ése, cerradas; las que no figuran en ninguno,
//     disponibles—. Los rangos se toman como "momentos" exclusivos: un solapamiento con otro rango NO abre nada. Un id que ya
//     no existe en la lista (el padre lo borró) = sin override: rige el reloj real.
//   · `opensAt` (el "se abre de nuevo a las…" del 403): el próximo minuto de HOY (antes de la medianoche) en que la sección
//     cerrada pasa a estar disponible, como "HH:MM"; null si hoy ya no abre, si está disponible o si rige un override.
import { wallClock } from './zonedClock'

/* ---------- formas (espejo de src/api/types.ts: CycleRange / SectionKey; estructuralmente idénticas a las del contrato —
   se conservan acá para que el server no dependa de los tipos del cliente) ---------- */
export type SectionKey = 'chat' | 'buscar' | 'mytube' | 'aprender' | 'tienda' | 'calendario' | 'espacio' | 'afterday'
export interface CycleRange { id: string; name: string; from: string; to: string; sections: SectionKey[] }

/** Las 8 secciones que el ciclo puede gatear, en el orden del menú (el Feed no está: nunca se cierra). */
export const SECTION_KEYS: readonly SectionKey[] = ['chat', 'buscar', 'mytube', 'aprender', 'tienda', 'calendario', 'espacio', 'afterday']
export const SECTION_LABEL: Record<SectionKey, string> = {
  chat: 'Chat', buscar: 'Buscar', mytube: 'MyTube', aprender: 'Aprender', tienda: 'Tienda', calendario: 'Calendario', espacio: 'Mi espacio', afterday: 'After Day',
}
export const isSectionKey = (k: unknown): k is SectionKey => typeof k === 'string' && (SECTION_KEYS as readonly string[]).includes(k)

/** Topes del POST /api/parent/cycle: rangos por integrante, largo del nombre y del id. */
export const CYCLE_LIMITS = { ranges: 8, nameLen: 30, idLen: 40 } as const
/** Ids aceptables: letras, números, guion y guion bajo (los genera el cliente o, si no vienen, el server: r1, r2…). */
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/
const DAY = 1440

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/* ---------- horas ---------- */
/** "8:00" / "08:00" → minutos del día; null si no es HH:MM válida (00:00 a 23:59). */
export function parseHHMM(s: unknown): number | null {
  if (typeof s !== 'string') return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return null
  const h = +m[1], min = +m[2]
  if (h > 23 || min > 59) return null
  return h * 60 + min
}
/** Minutos del día → "HH:MM" canónica (dos dígitos). */
export const hhmm = (min: number): string => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
/** El minuto del día (0..1439) de `now` en la zona IANA de la familia (null/ausente = la del proceso). */
export const minuteOfDay = (now: Date, tz?: string | null): number => wallClock(now, tz).minutes
const norm = (cur: number) => ((Math.floor(cur) % DAY) + DAY) % DAY

/** ¿El rango cubre el minuto `cur`? [from, to); to < from cruza la medianoche; from == to = las 24 h. Horas inválidas →
 *  true (fail-open: un rango mal cargado abre sus secciones, nunca las encierra). */
export function rangeCovers(r: { from?: unknown; to?: unknown }, cur: number): boolean {
  const from = parseHHMM(r.from), to = parseHHMM(r.to)
  if (from == null || to == null || from === to) return true
  const c = norm(cur)
  return to < from ? c >= from || c < to : c >= from && c < to
}

/* ---------- disponibilidad ---------- */
const lists = (r: unknown, key: SectionKey): boolean => isObject(r) && Array.isArray(r.sections) && r.sections.includes(key)

/** El rango del override de demo si sigue existiendo en la lista; null si no hay override o el padre lo borró. */
export function findRange(ranges: unknown, id: string | null | undefined): CycleRange | null {
  if (!id || !Array.isArray(ranges)) return null
  return (ranges.find(r => isObject(r) && r.id === id) as CycleRange | undefined) ?? null
}

/** El evaluador de UNA sección: minuto del día → ¿disponible? (lo comparten las tres funciones de abajo, para no recorrer la
 *  lista por cada minuto). Fail-open en todo lo raro. */
function evaluator(ranges: unknown, key: SectionKey, demoRangeId?: string | null): (cur: number) => boolean {
  try {
    if (!Array.isArray(ranges)) return () => true // no es una lista: no cierra nada
    const mine = ranges.filter(r => lists(r, key))
    if (!mine.length) return () => true // no figura en ningún rango: siempre disponible
    if (mine.some(r => parseHHMM(r.from) == null || parseHHMM(r.to) == null)) return () => true // rango inválido: fail-open
    const demo = findRange(ranges, demoRangeId)
    if (demo) { const inDemo = mine.includes(demo); return () => inDemo } // "como si el reloj estuviera en ese rango"
    return (cur: number) => { try { return mine.some(r => rangeCovers(r, cur)) } catch { return true } }
  } catch {
    return () => true
  }
}

/** ¿La sección está disponible en el minuto `cur` (0..1439, en la zona de la familia)? Con `demoRangeId` (un id que existe
 *  en `ranges`), según el override de demo en lugar del reloj. */
export function sectionAvailableAt(ranges: unknown, key: SectionKey, cur: number, demoRangeId?: string | null): boolean {
  return evaluator(ranges, key, demoRangeId)(norm(cur))
}

/** "HH:MM" del próximo minuto de HOY en que la sección pasa a estar disponible; null si está disponible, si hoy ya no abre o
 *  si rige un override de demo (el override no sigue al reloj). */
export function opensAtToday(ranges: unknown, key: SectionKey, cur: number, demoRangeId?: string | null): string | null {
  try {
    if (findRange(ranges, demoRangeId)) return null
    const at = evaluator(ranges, key)
    const c = norm(cur)
    if (at(c)) return null
    for (let m = c + 1; m < DAY; m++) if (at(m)) return hhmm(m)
    return null
  } catch {
    return null
  }
}

/** Las secciones disponibles en el minuto `cur` (con override opcional), en el orden del menú. */
export function availableSections(ranges: unknown, cur: number, demoRangeId?: string | null): SectionKey[] {
  return SECTION_KEYS.filter(k => sectionAvailableAt(ranges, k, cur, demoRangeId))
}

/* ---------- validación del POST /api/parent/cycle (todo o nada; 400 con el motivo) ---------- */
type Check<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
/** Como el cleanText de parent.ts: sin caracteres de control y con los espacios colapsados. */
const cleanText = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim()
/** Nombre de un rango (estilo checkTerm de parent.ts): limpio, 1 a 30 caracteres y con al menos una letra o número. */
function checkName(v: unknown, where: string): Check<string> {
  const t = typeof v === 'string' ? cleanText(v) : ''
  if (t.length < 1 || t.length > CYCLE_LIMITS.nameLen) return fail(`${where}: el nombre tiene que tener entre 1 y ${CYCLE_LIMITS.nameLen} caracteres${t ? ` («${t.slice(0, 40)}»)` : ''}.`)
  if (!/[\p{L}\p{N}]/u.test(t)) return fail(`${where}: «${t}» no es un nombre válido (tiene que tener letras o números).`)
  return { ok: true, value: t }
}
/** El primer id r1, r2… que no está usado (para los rangos que llegan sin id). */
function freshId(used: Set<string>): string {
  for (let n = 1; ; n++) if (!used.has(`r${n}`)) { used.add(`r${n}`); return `r${n}` }
}

/** Valida la lista COMPLETA de rangos de un integrante (`kid` = su nombre, para los textos). Ids únicos (los que faltan los
 *  pone el server: r1, r2…), nombre 1-30 con letras, horas HH:MM (se guardan canónicas: "8:00" → "08:00"), secciones
 *  conocidas (sin repetir, en el orden del menú; puede ser vacía), máx. 8 rangos. Campos de más se ignoran. */
export function checkCycle(raw: unknown, kid: string): Check<CycleRange[]> {
  if (!Array.isArray(raw)) return fail('Los rangos tienen que venir en una lista (ranges).')
  if (raw.length > CYCLE_LIMITS.ranges) return fail(`El ciclo de ${kid} admite hasta ${CYCLE_LIMITS.ranges} rangos (vinieron ${raw.length}).`)
  const used = new Set<string>()
  const drafts: (Omit<CycleRange, 'id'> & { id: string | null })[] = []
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]
    let where = `Rango ${i + 1}`
    if (!isObject(r)) return fail(`${where}: tiene que ser un objeto {id, name, from, to, sections}.`)
    let id: string | null = null
    if (r.id !== undefined && r.id !== null && r.id !== '') {
      const t = typeof r.id === 'string' ? r.id.trim() : ''
      if (!ID_RE.test(t)) return fail(`${where}: el id tiene que ser de 1 a ${CYCLE_LIMITS.idLen} letras, números, - o _.`)
      if (used.has(t)) return fail(`${where}: el id «${t}» está repetido (cada rango necesita uno propio).`)
      used.add(t)
      id = t
    }
    const name = checkName(r.name, where)
    if (!name.ok) return name
    where = `«${name.value}»`
    const from = parseHHMM(r.from), to = parseHHMM(r.to)
    if (from == null || to == null) return fail(`${where}: las horas tienen que ser HH:MM (de 00:00 a 23:59).`)
    if (!Array.isArray(r.sections)) return fail(`${where}: faltan las secciones (una lista; puede estar vacía).`)
    for (const s of r.sections) if (!isSectionKey(s)) return fail(`${where}: no hay una sección «${String(s).slice(0, 40)}» (son: ${SECTION_KEYS.join(', ')}).`)
    const sections = SECTION_KEYS.filter(k => (r.sections as unknown[]).includes(k))
    drafts.push({ id, name: name.value, from: hhmm(from), to: hhmm(to), sections })
  }
  return { ok: true, value: drafts.map(d => ({ ...d, id: d.id ?? freshId(used) })) }
}

/* ---------- saneo al LEER el archivo (nunca tira; lo raro se arregla hacia ABIERTO y se avisa) ---------- */
/** Lo que vino de schedules.json para un integrante → rangos bien formados, sin cambiar la disponibilidad hacia CERRADO:
 *  horas inválidas → 24 h ("00:00"–"00:00": abre sus secciones todo el día, como la regla fail-open), secciones que no son
 *  lista → ninguna, secciones desconocidas → afuera, id ausente/inválido/repetido → r1, r2…, nombre inválido → "Rango N".
 *  No recorta a 8 (sacar un rango podría CERRAR una sección). `fixes` = qué se arregló (para el log). */
export function sanitizeStoredRanges(raw: unknown): { ranges: CycleRange[]; fixes: string[] } {
  const fixes: string[] = []
  if (raw === undefined) return { ranges: [], fixes }
  if (!Array.isArray(raw)) return { ranges: [], fixes: ['los rangos no eran una lista: sin rangos'] }
  const used = new Set<string>()
  const pending: { i: number; r: Omit<CycleRange, 'id'> }[] = []
  const out: (CycleRange | null)[] = []
  raw.forEach((r, i) => {
    if (!isObject(r)) { fixes.push(`rango ${i + 1}: no era un objeto, lo salteo`); return }
    const name = checkName(r.name, `rango ${i + 1}`)
    if (!name.ok) fixes.push(`rango ${i + 1}: nombre inválido → «Rango ${i + 1}»`)
    const from = parseHHMM(r.from), to = parseHHMM(r.to)
    const okTimes = from != null && to != null
    if (!okTimes) fixes.push(`rango ${i + 1}: horas inválidas → las 24 h (fail-open)`)
    if (!Array.isArray(r.sections)) fixes.push(`rango ${i + 1}: las secciones no eran una lista → ninguna`)
    const given = Array.isArray(r.sections) ? r.sections : []
    if (given.some(s => !isSectionKey(s))) fixes.push(`rango ${i + 1}: secciones desconocidas afuera`)
    const body = {
      name: name.ok ? name.value : `Rango ${i + 1}`,
      from: okTimes ? hhmm(from) : '00:00', to: okTimes ? hhmm(to) : '00:00',
      sections: SECTION_KEYS.filter(k => given.includes(k)),
    }
    const id = typeof r.id === 'string' ? r.id.trim() : ''
    if (ID_RE.test(id) && !used.has(id)) { used.add(id); out.push({ id, ...body }) }
    else { fixes.push(`rango ${i + 1}: id ausente, inválido o repetido → uno nuevo`); pending.push({ i: out.length, r: body }); out.push(null) }
  })
  for (const p of pending) out[p.i] = { id: freshId(used), ...p.r }
  return { ranges: out.filter((r): r is CycleRange => r !== null), fixes }
}
