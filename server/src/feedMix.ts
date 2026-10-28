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
//   2) LA RÁFAGA DE NPCs (planBurst): UNA noticia de cada tipo social —racha, insignia, unidad completada, ruta
//      compartida— (feedFake suma la quinta: la carrera de tu liga, con XP real), NUNCA dos del mismo tipo; protagonistas
//      distintos dentro de la ráfaga siempre que se pueda y, primero, otros que los de la ráfaga anterior; sin repetir una
//      noticia hasta agotar SU tipo, y al reciclarlo nunca las de la ráfaga anterior.
// Todo determinístico con el `r` que se pasa (rng de leaguesFake): mismas ráfagas para el mismo usuario y semana.

/* ---------- la edición sembrada ---------- */
export type Daypart = 'manana' | 'tarde' | 'noche'
export type Slot = 'friend' | 'article' | 'route' | 'video'
export const SLOTS: readonly Slot[] = ['friend', 'article', 'route', 'video']
/** La plantilla de cada franja: el orden de los tipos de la CABEZA de la edición (una pasada) y en qué lugar de la primera
 *  página van la grilla de videos y el resumen (noticia → 1-2 "para vos" → grilla → más social → resumen…). */
export const EDITIONS: Record<Daypart, { pattern: readonly Slot[]; shelfAfter: number; summaryAfter: number }> = {
  manana: { pattern: ['friend', 'article', 'route', 'friend', 'article', 'video', 'friend', 'video', 'route', 'article', 'video'], shelfAfter: 3, summaryAfter: 4 },
  tarde: { pattern: ['friend', 'route', 'friend', 'article', 'video', 'friend', 'video', 'article', 'video', 'route', 'video'], shelfAfter: 2, summaryAfter: 4 },
  noche: { pattern: ['friend', 'article', 'friend', 'video', 'route', 'friend', 'video', 'article', 'video'], shelfAfter: 2, summaryAfter: 3 },
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
/** Los tipos de noticia social de la ráfaga (la quinta, la carrera de tu liga, la arma feedFake con leaguesFake). */
export type SocialBurstType = 'streak' | 'badge' | 'unit' | 'route'
export const SOCIAL_BURST_TYPES: readonly SocialBurstType[] = ['streak', 'badge', 'unit', 'route']
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
}
export const newBurstMemory = (): BurstMemory => ({ used: new Set(), lastKeys: [], lastNicks: [], lastRefs: [] })

/** Fisher-Yates con el `r` dado (el mismo algoritmo que leaguesFake.shuffle; acá para que el módulo quede puro). */
function shuffled<T>(xs: readonly T[], r: () => number): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
/** Cuántos candidatos (los mejores de cada tipo) mira la búsqueda del mejor reparto: 8⁴ combinaciones como mucho. */
const BEST_TOP = 8
/** Una por opción, todas con protagonista DISTINTO y con el MENOR puntaje total (menos repeticiones de la ráfaga
 *  anterior). Busca entre los BEST_TOP mejores de cada tipo; si ahí no hay reparto con todos distintos, entre todos (el
 *  primero que aparezca). null = imposible con protagonistas distintos. */
function distinctAssign(options: readonly BurstCand[][], score: (c: BurstCand) => number): BurstCand[] | null {
  const search = (lists: readonly BurstCand[][], firstOnly: boolean): BurstCand[] | null => {
    let best: BurstCand[] | null = null, bestScore = Infinity
    const pick: BurstCand[] = [], taken = new Set<string>()
    const go = (i: number, acc: number): void => {
      if (acc >= bestScore) return
      if (i === lists.length) { best = [...pick]; bestScore = firstOnly ? -1 : acc; return }
      for (const c of lists[i]) {
        if (taken.has(c.nick)) continue
        taken.add(c.nick); pick.push(c)
        go(i + 1, acc + score(c))
        pick.pop(); taken.delete(c.nick)
        if (bestScore <= 0) return // ya no se puede mejorar (o alcanza con el primero)
      }
    }
    go(0, 0)
    return best
  }
  return search(options.map((o) => o.slice(0, BEST_TOP)), false) ?? search(options, true)
}

/** El plan de UNA ráfaga: como mucho una noticia por tipo social (los tipos sin candidatos —filtros de la familia, nadie
 *  visible— no salen: honestidad antes que relleno). Actualiza `mem` (lo publicado, la ráfaga anterior) y devuelve lo
 *  elegido en el orden de SOCIAL_BURST_TYPES. */
export function planBurst(cands: readonly BurstCand[], mem: BurstMemory, r: () => number): BurstCand[] {
  const lastKeys = new Set(mem.lastKeys), lastNicks = new Set(mem.lastNicks), lastRefs = new Set(mem.lastRefs)
  // otra ruta que la de la ráfaga anterior pesa más que otro protagonista
  const score = (c: BurstCand) => (c.ref !== undefined && lastRefs.has(c.ref) ? 2 : 0) + (lastNicks.has(c.nick) ? 1 : 0)
  const options: BurstCand[][] = []
  for (const t of SOCIAL_BURST_TYPES) {
    const all = cands.filter((c) => c.type === t)
    if (!all.length) continue
    let avail = all.filter((c) => !mem.used.has(c.key))
    if (!avail.length) { // tipo agotado: vuelve a empezar, sin repetir lo de la ráfaga anterior
      for (const c of all) mem.used.delete(c.key)
      avail = all.filter((c) => !lastKeys.has(c.key))
    }
    if (avail.length) options.push(shuffled(avail, r).sort((a, b) => score(a) - score(b)))
  }
  options.sort((a, b) => a.length - b.length)
  // protagonistas distintos si se puede; si no (pocos amigos con noticias), el mejor de cada tipo sin repetir quien se pueda
  let picks = distinctAssign(options, score)
  if (!picks) {
    const taken = new Set<string>()
    picks = options.map((o) => { const c = o.find((x) => !taken.has(x.nick)) ?? o[0]; taken.add(c.nick); return c })
  }
  picks.sort((a, b) => SOCIAL_BURST_TYPES.indexOf(a.type) - SOCIAL_BURST_TYPES.indexOf(b.type))
  for (const c of picks) mem.used.add(c.key)
  mem.lastKeys = picks.map((c) => c.key)
  mem.lastNicks = picks.map((c) => c.nick)
  mem.lastRefs = picks.flatMap((c) => (c.ref !== undefined ? [c.ref] : []))
  return picks
}

/** El pool de la ráfaga: logros coherentes con cada NPC del demo (sus cursos, su racha y su liga de friendsFake), por TIPO
 *  (racha, insignia, unidad completada). Ningún texto repite una noticia del seed (friendsFake NEWS): la ráfaga trae cosas
 *  nuevas. Las medallas de LIGA (oro/plata/bronce) y los ascensos solo salen del cierre de la semana; los "va 2º en su
 *  liga" de antes se retiraron de la ráfaga (no son ninguno de los 5 tipos del pedido). Cada usuario ve las de quien ve en
 *  SU grafo (feedFake filtra con isVisibleNpc); f10, f11, f13 y f14 (el pool de Buscar → Personas) entran si se hacen
 *  amigos. Lo nuevo, AL FINAL de cada NPC (las claves no se reusan). */
export const NPC_NEWS: readonly { key: string; nick: string; text: string; type: Exclude<SocialBurstType, 'route'> }[] = [
  // f1 · TomiCohete (El sistema solar, Dinosaurios · racha 12)
  { key: 'tomi-brujula', nick: 'TomiCohete', text: 'se ganó la «Brújula Espacial» en El sistema solar 🚀', type: 'badge' },
  { key: 'tomi-cometas', nick: 'TomiCohete', text: 'terminó la unidad «Cometas y asteroides» de El sistema solar ☄️', type: 'unit' },
  { key: 'tomi-pasos', nick: 'TomiCohete', text: 'completó 25 pasos esta semana 💪', type: 'streak' },
  { key: 'tomi-saturno', nick: 'TomiCohete', text: 'se ganó la insignia «Anillos de Saturno» en El sistema solar 🪐', type: 'badge' },
  { key: 'tomi-huellas', nick: 'TomiCohete', text: 'terminó la unidad «Huellas de dinosaurio» de Dinosaurios 🦕', type: 'unit' },
  { key: 'tomi-desayuno', nick: 'TomiCohete', text: 'practicó antes del desayuno y no cortó su racha 🌅', type: 'streak' },
  // f2 · LuliVolcan (Animales del océano · racha 8)
  { key: 'luli-ballenas', nick: 'LuliVolcan', text: 'se ganó la «Medalla de ballenas» en Animales del océano 🐋', type: 'badge' },
  { key: 'luli-pulpos', nick: 'LuliVolcan', text: 'terminó la unidad «Pulpos, medusas y estrellas» de Animales del océano 🐙', type: 'unit' },
  { key: 'luli-racha', nick: 'LuliVolcan', text: 'llegó a 8 días seguidos practicando 🔥', type: 'streak' },
  { key: 'luli-lava', nick: 'LuliVolcan', text: 'se ganó la insignia «Corazón de Lava» en Volcanes 🌋', type: 'badge' },
  { key: 'luli-tortugas', nick: 'LuliVolcan', text: 'terminó la unidad «Tortugas marinas» de Animales del océano 🐢', type: 'unit' },
  { key: 'luli-pasos', nick: 'LuliVolcan', text: 'completó 30 pasos esta semana 💪', type: 'streak' },
  // f3 · MateoDino (Dinosaurios, Fracciones · racha 21)
  { key: 'mateo-racha', nick: 'MateoDino', text: 'llegó a 3 semanas de racha: ¡21 días seguidos! 🔥', type: 'streak' },
  { key: 'mateo-llave', nick: 'MateoDino', text: 'se ganó la «Llave de Equivalencias» en Fracciones 🔑', type: 'badge' },
  { key: 'mateo-comparar', nick: 'MateoDino', text: 'terminó la unidad «Comparar y ordenar» de Fracciones', type: 'unit' },
  { key: 'mateo-fosiles', nick: 'MateoDino', text: 'se ganó la insignia «Cazador de Fósiles» en Dinosaurios 🦴', type: 'badge' },
  { key: 'mateo-cretacico', nick: 'MateoDino', text: 'terminó la unidad «El Cretácico» de Dinosaurios 🦖', type: 'unit' },
  { key: 'mateo-semana', nick: 'MateoDino', text: 'practicó todos los días de la semana, ¡otra vez! 📅', type: 'streak' },
  // f4 · CataEstrella (Inglés inicial · racha 3)
  { key: 'cata-colores', nick: 'CataEstrella', text: 'se ganó la «Medalla de Colores» en Inglés inicial 🎨', type: 'badge' },
  { key: 'cata-numbers', nick: 'CataEstrella', text: 'terminó la unidad «Numbers» de Inglés inicial: one, two, three! 🔢', type: 'unit' },
  { key: 'cata-racha', nick: 'CataEstrella', text: 'arrancó una racha: 3 días seguidos practicando ✨', type: 'streak' },
  { key: 'cata-artist', nick: 'CataEstrella', text: 'se ganó la insignia «Little Artist» en Inglés inicial 🖍️', type: 'badge' },
  { key: 'cata-animals', nick: 'CataEstrella', text: 'terminó la unidad «Animals» de Inglés inicial 🐶', type: 'unit' },
  { key: 'cata-pasos', nick: 'CataEstrella', text: 'completó 12 pasos esta semana 🌟', type: 'streak' },
  // f5 · JuanchiRayo (Fracciones · racha 2)
  { key: 'juanchi-equiv', nick: 'JuanchiRayo', text: 'terminó la unidad «Fracciones equivalentes» ⚡', type: 'unit' },
  { key: 'juanchi-racha', nick: 'JuanchiRayo', text: 'ya lleva 2 días seguidos practicando 💪', type: 'streak' },
  { key: 'juanchi-rayo', nick: 'JuanchiRayo', text: 'se ganó la insignia «Rayo de las Fracciones» en Fracciones ⚡', type: 'badge' },
  { key: 'juanchi-pasos', nick: 'JuanchiRayo', text: 'completó 10 pasos esta semana ⚽', type: 'streak' },
  // f6 · MartuLuna (Mi cuerpo, El sistema solar · racha 5)
  { key: 'martu-corazon', nick: 'MartuLuna', text: 'se ganó la «Medalla de Corazón» en Mi cuerpo ❤️', type: 'badge' },
  { key: 'martu-luna', nick: 'MartuLuna', text: 'terminó la unidad «La Luna» de El sistema solar 🌙', type: 'unit' },
  { key: 'martu-racha', nick: 'MartuLuna', text: 'llegó a 5 días seguidos practicando 🔥', type: 'streak' },
  { key: 'martu-huesos', nick: 'MartuLuna', text: 'terminó la unidad «Los huesos» de Mi cuerpo 🦴', type: 'unit' },
  { key: 'martu-estetoscopio', nick: 'MartuLuna', text: 'se ganó la insignia «Estetoscopio de Oro» en Mi cuerpo 🩺', type: 'badge' },
  { key: 'martu-pasos', nick: 'MartuLuna', text: 'completó 18 pasos esta semana 💪', type: 'streak' },
  // f7 · NicoRobot (Fracciones, El sistema solar · racha 4)
  { key: 'nico-decimales', nick: 'NicoRobot', text: 'se ganó el «Sello de decimales» en Fracciones 🤖', type: 'badge' },
  { key: 'nico-espacio', nick: 'NicoRobot', text: 'terminó la unidad «Explorar el espacio» de El sistema solar 🛰️', type: 'unit' },
  { key: 'nico-racha', nick: 'NicoRobot', text: 'llegó a 4 días seguidos practicando 🤖', type: 'streak' },
  { key: 'nico-recta', nick: 'NicoRobot', text: 'terminó la unidad «Fracciones en la recta» de Fracciones 📏', type: 'unit' },
  { key: 'nico-rover', nick: 'NicoRobot', text: 'se ganó la insignia «Rover Explorador» en El sistema solar 🛰️', type: 'badge' },
  // f12 · LeaTelescopio (El sistema solar · racha 7) — amiga de Luna
  { key: 'lea-saturno', nick: 'LeaTelescopio', text: 'se ganó la insignia «Cazadora de Planetas» en El sistema solar 🪐', type: 'badge' },
  { key: 'lea-racha', nick: 'LeaTelescopio', text: 'practicó con su telescopio y no cortó su racha 🔭', type: 'streak' },
  { key: 'lea-constelaciones', nick: 'LeaTelescopio', text: 'terminó la unidad «Las constelaciones» de El sistema solar ✨', type: 'unit' },
  { key: 'lea-pasos', nick: 'LeaTelescopio', text: 'completó 22 pasos esta semana 💫', type: 'streak' },
  // f8 · TriniPiano (Inglés inicial · racha 6) — amiga de Luna
  { key: 'trini-oido', nick: 'TriniPiano', text: 'se ganó la insignia «Clave de Sol» en Inglés inicial 🎼', type: 'badge' },
  { key: 'trini-pasos', nick: 'TriniPiano', text: 'completó 20 pasos esta semana 💪', type: 'streak' },
  { key: 'trini-songs', nick: 'TriniPiano', text: 'terminó la unidad «Songs» de Inglés inicial 🎹', type: 'unit' },
  { key: 'trini-racha', nick: 'TriniPiano', text: 'llegó a 6 días seguidos practicando 🎶', type: 'streak' },
  // f9 · FedeAjedrez (Fracciones · racha 9) — le pide contacto a Luna
  { key: 'fede-jaque', nick: 'FedeAjedrez', text: 'se ganó la insignia «Jaque a las Fracciones» en Fracciones ♟️', type: 'badge' },
  { key: 'fede-racha', nick: 'FedeAjedrez', text: 'llegó a 9 días seguidos practicando ♟️', type: 'streak' },
  { key: 'fede-mixtos', nick: 'FedeAjedrez', text: 'terminó la unidad «Números mixtos» de Fracciones 🧩', type: 'unit' },
  // f10, f11, f13, f14 · el pool de Buscar → Personas (salen si se hacen amigos)
  { key: 'mica-tortuga', nick: 'MicaPincel', text: 'se ganó la insignia «Tortuga Dibujante» en Animales del océano 🐢', type: 'badge' },
  { key: 'mica-arrecife', nick: 'MicaPincel', text: 'terminó la unidad «Arrecifes de coral» de Animales del océano 🐠', type: 'unit' },
  { key: 'mica-racha', nick: 'MicaPincel', text: 'llegó a 4 días seguidos practicando 🎨', type: 'streak' },
  { key: 'gero-plumas', nick: 'GeroColibrí', text: 'terminó la unidad «Dinosaurios con plumas» de Dinosaurios 🐦', type: 'unit' },
  { key: 'gero-racha', nick: 'GeroColibrí', text: 'llegó a 11 días seguidos practicando 🔥', type: 'streak' },
  { key: 'gero-nido', nick: 'GeroColibrí', text: 'se ganó la insignia «Nido de Colibrí» en Dinosaurios 🐣', type: 'badge' },
  { key: 'nahue-golazo', nick: 'NahueGol', text: 'se ganó la insignia «Golazo Matemático» en Fracciones ⚽', type: 'badge' },
  { key: 'nahue-sports', nick: 'NahueGol', text: 'terminó la unidad «Sports» de Inglés inicial ⚽', type: 'unit' },
  { key: 'nahue-racha', nick: 'NahueGol', text: 'llegó a 3 días seguidos practicando 💪', type: 'streak' },
  { key: 'coni-cocina', nick: 'ConiCiencia', text: 'se ganó la insignia «Científica de Cocina» en Mi cuerpo 🧪', type: 'badge' },
  { key: 'coni-pulmones', nick: 'ConiCiencia', text: 'terminó la unidad «Los pulmones» de Mi cuerpo 🌬️', type: 'unit' },
  { key: 'coni-racha', nick: 'ConiCiencia', text: 'llegó a 5 días seguidos practicando 🧪', type: 'streak' },
]
/** Quién comparte rutas en la ráfaga: cualquier NPC que el activo vea (feedFake filtra con su grafo), en este orden. */
export const SHARERS: readonly string[] = [
  'TomiCohete', 'LuliVolcan', 'CataEstrella', 'MartuLuna', 'JuanchiRayo', 'LeaTelescopio', 'TriniPiano', 'MateoDino', 'NicoRobot',
  'FedeAjedrez', 'MicaPincel', 'GeroColibrí', 'NahueGol', 'ConiCiencia',
]
