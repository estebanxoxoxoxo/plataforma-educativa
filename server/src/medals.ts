// U5-B (28-oct; docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §5.3-§5.5 y docs/USUARIOS.md §12): el ESTADO de las medallas de la
// plataforma y sus rutas. Las reglas puras (catálogo de 13, earnedFrom) viven en medalRules.ts.
//
// HOJA del grafo de imports (importa SOLO perUser, requestContext, users, web y medalRules): todo lo de otros módulos entra
// por REGISTROS que esos módulos hacen al cargar (patrón registerContinue / setProgressTzSource), así nadie arma un ciclo:
//   · registerMedalFacts(fn): cada dueño de un dato aporta SU parte de los hechos (learnResults, learnRoutes, space,
//     friendsFake, progress, leaguesFake); lo que falte vale cero. Una parte que tira se ignora (con aviso): nunca tumba un
//     pedido de Learn ni un cierre.
//   · registerMedalNews(fn): el sumidero de la noticia "Ganaste la medalla…" (feedFake.injectMedalNews).
//   · registerMedalGate(fn): los candados del chico (parent.ts; Amigos / Ligas). Sin gate registrado → fail-closed (las
//     medallas con `domain` se esconden).
//
// ESTADO (D3 del dueño: RAM, sin medals.json): por usuario (perUser) `{earned: Map<id, {at, times}>, seen: Set<id>}`.
//   · Seed = earnedFrom(los hechos de ESE momento), todo VISTO (al arrancar nada es "nuevo"). Como los hechos de Learn, Mi
//     espacio y el catálogo PERSISTEN, lo que sale de ellos sobrevive al F5 y a un reinicio aunque viva en RAM; lo que sale
//     de RAM (racha, semanas, copas, amigos) vuelve al seed con el F5 de ese usuario, como su XP ("tu F5 es tu demo nueva").
//   · UNA operación lo mueve: syncMedals(uid) — evalúa los hechos; lo que no estaba se AGREGA (at = la fecha del hecho si
//     la trae, si no ahora), times = max(guardado, derivado) y NUNCA saca nada (si un hecho desaparece, la medalla queda).
//     Por cada medalla NUEVA, una noticia en el feed de ESE usuario. Idempotente: dos syncs seguidos no duplican nada.
//   · ⚠ La noticia va al feed del usuario DEL CONTEXTO (feedFake.live()): syncMedals(X) la emite SIEMPRE bajo
//     runAsUser(X) si el pedido es de otro (defensa en profundidad: los llamadores igual sincronizan a cada uno bajo su
//     runAsUser, §5.3). medalsOf(..., {forParent}) NO sincroniza (solo lee).
//   · ensureMedals(uid) = crear el slice si no existe. Los llamadores lo hacen ANTES de mover un hecho (escribir la fila de
//     Learn, guardar, aceptar un amigo, cortar la semana): si el slice naciera después, lo nuevo entraría al seed como "ya
//     visto" y no habría medalla nueva.
//   · resetMedals(id?) re-siembra EN EL ACTO (también con {scope:'all'}: los tres del seed) — index.ts lo llama AL FINAL del
//     reset, cuando todos los dueños de hechos ya volvieron a su seed.
//   GET  /api/medals       → MedalsResponse del usuario ACTIVO (sync antes —red de seguridad—; sin las de dominios apagados
//                            para él; las más nuevas primero, las sin fecha al final en el orden del catálogo) · 405 sin GET
//   POST /api/medals/seen  → MedalsResponse (unseen 0: las "Nueva" se ven en ESA apertura de la hoja y se van en la próxima)
//                            · 405 sin POST
// No pertenece a ninguna sección (el Ciclo del día no lo cierra: schedule.sectionForApi → null) ni a ninguna funcionalidad.
// El catálogo NO viaja nunca: solo las ganadas (sin totales, sin "faltan", sin siluetas).
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  MEDALS, earnedFrom, emptyFacts, sortMedals,
  type EarnedMedal, type MedalDomain, type MedalFacts, type MedalId,
} from './medalRules'
import { perUser } from './perUser'
import { currentUser, runAsUser } from './requestContext'
import { actingUser, userById, users } from './users'
import { send } from './web'

/* ---------- registros (los hacen los módulos dueños de cada dato, al cargar) ---------- */
type FactsPart = Partial<MedalFacts>
const sources: { name: string; fn: (uid: string) => FactsPart }[] = []
/** Un módulo aporta SU parte de los hechos de un usuario (acceso explícito por id: nunca el usuario del pedido). `name`
 *  solo sirve para el aviso si esa parte tira. */
export function registerMedalFacts(fn: (uid: string) => FactsPart, name = `fuente ${sources.length + 1}`): void { sources.push({ name, fn }) }
let newsSink: ((m: EarnedMedal) => void) | null = null
/** El Feed registra acá su sumidero de la noticia de medalla (escribe en lo vivo del usuario DEL CONTEXTO). */
export function registerMedalNews(fn: (m: EarnedMedal) => void): void { newsSink = fn }
let gate: (uid: string, domain: MedalDomain) => boolean = () => false
/** parent.ts registra los candados: ¿este usuario ve las medallas de este dominio? (un adulto siempre). */
export function registerMedalGate(fn: (uid: string, domain: MedalDomain) => boolean): void { gate = fn }

/** Los hechos de un usuario, juntando las partes registradas (lo que falte, en cero). */
export function medalFactsOf(uid: string): MedalFacts {
  const f = emptyFacts()
  for (const s of sources) {
    try { Object.assign(f, s.fn(uid)) } catch (e) { console.warn(`[medals] no pude leer los hechos de «${s.name}» de ${uid}:`, e) }
  }
  return f
}

/* ---------- estado (RAM por usuario) ---------- */
interface Earned { at: number | null; times: number }
interface MedalState { earned: Map<MedalId, Earned>; seen: Set<MedalId> }
function seedMedals(uid: string): MedalState {
  const earned = new Map<MedalId, Earned>()
  if (userById(uid)) for (const h of earnedFrom(medalFactsOf(uid))) earned.set(h.id, { at: h.at ?? null, times: h.times ?? 1 })
  return { earned, seen: new Set(earned.keys()) }
}
const states = perUser(seedMedals)

/** Crea el slice de medallas del usuario si todavía no existe (con su seed: todo visto). Llamarlo ANTES de mover un hecho. */
export function ensureMedals(uid: string): void { if (userById(uid)) states.of(uid) }

/** Vuelve al seed (EN EL ACTO) las medallas de un usuario; sin id, las de TODOS los del seed. Va en POST /api/demo/reset,
 *  DESPUÉS de los resets de los dueños de hechos (el seed se deriva de los hechos ya re-sembrados). */
export function resetMedals(userId?: string): void {
  if (userId !== undefined) { if (userById(userId)) states.reset(userId); return }
  states.reset()
  for (const u of users()) states.of(u.id)
}

const toEarned = (id: MedalId, e: Earned): EarnedMedal => {
  const d = MEDALS[id]
  return { id, emoji: d.emoji, title: d.title, text: d.text, at: e.at, ...(d.repeatable && e.times >= 2 ? { times: e.times } : {}) }
}

/** Sincroniza las medallas de `uid` con sus hechos de AHORA: agrega las que se cumplen y no estaban (con la fecha del hecho
 *  o la de ahora), sube `times` de las repetibles y NUNCA saca nada. Por cada medalla NUEVA, la noticia en el feed DE `uid`
 *  (bajo su runAsUser si el pedido es de otro). Idempotente. Devuelve las nuevas (para logs y tests). Nunca tira. */
export function syncMedals(uid: string): EarnedMedal[] {
  if (!userById(uid)) return []
  const st = states.of(uid)
  const added: EarnedMedal[] = []
  for (const h of earnedFrom(medalFactsOf(uid))) {
    const cur = st.earned.get(h.id)
    const times = h.times ?? 1
    if (!cur) {
      const e: Earned = { at: h.at ?? Date.now(), times }
      st.earned.set(h.id, e)
      added.push(toEarned(h.id, e))
    } else if (times > cur.times) cur.times = times
  }
  for (const m of added) {
    console.log(`[medals] ${uid} ganó «${m.title}» (${m.id})`)
    if (!newsSink) continue
    const sink = newsSink
    try {
      if (currentUser()?.id === uid) sink(m)
      else runAsUser(uid, () => sink(m))
    } catch (e) { console.warn(`[medals] no pude poner la noticia de «${m.id}» en el feed de ${uid}:`, e) }
  }
  return added
}

/** Las medallas GANADAS de un usuario, ordenadas (las más nuevas primero; las sin fecha al final en el orden del catálogo).
 *  Sin `forParent` (su pila): sin las de dominios apagados para él y con `fresh` en las que todavía no vio. Con `forParent`
 *  (Familia → Actividad): TODAS, sin `fresh`, y `hidden` en las que él no ve por un candado. NO sincroniza. */
export function medalsOf(uid: string, opts: { forParent?: boolean } = {}): (EarnedMedal & { hidden?: MedalDomain })[] {
  if (!userById(uid)) return []
  const st = states.of(uid)
  const out: (EarnedMedal & { hidden?: MedalDomain })[] = []
  for (const [id, e] of st.earned) {
    const d = MEDALS[id]
    const hiddenBy = d.domain && !gate(uid, d.domain) ? d.domain : null
    if (hiddenBy && !opts.forParent) continue
    const m: EarnedMedal & { hidden?: MedalDomain } = toEarned(id, e)
    if (opts.forParent) { if (hiddenBy) m.hidden = hiddenBy }
    else if (!st.seen.has(id)) m.fresh = true
    out.push(m)
  }
  return sortMedals(out)
}

/** La forma de GET /api/medals: la pila del usuario + cuántas no vio (de las que ve). */
export function medalsResponse(uid: string): { medals: EarnedMedal[]; unseen: number } {
  const medals = medalsOf(uid)
  return { medals, unseen: medals.filter(m => m.fresh).length }
}

/** "Ya las vio": marca vistas las que hoy VE (una escondida por un candado sigue sin ver: si la familia lo prende, la ve
 *  como nueva). */
export function markMedalsSeen(uid: string): void {
  if (!userById(uid)) return
  const st = states.of(uid)
  for (const id of st.earned.keys()) {
    const d = MEDALS[id]
    if (!d.domain || gate(uid, d.domain)) st.seen.add(id)
  }
}

/* ---------- rutas (del usuario ACTIVO) ---------- */
export function medalsRoutes(req: IncomingMessage, res: ServerResponse, url: URL): void {
  const me = actingUser(req)
  const path = url.pathname.replace(/\/+$/, '')
  if (path === '/api/medals') {
    if (req.method !== 'GET') return send(res, 405, { error: 'Método no permitido: usá GET.' })
    syncMedals(me.id) // red de seguridad: si algo se escapó, aparece al leer
    return send(res, 200, medalsResponse(me.id))
  }
  if (path === '/api/medals/seen') {
    if (req.method !== 'POST') return send(res, 405, { error: 'Método no permitido: usá POST.' })
    markMedalsSeen(me.id)
    return send(res, 200, medalsResponse(me.id))
  }
  return send(res, 404, { error: 'not found' })
}
