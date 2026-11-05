// ============================== LA MEZCLA DEL FEED (reglas PURAS: sin estado propio ni server/data) ==============================
// La usa feedFake.ts (el server fake del Feed v6) y la prueba server/src/__tests__/feedMix.test.ts. Tanda "Feed diverso"
// (28-oct), pedido del dueño: «el botón de lanzar NPC que sean 5 por vez y de diversos tipos; y que los que vienen por
// default sean más diversos, que haya cards de muchos tipos». Dos reglas:
//   1) LA EDICIÓN SEMBRADA (interleave): la CABEZA sigue la plantilla editorial de la franja (EDITIONS: lo que el resumen
//      confiesa —mañana lecturas y rutas primero, tarde videos antes, noche tranquila— y es verdad); el RESTO se reparte
//      con un round-robin ponderado suave (cada tipo en proporción a lo que le queda, y nunca dos seguidos del mismo
//      mientras haya otro). Antes la plantilla ciclaba hasta agotar colas de largos muy distintos y la cola de la edición
//      quedaba de un solo tipo (5-6 videos seguidos). Lo del cierre de liga (spaceOut) ya no entra en bloque: va donde le
//      toca por antigüedad, espaciado. Las lecturas se intercalan por tema (roundRobinBy): no salen todas las del espacio
//      juntas.
//   2) LA RÁFAGA DE NPCs (planBurst): QUÉ noticia concreta entra de cada tipo social —racha, insignia, unidad completada,
//      ruta compartida, medalla—, en las cantidades que le dicta la composición sorteada de 3 (la carrera de tu liga, con
//      XP real, la suma feedFake); protagonistas
//      distintos dentro de la ráfaga siempre que se pueda y, primero, otros que los de la ráfaga anterior; sin repetir una
//      noticia hasta agotar SU tipo, y al reciclarlo nunca las de la ráfaga anterior. FS-BASE-B (hallazgo feedMix.ts:141):
//      esas reglas podían TRABAR una ráfaga —en la 7.ª de Luna, a insignia y unidad solo les quedaba una noticia cada una y
//      las dos eran de CataNova, así que salía dos veces—. Ahora (a) dentro de cada tipo se prefiere, con peso
//      fraccionario, la noticia de quien más tiene sin publicar (balanceo: los restos no se concentran en una persona), (b)
//      entre los repartos buenos se prefiere el que deja la ráfaga SIGUIENTE con reparto posible (lookahead de un paso) y
//      (c) si igual no hay reparto con protagonistas distintos, un tipo trabado RECICLA antes de agotarse lo ya publicado
//      (nunca lo de la ráfaga anterior), lo mínimo indispensable. Protagonistas distintos GANAN sobre "no repetir hasta
//      agotar"; repetir quién queda solo para cuando no hay con quién (pocos amigos con noticias). Medido con las semillas
//      reales del server (300 ráfagas por semana, semanas 0-2): protagonista repetido, Luna 41-46 → 0 e Ian 3-6 → 0;
//      reciclado antes de agotar (antes 0), Luna 16-30 e Ian 0-3 de cada 300 (simulación en el informe de FS-BASE-B).
//   3) LA RÁFAGA SE SORTEA (composeBurst; tanda "Ráfaga variada", 29-oct, pedido del dueño: «Simular npc siempre indica
//      medallas de amigos supuestos. tienen que ser de todo tipo y random»). La plantilla fija de arriba (una de cada tipo,
//      siempre los mismos 5) hacía que cada ráfaga se sintiera igual a la anterior. Ahora hay SEIS tipos —racha, insignia,
//      unidad, ruta compartida, MEDALLA DE LIGA de un amigo (NPC_MEDALS, nuevo: solo con Ligas) y la carrera de tu liga
//      (solo con Ligas)— y cada ráfaga SORTEA su composición: siguen siendo BURST_SIZE (5) noticias, como mucho
//      BURST_MAX_PER_TYPE (2) del mismo tipo (con 5 y tope 2 salen siempre ≥ 3 tipos distintos), y nunca la misma
//      composición dos veces seguidas mientras haya otra posible. Entre las composiciones se elige al azar (con `r`) una
//      que admita protagonistas DISTINTOS sin reciclar antes de tiempo; después planBurst reparte con TODAS sus reglas de
//      siempre (generalizadas a "hasta 2 por tipo": dos de un mismo tipo van con protagonistas distintos y, si son rutas,
//      rutas distintas; si un tipo se agota a mitad de ráfaga, la que falta recicla —nunca lo de la ráfaga anterior—).
//      Si no alcanzan los candidatos para 5 (Ligas apagado y pocos amigos), salen menos: honestidad antes que relleno.
// Todo determinístico con el `r` que se pasa (rng de leaguesFake): mismas ráfagas para el mismo usuario y semana.

/* ---------- la edición sembrada ---------- */
export type Daypart = 'manana' | 'tarde' | 'noche'
export type Slot = 'friend' | 'article' | 'route' | 'video'
export const SLOTS: readonly Slot[] = ['friend', 'article', 'route', 'video']
/** La plantilla de cada franja: el orden de los tipos de la CABEZA de la edición (una pasada) y en qué lugar de la primera
 *  página van la grilla de videos y el resumen (noticia → 1-2 "para vos" → grilla → más social → resumen…). */
export const EDITIONS: Record<Daypart, { pattern: readonly Slot[]; shelfAfter: number }> = {
  manana: { pattern: ['friend', 'article', 'route', 'friend', 'article', 'video', 'friend', 'video', 'route', 'article', 'video'], shelfAfter: 3 },
  tarde: { pattern: ['friend', 'route', 'friend', 'article', 'video', 'friend', 'video', 'article', 'video', 'route', 'video'], shelfAfter: 2 },
  noche: { pattern: ['friend', 'article', 'friend', 'video', 'route', 'friend', 'video', 'article', 'video'], shelfAfter: 2 },
}

/** La edición sembrada en orden. CABEZA: la plantilla de la franja, una pasada (un tipo sin ítems se saltea, y también
 *  el que repetiría el anterior por ese salto: queda para el resto). RESTO: round-robin ponderado suave (el de nginx) con
 *  peso = lo que le quedaba a cada tipo al terminar la cabeza → cada tipo se reparte en proporción y todos se terminan
 *  más o menos juntos; entre los empatados gana el orden de SLOTS, y nunca se elige el mismo tipo dos veces seguidas si
 *  queda otro. */
export function interleave<T>(queues: Record<Slot, readonly T[]>, pattern: readonly Slot[]): T[] {
  const q = Object.fromEntries(SLOTS.map((s) => [s, [...queues[s]]])) as Record<Slot, T[]>
  const out: T[] = []
  let last: Slot | null = null
  for (const s of pattern) {
    if (s === last || !q[s].length) continue
    out.push(q[s].shift()!)
    last = s
  }
  const weight = Object.fromEntries(SLOTS.map((s) => [s, q[s].length])) as Record<Slot, number>
  const cur = Object.fromEntries(SLOTS.map((s) => [s, 0])) as Record<Slot, number>
  for (;;) {
    const live = SLOTS.filter((s) => q[s].length > 0)
    if (!live.length) break
    let total = 0
    for (const s of live) { cur[s] += weight[s]; total += weight[s] }
    const ranked = [...live].sort((a, b) => cur[b] - cur[a]) // estable: empate → orden de SLOTS
    const pick = ranked.find((s) => s !== last) ?? ranked[0]
    cur[pick] -= total
    out.push(q[pick].shift()!)
    last = pick
  }
  return out
}

/** Lo que se repartió en el cierre de liga (la tarjeta de la liga de la semana, medallas y ascensos de los amigos) entra en
 *  la edición donde le toca por antigüedad (`at`), pero ESPACIADO: entre uno y otro, `gap` ítems de la edición (antes iba
 *  en bloque: 3-4 noticias de liga seguidas). Si cerca del final no alcanza el lugar, arranca un poco antes. */
export function spaceOut<T>(stream: readonly T[], late: readonly T[], at: number, gap = 2): T[] {
  if (!late.length) return [...stream]
  const start = Math.max(0, Math.min(at, stream.length - (late.length - 1) * gap))
  const out = stream.slice(0, start)
  const rest = stream.slice(start)
  late.forEach((it, i) => { out.push(it); if (i < late.length - 1) out.push(...rest.splice(0, gap)) })
  out.push(...rest)
  return out
}

/** Intercala por grupo (p. ej. las lecturas por tema), en el orden en que aparece cada grupo y respetando el orden dentro
 *  de cada uno: a1 b1 c1 a2 b2 a3… */
export function roundRobinBy<T>(xs: readonly T[], key: (x: T) => string): T[] {
  const groups = new Map<string, T[]>()
  for (const x of xs) { const k = key(x); const g = groups.get(k); if (g) g.push(x); else groups.set(k, [x]) }
  const lists = [...groups.values()]
  const out: T[] = []
  for (let i = 0; out.length < xs.length; i++) for (const g of lists) if (i < g.length) out.push(g[i])
  return out
}

/* ---------- la ráfaga de "Simular NPCs" ---------- */
/** Los tipos de noticia social de la ráfaga (los que salen de un pool con claves: NPC_NEWS, NPC_MEDALS y las rutas del
 *  catálogo). 'medal' (tanda "Ráfaga variada", 29-oct) = la medalla de liga de un amigo; va AL FINAL (el orden de lo elegido). */
export type SocialBurstType = 'streak' | 'badge' | 'unit' | 'route' | 'medal'
export const SOCIAL_BURST_TYPES: readonly SocialBurstType[] = ['streak', 'badge', 'unit', 'route', 'medal']
/** Todos los tipos que puede sortear una ráfaga: los sociales + la CARRERA de tu liga (la arma feedFake con leaguesFake:
 *  XP real, sin pool ni claves). */
export type BurstType = SocialBurstType | 'race'
export const BURST_TYPES: readonly BurstType[] = [...SOCIAL_BURST_TYPES, 'race']
/** Noticias por ráfaga (pedido del 28-oct: «que sean 5 por vez») y tope del mismo tipo en una ráfaga (29-oct). */
export const BURST_SIZE = 5
export const BURST_MAX_PER_TYPE = 2
/** La composición de una ráfaga: cuántas de cada tipo. */
export type BurstMix = Record<BurstType, number>
/** Firma de una composición (la multiset de tipos), para no repetirla dos veces seguidas: "streak:1,badge:0,…". */
export const mixKey = (m: BurstMix): string => BURST_TYPES.map((t) => `${t}:${m[t]}`).join(',')
/** Una noticia posible de la ráfaga: clave estable (no se repite hasta agotar su tipo), tipo, protagonista y, para una ruta
 *  compartida, `ref` = el id de la ruta del catálogo. */
export interface BurstCand { key: string; type: SocialBurstType; nick: string; ref?: string }
/** La memoria de ráfagas de UN usuario (vive en su slice de feedFake; vuelve al seed con el reset del demo). */
export interface BurstMemory {
  /** Claves ya publicadas: no vuelven hasta agotar su tipo. */
  used: Set<string>
  /** Las de la ráfaga anterior: al reciclar un tipo agotado, esas NUNCA. */
  lastKeys: string[]
  /** Protagonistas y rutas de la ráfaga anterior: se prefieren otros. */
  lastNicks: string[]
  lastRefs: string[]
  /** La composición de la ráfaga anterior (mixKey; '' = ninguna): la siguiente sale distinta si se puede. */
  lastMix: string
}
export const newBurstMemory = (): BurstMemory => ({ used: new Set(), lastKeys: [], lastNicks: [], lastRefs: [], lastMix: '' })

/** Fisher-Yates con el `r` dado (el mismo algoritmo que leaguesFake.shuffle; acá para que el módulo quede puro). */
function shuffled<T>(xs: readonly T[], r: () => number): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
/** Cuántos candidatos (los mejores de cada tipo) mira la búsqueda del mejor reparto: 8⁵ combinaciones como mucho (la poda
 *  por puntaje corta casi todo: las listas van ordenadas de mejor a peor). */
const BEST_TOP = 8
/** Un lugar de la ráfaga: sus opciones (ordenadas de mejor a peor) y su grupo. Dos lugares del MISMO grupo (tanda "Ráfaga
 *  variada": hasta 2 por tipo) comparten la lista y van seguidos: el segundo elige solo DESPUÉS del primero en la lista
 *  (un par no se cuenta dos veces). */
interface BurstSlot { opts: readonly BurstCand[]; group: string }
/** La ruta de una noticia de ruta compartida, como "ficha" del reparto: dos rutas de la misma ráfaga, rutas distintas. */
const refToken = (c: BurstCand) => (c.ref !== undefined ? `ref:${c.ref}` : null)
/** Una por lugar, todas con protagonista DISTINTO (y rutas distintas entre las compartidas) y con el MENOR puntaje total
 *  (menos repeticiones de la ráfaga anterior; `leaf` suma un costo por el reparto entero: el lookahead de planBurst). Busca
 *  entre los BEST_TOP mejores de cada lugar; si ahí no hay reparto con todos distintos, entre todos (el primero que
 *  aparezca). null = imposible con protagonistas distintos. Con un lugar por tipo es exactamente la búsqueda de FS-BASE-B. */
function distinctAssign(slots: readonly BurstSlot[], score: (c: BurstCand) => number, leaf: (picks: readonly BurstCand[]) => number = () => 0): BurstCand[] | null {
  const search = (lists: readonly BurstSlot[], firstOnly: boolean): BurstCand[] | null => {
    let best: BurstCand[] | null = null, bestScore = Infinity
    const pick: BurstCand[] = [], at: number[] = [], taken = new Set<string>()
    const go = (i: number, acc: number): void => {
      if (acc >= bestScore) return
      if (i === lists.length) { const total = acc + leaf(pick); if (total < bestScore) { best = [...pick]; bestScore = firstOnly ? -1 : total } return }
      const opts = lists[i].opts
      const from = i > 0 && lists[i - 1].group === lists[i].group ? at[i - 1] + 1 : 0 // el hermano: después del primero
      for (let j = from; j < opts.length; j++) {
        const c = opts[j], ref = refToken(c)
        if (taken.has(c.nick) || (ref !== null && taken.has(ref))) continue
        taken.add(c.nick); if (ref !== null) taken.add(ref)
        pick.push(c); at[i] = j
        go(i + 1, acc + score(c))
        pick.pop(); taken.delete(c.nick); if (ref !== null) taken.delete(ref)
        if (bestScore <= 0) return // ya no se puede mejorar (o alcanza con el primero)
      }
    }
    go(0, 0)
    return best
  }
  return search(slots.map((s) => ({ ...s, opts: s.opts.slice(0, BEST_TOP) })), false) ?? search(slots, true)
}

/** ¿Hay un reparto con protagonistas DISTINTOS entre estas listas? (emparejamiento tipo → protagonista, por aumento). */
function distinctFeasible(lists: readonly (readonly string[])[]): boolean {
  const owner = new Map<string, number>()
  const tryList = (i: number, seen: Set<string>): boolean => {
    for (const nick of lists[i]) {
      if (seen.has(nick)) continue
      seen.add(nick)
      const o = owner.get(nick)
      if (o === undefined || tryList(o, seen)) { owner.set(nick, i); return true }
    }
    return false
  }
  return lists.every((_, i) => tryList(i, new Set()))
}
/** Penalización del lookahead: dejar la ráfaga siguiente SIN reparto de protagonistas distintos (pesa más que repetir un
 *  protagonista o una ruta de la anterior, que valen 1 y 2). */
const TRAP = 5
/** Penalización de reciclar ANTES de agotar el tipo (solo si no hay otra forma de tener protagonistas distintos). */
const RECYCLE = 50
/** Peso del balanceo (fraccionario: suma como mucho BALANCE por noticia, menos que una preferencia entera). */
const BALANCE = 0.4

/** Penalización (solo en el reparto trabado de FS-BASE-B, donde las listas se abren) de usar una noticia del ciclo NUEVO
 *  de un tipo que se agota en esta ráfaga en vez de la que le quedaba sin publicar. Pesa más que cualquier preferencia y
 *  menos que RECYCLE. */
const WRAP = 20

/** Cuántas noticias de un tipo pueden salir juntas: protagonistas distintos y, si son rutas, rutas distintas. */
function spread(cs: readonly BurstCand[]): number {
  const nicks = new Set(cs.map((c) => c.nick)).size
  const refs = new Set(cs.flatMap((c) => (c.ref !== undefined ? [c.ref] : [])))
  return refs.size ? Math.min(nicks, refs.size) : nicks
}
/** Lo que un tipo ofrece en ESTA ráfaga para `q` lugares (puro: no toca la memoria):
 *  - lo NO publicado; si no queda nada, el tipo vuelve a empezar (`reset`) sin lo de la ráfaga anterior (la regla de
 *    siempre);
 *  - si lo no publicado son MENOS noticias que `q` (van dos y le queda una), además lo ya publicado que NO fue de la ráfaga
 *    anterior (`wrap`): el tipo se AGOTA en esta ráfaga —lo que le quedaba sale SÍ o SÍ (slotsFor) y lo que falta ya es del
 *    ciclo nuevo—. (Si le quedan dos o más pero todas de UN mismo protagonista, no: eso sería reciclar ANTES de agotar
 *    —composeBurst elige otra composición, y si no hay, planBurst lo resuelve como siempre, con RECYCLE—.) */
function typePool(all: readonly BurstCand[], q: number, used: ReadonlySet<string>, lastKeys: ReadonlySet<string>): { opts: BurstCand[]; wrap: Set<string>; reset: boolean } {
  const fresh = all.filter((c) => !used.has(c.key))
  if (!fresh.length) return { opts: all.filter((c) => !lastKeys.has(c.key)), wrap: new Set(), reset: true }
  if (fresh.length >= q) return { opts: fresh, wrap: new Set(), reset: false }
  const wrap = all.filter((c) => used.has(c.key) && !lastKeys.has(c.key))
  return { opts: [...fresh, ...wrap], wrap: new Set(wrap.map((c) => c.key)), reset: false }
}
/** La ruta compartida VARÍA de ruta entre ráfagas seguidas (con hasta 2 rutas por ráfaga ya no alcanza la preferencia
 *  blanda de planBurst: con el catálogo de 2 rutas, una ráfaga con las dos dejaría a la siguiente sin ruta nueva): de lo que
 *  ofrece el tipo, solo las rutas que NO salieron en la ráfaga anterior, si alcanzan para `q`. */
function otherRoutes(opts: BurstCand[], q: number, lastRefs: ReadonlySet<string>): BurstCand[] {
  const other = opts.filter((c) => c.ref === undefined || !lastRefs.has(c.ref))
  return other.length && spread(other) >= q ? other : opts
}
/** Los `q` lugares de un tipo a partir de lo que ofrece (`opts`, en el orden de preferencia; `wrap` = las del ciclo nuevo
 *  de typePool). Lo normal: `q` lugares hermanos con la misma lista (con `lastRefs`, las rutas por otherRoutes). Si el tipo
 *  se agota en esta ráfaga: un lugar FIJO por cada noticia que le quedaba (sale sí o sí: si no, se perdería al volver a
 *  empezar el ciclo, y sería reciclar antes de agotar) y el resto, hermanos con las del ciclo nuevo. */
function slotsFor(t: SocialBurstType, q: number, opts: BurstCand[], wrap: ReadonlySet<string>, lastRefs: ReadonlySet<string> | null): BurstSlot[] {
  if (!wrap.size) {
    const o = lastRefs && t === 'route' ? otherRoutes(opts, q, lastRefs) : opts
    return Array.from({ length: q }, (): BurstSlot => ({ opts: o, group: t }))
  }
  const fresh = opts.filter((c) => !wrap.has(c.key))
  const next = opts.filter((c) => wrap.has(c.key))
  const o = lastRefs && t === 'route' ? otherRoutes(next, q - fresh.length, lastRefs) : next
  return [
    ...fresh.map((c, i): BurstSlot => ({ opts: [c], group: `${t}#${i}` })),
    ...Array.from({ length: q - fresh.length }, (): BurstSlot => ({ opts: o, group: `${t}#nuevo` })),
  ]
}

/** El plan de UNA ráfaga. Sin `quota`: una noticia por tipo social con candidatos (la regla de FS-BASE-B, la que sigue
 *  fijando feedMix.test). Con `quota` (composeBurst, tanda "Ráfaga variada"): cuántas de cada tipo, hasta
 *  BURST_MAX_PER_TYPE; dos de un mismo tipo, con protagonistas distintos (y rutas distintas). Los tipos sin candidatos
 *  —filtros de la familia, nadie visible— no salen: honestidad antes que relleno. Actualiza `mem` (lo publicado, la ráfaga
 *  anterior) y devuelve lo elegido en el orden de SOCIAL_BURST_TYPES. */
export function planBurst(cands: readonly BurstCand[], mem: BurstMemory, r: () => number, quota?: Partial<Record<SocialBurstType, number>>): BurstCand[] {
  const lastKeys = new Set(mem.lastKeys), lastNicks = new Set(mem.lastNicks), lastRefs = new Set(mem.lastRefs)
  // otra ruta que la de la ráfaga anterior pesa más que otro protagonista
  const score = (c: BurstCand) => (c.ref !== undefined && lastRefs.has(c.ref) ? 2 : 0) + (lastNicks.has(c.nick) ? 1 : 0)
  const want = (t: SocialBurstType) => (quota ? Math.max(0, Math.min(BURST_MAX_PER_TYPE, Math.floor(quota[t] ?? 0))) : 1)
  // los tipos de ESTA ráfaga (q > 0) y, para el lookahead, todos los que tienen algo que ofrecer
  const types: { t: SocialBurstType; all: BurstCand[]; opts: BurstCand[]; wrap: Set<string>; q: number }[] = []
  const look: BurstCand[][] = []
  for (const t of SOCIAL_BURST_TYPES) {
    const all = cands.filter((c) => c.type === t)
    if (!all.length) continue
    const q = want(t)
    const p = typePool(all, Math.max(q, 1), mem.used, lastKeys)
    // tipo agotado: vuelve a empezar, sin repetir lo de la ráfaga anterior (un tipo que no sale en esta ráfaga no se toca)
    if (p.reset && q > 0) for (const c of all) mem.used.delete(c.key)
    if (!p.opts.length) continue
    look.push(all)
    if (q > 0) types.push({ t, all, opts: p.opts, wrap: p.wrap, q })
  }
  // FS-BASE-B, lookahead: con estas elegidas, ¿la ráfaga que sigue tiene reparto con protagonistas distintos (una por
  // tipo)? (lo que le quedaría a cada tipo; si se agota, vuelve a empezar sin lo de ESTA ráfaga, como arriba)
  const leaf = (picks: readonly BurstCand[]): number => {
    const chosen = new Set(picks.map((c) => c.key))
    const next = look.map((all) => {
      const left = all.filter((c) => !mem.used.has(c.key) && !chosen.has(c.key))
      return (left.length ? left : all.filter((c) => !chosen.has(c.key))).map((c) => c.nick)
    }).filter((l) => l.length)
    return distinctFeasible(next) ? 0 : TRAP
  }
  // FS-BASE-B, balanceo: dentro de un tipo se prefiere (con peso FRACCIONARIO: nunca pisa lo de la ráfaga anterior) la
  // noticia del protagonista al que más le quedan en ese tipo, así lo que queda sin publicar no se concentra en una sola
  // persona (la traba de arriba nace de eso).
  const left = new Map<string, number>()
  for (const { opts } of types) for (const c of opts) left.set(`${c.type}|${c.nick}`, (left.get(`${c.type}|${c.nick}`) ?? 0) + 1)
  const bscore = (c: BurstCand) => score(c) + BALANCE / (left.get(`${c.type}|${c.nick}`) ?? 1)
  // un lugar por noticia (slotsFor: q por tipo; con `quota`, la ruta compartida cambia de ruta como regla —otherRoutes—,
  // sin `quota` queda la preferencia de `score`), los más cortos primero (estable: los hermanos siguen juntos)
  const byLength = (a: BurstSlot, b: BurstSlot) => a.opts.length - b.opts.length
  const slots = types.flatMap(({ t, q, opts, wrap }) => slotsFor(t, q, shuffled(opts, r).sort((a, b) => bscore(a) - bscore(b)), wrap, quota ? lastRefs : null)).sort(byLength)
  // protagonistas distintos si se puede
  let picks = distinctAssign(slots, bscore, leaf)
  if (!picks) {
    // FS-BASE-B: trabado (ningún reparto con protagonistas distintos entre lo NO publicado). Se deja reciclar ANTES de
    // agotar el tipo lo ya publicado —nunca lo de la ráfaga anterior—, con una penalización alta: se recicla lo mínimo.
    // (Un tipo que se agota en esta ráfaga abre también sus lugares fijos, con WRAP: lo que le quedaba, primero.)
    const recycled = new Set<string>(), wrapped = new Set(types.flatMap(({ wrap }) => [...wrap]))
    const wide = types.map(({ t, q, all, opts }) => {
      const extra = all.filter((c) => !opts.includes(c) && !lastKeys.has(c.key))
      for (const c of extra) recycled.add(c.key)
      return { t, q, opts: [...opts, ...extra] }
    })
    const wscore = (c: BurstCand) => score(c) + (wrapped.has(c.key) ? WRAP : 0) + (recycled.has(c.key) ? RECYCLE : 0)
    picks = distinctAssign(wide.flatMap(({ t, q, opts }) => {
      const o = shuffled(opts, r).sort((a, b) => wscore(a) - wscore(b))
      return Array.from({ length: q }, (): BurstSlot => ({ opts: o, group: t }))
    }).sort(byLength), wscore)
  }
  // si tampoco (pocos amigos con noticias), el mejor de cada lugar sin repetir quien se pueda (ni nunca la misma noticia)
  if (!picks) {
    const taken = new Set<string>(), keys = new Set<string>()
    picks = []
    for (const { opts } of slots) {
      const c = opts.find((x) => !taken.has(x.nick) && !keys.has(x.key)) ?? opts.find((x) => !keys.has(x.key))
      if (!c) continue
      taken.add(c.nick); keys.add(c.key); picks.push(c)
    }
  }
  picks.sort((a, b) => SOCIAL_BURST_TYPES.indexOf(a.type) - SOCIAL_BURST_TYPES.indexOf(b.type))
  // un tipo que se agotó EN esta ráfaga (salió una de `wrap`) vuelve a empezar: su ciclo nuevo arranca con lo de ahora
  for (const { all, wrap } of types) if (picks.some((c) => wrap.has(c.key))) for (const c of all) mem.used.delete(c.key)
  for (const c of picks) mem.used.add(c.key)
  mem.lastKeys = picks.map((c) => c.key)
  mem.lastNicks = picks.map((c) => c.nick)
  mem.lastRefs = picks.flatMap((c) => (c.ref !== undefined ? [c.ref] : []))
  return picks
}

/** Todas las composiciones de `size` noticias con como mucho cap[t] de cada tipo (en un orden fijo: el sorteo lo hace
 *  composeBurst con `r`). */
function mixesOf(cap: BurstMix, size: number): BurstMix[] {
  const out: BurstMix[] = []
  const cur = Object.fromEntries(BURST_TYPES.map((t) => [t, 0])) as BurstMix
  const go = (i: number, rest: number): void => {
    if (i === BURST_TYPES.length) { if (rest === 0) out.push({ ...cur }); return }
    const t = BURST_TYPES[i]
    for (let n = Math.min(cap[t], rest); n >= 0; n--) { cur[t] = n; go(i + 1, rest - n) }
    cur[t] = 0
  }
  go(0, size)
  return out
}

/** La ráfaga SORTEADA (tanda "Ráfaga variada", 29-oct; ver la cabecera, regla 3). Sortea con `r` la composición entre
 *  todas las de BURST_SIZE noticias con como mucho BURST_MAX_PER_TYPE de cada tipo (`raceCap` = cuántas carreras puede
 *  contar feedFake: 0 con Ligas apagado; cada carrera es un compañero DISTINTO de tu tabla, nunca un amigo), en este orden
 *  de preferencia: DISTINTA de la de la ráfaga anterior y con reparto de protagonistas distintos sin reciclar antes de
 *  tiempo → distinta y con reparto de protagonistas distintos reciclando lo mínimo (la regla de FS-BASE-B: protagonistas
 *  distintos ganan sobre no repetir; pasa con pocos amigos, p. ej. Luna con Ligas apagado: 5 lugares y 5 NPCs) → con
 *  reparto aunque repita la composición (no había otra) → cualquiera. La ruta compartida nunca repite la ruta de la ráfaga
 *  anterior si hay otra (cap y otherRoutes). Después reparte lo social con planBurst (todas sus reglas finas). Si los
 *  candidatos no alcanzan para BURST_SIZE, la ráfaga es más corta (honestidad antes que relleno). Devuelve lo social
 *  elegido, cuántas carreras van y la composición sorteada. */
export function composeBurst(cands: readonly BurstCand[], mem: BurstMemory, r: () => number, raceCap = 0): { picks: BurstCand[]; race: number; mix: BurstMix } {
  const lastKeys = new Set(mem.lastKeys), lastRefs = new Set(mem.lastRefs)
  const byType = new Map(SOCIAL_BURST_TYPES.map((t) => [t, cands.filter((c) => c.type === t)] as const))
  const cap = { race: Math.max(0, Math.min(BURST_MAX_PER_TYPE, Math.floor(raceCap))) } as BurstMix
  for (const t of SOCIAL_BURST_TYPES) {
    const usable = byType.get(t)!.filter((c) => !lastKeys.has(c.key))
    cap[t] = Math.min(BURST_MAX_PER_TYPE, spread(usable))
    if (t !== 'route') continue
    // rutas: solo las que no salieron en la ráfaga anterior (otherRoutes); si salieron TODAS las del catálogo, esta
    // ráfaga va sin ruta compartida — salvo que el catálogo tenga una sola (no hay cómo variar: sale esa, como siempre)
    const other = usable.filter((c) => c.ref === undefined || !lastRefs.has(c.ref))
    if (other.length) cap.route = Math.min(cap.route, spread(other))
    else if (new Set(usable.map((c) => c.ref)).size > 1) cap.route = 0
  }
  const size = Math.min(BURST_SIZE, BURST_TYPES.reduce((s, t) => s + cap[t], 0))
  // ¿esta composición admite protagonistas distintos con lo que ofrece cada tipo (sin reciclar antes de agotarlo)? Y si no,
  // ¿reciclando antes de tiempo (todo lo que no fue de la ráfaga anterior: el reparto trabado de planBurst)?
  const fitsWide = (m: BurstMix): boolean => {
    const lists: string[][] = []
    for (const t of SOCIAL_BURST_TYPES) {
      if (!m[t]) continue
      const opts = byType.get(t)!.filter((c) => !lastKeys.has(c.key))
      if (spread(opts) < m[t]) return false
      for (let k = 0; k < m[t]; k++) lists.push(opts.map((c) => c.nick))
    }
    return distinctFeasible(lists)
  }
  // (rutas: además, sin la ruta de la ráfaga anterior si el catálogo tiene más de una —ni siquiera la que le quedaba sin
  // publicar a un tipo que se agota—: esa composición no entra, sale otra)
  const vary = new Set(byType.get('route')!.map((c) => c.ref)).size > 1
  const fits = (m: BurstMix): boolean => {
    const lists: string[][] = []
    for (const t of SOCIAL_BURST_TYPES) {
      if (!m[t]) continue
      const p = typePool(byType.get(t)!, m[t], mem.used, lastKeys)
      const slots = slotsFor(t, m[t], p.opts, p.wrap, lastRefs)
        .map((s) => (t === 'route' && vary ? s.opts.filter((c) => c.ref === undefined || !lastRefs.has(c.ref)) : s.opts))
      if (spread(slots.flat()) < m[t] || slots.some((o) => !o.length)) return false
      for (const o of slots) lists.push(o.map((c) => c.nick))
    }
    return distinctFeasible(lists)
  }
  const other = (m: BurstMix) => mixKey(m) !== mem.lastMix
  const order = shuffled(mixesOf(cap, size), r)
  const mix = order.find((m) => other(m) && fits(m)) ?? order.find((m) => other(m) && fitsWide(m)) ?? order.find(fits) ?? order[0]
  const picks = planBurst(cands, mem, r, Object.fromEntries(SOCIAL_BURST_TYPES.map((t) => [t, mix[t]])))
  mem.lastMix = mixKey(mix)
  return { picks, race: mix.race, mix }
}

/** El pool de la ráfaga: logros coherentes con cada NPC del demo (sus cursos, su racha y su liga de friendsFake), por TIPO
 *  (racha, insignia, unidad completada). Ningún texto repite una noticia del seed (friendsFake NEWS): la ráfaga trae cosas
 *  nuevas. Las medallas de LIGA de los amigos van aparte (NPC_MEDALS, abajo: tanda "Ráfaga variada", 29-oct); los "va 2º
 *  en su liga" de antes se retiraron de la ráfaga (no son ninguno de los tipos del pedido). Cada usuario ve las de quien ve
 *  en SU grafo (feedFake filtra con isVisibleNpc); f10, f11, f13 y f14 (el pool de Buscar → Personas) entran si se hacen
 *  amigos. Lo nuevo, AL FINAL de cada NPC (las claves no se reusan). */
// TEEN (4-nov, pedido de Esteban: «que parezca para un chico de 13»): mismas CLAVES, tipos y orden (la memoria de la ráfaga
// va por clave); textos con los cursos de 13 de friendsFake (Álgebra, Paleontología, Biología marina, Inglés intermedio,
// Anatomía) y sin festejos de jardín («¡otra vez!», «Little Artist», «Nido de Colibrí»).
export const NPC_NEWS: readonly { key: string; nick: string; text: string; type: Exclude<SocialBurstType, 'route' | 'medal'> }[] = [
  // f1 · TomasApolo (El sistema solar, Paleontología · racha 12)
  { key: 'tomi-brujula', nick: 'TomasApolo', text: 'se ganó la insignia «Órbita de Transferencia» en El sistema solar 🚀', type: 'badge' },
  { key: 'tomi-cometas', nick: 'TomasApolo', text: 'terminó la unidad «Cometas y asteroides» de El sistema solar ☄️', type: 'unit' },
  { key: 'tomi-pasos', nick: 'TomasApolo', text: 'completó 25 pasos esta semana', type: 'streak' },
  { key: 'tomi-saturno', nick: 'TomasApolo', text: 'se ganó la insignia «Anillos de Saturno» en El sistema solar 🪐', type: 'badge' },
  { key: 'tomi-huellas', nick: 'TomasApolo', text: 'terminó la unidad «Icnitas: leer huellas fósiles» de Paleontología 🦕', type: 'unit' },
  { key: 'tomi-desayuno', nick: 'TomasApolo', text: 'practicó antes del desayuno y no cortó su racha 🌅', type: 'streak' },
  // f2 · LuMagma (Biología marina · racha 8)
  { key: 'luli-ballenas', nick: 'LuMagma', text: 'se ganó la insignia «Ecolocalización» en Biología marina 🐋', type: 'badge' },
  { key: 'luli-pulpos', nick: 'LuMagma', text: 'terminó la unidad «Cefalópodos» de Biología marina 🐙', type: 'unit' },
  { key: 'luli-racha', nick: 'LuMagma', text: 'llegó a 8 días seguidos practicando 🔥', type: 'streak' },
  { key: 'luli-lava', nick: 'LuMagma', text: 'se ganó la insignia «Magma y Placas» en Geología 🌋', type: 'badge' },
  { key: 'luli-tortugas', nick: 'LuMagma', text: 'terminó la unidad «Migración de las tortugas marinas» de Biología marina 🐢', type: 'unit' },
  { key: 'luli-pasos', nick: 'LuMagma', text: 'completó 30 pasos esta semana', type: 'streak' },
  // f3 · MateoPaleo (Paleontología, Álgebra · racha 21)
  { key: 'mateo-racha', nick: 'MateoPaleo', text: 'llegó a 3 semanas de racha: 21 días seguidos 🔥', type: 'streak' },
  { key: 'mateo-llave', nick: 'MateoPaleo', text: 'se ganó la insignia «Despeje Perfecto» en Álgebra 🔑', type: 'badge' },
  { key: 'mateo-comparar', nick: 'MateoPaleo', text: 'terminó la unidad «Inecuaciones» de Álgebra', type: 'unit' },
  { key: 'mateo-fosiles', nick: 'MateoPaleo', text: 'se ganó la insignia «Estratigrafía» en Paleontología 🦴', type: 'badge' },
  { key: 'mateo-cretacico', nick: 'MateoPaleo', text: 'terminó la unidad «El Cretácico» de Paleontología 🦖', type: 'unit' },
  { key: 'mateo-semana', nick: 'MateoPaleo', text: 'practicó todos los días de la semana, otra vez 📅', type: 'streak' },
  // f4 · CataNova (Inglés intermedio · racha 3)
  { key: 'cata-colores', nick: 'CataNova', text: 'se ganó la insignia «Past Perfect» en Inglés intermedio 📘', type: 'badge' },
  { key: 'cata-numbers', nick: 'CataNova', text: 'terminó la unidad «Conditionals» de Inglés intermedio: if I were you…', type: 'unit' },
  { key: 'cata-racha', nick: 'CataNova', text: 'arrancó una racha: 3 días seguidos practicando ✨', type: 'streak' },
  { key: 'cata-artist', nick: 'CataNova', text: 'se ganó la insignia «Storyteller» en Inglés intermedio ✍️', type: 'badge' },
  { key: 'cata-animals', nick: 'CataNova', text: 'terminó la unidad «Movies & Series» de Inglés intermedio 🎬', type: 'unit' },
  { key: 'cata-pasos', nick: 'CataNova', text: 'completó 12 pasos esta semana 🌟', type: 'streak' },
  // f5 · JuanTrueno (Álgebra · racha 2)
  { key: 'juanchi-equiv', nick: 'JuanTrueno', text: 'terminó la unidad «Expresiones algebraicas» de Álgebra ⚡', type: 'unit' },
  { key: 'juanchi-racha', nick: 'JuanTrueno', text: 'ya lleva 2 días seguidos practicando', type: 'streak' },
  { key: 'juanchi-rayo', nick: 'JuanTrueno', text: 'se ganó la insignia «Rayo Algebraico» en Álgebra ⚡', type: 'badge' },
  { key: 'juanchi-pasos', nick: 'JuanTrueno', text: 'completó 10 pasos esta semana ⚽', type: 'streak' },
  // f6 · MartuPulso (Anatomía, El sistema solar · racha 5)
  { key: 'martu-corazon', nick: 'MartuPulso', text: 'se ganó la insignia «Ritmo Cardíaco» en Anatomía ❤️', type: 'badge' },
  { key: 'martu-luna', nick: 'MartuPulso', text: 'terminó la unidad «La Luna» de El sistema solar 🌙', type: 'unit' },
  { key: 'martu-racha', nick: 'MartuPulso', text: 'llegó a 5 días seguidos practicando 🔥', type: 'streak' },
  { key: 'martu-huesos', nick: 'MartuPulso', text: 'terminó la unidad «El sistema óseo» de Anatomía 🦴', type: 'unit' },
  { key: 'martu-estetoscopio', nick: 'MartuPulso', text: 'se ganó la insignia «Estetoscopio de Oro» en Anatomía 🩺', type: 'badge' },
  { key: 'martu-pasos', nick: 'MartuPulso', text: 'completó 18 pasos esta semana', type: 'streak' },
  // f7 · NicoServo (Álgebra, El sistema solar · racha 4)
  { key: 'nico-decimales', nick: 'NicoServo', text: 'se ganó la insignia «Sistemas de Ecuaciones» en Álgebra 🤖', type: 'badge' },
  { key: 'nico-espacio', nick: 'NicoServo', text: 'terminó la unidad «Sondas y satélites» de El sistema solar 🛰️', type: 'unit' },
  { key: 'nico-racha', nick: 'NicoServo', text: 'llegó a 4 días seguidos practicando 🔧', type: 'streak' },
  { key: 'nico-recta', nick: 'NicoServo', text: 'terminó la unidad «Funciones lineales» de Álgebra 📏', type: 'unit' },
  { key: 'nico-rover', nick: 'NicoServo', text: 'se ganó la insignia «Rover Explorador» en El sistema solar 🛰️', type: 'badge' },
  // f12 · LeaVega (El sistema solar · racha 7) — amiga de Luna
  { key: 'lea-saturno', nick: 'LeaVega', text: 'se ganó la insignia «Cazadora de Planetas» en El sistema solar 🪐', type: 'badge' },
  { key: 'lea-racha', nick: 'LeaVega', text: 'observó con su telescopio y no cortó su racha 🔭', type: 'streak' },
  { key: 'lea-constelaciones', nick: 'LeaVega', text: 'terminó la unidad «Las constelaciones» de El sistema solar ✨', type: 'unit' },
  { key: 'lea-pasos', nick: 'LeaVega', text: 'completó 22 pasos esta semana 💫', type: 'streak' },
  // f8 · TriniLofi (Inglés intermedio · racha 6) — amiga de Luna
  { key: 'trini-oido', nick: 'TriniLofi', text: 'se ganó la insignia «Lyrics Translator» en Inglés intermedio 🎼', type: 'badge' },
  { key: 'trini-pasos', nick: 'TriniLofi', text: 'completó 20 pasos esta semana', type: 'streak' },
  { key: 'trini-songs', nick: 'TriniLofi', text: 'terminó la unidad «Listening: podcasts» de Inglés intermedio 🎧', type: 'unit' },
  { key: 'trini-racha', nick: 'TriniLofi', text: 'llegó a 6 días seguidos practicando 🎶', type: 'streak' },
  // f9 · FedeBlitz (Álgebra · racha 9) — le pide contacto a Luna
  { key: 'fede-jaque', nick: 'FedeBlitz', text: 'se ganó la insignia «Jaque al Álgebra» en Álgebra ♟️', type: 'badge' },
  { key: 'fede-racha', nick: 'FedeBlitz', text: 'llegó a 9 días seguidos practicando ♟️', type: 'streak' },
  { key: 'fede-mixtos', nick: 'FedeBlitz', text: 'terminó la unidad «Factorización» de Álgebra 🧩', type: 'unit' },
  // f10, f11, f13, f14 · el pool de Buscar → Personas (salen si se hacen amigos)
  { key: 'mica-tortuga', nick: 'MicaTinta', text: 'se ganó la insignia «Ilustración Científica» en Biología marina 🐢', type: 'badge' },
  { key: 'mica-arrecife', nick: 'MicaTinta', text: 'terminó la unidad «Arrecifes de coral» de Biología marina 🐠', type: 'unit' },
  { key: 'mica-racha', nick: 'MicaTinta', text: 'llegó a 4 días seguidos practicando 🎨', type: 'streak' },
  { key: 'gero-plumas', nick: 'GeroHalcón', text: 'terminó la unidad «Dinosaurios con plumas» de Paleontología 🐦', type: 'unit' },
  { key: 'gero-racha', nick: 'GeroHalcón', text: 'llegó a 11 días seguidos practicando 🔥', type: 'streak' },
  { key: 'gero-nido', nick: 'GeroHalcón', text: 'se ganó la insignia «Ojo de Halcón» en Paleontología 🦅', type: 'badge' },
  { key: 'nahue-golazo', nick: 'NahueRabona', text: 'se ganó la insignia «Golazo Algebraico» en Álgebra ⚽', type: 'badge' },
  { key: 'nahue-sports', nick: 'NahueRabona', text: 'terminó la unidad «Sports commentary» de Inglés intermedio ⚽', type: 'unit' },
  { key: 'nahue-racha', nick: 'NahueRabona', text: 'llegó a 3 días seguidos practicando', type: 'streak' },
  { key: 'coni-cocina', nick: 'ConiLab', text: 'se ganó la insignia «Bioquímica» en Anatomía 🧪', type: 'badge' },
  { key: 'coni-pulmones', nick: 'ConiLab', text: 'terminó la unidad «El sistema respiratorio» de Anatomía 🌬️', type: 'unit' },
  { key: 'coni-racha', nick: 'ConiLab', text: 'llegó a 5 días seguidos practicando 🧪', type: 'streak' },
]
/** Quién comparte rutas en la ráfaga: cualquier NPC que el activo vea (feedFake filtra con su grafo), en este orden. */
export const SHARERS: readonly string[] = [
  'TomasApolo', 'LuMagma', 'CataNova', 'MartuPulso', 'JuanTrueno', 'LeaVega', 'TriniLofi', 'MateoPaleo', 'NicoServo',
  'FedeBlitz', 'MicaTinta', 'GeroHalcón', 'NahueRabona', 'ConiLab',
]

export type MedalTint = 'oro' | 'plata' | 'bronce'
/** Tanda "Ráfaga variada" (29-oct): las MEDALLAS DE LIGA de los amigos para la ráfaga (tipo 'medal'; ícono 'medal' en el
 *  feed, que el cliente pinta con el tinte del emoji 🥇🥈🥉 que lleva cada texto —newsFace—). Solo con Ligas (feedFake).
 *  UNA por NPC y coherente con su liga de HOY (`league` = la de friendsFake; feedBurst.test lo coteja con el seed real) y
 *  con la escalera de leaguesFake (Chispa → Cometa → Estrella…; podio → sube): o la ganó en la liga de abajo y subió a la
 *  suya, o —si su noticia del seed ya contaba una medalla— es ESA misma medalla (mismo metal), nunca otra. Se cuentan como
 *  algo que el amigo PUBLICA ahora sobre su medalla (la festeja, la colgó, estrena su liga): las medallas se reparten en el
 *  cierre del domingo, no a cualquier hora. Sin los de la Liga Chispa (la de abajo de todo: no pudieron subir a ella) ni
 *  CataNova (su noticia del seed "subió a la Liga Estrella" no cuadra con su liga de hoy, la Cometa: no se le suma
 *  otra). Oro, plata y bronce repartidos para que Ian y Luna vean los TRES tintes. Claves nuevas; lo nuevo, AL FINAL. */
export const NPC_MEDALS: readonly { key: string; nick: string; medal: MedalTint; league: string; text: string }[] = [
  // TEEN (4-nov): mismas medallas, ligas y claves; sin los «¡…!» de festejo de jardín.
  // amigos de Ian: TomasApolo, MateoPaleo (los dos con su medalla en el seed: la misma) y LuMagma
  { key: 'tomi-medalla-liga', nick: 'TomasApolo', medal: 'bronce', league: 'Liga Cometa', text: 'festeja su medalla de bronce 🥉 de la Liga Cometa: esta semana va por más 🚀' },
  { key: 'luli-medalla-liga', nick: 'LuMagma', medal: 'plata', league: 'Liga Cometa', text: 'colgó en su perfil la medalla de plata 🥈 de la Liga Chispa: ya compite en la Liga Cometa ☄️' },
  { key: 'mateo-medalla-liga', nick: 'MateoPaleo', medal: 'oro', league: 'Liga Estrella', text: 'ya compite en la Liga Estrella ⭐ con la medalla de oro 🥇 que ganó en la Liga Cometa 🦴' },
  // de Ian y de Luna
  { key: 'martu-medalla-liga', nick: 'MartuPulso', medal: 'plata', league: 'Liga Cometa', text: 'estrena la Liga Cometa ☄️ con la medalla de plata 🥈 que ganó en la Liga Chispa 🌙' },
  // de Luna: TriniLofi, LeaVega y FedeBlitz (estos dos, con su medalla en el seed: la misma)
  { key: 'trini-medalla-liga', nick: 'TriniLofi', medal: 'oro', league: 'Liga Cometa', text: 'festeja su medalla de oro 🥇 de la Liga Chispa con un beat nuevo: ya está en la Liga Cometa ☄️ 🎹' },
  { key: 'lea-medalla-liga', nick: 'LeaVega', medal: 'bronce', league: 'Liga Cometa', text: 'anotó en su registro de observación la medalla de bronce 🥉 de la Liga Chispa: ya practica en la Liga Cometa ☄️ 🔭' },
  { key: 'fede-medalla-liga', nick: 'FedeBlitz', medal: 'oro', league: 'Liga Estrella', text: 'estrena la Liga Estrella ⭐ con su medalla de oro 🥇 de la Liga Cometa ♟️' },
  // el pool de Buscar → Personas (salen si se hacen amigos)
  { key: 'gero-medalla-liga', nick: 'GeroHalcón', medal: 'bronce', league: 'Liga Cometa', text: 'ya compite en la Liga Cometa ☄️ con la medalla de bronce 🥉 que ganó en la Liga Chispa 🦅' },
  { key: 'coni-medalla-liga', nick: 'ConiLab', medal: 'plata', league: 'Liga Cometa', text: 'festeja su medalla de plata 🥈 de la Liga Chispa: ya compite en la Liga Cometa ☄️ 🧪' },
]
