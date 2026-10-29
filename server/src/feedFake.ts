// ============================== SERVER FAKE DEL FEED (modelo v6: "un hilo, muchos estilos") ==============================
// El backend real del feed (algoritmo de recomendación del padre + intereses del chico, eventos sociales reales)
// TODAVÍA NO EXISTE — ver docs/VISION.md §3 "Feed". Este módulo lo simula para que la UI quede como esqueleto definitivo,
// con las formas del contrato Feed v6 (src/api/types.ts; mock fuente: smarty-poc/docs/feed-mocks/v6-hilo-unico.html):
//   - UNA EDICIÓN FINITA. La MEZCLA es del server (plantilla editorial por franja del día, no un sort). Primera página:
//       [ 'next' (el hero: SIEMPRE la siguiente mejor acción de APRENDIZAJE —jamás comercio—, del progreso real),
//         lo que entró en vivo (noticias frescas, lo más nuevo primero),
//         tu medalla MÁS RECIENTE (la sembrada: tanda "Cards del feed", 29-oct — seedMedal, abajo),
//         la edición sembrada: noticia de amigos → 1-2 "para vos" (lectura/ruta) → la grilla 'videos' → más social →
//         el 'summary' (que CONFIESA la mezcla y cómo cambia con la hora) → el resto ].
//     Las páginas siguientes siguen la edición, más vieja, sin hero ni resumen; la última trae next=null ("Estás al día").
//     MEZCLA DIVERSA (tanda "Feed diverso", 28-oct; reglas puras en feedMix.ts): la cabeza de la edición sigue la plantilla
//     de la franja y el resto se reparte balanceado (ninguna página de un solo tipo; antes la cola eran 5-6 videos
//     seguidos), lo del cierre de liga entra espaciado, las lecturas cubren todos los intereses del chico (intercaladas
//     por tema) y lo social trae rachas, insignias, unidades completadas y rutas compartidas.
//     El cursor es la posición en la edición sembrada: lo que entra en vivo va siempre arriba de la primera página, así
//     una ráfaga nueva no corre las páginas que el chico ya pidió.
//   - FRANJA DEL DÍA (hora REAL del server, 6/13/20 h, en la ZONA HORARIA DE LA FAMILIA si el padre eligió una —parent.ts
//     familyTz, deuda 14-oct—; el subtítulo del Feed usa los mismos cortes): mañana = más para
//     aprender (lecturas y rutas primero) · tarde = más para explorar (videos antes) · noche = más tranquila (videos de
//     hasta 6 min y el hero como repaso sin apuro). El resumen lo dice así y avisa qué viene después: es verdad.
//   - Cada ítem trae su "por qué" (`reason`) en lenguaje de chico, en el eje de SU interés ("Porque te gustan los
//     dinosaurios", "TomiCohete es tu amigo", "Tu liga").
//   - Los VIDEOS salen del catálogo aprobado real (se pueden abrir y reproducir); las LECTURAS son URLs reales de sitios de
//     la lista blanca (pasan por el lector moderado). La grilla 'videos' son hasta 3 del tema + el total de ese tema (su
//     "Ver todos" lleva a Buscar). TODO lo que lleva un "por qué" temático (los videos sueltos, la grilla y su total) sale
//     de la vía ESTRICTA del buscador (videos.ts: searchVideosStrict, fix "fuzzy del Feed" 28-oct): el fuzzy 0.2 del POC
//     traía "gallinas" bajo "Porque a tu familia le interesa: ballenas" y "Fiji" bajo la ruta "niji". Si un tema rinde
//     poco, sale menos (o la grilla pasa al siguiente tema con SU motivo): honestidad antes que relleno.
//     DESVÍO DELIBERADO (tanda v6): los temas de chico del armado ya NO
//     incluyen los temas blancos de fábrica de config.json — esos son lo que el CHAT puede tratar si el chico pregunta
//     (hoy, educación sexual: "feto", "óvulos"…), no intereses para empujarle en la home sin un "por qué" honesto.
//   - Los eventos de AMIGOS salen de friendsFake (friendNews): los NPCs del demo son UNA sola lista en todo el sistema
//     (mismos nicks y colores, y cada NPC "sabe" lo que publicó). Cada usuario ve las de SUS amigos y de quien le pidió
//     contacto (isVisibleNpc: el grafo del activo, U4). Las reacciones son datos de demo en memoria. Las medallas
//     y ascensos (y la tarjeta de la liga de la semana) se fechan en el último cierre de liga (lastCloseLabel) y entran en
//     la edición donde les toca por antigüedad: se reparten el domingo, no a cualquier hora. Tanda "Ráfaga variada"
//     (29-oct, pedido del dueño: «En el inicial también tiene que tener alguno que otro de liga cerrada de un amigo»): la
//     PRIMERA página trae 1-2 de esas noticias de amigos aunque la antigüedad las mande más abajo (leadLeague: se ADELANTA
//     su lugar, la fecha sigue siendo la del cierre).
//   - La noticia de MI LIGA cuenta el ciclo semanal: cómo me fue en el cierre pasado (lastWeek/lastClose de leaguesFake)
//     + dónde compito esta semana. Se arma al servir, no se duplica.
//   - La CONFIG DEL PADRE se aplica acá EN SERIO: lo que pega con un tema NEGRO o trae una palabra de la familia no se
//     sirve; los temas BLANCOS de la familia son "sus sugerencias" (guían, no dirigen: 1 de cada 3 videos, "Porque a tu
//     familia le interesa: …"); con Amigos apagado no hay nada social y con Ligas apagado nada de ligas (ni en vivo); con
//     la Tienda apagada no se nombra la moneda. El dial de animación del Feed (parent.feedMotion) viaja en cada respuesta.
//     U3 (docs/USUARIOS.md §9): la config que rige es la DEL CHICO ACTIVO (la "política vigente" de parent.ts, por el
//     contexto del pedido: requestContext.ts) — temas, palabras, on-off (featureOnNow) y dial. Con un ADULTO activo,
//     solo la protección de fábrica y todo prendido (D1). Los pools se arman y se guardan POR POLÍTICA (hasta 4), así
//     alternar entre hermanos no rearma la edición cada vez. El pool NO guarda nada del grafo social (guarda TODAS las
//     noticias de los NPCs que la política deja pasar): lo social se filtra al servir por el grafo del activo, así dos
//     hermanos con la misma config comparten pool.
//   - POR USUARIO desde U4 (docs/USUARIOS.md §10): lo que entró en vivo (cierres de liga, ráfagas de NPCs), las
//     reacciones, "ver menos" y el contador de ráfagas viven en un slice de perUser() por usuario (el del pedido): la
//     ráfaga o el cierre de liga de Luna nunca aparecen en el feed de Ian. El hero y las rutas salen de los resultados de
//     Learn DEL ACTIVO (learnResults.resultRows) y la tarjeta de la liga, de SU ciclo (leaguesFake).
//   - DEMO VIVO (RAM, docs/AGENTS.md regla 9): lo que entra en vivo pasa por los MISMOS filtros vivos al servirse:
//       · injectLeagueClose(): las noticias del cierre simulado de liga (lo orquesta leaguesFake.closeWeek).
//       · simulateNpcs() (botón "Simular NPCs" del Feed): una ráfaga de 5 noticias frescas de composición SORTEADA (tanda
//         "Ráfaga variada", 29-oct; antes —"Feed diverso", 28-oct— era una de cada tipo, siempre igual): entre racha,
//         insignia, unidad completada, ruta compartida del catálogo real, medalla de liga de un amigo y la carrera de tu liga
//         con XP real, como mucho 2 del mismo tipo y nunca la misma composición dos veces seguidas (las reglas en
//         feedMix.composeBurst/planBurst). El cliente NO las mete solo: muestra la píldora "N novedades ↑" y las trae cuando
//         el chico la toca. Con Amigos apagado del chico el endpoint responde 403.
//       · feedLess(): "Ver menos de esto" — los ids ocultos se filtran de TODAS las respuestas siguientes (reversible).
//     Después de un cierre, lo de semanas anteriores se fecha por semanas. resetFeed(userId?) vuelve al seed lo de ese
//     usuario (sin id, lo de todos; va en /api/demo/reset).
//   - RUTAS (tanda W3 del porte Smarty): el hero, las cards 'route' y las rutas que comparten los NPCs salen del CATÁLOGO
//     REAL de Learn (learnRoutes.ts) y su avance de los resultados persistidos (learnResults.ts, derivado con la misma
//     regla que el camino: learnProgress.ts). Los 5 cursos fijos de Aprender/Practicar se retiraron. Todo lleva a
//     /aprender?ruta=<id> (abre la ruta directo; la vista limpia el parámetro).
// Para conectar el backend real: reemplazar getFeed()/reactFeed()/feedLess() manteniendo las formas.
import { friendCount, friendNews, isVisibleNpc, npcInfo, npcRelation } from './friendsFake'
import {
  cycleWeek, hashOf, lastClose, lastCloseLabel, MEDAL_EMOJI, myLeague, npcPractice, rng, shuffle, sinceLabel, weeksAgoLabel,
  type CloseNews, type Medal, type NpcRace,
} from './leaguesFake'
import { matchBlockedWord } from './filters'
import { familyBlockedTerms, familyTopics, familyTz, featureOnNow, feedMotion, topicHit, type FeedMotion } from './parent'
import { wallClock } from '../../src/shared/lib/zonedClock'
import { LEARN_EC, resultRows } from './learnResults'
// FS-BASE-A: el Feed sirve las rutas como las ve el usuario del pedido (servedRoutes: lo que importó un hermano pasa la
// moderación y su portada subida no se sirve; learnRoutes.ts), no el catálogo crudo.
import { servedRoutes, type CatalogRoute } from './learnRoutes'
import { routeInProgress, routeRuns, type RouteRun } from './learnProgress'
import { MEDALS, type EarnedMedal } from './medalRules'
import { medalsOf, registerMedalNews } from './medals'
import { familyCatalogVersion, searchVideosStrict, toVideoResult, type CatalogVideo } from './videos'
import { perUser } from './perUser'
import { currentUser } from './requestContext'
import {
  BURST_MAX_PER_TYPE, EDITIONS, NPC_MEDALS, NPC_NEWS, SHARERS, composeBurst, interleave, newBurstMemory, roundRobinBy, spaceOut,
  type BurstCand, type BurstMemory, type Daypart, type Slot,
} from './feedMix'

type VideoCard = ReturnType<typeof toVideoResult>
export interface FeedReaction { emoji: string; count: number; mine: boolean }
/** 'unit' = unidad completada (tanda "Feed diverso", 28-oct; antes iba como 'badge'). */
type NewsIcon = 'medal' | 'streak' | 'badge' | 'unit' | 'route' | 'league'
/** La ruta como la dibuja la card (forma `course` del contrato): `units` = sus postas (sin contar los repasos), `img` = la
 *  portada ('' si no hay: la card cae al emoji). `emoji` = ADITIVO de W3 (pendiente de formalizar en src/api/types.ts por
 *  el coordinador): el ícono de la ruta, para la card sin portada. `done` = ADITIVO (tanda "Cards del feed", 29-oct; ya en
 *  src/api/types.ts): las postas que el usuario del pedido ya hizo (la misma regla del camino que el hero), para que la card
 *  pinte su avance; el server lo manda siempre. */
type RouteCourse = { id: string; name: string; units: number; done?: number; img: string; bg: [string, string]; emoji?: string }
export type FeedItem =
  | { kind: 'video'; id: string; time: string; reason: string; video: VideoCard }
  | { kind: 'article'; id: string; time: string; reason: string; title: string; url: string; source: string; snippet?: string }
  | { kind: 'route'; id: string; time: string; reason: string; course: RouteCourse }
  | { kind: 'friend'; id: string; time: string; reason?: string; friend: { nick: string; color: string }; text: string; icon: NewsIcon; reactions: FeedReaction[] }
  | { kind: 'league'; id: string; time: string; reason?: string; name: string; desc: string }
  /** "Fijado · tu siguiente paso": el hero de la edición (aprendizaje, jamás comercio). */
  | { kind: 'next'; id: string; time: string; reason: string; title: string; meta: string; action: { label: string; to: string } }
  /** Grilla de videos inline. `topic` = ADITIVO (pendiente de formalizar en src/api/types.ts por el coordinador): el
   *  tema de la grilla, para que "Ver todos" lleve a /buscar?tab=videos&q=<topic>. */
  | { kind: 'videos'; id: string; time: string; reason: string; title: string; total: number; videos: VideoCard[]; topic?: string }
  /** Resumen de la edición: la mezcla CONTADA de lo servido y cómo cambia con la hora. */
  | { kind: 'summary'; id: string; title: string; desc: string; mix: { label: string; n: number }[]; later: string }
  /** U5-B: "Ganaste la medalla «…»" — una noticia PROPIA por cada medalla nueva (injectMedalNews), sin reacciones ni
   *  festejos de NPCs (no es la medalla de liga "que ven tus amigos"). Un cliente sin este kind no pinta nada. */
  | { kind: 'medal'; id: string; time: string; reason: string; medal: EarnedMedal }
type Of<K extends FeedItem['kind']> = Extract<FeedItem, { kind: K }>
export interface FeedResponse { items: FeedItem[]; next: string | null; motion: FeedMotion }
/** El mismo ítem con otro "hace cuánto" (el resumen no tiene). */
const withTime = (it: FeedItem, time: string): FeedItem => (it.kind === 'summary' ? it : { ...it, time })

/* ---------- lo vivo del demo, POR USUARIO (RAM, U4) ---------- */
/** Una noticia que entró en vivo: en qué semana del ciclo y cuándo (para fecharla al servir). */
interface Fresh { item: FeedItem; week: number; at: number }
interface Live {
  /** Del más nuevo al más viejo: va ARRIBA de la primera página (debajo del hero). */
  fresh: Fresh[]
  freshSeq: number
  bursts: number
  /** Lo social de las ráfagas (feedMix.planBurst): lo ya publicado no se repite hasta agotar SU tipo (y nunca lo de la
   *  ráfaga anterior); protagonistas y rutas de la anterior, para variar. */
  burst: BurstMemory
  /** Quién corrió la carrera de la liga en la ráfaga anterior (en la siguiente, otro). */
  lastRace: string[]
  /** Reacciones por ítem de amigo (las de los demás + la del usuario: mine). */
  reactions: Map<string, FeedReaction[]>
  /** Ids que el usuario pidió ver menos: no salen en NINGUNA respuesta siguiente hasta que lo deshaga (o se resetee). */
  hidden: Set<string>
}
const lives = perUser((): Live => ({ fresh: [], freshSeq: 0, bursts: 0, burst: newBurstMemory(), lastRace: [], reactions: new Map(), hidden: new Set() }))
/** Lo vivo del usuario del pedido (fuera de un pedido, ian). */
const live = () => lives.now()

/* ---------- reacciones (en memoria; por ítem de amigo y por usuario) ---------- */
const EMOJIS = ['👏', '🎉', '💪', '🤩']
function reactionsOf(id: string): FeedReaction[] {
  const { reactions } = live()
  if (!reactions.has(id)) {
    const h = [...id].reduce((a, c) => a + c.charCodeAt(0), 0)
    reactions.set(id, EMOJIS.map((emoji, i) => ({ emoji, count: [h % 4 + 1, h % 3, (h >> 2) % 2, 0][i], mine: false })))
  }
  return reactions.get(id)!
}
export function reactFeed(id: string, emoji: string): { id: string; reactions: FeedReaction[] } {
  const arr = reactionsOf(id)
  const r = arr.find(x => x.emoji === emoji)
  if (r) { r.mine = !r.mine; r.count = Math.max(0, r.count + (r.mine ? 1 : -1)) }
  return { id, reactions: arr.map(x => ({ ...x })) }
}

/* ---------- "Ver menos de esto" (v6; RAM del demo) ---------- */
/** Tope de ids ocultos por usuario (los ids viven en Live.hidden). */
const MAX_HIDDEN = 500
/** Forma de los ids del feed (fv-<videoId>, fa-3, ff-2, fx-12, fl-cometa…): lo demás no se guarda. */
const FEED_ID = /^[\w.:-]{1,80}$/
/** POST /api/feed/less {id, undo} → {ok}. FAKE: el algoritmo real aprendería "menos de esto"; acá se oculta ese ítem.
 *  PENDIENTE (coordinador): enrutarlo en server/src/index.ts (este módulo no tiene router propio). */
export function feedLess(id: string, undo = false): { ok: boolean } {
  if (!FEED_ID.test(id)) return { ok: false }
  const { hidden } = live()
  if (undo) hidden.delete(id)
  else if (hidden.size < MAX_HIDDEN) hidden.add(id)
  console.log(`[feed] ver menos${undo ? ' (deshecho)' : ''} de ${lives.nowId()}: ${id}`)
  return { ok: true }
}

/* ---------- "por qué": en el eje del interés del chico (mock v6) ---------- */
/** Los temas de chico con los que se arma la edición (las sugerencias de la familia van aparte). Ver el DESVÍO de la
 *  cabecera: no salen de los temas blancos de fábrica del chat. */
const INTERESTS = ['el sistema solar', 'dinosaurios', 'volcanes', 'tiburones', 'inventos', 'robots', 'la luna', 'experimentos para niños', 'fracciones']
const TOPIC_WHY: Record<string, string> = {
  'el sistema solar': 'Porque te interesa el espacio',
  'el espacio': 'Porque te interesa el espacio',
  'la luna': 'Porque te interesa el espacio',
  dinosaurios: 'Porque te gustan los dinosaurios',
  volcanes: 'Porque te copan los volcanes',
  tiburones: 'Porque te gustan los animales del mar',
  inventos: 'Porque te gusta saber cómo se inventan las cosas',
  robots: 'Porque te gustan los robots',
  'experimentos para niños': 'Porque te gusta experimentar',
  fracciones: 'Para jugar con fracciones mirando',
}
const kidWhy = (topic: string) => TOPIC_WHY[topic] ?? `Porque te interesa: ${topic}`
/** El motivo de una sugerencia de la familia (tema blanco de la Zona de padres). */
const familyReason = (t: string) => `Porque a tu familia le interesa: ${t}`
/** Por qué aparece lo de un NPC, según lo que es EN EL GRAFO DEL ACTIVO (FS-BASE-B, hallazgo feedFake.ts:194: antes era por
 *  nick y a Luna le decía «FedeAjedrez es tu amigo» cuando él solo le había mandado una solicitud): amigo → "<nick> es tu
 *  amiga/amigo"; solicitud pendiente → "<nick> quiere ser tu amiga/amigo" (el género sale de friendsFake.npcInfo: una sola
 *  lista de NPCs en el sistema). NicoRobot conserva SIEMPRE su caso especial (el de la solicitud de amistad de Ian: hace
 *  Fracciones como Ian, sea o no su amigo todavía). Lo que se sirve ya pasó por isVisibleNpc (amigo o te pidió contacto). */
const npcWhy = (nick: string) => {
  if (nick === 'NicoRobot') return 'NicoRobot hace Fracciones como vos'
  const n = npcInfo(nick)
  if (!n) return 'Es de tus amigos'
  const who = n.girl ? 'amiga' : 'amigo'
  return npcRelation(n.id) === 'request' ? `${nick} quiere ser tu ${who}` : `${nick} es tu ${who}`
}

/* ---------- pools de demo ---------- */
// Noticias de amigos: NO viven acá — las publica cada NPC en friendsFake (friendNews(), en el orden de intercalado).
// Lecturas: URLs reales de la lista blanca (verificadas con el lector moderado). Tanda "Feed diverso" (28-oct): las 6 de
// antes eran todas del espacio; se suman 9 de los otros intereses del chico (AL FINAL: los ids fa-N son por lugar),
// verificadas ese día con GET /api/article (gate de sitio + juez; quedaron afuera las que el juez bloqueó y una de NASA que
// se extrae en inglés). En la edición se intercalan por tema (roundRobinBy). `why` = el motivo propio cuando el del tema
// (TOPIC_WHY, pensado para videos) no le queda a una lectura.
const ARTICLES: { title: string; url: string; source: string; snippet: string; topic: string; why?: string }[] = [
  { title: 'Apolo 11: el viaje a la Luna', url: 'https://es.wikipedia.org/wiki/Apolo_11', source: 'es.wikipedia.org', snippet: 'La misión que llevó a los primeros seres humanos a pisar la Luna, en julio de 1969.', topic: 'el espacio' },
  { title: 'Cómo es nuestro sol con respecto a otras estrellas', url: 'https://spaceplace.nasa.gov/sun-compare/sp/', source: 'NASA Space Place', snippet: 'Nuestro sol es impresionante, pero ¿cómo se compara con las demás estrellas de la galaxia?', topic: 'el espacio' },
  { title: 'Estrellas fugaces', url: 'https://www.esa.int/kids/es/Aprende/Nuestro_Universo/Cometas_y_meteoritos/Estrellas_fugaces', source: 'ESA Kids', snippet: '¿Qué son en realidad las estrellas fugaces y por qué aparecen en lluvias?', topic: 'el espacio' },
  { title: 'El cinturón de asteroides', url: 'https://es.wikipedia.org/wiki/Cintur%C3%B3n_de_asteroides', source: 'es.wikipedia.org', snippet: 'Entre Marte y Júpiter hay millones de rocas girando alrededor del Sol.', topic: 'el espacio' },
  { title: '¿Qué es un cometa?', url: 'https://concepto.de/cometas/', source: 'concepto.de', snippet: 'Cuerpos celestes con núcleo de hielo y polvo que desarrollan una cola brillante.', topic: 'el espacio' },
  { title: 'La Vía Láctea', url: 'https://es.wikipedia.org/wiki/V%C3%ADa_L%C3%A1ctea', source: 'es.wikipedia.org', snippet: 'La galaxia espiral donde vive el sistema solar, con cientos de miles de millones de estrellas.', topic: 'el espacio' },
  { title: 'Tyrannosaurus rex, el rey de los dinosaurios', url: 'https://es.wikipedia.org/wiki/Tyrannosaurus_rex', source: 'es.wikipedia.org', snippet: 'Uno de los carnívoros más grandes que pisaron la Tierra: vivió al final del Cretácico.', topic: 'dinosaurios' },
  { title: '¿Qué es un volcán?', url: 'https://concepto.de/volcan/', source: 'concepto.de', snippet: 'Cómo se forman, qué tipos hay y por qué algunos están dormidos durante siglos.', topic: 'volcanes' },
  { title: 'El tiburón blanco', url: 'https://concepto.de/tiburon/', source: 'concepto.de', snippet: 'Dónde vive, qué come y cómo es uno de los grandes cazadores del océano.', topic: 'tiburones' },
  { title: 'Arduino: la placa para armar robots', url: 'https://es.wikipedia.org/wiki/Arduino', source: 'es.wikipedia.org', snippet: 'La placa electrónica con la que chicos y grandes arman robots, luces y sensores.', topic: 'robots' },
  { title: 'La imprenta', url: 'https://es.wikipedia.org/wiki/Imprenta', source: 'es.wikipedia.org', snippet: 'El invento que permitió copiar libros en cantidad y cambió cómo aprende el mundo.', topic: 'inventos' },
  { title: 'El método científico', url: 'https://concepto.de/metodo-cientifico/', source: 'concepto.de', snippet: 'Observar, preguntar, probar y sacar conclusiones: los pasos de todo buen experimento.', topic: 'experimentos para niños' },
  { title: 'Fracciones', url: 'https://www.disfrutalasmatematicas.com/fracciones.html', source: 'disfrutalasmatematicas.com', snippet: 'Qué son el numerador y el denominador, explicado con pizzas y dibujos.', topic: 'fracciones', why: 'Para jugar con fracciones leyendo' },
  { title: 'Triceratops', url: 'https://es.wikipedia.org/wiki/Triceratops', source: 'es.wikipedia.org', snippet: 'El dinosaurio de los tres cuernos y el gran escudo de hueso en la cabeza.', topic: 'dinosaurios' },
  { title: 'Las fases de la Luna', url: 'https://es.wikipedia.org/wiki/Fase_lunar', source: 'es.wikipedia.org', snippet: 'Por qué la Luna se ve llena, en cuarto o nueva a lo largo del mes.', topic: 'la luna' },
]
/* Rutas: el CATÁLOGO real de Learn (ver la cabecera). El catálogo no trae colores: el fondo de la card sale de un par fijo
   de la paleta de Innerith según el id (estable). */
const ROUTE_BG: [string, string][] = [
  ['#3A5BD9', '#1E2F7A'], ['#13A39A', '#0B6B66'], ['#F26B3A', '#B8431C'], ['#8A5CF5', '#5431B3'], ['#E5487A', '#9E2350'], ['#1C9BD6', '#0E5F8A'],
]
/** Portada de la card: la subida en /crear; si no, la miniatura del PRIMER contenido si es un video (mqdefault: la 16:9 que
 *  siempre existe — la regla del mosaico, firstContent del POC); si no, '' (la card cae al emoji). */
function routeImg(r: CatalogRoute): string {
  if (typeof r.cover === 'string' && r.cover) return r.cover
  const mods = Array.isArray(r.modules) ? (r.modules as { source?: { url?: string; kind?: string; videoId?: string } }[]) : []
  const m = mods[0]?.source
  const first = m && (m.url || m.videoId) ? m : (r.postas.find((p) => p.reading)?.reading as { kind?: string; videoId?: string } | undefined)
  return first?.kind === 'video' && first.videoId ? `https://i.ytimg.com/vi/${first.videoId}/mqdefault.jpg` : ''
}
/** Cada ruta del catálogo con su avance real (resultados persistidos), en el orden del catálogo. */
function catalogRuns(): { route: CatalogRoute; run: RouteRun }[] {
  const routes = servedRoutes()
  const runs = routeRuns(routes, resultRows())
  return routes.map((route, i) => ({ route, run: runs[i] }))
}
function routeCourse(route: CatalogRoute, run: RouteRun): RouteCourse {
  return { id: run.id, name: run.title, units: run.total, done: run.done, img: routeImg(route), bg: ROUTE_BG[hashOf(run.id) % ROUTE_BG.length], emoji: run.emoji || undefined }
}
/** El "por qué" de una ruta: en el eje del chico (lo que lleva hecho), salvo que pegue con un tema de la familia. */
function routeWhy(run: RouteRun): string {
  const w = topicHit(run.title, familyTopics().white)
  if (w) return familyReason(w)
  if (run.lastAt === 0 || run.done === 0) return 'Es una ruta para arrancar algo nuevo'
  if (run.done < run.total) { const left = run.total - run.done; return `La empezaste y te ${left === 1 ? 'queda' : 'quedan'} ${left} ${postasWord(left)}` }
  return 'Ya la terminaste: podés repasarla'
}
/** "1 posta" / "3 postas" (sin el número: postasWord). */
const postasWord = (n: number) => (n === 1 ? 'posta' : 'postas')
/** Lo que abre una ruta (Aprender la abre directo y limpia el parámetro). */
const routeLink = (id: string) => `/aprender?ruta=${encodeURIComponent(id)}`
const timeOf = (i: number) => (i < 2 ? 'hace 1 h' : i < 4 ? 'hace 3 h' : i < 8 ? 'hoy' : i < 13 ? 'ayer' : i < 19 ? 'hace 2 días' : 'esta semana')
/** La misma escala en horas (para ubicar lo que se repartió en el cierre de liga). */
const ageOf = (i: number) => (i < 2 ? 1 : i < 4 ? 3 : i < 8 ? 8 : i < 13 ? 30 : i < 19 ? 54 : 100)
/** "Videos cortitos" de la edición de la noche. */
const SHORT_SEC = 6 * 60
/** Las noticias de amigos que en realidad son de ligas (medallas, ascensos): se reparten en el cierre. */
const LEAGUEISH: ReadonlySet<NewsIcon> = new Set<NewsIcon>(['medal', 'league'])

/** La noticia de MI liga: el ciclo completo. Semana del seed, con medalla en el cierre pasado →
 *  "🥈 ¡La semana pasada saliste 2º en la Liga Cometa! Esta semana competís con otros 11 chicos de tu nivel. Cierra el domingo."
 *  Después de un cierre simulado cuenta ESE cierre (con su liga, que puede no ser la de ahora) y la semana nueva. */
function leagueNews(): { name: string; desc: string } {
  const l = myLeague(), lw = l.lastWeek, lc = lastClose()
  // El adulto compite con otros GRANDES (U4 D4: su liga pública es de NPCs adultos), nunca con chicos.
  const peers = currentUser()?.kind === 'adult' ? 'grandes' : 'chicos'
  const others = `competís con otros ${l.total - 1} ${peers} de tu nivel`
  const closes = l.closesInDays === 0 ? '¡Cierra hoy!' : `Cierra ${l.closes}.`
  if (lc) {
    const res = `${lc.pos}º en la ${lc.from}`
    if (lc.medal && lc.movement === 'sube') return { name: l.name, desc: `${MEDAL_EMOJI[lc.medal]} ¡Saliste ${res} y subiste a la ${l.name}! Esta semana ${others}. ${closes}` }
    if (lc.medal) return { name: l.name, desc: `${MEDAL_EMOJI[lc.medal]} ¡Saliste ${res}${lc.top ? ', la más alta de todas' : ''}! Seguís ahí: esta semana ${others}. ${closes}` }
    if (lc.movement === 'baja') return { name: l.name, desc: `Saliste ${res} y esta semana te toca la ${l.name}, con otros ${l.total - 1} ${peers} de tu nivel: ¡a sumar XP para volver a subir! ${closes}` }
    return { name: l.name, desc: `Saliste ${res} y seguís en esta liga. Esta semana ${others}: ¡vamos por el podio! ${closes}` }
  }
  if (lw?.medal) return { name: l.name, desc: `${MEDAL_EMOJI[lw.medal]} ¡La semana pasada saliste ${lw.pos}º en la ${l.name}! Esta semana ${others}. ${closes}` }
  if (lw) return { name: l.name, desc: `La semana pasada saliste ${lw.pos}º en la ${l.name}. Esta semana ${others}. ${closes}` }
  return { name: l.name, desc: `Por tus resultados, esta semana ${others}. ${closes}` }
}
const LEAGUE_WHY = 'Te la asignaron por tus resultados'

/* ---------- armado de los pools (uno por POLÍTICA: los temas y palabras que rigen para el usuario del pedido) ---------- */
interface PoolVideo { video: VideoCard; reason: string }
interface Pool {
  /** Videos del día (1-25 min) y los de la noche (hasta 6 min), cada uno con su "por qué". */
  vids: PoolVideo[]; short: PoolVideo[]
  arts: { n: number; title: string; url: string; source: string; snippet: string; reason: string }[]
  /** TODAS las noticias de los NPCs que la política deja pasar (con su id de NPC): lo del grafo se filtra al servir. */
  news: { n: number; fid: string; friend: { nick: string; color: string }; text: string; icon: NewsIcon }[]
}
/** Pools por política (U3): la clave son los temas y palabras que rigen; tope MAX_POOLS (al pasarse, se va el que hace más
 *  que no se usa). Ian y el adulto sin filtros de la familia comparten el mismo. FS-BASE-B (hallazgo feedFake.ts:302): la
 *  clave lleva también la VERSIÓN del catálogo aprobado (videos.ts familyCatalogVersion): cuando el padre quita (o suma, o
 *  reingesta) algo en Familia → MyTube, el próximo GET /api/feed rearma el pool y la grilla (shelfOf usa esta misma clave)
 *  —antes seguían cacheados y el chico veía la card de un video que ya no estaba aprobado (y tocarla daba 404)—. */
const pools = new Map<string, Pool>()
const MAX_POOLS = 4
const poolKey = () => JSON.stringify([familyTopics(), familyBlockedTerms(), familyCatalogVersion()])
/** Lo que la familia no quiere ver: pega con uno de sus temas NEGROS o trae una de sus palabras (fail-closed). */
function familyFilter(): (text: string) => boolean {
  const fam = familyTopics(), famTerms = familyBlockedTerms()
  return (text: string) => topicHit(text, fam.black) !== null || matchBlockedWord(text, famTerms) !== null
}
const videoText = (v: CatalogVideo) => `${v.title} ${v.channelTitle} ${v.tags.join(' ')} ${v.description.slice(0, 300)}`
function build(): Pool {
  const fam = familyTopics()
  const key = poolKey()
  const hit = pools.get(key)
  if (hit) { pools.delete(key); pools.set(key, hit); return hit } // el más usado queda al final
  // Temas de la familia: lo que pega con uno NEGRO (o trae una palabra bloqueada de la familia) no se sirve (título,
  // canal, tags y descripción: fail-closed); lo que pega con uno BLANCO en su TÍTULO lleva el motivo de la familia (solo
  // coincidencias fuertes: si no, media edición diría "Porque a tu familia…" y dejaría de guiar para dirigir).
  const blocked = familyFilter()
  const why = (title: string, base: string) => { const w = topicHit(title, fam.white); return w ? familyReason(w) : base }
  const famQs = fam.white.filter(q => !blocked(q))
  const qs = INTERESTS.filter(q => !blocked(q))
  const pickVids = (maxSec: number): PoolVideo[] => {
    const seen = new Set<string>()
    const lim = maxSec < 1500 ? 30 : 8 // los cortitos son menos: se mira más hondo en cada tema
    // Vía ESTRICTA (videos.ts): cada video sale con un "por qué" temático (el de la familia o el del chico), así que solo
    // entra lo que tiene de verdad las palabras del tema; si un tema rinde menos, entran menos (NUNCA se completa con fuzzy).
    const pick = (q: string) => searchVideosStrict(q, lim).find(h => !seen.has(h.videoId) && h.duration >= 60 && h.duration <= maxSec && !blocked(videoText(h)))
    // Sugerencias de la familia (temas blancos de la Zona de padres): hasta 2 videos por tema y 5 en total.
    const famMax = Math.min(5, famQs.length * 2)
    const famVids: PoolVideo[] = []
    for (let round = 0; round < 2 && famVids.length < famMax; round++) {
      for (const q of famQs) {
        if (famVids.length >= famMax) break
        const hit = pick(q)
        if (!hit) continue
        seen.add(hit.videoId)
        famVids.push({ video: toVideoResult(hit), reason: familyReason(q) })
      }
    }
    // Los temas de chico, de a uno por tema por ronda (si no, un tema domina toda la edición).
    const base: PoolVideo[] = []
    for (let round = 0; round < 2 && base.length + famVids.length < 14; round++) {
      for (const q of qs) {
        if (base.length + famVids.length >= 14) break
        const hit = pick(q)
        if (!hit) continue
        seen.add(hit.videoId)
        base.push({ video: toVideoResult(hit), reason: why(hit.title, kidWhy(q)) })
      }
    }
    // Las sugerencias de la familia GUÍAN sin dirigir: uno de cada tres videos, empezando por el primero.
    const out: PoolVideo[] = []
    while (famVids.length || base.length) {
      const next = (out.length % 3 === 0 ? famVids.shift() : base.shift()) ?? famVids.shift() ?? base.shift()
      if (next) out.push(next)
    }
    return out
  }
  // Lecturas y noticias sin lo que pega con un tema negro (las rutas se arman al servir: catálogo + avance reales). Los ids
  // conservan el lugar en su pool (las reacciones de las noticias van por id: no se corren cuando se filtra una).
  // Las lecturas, intercaladas por tema (feedMix.roundRobinBy): no salen todas las del espacio juntas.
  const arts = roundRobinBy(ARTICLES.map((a, n) => ({ a, n: n + 1 })).filter(({ a }) => !blocked(`${a.title} ${a.snippet} ${a.topic}`)), ({ a }) => a.topic)
    .map(({ a, n }) => ({ n, title: a.title, url: a.url, source: a.source, snippet: a.snippet, reason: why(a.title, a.why ?? kidWhy(a.topic)) }))
  const news = friendNews().map((e, i) => ({ ...e, n: i + 1 })).filter(e => !blocked(e.text))
  const pool: Pool = { vids: pickVids(1500), short: pickVids(SHORT_SEC), arts, news }
  pools.set(key, pool)
  while (pools.size > MAX_POOLS) { const oldest = pools.keys().next().value; if (oldest === undefined) break; pools.delete(oldest) }
  return pool
}

/* ---------- la edición: franja del día + plantilla editorial (las reglas puras de la mezcla viven en feedMix.ts) ---------- */
/** Franja por la hora REAL del server (mismos cortes que el subtítulo del Feed en el cliente: 6, 13 y 20 h), leída en la ZONA
 *  HORARIA DE LA FAMILIA si el padre eligió una (deuda 14-oct; sin zona, la del server). */
const daypartOf = (d: Date): Daypart => { const h = wallClock(d, familyTz()).hour; return h >= 6 && h < 13 ? 'manana' : h >= 13 && h < 20 ? 'tarde' : 'noche' }
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
/** La madrugada (0-5 h) todavía es la noche del día anterior. En la zona de la familia, como la franja. */
const dayName = (d: Date) => { const c = wallClock(d, familyTz()); return DAYS[(c.day + (c.hour < 6 ? 6 : 0)) % 7] }
const DP_NAME: Record<Daypart, string> = { manana: 'mañana', tarde: 'tarde', noche: 'noche' }
/** Lo que el resumen confiesa de la mezcla (y es verdad: lo hace la plantilla de abajo). */
const DESC: Record<Daypart, string> = {
  manana: 'Armé la edición con más para aprender: lecturas y rutas primero — cambia según la hora del día.',
  tarde: 'Armé la edición con más para explorar y menos repaso — cambia según la hora del día.',
  noche: 'Armé una edición más tranquila: un repaso sin apuro y videos cortitos — cambia según la hora del día.',
}
/** Cómo cambia en la franja que viene. */
const LATER: Record<Daypart, string> = {
  manana: 'a la tarde cambia a más para explorar',
  tarde: 'a la nochecita cambia a repaso tranquilo',
  noche: 'mañana arranca con más para aprender',
}
/* FS-BASE-B (hallazgo feedFake.ts:382): el "repaso sin apuro" de la noche solo existe si hay una ruta EN CURSO (nextStep: sin
   ella el hero de la noche es "Empezá …" o "Elegí qué aprender hoy"). Sin ruta en curso, el resumen de la noche no lo promete
   y el de la tarde no anuncia un repaso que no va a venir: el resumen "confiesa la mezcla y es verdad". */
const DESC_NOCHE_SIN_REPASO = 'Armé una edición más tranquila, con videos cortitos — cambia según la hora del día.'
const LATER_TARDE_SIN_REPASO = 'a la nochecita cambia a algo más tranquilo'
/** Horas desde el cierre de liga del seed (lunes 00:00 de esta semana), en la ZONA HORARIA DE LA FAMILIA como la franja
 *  (sin zona, la del server). Horas "de pared" desde el lunes: en la semana del cambio de horario puede correrse una
 *  hora, y da igual (ubica en la escala de ageOf, que va de 1 a 100 h). */
function closeAgeHours(now = new Date()): number {
  const c = wallClock(now, familyTz())
  return ((c.day + 6) % 7) * 24 + c.minutes / 60 + now.getSeconds() / 3600
}

/** La edición SEMBRADA (sin lo que entró en vivo), en orden: estable mientras no cambien la familia, los on-off ni la
 *  franja. Las páginas se cortan por POSICIÓN acá; lo oculto con "ver menos" (y la tarjeta de liga vieja tras un cierre)
 *  se saca DESPUÉS de cortar, así ocultar algo no corre las páginas. Los tiempos van por lugar ("hace 1 h"… "esta
 *  semana"); lo que se repartió en el cierre de liga va fechado ahí y entra donde le toca por antigüedad, ESPACIADO.
 *  Tanda "Feed diverso" (28-oct): la cabeza sigue la plantilla de la franja y el resto se reparte balanceado
 *  (feedMix.interleave: ninguna página de un solo tipo). */
function seedStream(dp: Daypart): FeedItem[] {
  const p = build()
  const amigos = featureOnNow('amigos'), ligas = featureOnNow('ligas')
  // Lo social: solo de TUS amigos y de quien te pidió contacto (el grafo del activo, U4), y sin ligas si están apagadas.
  const social = amigos ? p.news.filter(e => isVisibleNpc(e.fid) && (ligas || !LEAGUEISH.has(e.icon))) : []
  const friendItem = (e: Pool['news'][number]): Of<'friend'> =>
    ({ kind: 'friend', id: `ff-${e.n}`, time: '', reason: npcWhy(e.friend.nick), friend: e.friend, text: e.text, icon: e.icon, reactions: [] })
  // Las rutas: el catálogo REAL de Learn (sin lo que pega con un tema negro o una palabra de la familia), cada una con su
  // avance de verdad en el "por qué".
  const blocked = familyFilter()
  const routes = catalogRuns().filter(({ run }) => !blocked(run.title))
  const queues: Record<Slot, FeedItem[]> = {
    friend: social.filter(e => !LEAGUEISH.has(e.icon)).map(friendItem),
    article: p.arts.map(({ n, ...a }): Of<'article'> => ({ kind: 'article', id: `fa-${n}`, time: '', ...a })),
    route: routes.map(({ route, run }): Of<'route'> => ({ kind: 'route', id: `fr-${run.id}`, time: '', reason: routeWhy(run), course: routeCourse(route, run) })),
    video: (dp === 'noche' ? p.short : p.vids).map(({ video, reason }): Of<'video'> => ({ kind: 'video', id: `fv-${video.id}`, time: '', reason, video })),
  }
  const out = interleave(queues, EDITIONS[dp].pattern).map((it, i) => withTime(it, timeOf(i)))
  // Lo del cierre: la tarjeta de la liga de la semana (la liga se ASIGNA por resultados: la noticia cuenta el ciclo, no
  // invita a unirse; su texto se arma al servir) y las medallas/ascensos de los amigos.
  const late: FeedItem[] = [
    ...(ligas ? [{ kind: 'league', id: 'fl-cometa', time: '', reason: LEAGUE_WHY, name: '', desc: '' } as Of<'league'>] : []),
    ...social.filter(e => LEAGUEISH.has(e.icon)).map(friendItem),
  ].map(it => ({ ...it, time: lastCloseLabel() }))
  const h = closeAgeHours()
  let at = 0
  while (at < out.length && ageOf(at) <= h) at++
  const stream = spaceOut(out, late, at)
  // La primera página trae alguna noticia de liga cerrada de un amigo (leadLeague): esas salen del reparto por antigüedad y
  // se adelantan; el resto de lo del cierre sigue entrando espaciado donde le toca.
  const lead = leadLeague(stream, late)
  return lead.length ? leadInto(spaceOut(out, late.filter(it => !lead.includes(it)), at), lead) : stream
}

/* ---------- la liga cerrada de los amigos, en la primera página (tanda "Ráfaga variada", 29-oct) ---------- */
// Pedido del dueño: «En el inicial también tiene que tener alguno que otro de liga cerrada de un amigo». Las medallas y
// ascensos de los amigos se fechan en el último cierre y entran por antigüedad (arriba): salvo el lunes temprano, quedaban en
// la página 3 o más abajo y la primera página casi nunca traía una.
/** Cuántas se adelantan como mucho: "alguno que otro" (1, y 2 si hay de sobra). */
const LEAD_MAX = 2
/** Desde qué lugar de la edición se buscan sus lugares (después de la primera noticia de amigos y un "para vos"). */
const LEAD_AT = 2
const isFriendLeague = (it: FeedItem): it is Of<'friend'> => it.kind === 'friend' && LEAGUEISH.has(it.icon)
const isLeagueish = (it: FeedItem): boolean => it.kind === 'league' || isFriendLeague(it)
/** Las noticias de liga cerrada de amigos que se ADELANTAN a la primera página: 1-2 (las medallas primero —el tinte de oro,
 *  plata o bronce es lo que se ve—, después los ascensos), y solo si hace falta: Amigos y Ligas prendidos (si no, `late` no
 *  trae ninguna de amigos), el grafo del activo deja ver alguna y la primera página de la edición NO trae ya ninguna (el
 *  lunes temprano la antigüedad ya las pone arriba). Tras un cierre simulado (semana > 0) no: lo vivo del cierre (la
 *  medalla y el podio de esa liga) ya está arriba y lo de la edición es "de la semana pasada" — no se duplica. Lo que
 *  entró en vivo por una ráfaga NO cuenta para decidir: la edición sembrada no puede cambiar con lo vivo (el cursor de las
 *  páginas es su posición: una ráfaga no corre las páginas que el chico ya pidió). */
function leadLeague(stream: readonly FeedItem[], late: readonly FeedItem[]): FeedItem[] {
  if (cycleWeek() > 0 || stream.slice(0, PAGE).some(isFriendLeague)) return []
  const theirs = late.filter(isFriendLeague)
  return [...theirs.filter(it => it.icon === 'medal'), ...theirs.filter(it => it.icon !== 'medal')].slice(0, LEAD_MAX)
}
/** Mete `lead` en la primera página de la edición, desde LEAD_AT y con dos ítems de por medio entre una y otra: en el primer
 *  lugar que no queda pegado a otra noticia de liga (la regla de spaceOut: nunca dos de liga seguidas) ni, si se puede, a
 *  otra noticia de amigos (la plantilla de la franja nunca pone dos sociales seguidas). Conserva su fecha (la del cierre): se
 *  adelanta el lugar, no se miente la fecha. */
function leadInto(stream: readonly FeedItem[], lead: readonly FeedItem[]): FeedItem[] {
  const s = [...stream]
  let from = LEAD_AT
  for (const it of lead) {
    const near = (x: FeedItem | undefined, calm: boolean) => !!x && (isLeagueish(x) || (calm && x.kind === 'friend'))
    const free = (j: number, calm: boolean) => !near(s[j - 1], calm) && !near(s[j], calm)
    let j = -1
    for (const calm of [true, false]) for (let k = from; k < PAGE && k <= s.length && j < 0; k++) if (free(k, calm)) j = k
    for (let k = from; k <= s.length && j < 0; k++) if (free(k, false)) j = k // (no pasa con una edición normal)
    if (j < 0) j = s.length
    s.splice(j, 0, it)
    from = j + 3
  }
  return s
}

/** Las rutas del catálogo que la familia deja ver, con su avance real (las que pegan con un tema negro o una palabra de la
 *  familia no se nombran). */
function visibleRuns(): RouteRun[] {
  const blocked = familyFilter()
  return catalogRuns().map(({ run }) => run).filter((r) => !blocked(r.title))
}

/** El hero "Fijado · tu siguiente paso": SIEMPRE la siguiente mejor acción de aprendizaje (nunca comercio). De día,
 *  seguir la ruta EN CURSO (la de actividad más reciente que tiene postas pendientes); de noche, un repaso tranquilo de esa
 *  ruta (lo que promete el resumen). Sin ruta en curso: empezar una (la primera que no jugó, en el orden del catálogo; si
 *  jugó todas, la primera sin terminar); con todo terminado (o sin rutas), elegir en Aprender. */
function nextStep(dp: Daypart): Of<'next'> {
  const runs = visibleRuns()
  const coins = featureOnNow('tienda') ? ` · +${LEARN_EC} ⚡ por cada posta nueva` : '' // sin Tienda no se nombra la moneda
  const cur = routeInProgress(runs)
  if (!cur) {
    const other = runs.find((r) => r.lastAt === 0 && r.total > 0) ?? runs.find((r) => r.done < r.total)
    if (!other) return { kind: 'next', id: 'fn-aprender', time: 'ahora', reason: 'Para elegir qué aprender hoy', title: 'Elegí qué aprender hoy', meta: 'En Aprender están todas tus rutas', action: { label: 'Ver rutas', to: '/aprender' } }
    const last = runs.filter((r) => r.lastAt > 0).sort((a, b) => b.lastAt - a.lastAt)[0]
    return {
      kind: 'next', id: `fn-${other.id}`, time: 'ahora', title: `Empezá ${other.title}`, meta: `${other.total} ${postasWord(other.total)} para descubrir${coins}`,
      reason: last ? `Terminaste ${last.title}: ¡vamos por otra!` : 'Es una ruta para arrancar algo nuevo', action: { label: 'Empezar', to: routeLink(other.id) },
    }
  }
  const to = routeLink(cur.id)
  const left = cur.total - cur.done
  if (dp === 'noche') {
    return { kind: 'next', id: `fn-${cur.id}`, time: 'ahora', title: `Repasá ${cur.title}, sin apuro`, meta: `Vas ${cur.done} de ${cur.total} ${postasWord(cur.total)} · un repaso cortito antes de dormir`, reason: 'A la noche, un repaso tranquilo te ayuda a recordar', action: { label: 'Repasar', to } }
  }
  return {
    kind: 'next', id: `fn-${cur.id}`, time: 'ahora', title: `Seguí con ${cur.title}`,
    meta: `Vas ${cur.done} de ${cur.total} ${postasWord(cur.total)}${coins}`,
    reason: `La empezaste y te ${left === 1 ? 'queda' : 'quedan'} ${left} ${postasWord(left)}`, action: { label: 'Seguir', to },
  }
}

/** Los temas que puede llevar la grilla, en orden y cada uno con su "por qué": las sugerencias de la familia (sin lo que
 *  pega con un tema negro), el TÍTULO de la ruta en curso (la grilla la acompaña) y los temas de chico. */
function shelfCandidates(): { topic: string; reason: string }[] {
  const blocked = familyFilter()
  const out = familyTopics().white.filter(t => !blocked(t)).map(t => ({ topic: t, reason: familyReason(t) }))
  const cur = routeInProgress(visibleRuns())
  if (cur) out.push({ topic: cur.title, reason: `Porque estás aprendiendo ${cur.title}` })
  for (const q of INTERESTS) if (!blocked(q)) out.push({ topic: q, reason: kidWhy(q) })
  return out
}
/** La grilla ya armada, por política + franja + candidatos (U3: ya no se vacía al armar un pool: cada política tiene la
 *  suya; tope SHELF_MEMO_MAX entradas, al pasarse se vacía). */
const shelfMemo = new Map<string, Of<'videos'> | null>()
const SHELF_MEMO_MAX = 32
/** La grilla "Videos para vos": hasta 3 del tema (que no estén sueltos en la edición; de noche, cortitos) + el total de
 *  ese tema. Todo por la vía ESTRICTA del buscador (videos.ts: searchVideosStrict): la grilla lleva un "por qué" temático
 *  ("Porque a tu familia le interesa: X", "Porque estás aprendiendo X"), así que solo entra lo que tiene de verdad las
 *  palabras del tema, y el total cuenta SOLO eso (con el mismo tope que lista Buscar: const.videoMostrados). El tema es el
 *  PRIMER candidato (shelfCandidates) que rinde al menos un video así: si la sugerencia de la familia o la ruta no tienen
 *  ninguno, la grilla pasa al siguiente con SU propio motivo; si rinde menos de 3, sale más chica; si ninguno rinde, no
 *  hay grilla. NUNCA se completa con resultados fuzzy bajo el motivo de otro tema. */
function shelfOf(dp: Daypart, stream: readonly FeedItem[]): Of<'videos'> | null {
  const cands = shelfCandidates()
  const key = JSON.stringify([poolKey(), dp, cands])
  if (shelfMemo.has(key)) return shelfMemo.get(key)!
  if (shelfMemo.size >= SHELF_MEMO_MAX) shelfMemo.clear()
  const used = new Set(stream.flatMap(it => (it.kind === 'video' ? [it.video.id] : [])))
  const blocked = familyFilter()
  const max = dp === 'noche' ? SHORT_SEC : 1500
  let shelf: Of<'videos'> | null = null
  for (const { topic, reason } of cands) {
    const vids = searchVideosStrict(topic, 40).filter(v => !used.has(v.videoId) && v.duration >= 60 && v.duration <= max && !blocked(videoText(v))).slice(0, 3)
    if (!vids.length) continue
    shelf = { kind: 'videos', id: 'fvs', time: 'hoy', reason, title: 'Videos para vos', total: Math.max(vids.length, searchVideosStrict(topic).length), videos: vids.map(toVideoResult), topic }
    break
  }
  shelfMemo.set(key, shelf)
  return shelf
}

/** El resumen de la edición: título por la franja REAL, la mezcla CONTADA de lo que se sirve (toda la edición, sin lo
 *  oculto) y cómo cambia en la franja que viene. */
function summaryOf(dp: Daypart, now: Date, served: readonly FeedItem[], shelf: Of<'videos'> | null): Of<'summary'> {
  const n = { rutas: 0, videos: shelf?.videos.length ?? 0, lecturas: 0, amigos: 0, liga: 0 }
  for (const it of served) {
    if (it.kind === 'route') n.rutas++
    else if (it.kind === 'video') n.videos++
    else if (it.kind === 'article') n.lecturas++
    else if (it.kind === 'league') n.liga++
    else if (it.kind === 'friend') { if (LEAGUEISH.has(it.icon)) n.liga++; else n.amigos++ }
    // 'medal' (U5-B) no se cuenta: no es contenido recomendado ni social, es tuyo
  }
  const mix = [
    { label: n.rutas === 1 ? 'ruta' : 'rutas', n: n.rutas },
    { label: n.videos === 1 ? 'video' : 'videos', n: n.videos },
    { label: n.lecturas === 1 ? 'lectura' : 'lecturas', n: n.lecturas },
    { label: 'de amigos', n: n.amigos },
    { label: 'de la liga', n: n.liga },
  ].filter(m => m.n > 0)
  const review = dp === 'manana' || !!routeInProgress(visibleRuns()) // ¿el hero de la noche va a ser un repaso? (nextStep)
  const desc = dp === 'noche' && !review ? DESC_NOCHE_SIN_REPASO : DESC[dp]
  const later = dp === 'tarde' && !review ? LATER_TARDE_SIN_REPASO : LATER[dp]
  return { kind: 'summary', id: 'fsum', title: `Tu ${DP_NAME[dp]} de ${dayName(now)}`, desc, mix, later }
}

/* ---------- demo vivo: lo que entra en vivo (RAM, en el Live del usuario: ver arriba) ---------- */
const MAX_FRESH = 90

/** Vuelve al seed lo vivo de ese usuario —sin noticias en vivo, sin sus reacciones y sin nada oculto—; sin id, lo de
 *  TODOS (registrado en POST /api/demo/reset). */
export function resetFeed(userId?: string): void { lives.reset(userId) }

/** Lo que miran los filtros de la familia en una noticia en vivo (la de la liga no se filtra: es el ciclo de Ian). U5-B: la
 *  de medalla, por su título y su texto (como toda noticia en vivo). */
const freshText = (it: FeedItem) => (it.kind === 'friend' ? it.text : it.kind === 'route' ? it.course.name : it.kind === 'medal' ? `${it.medal.title} ${it.medal.text}` : '')
/** Los on-off del padre sobre lo que entró en vivo: sin Amigos nada social (noticias ni rutas compartidas), sin Ligas
 *  nada de ligas. U5-B: una noticia de medalla sigue el `domain` de su medalla (la copa de la familia solo con Ligas, el
 *  primer amigo solo con Amigos); el resto, siempre (no es social: es tuyo). Se ESCONDE al servir, no se borra. */
function liveAllowed(it: FeedItem, amigos: boolean, ligas: boolean): boolean {
  if (it.kind === 'league') return ligas
  if (it.kind === 'friend') return amigos && (ligas || !LEAGUEISH.has(it.icon))
  if (it.kind === 'route') return amigos
  if (it.kind === 'medal') { const d = MEDALS[it.medal.id]?.domain; return d === 'ligas' ? ligas : d === 'amigos' ? amigos : true }
  return true
}
/** Reacciones de arranque de una noticia en vivo (las de los demás ya están; la de Ian, ninguna: mine false). */
const preset = (id: string, counts: number[]) => live().reactions.set(id, EMOJIS.map((emoji, i) => ({ emoji, count: Math.max(0, counts[i] ?? 0), mine: false })))
/** Conteos chicos y creíbles, estables por id (al menos uno). */
function smallCounts(id: string): number[] {
  const h = hashOf(id)
  return [1 + (h % 3), (h >>> 3) % 3, (h >>> 6) % 2, (h >>> 9) % 4 === 0 ? 1 : 0]
}
/** La medalla del activo la festejan sus amigos (Ian tiene 6): números más altos. */
function cheerCounts(id: string): number[] {
  const h = hashOf(id)
  return [3 + (h % 4), 2 + ((h >>> 3) % 4), 1 + ((h >>> 6) % 3), 1 + ((h >>> 9) % 3)]
}
/** Cada emoji queda pegado a la palabra de antes (espacio duro): nunca baja solo a otra línea. */
const glue = (text: string) => text.replace(/ (?=\p{Extended_Pictographic})/gu, ' ')
function newsItem(nick: string, color: string, text: string, icon: NewsIcon, reason: string, counts: (id: string) => number[] = smallCounts): FeedItem {
  const id = `fx-${++live().freshSeq}`
  preset(id, counts(id))
  return { kind: 'friend', id, time: 'recién', reason, friend: { nick, color }, text: glue(text), icon, reactions: [] }
}
function pushFresh(items: FeedItem[], week: number) {
  const L = live(), at = Date.now()
  const all = [...items.map(item => ({ item, week, at })), ...L.fresh]
  L.fresh = all.slice(0, MAX_FRESH)
  // Con muchas ráfagas seguidas lo viejo se recorta, pero la tarjeta de la liga de la semana no se pierde nunca.
  const league = all.find(f => f.item.kind === 'league')
  if (league && !L.fresh.includes(league)) L.fresh.push(league)
}
const MEDAL_NAME: Record<Medal, string> = { oro: 'oro', plata: 'plata', bronce: 'bronce' }

/** Cierre de semana (lo llama leaguesFake.closeWeek, que cierra SOLO la liga del activo): las noticias del cierre ARRIBA
 *  del feed DEL ACTIVO (nunca del de un hermano). Devuelve cuántas entraron.
 *  - La medalla del activo (solo podio): la noticia que ven sus amigos en SU feed (VISION §7), con sus festejos ya
 *    puestos (sin amigos —el adulto—, sin el "la ven tus amigos" ni los festejos de amigos).
 *  - La tarjeta de la liga de la semana nueva: UNA sola (la del cierre anterior y la del seed se van); su texto lo arma
 *    leagueNews() al servir, así sigue al ciclo.
 *  - El podio de la tabla que cerró (sin Ian), como mucho 2: el 1º y uno más, con su ascenso ("sube con vos" si van
 *    juntos a la liga nueva).
 *  Con Amigos apagado solo entra la tarjeta de la liga (lo social no existe); lo que pega con un tema negro o una palabra
 *  de la familia no entra. */
export function injectLeagueClose(r: CloseNews): number {
  const blocked = familyFilter(), amigos = featureOnNow('amigos')
  const out: FeedItem[] = []
  const toLeague = (l: { name: string; emoji: string }) => `${l.name} ${l.emoji}`
  if (r.me.medal && amigos) {
    const text = `ganó la medalla de ${MEDAL_NAME[r.me.medal]} ${MEDAL_EMOJI[r.me.medal]} en la ${r.from.name}${r.movement === 'sube' ? ` y subió a la ${toLeague(r.to)}` : ''}`
    const withFriends = friendCount() > 0
    if (!blocked(text)) out.push(newsItem(r.me.nick, r.me.color, text, 'medal', withFriends ? 'Es tu medalla: la ven tus amigos en su feed' : 'Es tu medalla de la semana', withFriends ? cheerCounts : smallCounts))
  }
  const L = live()
  L.fresh = L.fresh.filter(f => f.item.kind !== 'league')
  out.push({ kind: 'league', id: `fl-w${r.week}`, time: 'recién', reason: LEAGUE_WHY, name: r.to.name, desc: '' })
  if (amigos) {
    for (const p of r.podium.slice(0, 2)) {
      const tail = p.up ? (p.withMe ? ` y sube con vos a la ${toLeague(p.up)}` : ` y subió a la ${toLeague(p.up)}`) : ''
      const text = `ganó la medalla de ${MEDAL_NAME[p.medal]} ${MEDAL_EMOJI[p.medal]} en tu ${r.from.name}${tail}`
      if (!blocked(text)) out.push(newsItem(p.nick, p.color, text, 'medal', p.withMe ? 'Sube de liga con vos' : 'Compitió en tu liga la semana pasada'))
    }
  }
  pushFresh(out, r.week)
  return out.length
}

/** U5-B (docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §5.5c): la noticia de una medalla NUEVA, en lo VIVO del usuario DEL CONTEXTO
 *  (medals.syncMedals la emite siempre bajo el runAsUser del dueño): entra por la píldora "N novedades ↑", como el cierre de
 *  liga. Sin reacciones ni festejos de NPCs; filtrada al servir por liveAllowed (su dominio) y por las palabras/temas de
 *  la familia; el resumen de la edición no la cuenta. Lo registra medals.ts como sumidero (abajo). */
export function injectMedalNews(m: EarnedMedal): void {
  const L = live()
  const medal: EarnedMedal = { id: m.id, emoji: m.emoji, title: m.title, text: m.text, at: m.at, ...(m.times ? { times: m.times } : {}) }
  pushFresh([{ kind: 'medal', id: `fm-${++L.freshSeq}`, time: 'recién', reason: 'Es tu medalla nueva', medal }], cycleWeek())
}
registerMedalNews(injectMedalNews)

/** Cuándo se ganó la medalla sembrada, en la escala de lo sembrado (timeOf): de hoy, como lo vivo ("hace 3 h": sinceLabel);
 *  de ayer, "ayer"; más vieja —o del seed sin fecha (racha, semanas, copa, amigos: `at` null)—, "esta semana", y tras un
 *  cierre simulado, como el resto de lo sembrado ("la semana pasada": weeksAgoLabel). Lee el rótulo de sinceLabel (que ya
 *  cuenta los días de pared en la zona de la familia) en vez de contar los días otra vez. */
function seedMedalTime(at: number | null, week: number): string {
  const since = at === null ? null : sinceLabel(at)
  if (since !== null && !/^hace \d+ días$/.test(since)) return since
  return week > 0 ? weeksAgoLabel(week) : 'esta semana'
}
/** Tanda "Cards del feed" (29-oct; spec §4.1): sin ganar una medalla en vivo, la card 'medal' no aparecía NUNCA. Ahora la
 *  primera página siembra tu medalla MÁS RECIENTE de las reales (medals.ts: derivadas de hechos, nunca entregadas) como
 *  noticia propia: la más nueva de las que VES — medalsOf ya esconde las de un candado y `ok` pasa los mismos filtros que
 *  lo vivo (liveAllowed por su dominio, las palabras y temas de la familia): si la más nueva no se puede mostrar, sale la
 *  que le sigue. Si ESA medalla ya entró en vivo (la acabás de ganar), sale solo la viva: nunca dos veces la misma. Id
 *  estable fm-seed-<medalla> (cumple FEED_ID); como la viva, sin reacciones ni "ver menos" (§5.5c) y el resumen no la
 *  cuenta. Sin medallas (el adulto del seed), nada. */
function seedMedal(fresh: readonly Fresh[], week: number, ok: (it: FeedItem) => boolean): Of<'medal'> | null {
  for (const m of medalsOf(lives.nowId())) {
    const medal: EarnedMedal = { id: m.id, emoji: m.emoji, title: m.title, text: m.text, at: m.at, ...(m.times ? { times: m.times } : {}) }
    const it: Of<'medal'> = { kind: 'medal', id: `fm-seed-${m.id}`, time: seedMedalTime(m.at, week), reason: 'Es tu medalla más reciente', medal }
    if (!ok(it)) continue
    return fresh.some(f => f.item.kind === 'medal' && f.item.medal.id === m.id) ? null : it
  }
  return null
}

/* ---------- "Simular NPCs": lo que publican los NPCs del demo ---------- */
/** El color de cada NPC: el de friendsFake (una sola lista de NPCs: coincide con el dock). */
const friendColor = (nick: string) => npcInfo(nick)?.color ?? '#3A5BD9'
/** ¿El activo ve lo de este NPC (por nick)? Amigo o te pidió contacto, en SU grafo (friendsFake.isVisibleNpc). */
const visibleNick = (nick: string) => isVisibleNpc(npcInfo(nick)?.id)
/** La carrera de la liga, contada para el chico. */
function raceText(ev: NpcRace): string {
  if (ev.passedMe) return `te pasó en la ${ev.league}: sumó ${ev.gain} XP y ahora va ${ev.to}º 😮`
  if (ev.to < ev.from) return `sumó ${ev.gain} XP y subió al ${ev.to}º puesto de tu ${ev.league} 📈`
  return `practicó un montón: +${ev.gain} XP en tu ${ev.league} 💪`
}
const NPC_NEWS_BY_KEY = new Map(NPC_NEWS.map(e => [e.key, e]))
const NPC_MEDALS_BY_KEY = new Map(NPC_MEDALS.map(e => [e.key, e]))

/** Botón "Simular NPCs" (Feed): los NPCs "viven" un rato EN EL FEED DEL ACTIVO (su liga, sus amigos; U4). Deja listas 5
 *  noticias frescas (pedido del 28-oct: «que sean 5 por vez y de diversos tipos»; entran ARRIBA de la primera página cuando
 *  el chico toca la píldora "N novedades ↑"), con reacciones de arranque. Tanda "Ráfaga variada" (29-oct, pedido del
 *  dueño: «tienen que ser de todo tipo y random»): la COMPOSICIÓN se sortea en cada ráfaga (feedMix.composeBurst) entre
 *  seis tipos, como mucho 2 del mismo y nunca la misma dos veces seguidas (antes: una de cada tipo, siempre las mismas 5):
 *  - lo social (feedMix.planBurst, con todas sus reglas): RACHAS, INSIGNIAS y UNIDADES COMPLETADAS de los amigos
 *    (feedMix.NPC_NEWS), RUTAS COMPARTIDAS (kind 'route', del catálogo REAL de Learn: se abren en Aprender) y, con Ligas,
 *    MEDALLAS DE LIGA de los amigos (feedMix.NPC_MEDALS: icono 'medal', con el emoji de su metal; coherentes con la liga de
 *    cada uno). Protagonistas distintos dentro de la ráfaga y, primero, otros que los de la anterior; nada se repite hasta
 *    agotar su tipo (y al reciclar, nunca lo de la ráfaga anterior); la ruta compartida cambia de ruta entre ráfagas
 *    seguidas y, si van dos, son rutas distintas.
 *  - la CARRERA DE TU LIGA (con Ligas; 0, 1 o 2 según el sorteo): compañeros DISTINTOS de tu tabla practican DE VERDAD (su
 *    XP sube en Ligas: leaguesFake.npcPractice), otros que los de la ráfaga anterior.
 *  Solo de quien el activo ve (isVisibleNpc: su grafo) y por los mismos filtros vivos de la familia: un tipo que se queda
 *  sin candidatos no entra en el sorteo y, si no alcanzan para 5, salen menos (honestidad antes que relleno). Con Ligas
 *  apagado, ni carrera ni medallas. Con Amigos apagado no entra nada (el endpoint ya responde 403 antes: index.ts).
 *  Devuelve cuántas entraron. */
export function simulateNpcs(): { added: number } {
  if (!featureOnNow('amigos')) return { added: 0 }
  const L = live()
  const n = ++L.bursts, week = cycleWeek()
  // La semilla lleva al USUARIO: sin él, ian y luna compartían la misma secuencia de composiciones (QA-INTEGRAL, 29-oct).
  const r = rng(hashOf(`npcs:${lives.nowId()}:${n}:${week}`))
  const blocked = familyFilter(), ligas = featureOnNow('ligas')
  const out: FeedItem[] = []
  const routes = catalogRuns().filter(({ run }) => !blocked(run.title))
  const cands: BurstCand[] = [
    ...NPC_NEWS.filter(e => visibleNick(e.nick) && !blocked(e.text)).map((e): BurstCand => ({ key: e.key, type: e.type, nick: e.nick })),
    ...SHARERS.filter(visibleNick).flatMap(nick => routes.map(({ run }): BurstCand => ({ key: `share:${nick}:${run.id}`, type: 'route', nick, ref: run.id }))),
    ...(ligas ? NPC_MEDALS.filter(m => visibleNick(m.nick) && !blocked(m.text)).map((m): BurstCand => ({ key: m.key, type: 'medal', nick: m.nick })) : []),
  ]
  const plan = composeBurst(cands, L.burst, r, ligas ? BURST_MAX_PER_TYPE : 0)
  for (const c of plan.picks) {
    const s = c.type === 'route' ? routes.find(x => x.run.id === c.ref) : undefined
    const e = NPC_NEWS_BY_KEY.get(c.key), m = NPC_MEDALS_BY_KEY.get(c.key)
    if (s) out.push({ kind: 'route', id: `fs-${++L.freshSeq}`, time: 'recién', reason: `La compartió ${c.nick}`, course: routeCourse(s.route, s.run) })
    else if (e) out.push(newsItem(e.nick, friendColor(e.nick), e.text, e.type, npcWhy(e.nick)))
    else if (m) out.push(newsItem(m.nick, friendColor(m.nick), m.text, 'medal', npcWhy(m.nick)))
  }
  if (plan.race > 0) {
    const ran: string[] = []
    for (const ev of npcPractice(r, plan.race, new Set(L.lastRace))) {
      const text = raceText(ev)
      if (!blocked(text)) { out.push(newsItem(ev.nick, ev.color, text, 'league', 'Compite en tu liga esta semana')); ran.push(ev.nick) }
    }
    if (ran.length) L.lastRace = ran
  }
  const items = shuffle(out, r)
  pushFresh(items, week)
  console.log(`[feed] Simular NPCs #${n} de ${lives.nowId()}: +${items.length} noticias (${items.map(it => (it.kind === 'friend' ? (it.icon === 'league' ? 'carrera' : it.icon) : it.kind)).join(', ')}; esperan la píldora del Feed)`)
  return { added: items.length }
}

/* ---------- servir ---------- */
/** Ítems de la edición sembrada por página (la primera suma el hero, lo que entró en vivo, la grilla y el resumen). */
const PAGE = 9
/** Un ítem listo para salir: la liga con su texto del ciclo (se asignó en el cierre) y las noticias con sus reacciones. */
function serve(it: FeedItem): FeedItem {
  if (it.kind === 'league') return { ...it, ...leagueNews(), time: lastCloseLabel() }
  if (it.kind === 'friend') return { ...it, reactions: reactionsOf(it.id).map(r => ({ ...r })) }
  return it
}
export function getFeed(after?: string | null): FeedResponse {
  const now = new Date()
  const dp = daypartOf(now), week = cycleWeek(), motion = feedMotion()
  const { fresh, hidden } = live()
  const stream = seedStream(dp)
  // Lo que se saca DESPUÉS de cortar (no corre las páginas): lo oculto con "ver menos" y, tras un cierre simulado, la
  // tarjeta de liga del seed (la de la semana nueva entró en vivo). Tras un cierre lo sembrado es "de la semana pasada".
  const keep = (it: FeedItem) => !hidden.has(it.id) && (week === 0 || it.kind !== 'league')
  const dated = (it: FeedItem): FeedItem => (week > 0 ? withTime(it, weeksAgoLabel(week)) : it)
  const nextOf = (end: number) => (end < stream.length ? String(end) : null)
  const off = Math.max(0, Math.floor(Number(after ?? 0)) || 0)
  if (off > 0) return { items: stream.slice(off, off + PAGE).filter(keep).map(it => serve(dated(it))), next: nextOf(off + PAGE), motion }

  // Primera página. Lo que entró en vivo va arriba (debajo del hero), con los MISMOS filtros vivos de la familia y los
  // on-off; lo de esta semana se fecha por la hora real ("recién", "hace 5 min"), lo de semanas anteriores por semanas.
  const blocked = familyFilter(), amigos = featureOnNow('amigos'), ligas = featureOnNow('ligas')
  const livePasses = (it: FeedItem) => liveAllowed(it, amigos, ligas) && (it.kind === 'league' || !blocked(freshText(it)))
  const liveItems = fresh
    .filter(f => !hidden.has(f.item.id) && livePasses(f.item))
    .map(f => serve(withTime(f.item, f.week === week ? sinceLabel(f.at) : weeksAgoLabel(week - f.week))))
  // Tu medalla más reciente, debajo de lo vivo (seedMedal). Lo oculto con "ver menos" lo saca el filtro final, como a todo.
  const mine = seedMedal(fresh, week, livePasses)
  const shelf = shelfOf(dp, stream)
  const sum = summaryOf(dp, now, [...liveItems, ...stream.filter(keep)], shelf)
  const { shelfAfter, summaryAfter } = EDITIONS[dp]
  const head = stream.slice(0, PAGE)
  const items: FeedItem[] = [nextStep(dp), ...liveItems, ...(mine ? [mine] : [])]
  for (let i = 0; i <= head.length; i++) {
    if (i === Math.min(shelfAfter, head.length) && shelf) items.push(shelf)
    if (i === Math.min(summaryAfter, head.length)) items.push(sum)
    if (i < head.length && keep(head[i])) items.push(serve(dated(head[i])))
  }
  return { items: items.filter(it => !hidden.has(it.id)), next: nextOf(PAGE), motion }
}
