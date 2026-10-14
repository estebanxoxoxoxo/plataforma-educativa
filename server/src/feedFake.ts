// ============================== SERVER FAKE DEL FEED (modelo v6: "un hilo, muchos estilos") ==============================
// El backend real del feed (algoritmo de recomendación del padre + intereses del chico, eventos sociales reales)
// TODAVÍA NO EXISTE — ver docs/VISION.md §3 "Feed". Este módulo lo simula para que la UI quede como esqueleto definitivo,
// con las formas del contrato Feed v6 (src/api/types.ts; mock fuente: smarty-poc/docs/feed-mocks/v6-hilo-unico.html):
//   - UNA EDICIÓN FINITA. La MEZCLA es del server (plantilla editorial por franja del día, no un sort). Primera página:
//       [ 'next' (el hero: SIEMPRE la siguiente mejor acción de APRENDIZAJE —jamás comercio—, del progreso real),
//         lo que entró en vivo (noticias frescas, lo más nuevo primero),
//         la edición sembrada: noticia de amigos → 1-2 "para vos" (lectura/ruta) → la grilla 'videos' → más social →
//         el 'summary' (que CONFIESA la mezcla y cómo cambia con la hora) → el resto ].
//     Las páginas siguientes siguen la edición, más vieja, sin hero ni resumen; la última trae next=null ("Estás al día").
//     El cursor es la posición en la edición sembrada: lo que entra en vivo va siempre arriba de la primera página, así
//     una ráfaga nueva no corre las páginas que el chico ya pidió.
//   - FRANJA DEL DÍA (hora REAL del server, 6/13/20 h, en la ZONA HORARIA DE LA FAMILIA si el padre eligió una —parent.ts
//     familyTz, deuda 14-oct—; el subtítulo del Feed usa los mismos cortes): mañana = más para
//     aprender (lecturas y rutas primero) · tarde = más para explorar (videos antes) · noche = más tranquila (videos de
//     hasta 6 min y el hero como repaso sin apuro). El resumen lo dice así y avisa qué viene después: es verdad.
//   - Cada ítem trae su "por qué" (`reason`) en lenguaje de chico, en el eje de SU interés ("Porque te gustan los
//     dinosaurios", "TomiCohete es tu amigo", "Tu liga").
//   - Los VIDEOS salen del catálogo aprobado real (se pueden abrir y reproducir); las LECTURAS son URLs reales de sitios de
//     la lista blanca (pasan por el lector moderado). La grilla 'videos' son 3 del tema del chico + el total REAL de ese
//     tema en el buscador (su "Ver todos" lleva ahí). DESVÍO DELIBERADO (tanda v6): los temas de chico del armado ya NO
//     incluyen los temas blancos de fábrica de config.json — esos son lo que el CHAT puede tratar si el chico pregunta
//     (hoy, educación sexual: "feto", "óvulos"…), no intereses para empujarle en la home sin un "por qué" honesto.
//   - Los eventos de AMIGOS salen de friendsFake (friendNews): los NPCs del demo son UNA sola lista en todo el sistema
//     (mismos nicks y colores, y cada NPC "sabe" lo que publicó). Las reacciones son datos de demo en memoria. Las medallas
//     y ascensos (y la tarjeta de la liga de la semana) se fechan en el último cierre de liga (lastCloseLabel) y entran en
//     la edición donde les toca por antigüedad: se reparten el domingo, no a cualquier hora.
//   - La noticia de MI LIGA cuenta el ciclo semanal: cómo me fue en el cierre pasado (lastWeek/lastClose de leaguesFake)
//     + dónde compito esta semana. Se arma al servir, no se duplica.
//   - La CONFIG DEL PADRE se aplica acá EN SERIO: lo que pega con un tema NEGRO o trae una palabra de la familia no se
//     sirve; los temas BLANCOS de la familia son "sus sugerencias" (guían, no dirigen: 1 de cada 3 videos, "Porque a tu
//     familia le interesa: …"); con Amigos apagado no hay nada social y con Ligas apagado nada de ligas (ni en vivo); con
//     la Tienda apagada no se nombra la moneda. El dial de animación del Feed (parent.feedMotion) viaja en cada respuesta.
//   - DEMO VIVO (RAM, docs/AGENTS.md regla 9): lo que entra en vivo pasa por los MISMOS filtros vivos al servirse:
//       · injectLeagueClose(): las noticias del cierre simulado de liga (lo orquesta leaguesFake.closeWeek).
//       · simulateNpcs() (botón "Simular NPCs" del Feed): una ráfaga de 4-6 noticias frescas de los NPCs del demo. El
//         cliente NO las mete solo: muestra la píldora "N novedades ↑" y las trae cuando el chico la toca.
//       · feedLess(): "Ver menos de esto" — los ids ocultos se filtran de TODAS las respuestas siguientes (reversible).
//     Después de un cierre, lo de semanas anteriores se fecha por semanas. resetFeed() vuelve al seed (va en /api/demo/reset).
//   - RUTAS (tanda W3 del porte Smarty): el hero, las cards 'route' y las rutas que comparten los NPCs salen del CATÁLOGO
//     REAL de Learn (learnRoutes.ts) y su avance de los resultados persistidos (learnResults.ts, derivado con la misma
//     regla que el camino: learnProgress.ts). Los 5 cursos fijos de Aprender/Practicar se retiraron. Todo lleva a
//     /aprender?ruta=<id> (abre la ruta directo; la vista limpia el parámetro).
// Para conectar el backend real: reemplazar getFeed()/reactFeed()/feedLess() manteniendo las formas.
import { friendNews } from './friendsFake'
import {
  cycleWeek, hashOf, lastClose, lastCloseLabel, MEDAL_EMOJI, myLeague, npcPractice, rng, shuffle, sinceLabel, weeksAgoLabel,
  type CloseNews, type Medal, type NpcRace,
} from './leaguesFake'
import { matchBlockedWord } from './filters'
import { familyBlockedTerms, familyTopics, familyTz, featureOn, feedMotion, topicHit, type FeedMotion } from './parent'
import { wallClock } from '../../src/shared/lib/zonedClock'
import { LEARN_EC, resultRows } from './learnResults'
import { catalogRoutes, type CatalogRoute } from './learnRoutes'
import { routeInProgress, routeRuns, type RouteRun } from './learnProgress'
import { searchVideos, toVideoResult, type CatalogVideo } from './videos'

type VideoCard = ReturnType<typeof toVideoResult>
export interface FeedReaction { emoji: string; count: number; mine: boolean }
type NewsIcon = 'medal' | 'streak' | 'badge' | 'route' | 'league'
/** La ruta como la dibuja la card (forma `course` del contrato): `units` = sus postas (sin contar los repasos), `img` = la
 *  portada ('' si no hay: la card cae al emoji). `emoji` = ADITIVO de W3 (pendiente de formalizar en src/api/types.ts por
 *  el coordinador): el ícono de la ruta, para la card sin portada. */
type RouteCourse = { id: string; name: string; units: number; img: string; bg: [string, string]; emoji?: string }
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
type Of<K extends FeedItem['kind']> = Extract<FeedItem, { kind: K }>
export interface FeedResponse { items: FeedItem[]; next: string | null; motion: FeedMotion }
/** El mismo ítem con otro "hace cuánto" (el resumen no tiene). */
const withTime = (it: FeedItem, time: string): FeedItem => (it.kind === 'summary' ? it : { ...it, time })

/* ---------- reacciones (en memoria; por ítem de amigo) ---------- */
const EMOJIS = ['👏', '🎉', '💪', '🤩']
const reactions = new Map<string, FeedReaction[]>()
function reactionsOf(id: string): FeedReaction[] {
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
/** Ids que el chico pidió ver menos: no salen en NINGUNA respuesta siguiente hasta que lo deshaga (o se resetee el demo). */
const hidden = new Set<string>()
const MAX_HIDDEN = 500
/** Forma de los ids del feed (fv-<videoId>, fa-3, ff-2, fx-12, fl-cometa…): lo demás no se guarda. */
const FEED_ID = /^[\w.:-]{1,80}$/
/** POST /api/feed/less {id, undo} → {ok}. FAKE: el algoritmo real aprendería "menos de esto"; acá se oculta ese ítem.
 *  PENDIENTE (coordinador): enrutarlo en server/src/index.ts (este módulo no tiene router propio). */
export function feedLess(id: string, undo = false): { ok: boolean } {
  if (!FEED_ID.test(id)) return { ok: false }
  if (undo) hidden.delete(id)
  else if (hidden.size < MAX_HIDDEN) hidden.add(id)
  console.log(`[feed] ver menos${undo ? ' (deshecho)' : ''}: ${id}`)
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
/** Los amigos de Ian (MISMOS nicks que friendsFake —ese módulo no se toca: van como datos acá—) y cómo se cuenta por qué
 *  aparece lo suyo. NicoRobot es el de la solicitud de amistad: puede no ser amigo todavía, pero hace Fracciones como Ian. */
const NPC_WHY: Record<string, string> = {
  TomiCohete: 'TomiCohete es tu amigo', LuliVolcan: 'LuliVolcan es tu amiga', MateoDino: 'MateoDino es tu amigo',
  CataEstrella: 'CataEstrella es tu amiga', JuanchiRayo: 'JuanchiRayo es tu amigo', MartuLuna: 'MartuLuna es tu amiga',
  NicoRobot: 'NicoRobot hace Fracciones como vos',
}
const npcWhy = (nick: string) => NPC_WHY[nick] ?? 'Es de tus amigos'

/* ---------- pools de demo ---------- */
// Noticias de amigos: NO viven acá — las publica cada NPC en friendsFake (friendNews(), en el orden de intercalado).
// Lecturas: URLs reales de la lista blanca (verificadas con el lector moderado).
const ARTICLES: { title: string; url: string; source: string; snippet: string; topic: string }[] = [
  { title: 'Apolo 11: el viaje a la Luna', url: 'https://es.wikipedia.org/wiki/Apolo_11', source: 'es.wikipedia.org', snippet: 'La misión que llevó a los primeros seres humanos a pisar la Luna, en julio de 1969.', topic: 'el espacio' },
  { title: 'Cómo es nuestro sol con respecto a otras estrellas', url: 'https://spaceplace.nasa.gov/sun-compare/sp/', source: 'NASA Space Place', snippet: 'Nuestro sol es impresionante, pero ¿cómo se compara con las demás estrellas de la galaxia?', topic: 'el espacio' },
  { title: 'Estrellas fugaces', url: 'https://www.esa.int/kids/es/Aprende/Nuestro_Universo/Cometas_y_meteoritos/Estrellas_fugaces', source: 'ESA Kids', snippet: '¿Qué son en realidad las estrellas fugaces y por qué aparecen en lluvias?', topic: 'el espacio' },
  { title: 'El cinturón de asteroides', url: 'https://es.wikipedia.org/wiki/Cintur%C3%B3n_de_asteroides', source: 'es.wikipedia.org', snippet: 'Entre Marte y Júpiter hay millones de rocas girando alrededor del Sol.', topic: 'el espacio' },
  { title: '¿Qué es un cometa?', url: 'https://concepto.de/cometas/', source: 'concepto.de', snippet: 'Cuerpos celestes con núcleo de hielo y polvo que desarrollan una cola brillante.', topic: 'el espacio' },
  { title: 'La Vía Láctea', url: 'https://es.wikipedia.org/wiki/V%C3%ADa_L%C3%A1ctea', source: 'es.wikipedia.org', snippet: 'La galaxia espiral donde vive el sistema solar, con cientos de miles de millones de estrellas.', topic: 'el espacio' },
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
  const routes = catalogRoutes()
  const runs = routeRuns(routes, resultRows())
  return routes.map((route, i) => ({ route, run: runs[i] }))
}
function routeCourse(route: CatalogRoute, run: RouteRun): RouteCourse {
  return { id: run.id, name: run.title, units: run.total, img: routeImg(route), bg: ROUTE_BG[hashOf(run.id) % ROUTE_BG.length], emoji: run.emoji || undefined }
}
/** El "por qué" de una ruta: en el eje del chico (lo que lleva hecho), salvo que pegue con un tema de la familia. */
function routeWhy(run: RouteRun): string {
  const w = topicHit(run.title, familyTopics().white)
  if (w) return familyReason(w)
  if (run.lastAt === 0 || run.done === 0) return 'Es una ruta para arrancar algo nuevo'
  if (run.done < run.total) return `La empezaste y te quedan ${run.total - run.done} postas`
  return 'Ya la terminaste: podés repasarla'
}
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
  const others = `competís con otros ${l.total - 1} chicos de tu nivel`
  const closes = l.closesInDays === 0 ? '¡Cierra hoy!' : `Cierra ${l.closes}.`
  if (lc) {
    const res = `${lc.pos}º en la ${lc.from}`
    if (lc.medal && lc.movement === 'sube') return { name: l.name, desc: `${MEDAL_EMOJI[lc.medal]} ¡Saliste ${res} y subiste a la ${l.name}! Esta semana ${others}. ${closes}` }
    if (lc.medal) return { name: l.name, desc: `${MEDAL_EMOJI[lc.medal]} ¡Saliste ${res}${lc.top ? ', la más alta de todas' : ''}! Seguís ahí: esta semana ${others}. ${closes}` }
    if (lc.movement === 'baja') return { name: l.name, desc: `Saliste ${res} y esta semana te toca la ${l.name}, con otros ${l.total - 1} chicos de tu nivel: ¡a sumar XP para volver a subir! ${closes}` }
    return { name: l.name, desc: `Saliste ${res} y seguís en esta liga. Esta semana ${others}: ¡vamos por el podio! ${closes}` }
  }
  if (lw?.medal) return { name: l.name, desc: `${MEDAL_EMOJI[lw.medal]} ¡La semana pasada saliste ${lw.pos}º en la ${l.name}! Esta semana ${others}. ${closes}` }
  if (lw) return { name: l.name, desc: `La semana pasada saliste ${lw.pos}º en la ${l.name}. Esta semana ${others}. ${closes}` }
  return { name: l.name, desc: `Por tus resultados, esta semana ${others}. ${closes}` }
}
const LEAGUE_WHY = 'Te la asignaron por tus resultados'

/* ---------- armado de los pools (una vez por proceso y cada vez que la familia cambia sus temas o palabras) ---------- */
interface PoolVideo { video: VideoCard; reason: string }
interface Pool {
  /** Videos del día (1-25 min) y los de la noche (hasta 6 min), cada uno con su "por qué". */
  vids: PoolVideo[]; short: PoolVideo[]
  arts: { n: number; title: string; url: string; source: string; snippet: string; reason: string }[]
  news:{ n: number; friend: { nick: string; color: string }; text: string; icon: NewsIcon }[]
}
let pool: Pool | null = null
let poolFor = ''
/** Lo que la familia no quiere ver: pega con uno de sus temas NEGROS o trae una de sus palabras (fail-closed). */
function familyFilter(): (text: string) => boolean {
  const fam = familyTopics(), famTerms = familyBlockedTerms()
  return (text: string) => topicHit(text, fam.black) !== null || matchBlockedWord(text, famTerms) !== null
}
const videoText = (v: CatalogVideo) => `${v.title} ${v.channelTitle} ${v.tags.join(' ')} ${v.description.slice(0, 300)}`
function build(): Pool {
  const fam = familyTopics()
  const famTerms = familyBlockedTerms()
  const key = JSON.stringify([fam, famTerms])
  if (pool && poolFor === key) return pool
  poolFor = key
  shelfMemo.clear()
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
    const pick = (q: string) => searchVideos(q, lim).find(h => !seen.has(h.videoId) && h.duration >= 60 && h.duration <= maxSec && !blocked(videoText(h)))
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
  const arts = ARTICLES.map((a, n) => ({ a, n: n + 1 }))
    .filter(({ a }) => !blocked(`${a.title} ${a.snippet} ${a.topic}`))
    .map(({ a, n }) => ({ n, title: a.title, url: a.url, source: a.source, snippet: a.snippet, reason: why(a.title, kidWhy(a.topic)) }))
  const news = friendNews().map((e, i) => ({ ...e, n: i + 1 })).filter(e => !blocked(e.text))
  return (pool = { vids: pickVids(1500), short: pickVids(SHORT_SEC), arts, news })
}

/* ---------- la edición: franja del día + plantilla editorial ---------- */
type Daypart = 'manana' | 'tarde' | 'noche'
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
type Slot = 'friend' | 'article' | 'route' | 'video'
/** La plantilla de cada franja: el orden de los tipos (se repite hasta agotar), y en qué lugar de la edición sembrada
 *  van la grilla de videos y el resumen (primera página: noticia → 1-2 "para vos" → grilla → más social → resumen…). */
const EDITIONS: Record<Daypart, { pattern: readonly Slot[]; shelfAfter: number; summaryAfter: number }> = {
  manana: { pattern: ['friend', 'article', 'route', 'friend', 'article', 'video', 'friend', 'video', 'route', 'article', 'video'], shelfAfter: 3, summaryAfter: 4 },
  tarde: { pattern: ['friend', 'route', 'friend', 'article', 'video', 'friend', 'video', 'article', 'video', 'route', 'video'], shelfAfter: 2, summaryAfter: 4 },
  noche: { pattern: ['friend', 'article', 'friend', 'video', 'route', 'friend', 'video', 'article', 'video'], shelfAfter: 2, summaryAfter: 3 },
}
/** Horas desde el cierre de liga del seed (lunes 00:00 de esta semana, hora local). */
function closeAgeHours(now = new Date()): number {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return (now.getTime() - monday.getTime()) / 3_600_000
}

/** La edición SEMBRADA (sin lo que entró en vivo), en orden: estable mientras no cambien la familia, los on-off ni la
 *  franja. Las páginas se cortan por POSICIÓN acá; lo oculto con "ver menos" (y la tarjeta de liga vieja tras un cierre)
 *  se saca DESPUÉS de cortar, así ocultar algo no corre las páginas. Los tiempos van por lugar ("hace 1 h"… "esta
 *  semana"); lo que se repartió en el cierre de liga va fechado ahí y entra donde le toca por antigüedad. */
function seedStream(dp: Daypart): FeedItem[] {
  const p = build()
  const amigos = featureOn('amigos'), ligas = featureOn('ligas')
  const social = amigos ? p.news.filter(e => ligas || !LEAGUEISH.has(e.icon)) : []
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
  const { pattern } = EDITIONS[dp]
  const out: FeedItem[] = []
  for (let k = 0; queues.friend.length || queues.article.length || queues.route.length || queues.video.length; k++) {
    const it = queues[pattern[k % pattern.length]].shift()
    if (it) out.push(withTime(it, timeOf(out.length)))
  }
  // Lo del cierre: la tarjeta de la liga de la semana (la liga se ASIGNA por resultados: la noticia cuenta el ciclo, no
  // invita a unirse; su texto se arma al servir) y las medallas/ascensos de los amigos.
  const late: FeedItem[] = [
    ...(ligas ? [{ kind: 'league', id: 'fl-cometa', time: '', reason: LEAGUE_WHY, name: '', desc: '' } as Of<'league'>] : []),
    ...social.filter(e => LEAGUEISH.has(e.icon)).map(friendItem),
  ].map(it => ({ ...it, time: lastCloseLabel() }))
  const h = closeAgeHours()
  let at = 0
  while (at < out.length && ageOf(at) <= h) at++
  out.splice(at, 0, ...late)
  return out
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
  const coins = featureOn('tienda') ? ` · +${LEARN_EC} ⚡ por cada posta nueva` : '' // sin Tienda no se nombra la moneda
  const cur = routeInProgress(runs)
  if (!cur) {
    const other = runs.find((r) => r.lastAt === 0 && r.total > 0) ?? runs.find((r) => r.done < r.total)
    if (!other) return { kind: 'next', id: 'fn-aprender', time: 'ahora', reason: 'Para elegir qué aprender hoy', title: 'Elegí qué aprender hoy', meta: 'En Aprender están todas tus rutas', action: { label: 'Ver rutas', to: '/aprender' } }
    const last = runs.filter((r) => r.lastAt > 0).sort((a, b) => b.lastAt - a.lastAt)[0]
    return {
      kind: 'next', id: `fn-${other.id}`, time: 'ahora', title: `Empezá ${other.title}`, meta: `${other.total} postas para descubrir${coins}`,
      reason: last ? `Terminaste ${last.title}: ¡vamos por otra!` : 'Es una ruta para arrancar algo nuevo', action: { label: 'Empezar', to: routeLink(other.id) },
    }
  }
  const to = routeLink(cur.id)
  const left = cur.total - cur.done
  if (dp === 'noche') {
    return { kind: 'next', id: `fn-${cur.id}`, time: 'ahora', title: `Repasá ${cur.title}, sin apuro`, meta: `Vas ${cur.done} de ${cur.total} postas · un repaso cortito antes de dormir`, reason: 'A la noche, un repaso tranquilo te ayuda a recordar', action: { label: 'Repasar', to } }
  }
  return {
    kind: 'next', id: `fn-${cur.id}`, time: 'ahora', title: `Seguí con ${cur.title}`,
    meta: `Vas ${cur.done} de ${cur.total} postas${coins}`,
    reason: `La empezaste y te quedan ${left} ${left === 1 ? 'posta' : 'postas'}`, action: { label: 'Seguir', to },
  }
}

/** El tema de la grilla de videos: la primera sugerencia de la familia; si no hay, el TÍTULO de la ruta en curso (la
 *  grilla la acompaña) cuando el buscador tiene videos para él; si no, el primer tema de chico. */
function shelfTopic(): { topic: string; reason: string } {
  const blocked = familyFilter()
  const fam = familyTopics().white.find(t => !blocked(t))
  if (fam) return { topic: fam, reason: familyReason(fam) }
  const cur = routeInProgress(visibleRuns())
  if (cur && searchVideos(cur.title, 1).length) return { topic: cur.title, reason: `Porque estás aprendiendo ${cur.title}` }
  const first = INTERESTS.find(q => !blocked(q)) ?? INTERESTS[0]
  return { topic: first, reason: kidWhy(first) }
}
const shelfMemo = new Map<string, Of<'videos'> | null>()
/** La grilla "Videos para vos": 3 del tema (que no estén sueltos en la edición; de noche, cortitos) + el total REAL de
 *  ese tema en el buscador de videos (lo que muestra "Ver todos"). */
function shelfOf(dp: Daypart, stream: readonly FeedItem[]): Of<'videos'> | null {
  const { topic, reason } = shelfTopic()
  const key = `${poolFor}|${dp}|${topic}|${reason}`
  if (shelfMemo.has(key)) return shelfMemo.get(key)!
  const used = new Set(stream.flatMap(it => (it.kind === 'video' ? [it.video.id] : [])))
  const blocked = familyFilter()
  const max = dp === 'noche' ? SHORT_SEC : 1500
  const vids = searchVideos(topic, 40).filter(v => !used.has(v.videoId) && v.duration >= 60 && v.duration <= max && !blocked(videoText(v))).slice(0, 3)
  const shelf: Of<'videos'> | null = vids.length
    ? { kind: 'videos', id: 'fvs', time: 'hoy', reason, title: 'Videos para vos', total: Math.max(vids.length, searchVideos(topic).length), videos: vids.map(toVideoResult), topic }
    : null
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
  }
  const mix = [
    { label: n.rutas === 1 ? 'ruta' : 'rutas', n: n.rutas },
    { label: n.videos === 1 ? 'video' : 'videos', n: n.videos },
    { label: n.lecturas === 1 ? 'lectura' : 'lecturas', n: n.lecturas },
    { label: 'de amigos', n: n.amigos },
    { label: 'de la liga', n: n.liga },
  ].filter(m => m.n > 0)
  return { kind: 'summary', id: 'fsum', title: `Tu ${DP_NAME[dp]} de ${dayName(now)}`, desc: DESC[dp], mix, later: LATER[dp] }
}

/* ---------- demo vivo: lo que entra en vivo (RAM) ---------- */
/** Una noticia que entró en vivo: en qué semana del ciclo y cuándo (para fecharla al servir). */
interface Fresh { item: FeedItem; week: number; at: number }
/** Del más nuevo al más viejo: va ARRIBA de la primera página (debajo del hero). */
let fresh: Fresh[] = []
let freshSeq = 0
let bursts = 0
/** Noticias del pool de los NPCs ya publicadas: no se repiten hasta agotarlo (y nunca las de la ráfaga anterior). */
let usedNews = new Set<string>()
let lastBurstKeys: string[] = []
const MAX_FRESH = 90

/** Vuelve al seed: sin noticias en vivo, sin reacciones de Ian y sin nada oculto (registrado en POST /api/demo/reset). */
export function resetFeed(): void {
  fresh = []; freshSeq = 0; bursts = 0; usedNews = new Set(); lastBurstKeys = []
  reactions.clear()
  hidden.clear()
}

/** Lo que miran los filtros de la familia en una noticia en vivo (la de la liga no se filtra: es el ciclo de Ian). */
const freshText = (it: FeedItem) => (it.kind === 'friend' ? it.text : it.kind === 'route' ? it.course.name : '')
/** Los on-off del padre sobre lo que entró en vivo: sin Amigos nada social (noticias ni rutas compartidas), sin Ligas
 *  nada de ligas. */
function liveAllowed(it: FeedItem, amigos: boolean, ligas: boolean): boolean {
  if (it.kind === 'league') return ligas
  if (it.kind === 'friend') return amigos && (ligas || !LEAGUEISH.has(it.icon))
  if (it.kind === 'route') return amigos
  return true
}
/** Reacciones de arranque de una noticia en vivo (las de los demás ya están; la de Ian, ninguna: mine false). */
const preset = (id: string, counts: number[]) => reactions.set(id, EMOJIS.map((emoji, i) => ({ emoji, count: Math.max(0, counts[i] ?? 0), mine: false })))
/** Conteos chicos y creíbles, estables por id (al menos uno). */
function smallCounts(id: string): number[] {
  const h = hashOf(id)
  return [1 + (h % 3), (h >>> 3) % 3, (h >>> 6) % 2, (h >>> 9) % 4 === 0 ? 1 : 0]
}
/** La medalla de Ian la festejan sus amigos (son 6): números más altos. */
function cheerCounts(id: string): number[] {
  const h = hashOf(id)
  return [3 + (h % 4), 2 + ((h >>> 3) % 4), 1 + ((h >>> 6) % 3), 1 + ((h >>> 9) % 3)]
}
/** Cada emoji queda pegado a la palabra de antes (espacio duro): nunca baja solo a otra línea. */
const glue = (text: string) => text.replace(/ (?=\p{Extended_Pictographic})/gu, ' ')
function newsItem(nick: string, color: string, text: string, icon: NewsIcon, reason: string, counts: (id: string) => number[] = smallCounts): FeedItem {
  const id = `fx-${++freshSeq}`
  preset(id, counts(id))
  return { kind: 'friend', id, time: 'recién', reason, friend: { nick, color }, text: glue(text), icon, reactions: [] }
}
function pushFresh(items: FeedItem[], week: number) {
  const at = Date.now()
  const all = [...items.map(item => ({ item, week, at })), ...fresh]
  fresh = all.slice(0, MAX_FRESH)
  // Con muchas ráfagas seguidas lo viejo se recorta, pero la tarjeta de la liga de la semana no se pierde nunca.
  const league = all.find(f => f.item.kind === 'league')
  if (league && !fresh.includes(league)) fresh.push(league)
}
const MEDAL_NAME: Record<Medal, string> = { oro: 'oro', plata: 'plata', bronce: 'bronce' }

/** Cierre de semana (lo llama leaguesFake.closeWeek): las noticias del cierre ARRIBA del feed. Devuelve cuántas entraron.
 *  - La medalla de Ian (solo podio): la noticia que ven sus amigos en SU feed (VISION §7), con sus festejos ya puestos.
 *  - La tarjeta de la liga de la semana nueva: UNA sola (la del cierre anterior y la del seed se van); su texto lo arma
 *    leagueNews() al servir, así sigue al ciclo.
 *  - El podio de la tabla que cerró (sin Ian), como mucho 2: el 1º y uno más, con su ascenso ("sube con vos" si van
 *    juntos a la liga nueva).
 *  Con Amigos apagado solo entra la tarjeta de la liga (lo social no existe); lo que pega con un tema negro o una palabra
 *  de la familia no entra. */
export function injectLeagueClose(r: CloseNews): number {
  const blocked = familyFilter(), amigos = featureOn('amigos')
  const out: FeedItem[] = []
  const toLeague = (l: { name: string; emoji: string }) => `${l.name} ${l.emoji}`
  if (r.me.medal && amigos) {
    const text = `ganó la medalla de ${MEDAL_NAME[r.me.medal]} ${MEDAL_EMOJI[r.me.medal]} en la ${r.from.name}${r.movement === 'sube' ? ` y subió a la ${toLeague(r.to)}` : ''}`
    if (!blocked(text)) out.push(newsItem(r.me.nick, r.me.color, text, 'medal', 'Es tu medalla: la ven tus amigos en su feed', cheerCounts))
  }
  fresh = fresh.filter(f => f.item.kind !== 'league')
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

/* ---------- "Simular NPCs": lo que publican los NPCs del demo ---------- */
/** El color de cada amigo de Ian (MISMOS nicks que friendsFake): sale de friendNews() cuando el amigo tiene noticias,
 *  así coincide con el dock. Ligas de cada uno: las de su perfil. */
const FRIEND_COLOR: Record<string, string> = {
  TomiCohete: '#3A5BD9', LuliVolcan: '#F26B3A', MateoDino: '#13A39A', CataEstrella: '#E5487A', JuanchiRayo: '#F2A81D', MartuLuna: '#8A5CF5', NicoRobot: '#18A957',
}
const friendColor = (nick: string) => friendNews().find(n => n.friend.nick === nick)?.friend.color ?? FRIEND_COLOR[nick] ?? '#3A5BD9'
/** Logros coherentes con cada amigo (sus cursos, su racha y su liga del perfil) y con Practicar: las medallas e
 *  insignias son las REALES de los recorridos (Medalla de ballenas, Brújula Espacial…) y las unidades, las de cada curso.
 *  Las medallas de LIGA (oro/plata/bronce) y los ascensos solo salen del cierre de la semana: acá, el podio "va 2º". */
const NPC_NEWS: { key: string; nick: string; text: string; icon: NewsIcon }[] = [
  { key: 'tomi-brujula', nick: 'TomiCohete', text: 'se ganó la «Brújula Espacial» en El sistema solar 🚀', icon: 'badge' },
  { key: 'tomi-cometas', nick: 'TomiCohete', text: 'terminó la unidad «Cometas y asteroides» de El sistema solar ☄️', icon: 'badge' },
  { key: 'tomi-podio', nick: 'TomiCohete', text: 'se metió en el podio de su Liga Cometa: va 3º 🥉', icon: 'medal' },
  { key: 'tomi-pasos', nick: 'TomiCohete', text: 'completó 25 pasos esta semana 💪', icon: 'streak' },
  { key: 'luli-ballenas', nick: 'LuliVolcan', text: 'se ganó la «Medalla de ballenas» en Animales del océano 🐋', icon: 'badge' },
  { key: 'luli-pulpos', nick: 'LuliVolcan', text: 'terminó la unidad «Pulpos, medusas y estrellas» de Animales del océano 🐙', icon: 'badge' },
  { key: 'luli-racha', nick: 'LuliVolcan', text: 'llegó a 8 días seguidos practicando 🔥', icon: 'streak' },
  { key: 'mateo-racha', nick: 'MateoDino', text: 'llegó a 3 semanas de racha: ¡21 días seguidos! 🔥', icon: 'streak' },
  { key: 'mateo-llave', nick: 'MateoDino', text: 'se ganó la «Llave de Equivalencias» en Fracciones 🔑', icon: 'badge' },
  { key: 'mateo-primero', nick: 'MateoDino', text: 'va 1º en su Liga Estrella 🥇', icon: 'medal' },
  { key: 'mateo-comparar', nick: 'MateoDino', text: 'terminó la unidad «Comparar y ordenar» de Fracciones', icon: 'badge' },
  { key: 'cata-colores', nick: 'CataEstrella', text: 'se ganó la «Medalla de Colores» en Inglés inicial 🎨', icon: 'badge' },
  { key: 'cata-numbers', nick: 'CataEstrella', text: 'terminó la unidad «Numbers» de Inglés inicial: one, two, three! 🔢', icon: 'badge' },
  { key: 'cata-racha', nick: 'CataEstrella', text: 'arrancó una racha: 3 días seguidos practicando ✨', icon: 'streak' },
  { key: 'juanchi-equiv', nick: 'JuanchiRayo', text: 'terminó la unidad «Fracciones equivalentes» ⚡', icon: 'badge' },
  { key: 'juanchi-primero', nick: 'JuanchiRayo', text: 'va 1º en su Liga Chispa ⚽', icon: 'medal' },
  { key: 'juanchi-racha', nick: 'JuanchiRayo', text: 'ya lleva 2 días seguidos practicando 💪', icon: 'streak' },
  { key: 'martu-corazon', nick: 'MartuLuna', text: 'se ganó la «Medalla de Corazón» en Mi cuerpo ❤️', icon: 'badge' },
  { key: 'martu-luna', nick: 'MartuLuna', text: 'terminó la unidad «La Luna» de El sistema solar 🌙', icon: 'badge' },
  { key: 'martu-racha', nick: 'MartuLuna', text: 'llegó a 5 días seguidos practicando 🔥', icon: 'streak' },
  { key: 'nico-decimales', nick: 'NicoRobot', text: 'se ganó el «Sello de decimales» en Fracciones 🤖', icon: 'badge' },
  { key: 'nico-espacio', nick: 'NicoRobot', text: 'terminó la unidad «Explorar el espacio» de El sistema solar 🛰️', icon: 'badge' },
  { key: 'nico-podio', nick: 'NicoRobot', text: 'va 2º en su Liga Chispa 🥈', icon: 'medal' },
]
/** Los amigos que comparten rutas (kind 'route'): cada ráfaga impar, el que toca comparte una ruta REAL del catálogo de
 *  Learn (en ronda; se abre en Aprender). */
const SHARERS = ['TomiCohete', 'LuliVolcan', 'CataEstrella', 'MartuLuna', 'JuanchiRayo']
/** La carrera de la liga, contada para el chico. */
function raceText(ev: NpcRace): string {
  if (ev.passedMe) return `te pasó en la ${ev.league}: sumó ${ev.gain} XP y ahora va ${ev.to}º 😮`
  if (ev.to < ev.from) return `sumó ${ev.gain} XP y subió al ${ev.to}º puesto de tu ${ev.league} 📈`
  return `practicó un montón: +${ev.gain} XP en tu ${ev.league} 💪`
}

/** Botón "Simular NPCs" (Feed): los NPCs "viven" un rato. Deja listas 4-6 noticias frescas y variadas (entran ARRIBA de
 *  la primera página cuando el chico toca la píldora "N novedades ↑"), con reacciones de arranque:
 *  - la carrera de tu liga: 1-2 compañeros de tu tabla practican DE VERDAD (su XP sube en Ligas: leaguesFake.npcPractice);
 *  - una ráfaga sí, una no: un amigo comparte una ruta (kind 'route', curso real);
 *  - logros de los amigos del pool (rachas, medallas e insignias de Practicar, unidades, podio en su liga), sin repetir.
 *  Pasa por los mismos filtros vivos de la familia; con Ligas apagado no hay noticias de ligas, y con Amigos apagado no
 *  hay noticias sociales (no entra nada). Devuelve cuántas entraron. */
export function simulateNpcs(): { added: number } {
  if (!featureOn('amigos')) return { added: 0 }
  const n = ++bursts, week = cycleWeek()
  const r = rng(hashOf(`npcs:${n}:${week}`))
  const blocked = familyFilter(), ligas = featureOn('ligas')
  const want = 4 + Math.floor(r() * 3) // 4-6
  const out: FeedItem[] = []
  const who = new Set<string>() // un NPC por noticia en cada ráfaga
  if (ligas) {
    for (const ev of npcPractice(r, r() < 0.5 ? 1 : 2)) {
      const text = raceText(ev)
      if (!blocked(text)) { out.push(newsItem(ev.nick, ev.color, text, 'league', 'Compite en tu liga esta semana')); who.add(ev.nick) }
    }
  }
  if (n % 2 === 1) {
    const k = (n - 1) / 2
    const routes = catalogRuns().filter(({ run }) => !blocked(run.title))
    const nick = SHARERS[k % SHARERS.length]
    const s = routes.length ? routes[k % routes.length] : null
    if (s) {
      out.push({ kind: 'route', id: `fs-${++freshSeq}`, time: 'recién', reason: `La compartió ${nick}`, course: routeCourse(s.route, s.run) })
      who.add(nick)
    }
  }
  // El podio de un amigo en "su Liga X" no se publica si X es la liga de Ian esta semana: en la tabla de Ian ese amigo
  // no está (compite en otro grupo) y "va 3º" lo contradiría.
  const mine = myLeague().name
  const pool = NPC_NEWS.filter(e => (e.icon !== 'medal' || (ligas && !e.text.includes(mine))) && !blocked(e.text))
  const picked: string[] = []
  const pickFrom = (cands: typeof pool) => {
    for (const e of cands) {
      if (out.length >= want) break
      if (who.has(e.nick) || usedNews.has(e.key)) continue
      usedNews.add(e.key); who.add(e.nick); picked.push(e.key)
      out.push(newsItem(e.nick, friendColor(e.nick), e.text, e.icon, npcWhy(e.nick)))
    }
  }
  pickFrom(shuffle(pool, r))
  if (out.length < want) { // pool agotado: vuelve a empezar, sin repetir lo de esta ráfaga ni lo de la anterior
    usedNews = new Set([...lastBurstKeys, ...picked])
    pickFrom(shuffle(pool, r))
  }
  lastBurstKeys = picked
  const items = shuffle(out, r)
  pushFresh(items, week)
  console.log(`[feed] Simular NPCs #${n}: +${items.length} noticias (esperan la píldora del Feed)`)
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
  const blocked = familyFilter(), amigos = featureOn('amigos'), ligas = featureOn('ligas')
  const live = fresh
    .filter(f => !hidden.has(f.item.id) && liveAllowed(f.item, amigos, ligas) && (f.item.kind === 'league' || !blocked(freshText(f.item))))
    .map(f => serve(withTime(f.item, f.week === week ? sinceLabel(f.at) : weeksAgoLabel(week - f.week))))
  const shelf = shelfOf(dp, stream)
  const sum = summaryOf(dp, now, [...live, ...stream.filter(keep)], shelf)
  const { shelfAfter, summaryAfter } = EDITIONS[dp]
  const head = stream.slice(0, PAGE)
  const items: FeedItem[] = [nextStep(dp), ...live]
  for (let i = 0; i <= head.length; i++) {
    if (i === Math.min(shelfAfter, head.length) && shelf) items.push(shelf)
    if (i === Math.min(summaryAfter, head.length)) items.push(sum)
    if (i < head.length && keep(head[i])) items.push(serve(dated(head[i])))
  }
  return { items: items.filter(it => !hidden.has(it.id)), next: nextOf(PAGE), motion }
}
