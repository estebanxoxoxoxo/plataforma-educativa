// Ciclo del día (tanda F1, 28-oct; docs/USUARIOS.md §11) — el "candado por reloj" de la familia, server-side. REEMPLAZA a
// los Horarios por sección (porte Smarty W7, HORARIOS.md del POC: por sección, una franja por día de la semana) con el
// pedido del dueño (28-oct): el padre arma RANGOS horarios del día y elige QUÉ puntos de menú están disponibles en cada
// uno; y, para la demo, se puede elegir en qué rango está el chico. Las reglas PURAS (disponibilidad, opensAt, validación y
// saneo) viven en src/shared/lib/cycleRules.ts (el MISMO código que usa el cliente, desde F2); acá: el archivo, el override
// de demo, el enforcement y las rutas públicas. El server es la VERDAD y ENFORCEA: con un CHICO activo, la API de una sección no disponible responde
// 403 (index.ts). Al adulto no lo alcanza nunca.
//
// PERSISTENCIA (config del padre, regla 9: FUERA de /api/demo/reset): server/data/schedules.json v3
//   { version: 3, members: { [childId]: { ranges: CycleRange[] } } }   (sin entrada = sin rangos = todo disponible)
// Un v1/v2 (los horarios semanales por sección) NO se convierte (familyMigrate.ts:upgradeCycleRaw; los modelos no mapean):
// el original queda en schedules.json.pre-v3 y cada integrante arranca sin rangos. FS-BASE-B (hallazgo schedule.ts:87): si
// ya había un .pre-v3 con OTRO contenido (una segunda migración), el respaldo va a .pre-v3-<ms> (durable.ts
// backupBeforeMigrate: antes se salteaba en silencio y el archivo se pisaba sin copia); si el respaldo no se puede escribir,
// el archivo NO se reescribe al cargar (rige en RAM; el primer guardado del padre lo escribe). Lo raro de un archivo editado
// a mano se sanea hacia ABIERTO al leer (cycleRules.ts:sanitizeStoredRanges). Ilegible → .roto-<ms> y todo disponible; una
// `version` DESCONOCIDA (ni ausente, ni 1, 2 o 3: un "3" de texto, un 4 de un checkout futuro) también es ilegible
// (familyMigrate.ts, FS-BASE-B): el archivo queda entero en el .roto-* en vez de "migrarse" como un v1 perdiendo los rangos.
// ⚠ Un checkout pre-F1 con el server corriendo leería el v3 como un v1 y lo reescribiría como v2 (los rangos quedarían
// adentro de members.ian, recuperables a mano: ahora también quedan en el .pre-v3-<ms> del próximo arranque): no hacerlo.
//
// OVERRIDE DE DEMO (RAM, POR USUARIO con perUser, regla 9): POST /api/demo/cycle {rangeId} → el chico se evalúa "como si el
// reloj estuviera dentro de ese rango" (cycleRules.ts). Lo limpia POST /api/demo/reset de ESE usuario ({scope:'all'}: el de
// todos) y también guardar un ciclo que ya no trae ese rango.
//
// ZONA HORARIA DE LA FAMILIA (deuda 14-oct): el minuto del día se lee en la zona IANA del padre (parent.json `tz`) con el
// helper Intl compartido con el cliente (src/shared/lib/zonedClock.ts); sin zona (Automática), en la del server. El dato lo
// PRESTA parent.ts con setFamilyTzSource (este módulo no importa parent.ts: parent.ts ya importa éste).
//
//   GET  /api/schedules[?member] → SchedulesResponse {serverNow, tz, member, cycle, demoRange}   (público)
//        Chico activo → lo SUYO (member ignorado: nunca lo de un hermano). Adulto → el integrante de ?member= (users.ts:
//        memberFor; ausente = el primero; ajeno → 400); adulto sin integrantes y sin member → {serverNow, tz,
//        cycle: {ranges: []}, demoRange: null} sin member (la TopBar del adulto lo lee para el reloj: nunca 400 sin member).
//        `cycle` = los rangos del integrante · `demoRange` = su override vigente (id de un rango que existe, o null). (El
//        campo `schedules` de compat con el cliente de antes de F2 se RETIRÓ cuando nadie lo leía: docs/USUARIOS.md §11.)
//   POST /api/demo/cycle[?member] {rangeId: string | null} → SchedulesResponse (la misma que GET /api/schedules daría ya)
//        Chico activo → SU override (member ignorado). Adulto → el del integrante de ?member= (ADITIVO de F1: así el selector
//        de la demo puede vivir también en Familia). rangeId que no es de un rango de ese integrante → 400; null = el reloj
//        real. Sin cuerpo JSON o sin rangeId → 400.
//   GET/POST /api/parent/cycle?member → viven en parent.ts (sesión + integrante) con cycleView / checkCycle / saveCycle.
//   POST /api/parent/schedules → 410 (parent.ts): los horarios por sección se retiraron.
import { existsSync, readFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { SERVER_ROOT } from './config'
import { backupBeforeMigrate, quarantine, tryWriteFileAtomic } from './durable'
import { type CycleRange, type SectionKey, findRange, minuteOfDay, opensAtToday, sanitizeStoredRanges, sectionAvailableAt } from '../../src/shared/lib/cycleRules'
import { isObject, upgradeCycleRaw } from './familyMigrate'
import { perUser } from './perUser'
import { actingUser, allDependents, memberFor, userById } from './users'
import { readJson, send } from './web'

export type { CycleRange, SectionKey } from '../../src/shared/lib/cycleRules'
export { checkCycle, isSectionKey } from '../../src/shared/lib/cycleRules'

/** schedules.json v3 (F1): el ciclo del día de cada integrante. */
interface MemberCycle { ranges: CycleRange[] }
interface CycleFile { version: 3; members: Record<string, MemberCycle> }
const FILE = join(SERVER_ROOT, 'data', 'schedules.json')

const copyRange = (r: CycleRange): CycleRange => ({ id: r.id, name: r.name, from: r.from, to: r.to, sections: [...r.sections] })
/** Todos los dependientes del seed sin rangos (arranque sin archivo, o archivo ilegible). */
const emptyFile = (): CycleFile => ({ version: 3, members: Object.fromEntries(allDependents().map(id => [id, { ranges: [] }])) })

function load(): CycleFile {
  if (!existsSync(FILE)) return emptyFile() // todo disponible; no se escribe hasta el primer guardado
  let text: string, up: ReturnType<typeof upgradeCycleRaw>
  try {
    text = readFileSync(FILE, 'utf8')
    up = upgradeCycleRaw(JSON.parse(text), allDependents())
  } catch (e) {
    console.error('[ciclo] schedules.json ilegible → todo disponible (fail-open); copia en .roto-*:', e)
    quarantine(FILE, 'ciclo') // sin copia: seguimos igual
    return emptyFile()
  }
  // Un integrante que ya no es dependiente de nadie se conserva (no se pierde config) y no se sirve.
  const members: Record<string, MemberCycle> = {}
  for (const [id, v] of Object.entries(up.raw.members)) {
    if (id === '__proto__') continue
    if (!isObject(v)) console.warn(`[ciclo] ${id}: la entrada no era un objeto → sin rangos`)
    const s = sanitizeStoredRanges(isObject(v) ? v.ranges : undefined)
    if (s.fixes.length) console.warn(`[ciclo] ${id}: ${s.fixes.join(' · ')}`)
    members[id] = { ranges: s.ranges }
  }
  for (const id of allDependents()) if (!Object.hasOwn(members, id)) members[id] = { ranges: [] }
  const f: CycleFile = { version: 3, members }
  if (up.from !== 3) {
    // Migración CON PÉRDIDA (lo de antes no se convierte): sin respaldo escrito, el original no se pisa.
    if (!backupBeforeMigrate(FILE, '.pre-v3', text, 'ciclo')) console.error(`[ciclo] schedules.json v${up.from} → v3 solo en RAM: sin respaldo no lo reescribo (el primer guardado del padre lo hará)`)
    else if (write(f)) console.log(`[ciclo] schedules.json v${up.from} → v3 (Ciclo del día): los horarios por sección NO se convierten; cada integrante arranca sin rangos`)
  }
  return f
}

/** FS-BASE-B: el helper común (durable.ts: tmp + fsync + rename); false = no quedó escrito (logueado). */
const write = (next: CycleFile): boolean => tryWriteFileAtomic(FILE, JSON.stringify(next, null, 1), 'ciclo')
let file: CycleFile = load()

/* ---------- la zona horaria de la familia (la presta parent.ts, dueño del dato) ---------- */
let tzSource: () => string | null = () => null
export function setFamilyTzSource(fn: () => string | null): void { tzSource = fn }
/** La zona IANA de la familia, o null = la del server. */
export const familyTzNow = (): string | null => tzSource()
/** FS-BASE-B (hallazgos cycleRules.ts:62 / mentors.ts:49): la zona IANA de ESTE proceso (la que usa la hora local del server:
 *  `tz` null = "Automática" = ésta). Viaja ADITIVA como `serverTz` en las respuestas que ya llevan `tz` (GET /api/schedules,
 *  POST /api/demo/cycle, GET/POST /api/parent/cycle): el cliente evalúa con `tz ?? serverTz` (cycle.ts) y así el menú, la
 *  pantalla "descansando", el Calendario y Mentores leen la MISMA pared que el server aunque el navegador esté en otra zona
 *  (antes, con tz null, el cliente usaba la del NAVEGADOR). `tz` sigue diciendo lo que eligió el adulto (null = Automática). */
export const serverTimeZone = (): string => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' } }

/* ---------- el ciclo de cada integrante ---------- */
const rangesOf = (member: string): readonly CycleRange[] => (Object.hasOwn(file.members, member) ? file.members[member].ranges : [])
/** Los rangos de un integrante (copia; sin entrada = ninguno: todo disponible). */
export function cycleOf(member: string): CycleRange[] { return rangesOf(member).map(copyRange) }

/** Reemplaza la lista COMPLETA de rangos de UN integrante (ya validada con checkCycle). Escribe el archivo entero (los demás
 *  integrantes intactos). Si su override de demo apuntaba a un rango que ya no está, deja de regir. null si no se pudo
 *  escribir (no cambia nada). */
export function saveCycle(member: string, ranges: readonly CycleRange[]): CycleRange[] | null {
  const next: CycleFile = { version: 3, members: { ...file.members, [member]: { ranges: ranges.map(copyRange) } } }
  if (!write(next)) return null
  file = next
  const d = demo.of(member)
  if (d.rangeId && !ranges.some(r => r.id === d.rangeId)) {
    console.log(`[ciclo] ${member}: el rango del override de demo («${d.rangeId}») ya no está → vuelve el reloj real`)
    d.rangeId = null
  }
  console.log(`[ciclo] ciclo de ${member} guardado → ${ranges.length ? ranges.map(r => `${r.name} ${r.from}–${r.to} [${r.sections.join(',') || '—'}]`).join(' · ') : 'sin rangos (todo disponible)'}`)
  return cycleOf(member)
}

/* ---------- override de DEMO (RAM, por usuario: lo limpia /api/demo/reset) ---------- */
const demo = perUser<{ rangeId: string | null }>(() => ({ rangeId: null }))
/** El override vigente de un integrante: el id de un rango QUE EXISTE en su ciclo, o null (sin override = reloj real). */
export function demoRangeOf(member: string): string | null {
  const id = demo.of(member).rangeId
  return id && findRange(rangesOf(member), id) ? id : null
}
/** Vuelve al reloj real el override de un usuario; sin id, el de TODOS (POST /api/demo/reset {scope:'all'}). */
export function resetCycleDemo(userId?: string): void { demo.reset(userId) }

type Check<T> = { ok: true; value: T } | { ok: false; error: string }
function setDemoRange(member: string, raw: unknown): Check<string | null> {
  const name = userById(member)?.name ?? member
  if (raw === null) {
    demo.of(member).rangeId = null
    console.log(`[ciclo] demo: ${member} vuelve al reloj real`)
    return { ok: true, value: null }
  }
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, error: 'rangeId tiene que ser el id de un rango del ciclo, o null para volver al reloj real.' }
  const r = findRange(rangesOf(member), raw.trim())
  if (!r) return { ok: false, error: `Ese rango no está en el ciclo del día de ${name}.` }
  demo.of(member).rangeId = r.id
  console.log(`[ciclo] demo: ${member} pasa a estar en «${r.name}» (${r.from}–${r.to})`)
  return { ok: true, value: r.id }
}

/* ---------- evaluación (reloj del server en la ZONA DE LA FAMILIA + el override del integrante) ---------- */
/** ¿La sección está disponible AHORA para este integrante? */
export function isOpen(key: SectionKey, member: string, now: Date = new Date()): boolean {
  return sectionAvailableAt(rangesOf(member), key, minuteOfDay(now, tzSource()), demoRangeOf(member))
}

/* ---------- ENFORCEMENT: a qué sección pertenece cada pedido de API (lo usa index.ts antes de rutear) ----------
   El mismo mapa de W7 (el ciclo gatea las mismas 8 secciones): en el POC el horario gatea la SECCIÓN (su vista); el lector,
   el reproductor y el selector de carpeta son overlays del shell y siguen andando con la sección cerrada. Por eso:
   · buscar = solo /api/search/* (las búsquedas). /api/article (el lector) y /api/video (el reproductor) NO se gatean: los
     usan el Feed, Mi espacio, el chat, MyTube y las postas de lectura de Aprender.
   · espacio = solo el Drive (/api/space/drive*: la vista, la papelera, mover, borrar, restaurar), MENOS crear carpeta
     (POST /api/space/drive/folder), que también usa la hoja "¿Dónde lo guardás?" (como el FolderPicker del POC). Seguir
     canales y Mis listas (/api/space/follow, /api/space/playlist*) son de MyTube; guardar (/api/space/save) y el árbol de
     carpetas (/api/space/folders) son del selector compartido.
   · calendario = /api/calendar: la sección Calendario DEL CHICO (cada usuario lee ahí SUS clases; el ciclo solo se mira
     con un chico activo —index.ts—, así que al adulto no lo alcanza).
   · /api/mentors* (tanda U2: SOLO del adulto) NO es de ninguna sección: no matchea ningún prefijo de acá —ni siquiera el de
     buscar, que es /api/search/*— y así tiene que quedar: como /api/mytube/admin/*, lo del adulto siempre es alcanzable.
   · NUNCA se gatean: /api/feed*, /api/friends*, /api/progress*, /api/leagues*, /api/parent/*, /api/demo/* (también
     /api/demo/cycle: el selector de la demo tiene que poder sacarte de un rango), /api/me, /api/identity, /api/video,
     /api/article, /api/schedules, /api/mentors*, /api/mytube/admin/*. */
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

/** La sección NO DISPONIBLE para este integrante a la que pertenece este pedido (con el "se abre a las…" de hoy), o null si
 *  pasa. Quien llama decide que solo rige con un CHICO activo y que el apagado de la funcionalidad gana (index.ts). */
export function closedSectionFor(pathname: string, member: string, now: Date = new Date()): { key: SectionKey; opensAt: string | null } | null {
  const key = sectionForApi(pathname)
  if (!key) return null
  const ranges = rangesOf(member), cur = minuteOfDay(now, tzSource()), d = demoRangeOf(member)
  if (sectionAvailableAt(ranges, key, cur, d)) return null
  return { key, opensAt: opensAtToday(ranges, key, cur, d) }
}

/* ---------- vistas ---------- */
type SchedulesView = {
  serverNow: number; tz: string | null; /** FS-BASE-B, aditivo: la zona del server (ver serverTimeZone) */ serverTz: string; member?: string
  cycle: { ranges: CycleRange[] }; demoRange: string | null
}
/** SchedulesResponse de un integrante (sin integrante: la vacía del adulto sin dependientes). */
function schedulesView(member: string | undefined, now: Date = new Date()): SchedulesView {
  const tz = tzSource(), serverTz = serverTimeZone()
  if (!member) return { serverNow: now.getTime(), tz, serverTz, cycle: { ranges: [] }, demoRange: null }
  return { serverNow: now.getTime(), tz, serverTz, member, cycle: { ranges: cycleOf(member) }, demoRange: demoRangeOf(member) }
}
/** CycleResponse de GET/POST /api/parent/cycle (parent.ts). */
export function cycleView(member: string): { cycle: { ranges: CycleRange[] }; member: string; serverNow: number; tz: string | null; serverTz: string; demoRange: string | null } {
  return { cycle: { ranges: cycleOf(member) }, member, serverNow: Date.now(), tz: tzSource(), serverTz: serverTimeZone(), demoRange: demoRangeOf(member) }
}

/* ---------- rutas públicas ---------- */
export async function scheduleRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const me = actingUser(req)
  const path = url.pathname.replace(/\/+$/, '')
  // De quién es este pedido: un chico, lo suyo (member ignorado); el adulto, el integrante de ?member= (sin integrantes y
  // sin member: nadie, la respuesta vacía; nunca 400 sin member en el GET).
  const whose = (): { ok: true; id?: string } | { ok: false; status: number; error: string } => {
    if (me.kind === 'child') return { ok: true, id: me.id }
    if (!me.dependents?.length && !(url.searchParams.get('member') ?? '').trim()) return { ok: true }
    const m = memberFor(req, url)
    return m.ok ? { ok: true, id: m.id } : m
  }
  if (path === '/api/schedules') {
    if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido: usá GET.' })
    const w = whose()
    return w.ok ? send(res, 200, schedulesView(w.id)) : send(res, w.status, { error: w.error })
  }
  if (path === '/api/demo/cycle') {
    if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido: usá POST.' })
    const w = whose()
    if (!w.ok) return send(res, w.status, { error: w.error })
    if (!w.id) return send(res, 400, { error: 'No tenés integrantes en tu familia para configurar.' })
    let b: unknown
    try { b = await readJson<unknown>(req) } catch { return send(res, 400, { error: 'Pedido inválido (se esperaba un objeto JSON).' }) }
    if (!isObject(b) || !('rangeId' in b)) return send(res, 400, { error: 'Falta rangeId: el id de un rango del ciclo, o null para volver al reloj real.' })
    const r = setDemoRange(w.id, b.rangeId)
    return r.ok ? send(res, 200, schedulesView(w.id)) : send(res, 400, { error: r.error })
  }
  return send(res, 404, { error: 'No existe.' })
}
