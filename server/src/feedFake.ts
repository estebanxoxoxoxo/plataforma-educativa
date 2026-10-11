// ============================== SERVER FAKE DEL FEED ==============================
// El backend real del feed (algoritmo de recomendación del padre + intereses del chico,
// eventos sociales reales) TODAVÍA NO EXISTE — ver docs/VISION.md §3 "Feed".
// Este módulo lo simula para que la UI quede como esqueleto definitivo:
//   - Los ítems de VIDEO salen del catálogo aprobado real (se pueden abrir y reproducir).
//   - Las LECTURAS son URLs reales de sitios de la lista blanca (pasan por el lector moderado).
//   - Los eventos de AMIGOS salen de friendsFake (friendNews): los NPCs del demo son UNA sola lista de amigos en todo el
//     sistema (mismos nicks y colores que la sección Amigos, y cada NPC "sabe" lo que publicó). Las reacciones son datos
//     de demo en memoria. Las medallas y ascensos de los amigos se fechan en el último cierre de liga (lastCloseLabel):
//     se reparten el domingo, no a cualquier hora.
//   - La noticia de MI LIGA cuenta el ciclo semanal: cómo me fue en el cierre pasado (lastWeek/lastClose de leaguesFake,
//     la MISMA medalla que el estandarte de Ligas y el aside) + dónde compito esta semana. Se arma al servir, no se duplica.
//   - La barra lateral NO es demo: liga/zona/país salen de leaguesFake (con la XP real de ./progress) y "Seguí
//     practicando" del progreso real + el recorrido real de Practicar: los MISMOS números que Ligas y Practicar.
//   - Los TEMAS DE LA FAMILIA (Zona del padre v2) se aplican acá EN SERIO: lo que pega con un tema NEGRO no se sirve
//     (videos, lecturas, rutas, noticias de amigos y temas del costado). Los BLANCOS son "las sugerencias del padre"
//     (audio 8: guían, no dirigen): uno de cada tres videos sale de ellos (el primero incluido, como mucho 2 por tema) y
//     lo que pega con alguno en el título dice "Porque a tu familia le interesa: …". Las PALABRAS de la familia también
//     sacan lo que las trae. El armado se rehace cuando cambian esos temas o palabras.
//   - DEMO VIVO (RAM, docs/AGENTS.md regla 9): lo que entra en vivo va ARRIBA del feed, del más nuevo al más viejo, y pasa
//     por los MISMOS filtros vivos de la familia al servirse:
//       · injectLeagueClose(): las noticias del cierre simulado de liga (lo orquesta leaguesFake.closeWeek): la medalla de
//         Ian (la que ven sus amigos), la tarjeta de la liga de la semana nueva y el podio de su tabla.
//       · simulateNpcs() (botón "Simular NPCs" de Home): una ráfaga de 4-6 noticias frescas de los NPCs del demo.
//     Después de un cierre, lo de semanas anteriores se fecha por semanas ("la semana pasada"). resetFeed() vuelve al seed.
// Para conectar el backend real: reemplazar getFeed()/reactFeed() manteniendo las formas.
import { whiteTopics } from './config'
import { friendNews } from './friendsFake'
import {
  cycleWeek, hashOf, lastClose, lastCloseLabel, leagueSidebar, MEDAL_EMOJI, myLeague, npcPractice, rng, shuffle, sinceLabel, weeksAgoLabel,
  type CloseNews, type Medal, type NpcRace,
} from './leaguesFake'
import { matchBlockedWord } from './filters'
import { familyBlockedTerms, familyTopics, featureOn, topicHit } from './parent'
import { practiceSummary } from './practice'
import { summary } from './progress'
import { searchVideos, toVideoResult, type CatalogVideo } from './videos'

type VideoCard = ReturnType<typeof toVideoResult>
export interface FeedReaction { emoji: string; count: number; mine: boolean }
export type FeedItem =
  | { kind: 'video'; id: string; time: string; reason: string; video: VideoCard }
  | { kind: 'article'; id: string; time: string; reason: string; title: string; url: string; source: string; snippet?: string }
  | { kind: 'route'; id: string; time: string; reason: string; course: { id: string; name: string; units: number; img: string; bg: [string, string] } }
  | { kind: 'friend'; id: string; time: string; friend: { nick: string; color: string }; text: string; icon: 'medal' | 'streak' | 'badge' | 'route' | 'league'; reactions: FeedReaction[] }
  | { kind: 'league'; id: string; time: string; name: string; desc: string }
type NewsIcon = Extract<FeedItem, { kind: 'friend' }>['icon']
type RouteCourse = Extract<FeedItem, { kind: 'route' }>['course']
export interface FeedSidebar {
  /** Liga ASIGNADA por los resultados del chico + puestos por puntaje (zona y país). */
  league: { name: string; pos: number; total: number; zone: { name: string; pos: number }; country: { name: string; pos: number }; medal?: Medal | null }
  continue: { courseId: string; title: string; done: number; total: number }
  topics: string[]
}
export interface FeedResponse { items: FeedItem[]; next: string | null; sidebar?: FeedSidebar }

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

/* ---------- pools de demo ---------- */
// Noticias de amigos: NO viven acá — las publica cada NPC en friendsFake (friendNews(), en el orden de intercalado).
// Lecturas: URLs reales de la lista blanca (verificadas con el lector moderado).
const ARTICLES: { title: string; url: string; source: string; snippet: string; reason: string }[] = [
  { title: 'Apolo 11: el viaje a la Luna', url: 'https://es.wikipedia.org/wiki/Apolo_11', source: 'es.wikipedia.org', snippet: 'La misión que llevó a los primeros seres humanos a pisar la Luna, en julio de 1969.', reason: 'el espacio' },
  { title: 'Cómo es nuestro sol con respecto a otras estrellas', url: 'https://spaceplace.nasa.gov/sun-compare/sp/', source: 'NASA Space Place', snippet: 'Nuestro sol es impresionante, pero ¿cómo se compara con las demás estrellas de la galaxia?', reason: 'el espacio' },
  { title: 'Estrellas fugaces', url: 'https://www.esa.int/kids/es/Aprende/Nuestro_Universo/Cometas_y_meteoritos/Estrellas_fugaces', source: 'ESA Kids', snippet: '¿Qué son en realidad las estrellas fugaces y por qué aparecen en lluvias?', reason: 'el espacio' },
  { title: 'El cinturón de asteroides', url: 'https://es.wikipedia.org/wiki/Cintur%C3%B3n_de_asteroides', source: 'es.wikipedia.org', snippet: 'Entre Marte y Júpiter hay millones de rocas girando alrededor del Sol.', reason: 'el espacio' },
  { title: '¿Qué es un cometa?', url: 'https://concepto.de/cometas/', source: 'concepto.de', snippet: 'Cuerpos celestes con núcleo de hielo y polvo que desarrollan una cola brillante.', reason: 'el espacio' },
  { title: 'La Vía Láctea', url: 'https://es.wikipedia.org/wiki/V%C3%ADa_L%C3%A1ctea', source: 'es.wikipedia.org', snippet: 'La galaxia espiral donde vive el sistema solar, con cientos de miles de millones de estrellas.', reason: 'el espacio' },
]
// Rutas recomendadas: los cursos existentes (mismo arte que la UI).
const ROUTES: RouteCourse[] = [
  { id: 'solar', name: 'El sistema solar', units: 6, img: 'c_solar', bg: ['#3A5BD9', '#1E2F7A'] },
  { id: 'ocean', name: 'Animales del océano', units: 6, img: 'c_ocean', bg: ['#1C9BD6', '#0E5F8A'] },
  { id: 'body', name: 'Mi cuerpo', units: 5, img: 'c_body', bg: ['#E5487A', '#9E2350'] },
  { id: 'frac', name: 'Fracciones', units: 7, img: 'c_fractions', bg: ['#F26B3A', '#B8431C'] },
]
const timeOf = (i: number) => (i < 2 ? 'hace 1 h' : i < 4 ? 'hace 3 h' : i < 8 ? 'hoy' : i < 13 ? 'ayer' : i < 19 ? 'hace 2 días' : 'esta semana')

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

/* ---------- armado (una vez por proceso y cada vez que la familia cambia sus temas) ---------- */
let built: FeedItem[] | null = null
let builtFor = ''
let topicsUsed: string[] = []
/** El motivo de una sugerencia de la familia (tema blanco de la Zona de padres). */
const familyReason = (t: string) => `Porque a tu familia le interesa: ${t}`
/** Lo que la familia no quiere ver: pega con uno de sus temas NEGROS o trae una de sus palabras (fail-closed). */
function familyFilter(): (text: string) => boolean {
  const fam = familyTopics(), famTerms = familyBlockedTerms()
  return (text: string) => topicHit(text, fam.black) !== null || matchBlockedWord(text, famTerms) !== null
}
function build(): FeedItem[] {
  const fam = familyTopics()
  const famTerms = familyBlockedTerms()
  const key = JSON.stringify([fam, famTerms])
  if (built && builtFor === key) return built
  builtFor = key
  // Temas de la familia: lo que pega con uno NEGRO (o trae una palabra bloqueada de la familia) no se sirve (título,
  // canal, tags y descripción: fail-closed); lo que pega con uno BLANCO en su TÍTULO lleva el motivo de la familia (solo
  // coincidencias fuertes: si no, media home diría "Porque a tu familia…" y dejaría de guiar para dirigir).
  const blocked = familyFilter()
  const why = (title: string, base: string) => { const w = topicHit(title, fam.white); return w ? familyReason(w) : base }
  const videoText = (v: CatalogVideo) => `${v.title} ${v.channelTitle} ${v.tags.join(' ')} ${v.description.slice(0, 300)}`
  const seen = new Set<string>()
  const pickVideo = (q: string) => (searchVideos(q, 8) as CatalogVideo[]).find(h => !seen.has(h.videoId) && h.duration >= 60 && h.duration <= 1500 && !blocked(videoText(h)))
  const okTopics: string[] = []
  // Sugerencias de la familia (temas blancos de la Zona de padres): hasta 2 videos por tema y 5 en total.
  const famQs = fam.white.filter(q => !blocked(q))
  const famMax = Math.min(5, famQs.length * 2)
  const famVids: { video: VideoCard; reason: string }[] = []
  for (let round = 0; round < 2 && famVids.length < famMax; round++) {
    for (const q of famQs) {
      if (famVids.length >= famMax) break
      const hit = pickVideo(q)
      if (!hit) continue
      seen.add(hit.videoId)
      famVids.push({ video: toVideoResult(hit), reason: familyReason(q) })
      if (!okTopics.includes(q)) okTopics.push(q)
    }
  }
  // Videos del catálogo aprobado. Temas blancos del padre INTERCALADOS con temas generales
  // (si no, un tema de la config domina toda la home) — 1 video por tema por ronda.
  const white = whiteTopics().map(t => t.name)
  const fallback = ['el sistema solar', 'dinosaurios', 'volcanes', 'tiburones', 'inventos', 'fracciones']
  const queries: string[] = []
  for (let i = 0; i < Math.max(white.length, fallback.length); i++) {
    if (white[i]) queries.push(white[i])
    if (fallback[i]) queries.push(fallback[i])
  }
  const qs = [...new Set(queries)].filter(q => !blocked(q))
  const baseVids: { video: VideoCard; reason: string }[] = []
  for (let round = 0; round < 2 && baseVids.length + famVids.length < 14; round++) {
    for (const q of qs) {
      if (baseVids.length + famVids.length >= 14) break
      const hit = pickVideo(q)
      if (!hit) continue
      seen.add(hit.videoId)
      baseVids.push({ video: toVideoResult(hit), reason: why(hit.title, q) })
      if (!okTopics.includes(q)) okTopics.push(q)
    }
  }
  // Las sugerencias de la familia GUÍAN sin dirigir: uno de cada tres videos, empezando por el primero.
  const vids: { video: VideoCard; reason: string }[] = []
  while (famVids.length || baseVids.length) {
    const next = (vids.length % 3 === 0 ? famVids.shift() : baseVids.shift()) ?? famVids.shift() ?? baseVids.shift()
    if (next) vids.push(next)
  }
  topicsUsed = okTopics

  // Lecturas, rutas y noticias sin lo que pega con un tema negro. Los ids conservan el lugar en su pool (las
  // reacciones de las noticias van por id: no se corren cuando se filtra una).
  const arts = ARTICLES.map((a, i) => ({ ...a, n: i + 1 })).filter(a => !blocked(`${a.title} ${a.snippet} ${a.reason}`))
  const routes = ROUTES.filter(c => !blocked(c.name))
  const news = friendNews().map((e, i) => ({ ...e, n: i + 1 })).filter(e => !blocked(e.text))

  // Intercalado: social → video → lectura → video → ruta/liga → …
  const pattern = ['friend', 'video', 'article', 'video', 'route', 'friend', 'video', 'article', 'league'] as const
  const idx = { friend: 0, video: 0, article: 0, route: 0, league: 0 }
  const items: FeedItem[] = []
  for (let page = 0; page < 3; page++) {
    for (const kind of pattern) {
      const i = items.length
      if (kind === 'video' && idx.video < vids.length) {
        const v = vids[idx.video++]
        items.push({ kind, id: `fv-${v.video.id}`, time: timeOf(i), reason: v.reason, video: v.video })
      } else if (kind === 'article' && idx.article < arts.length) {
        const { n, ...a } = arts[idx.article++]
        items.push({ kind, id: `fa-${n}`, time: timeOf(i), ...a, reason: why(a.title, a.reason) })
      } else if (kind === 'route' && idx.route < routes.length) {
        const c = routes[idx.route++]
        items.push({ kind, id: `fr-${c.id}`, time: timeOf(i), reason: why(c.name, 'Por tus temas de interés'), course: c })
      } else if (kind === 'friend' && idx.friend < news.length) {
        const e = news[idx.friend++]
        items.push({ kind, id: `ff-${e.n}`, time: timeOf(i), friend: e.friend, text: e.text, icon: e.icon, reactions: [] })
      } else if (kind === 'league' && idx.league === 0) {
        idx.league = 1
        // La liga se ASIGNA por resultados: la noticia cuenta el ciclo (cierre pasado + dónde competís esta semana),
        // no invita a unirse. El texto se vuelve a armar al servir (getFeed), así sigue al ciclo real.
        items.push({ kind, id: 'fl-cometa', time: timeOf(i), ...leagueNews() })
      }
    }
  }
  return (built = items)
}

/* "Seguí practicando": el último curso practicado (progreso real) con el nombre y el total de pasos del recorrido
   REAL de Practicar (el progreso guarda los suyos; si el recorrido ya está armado, mandan los del recorrido). */
function continueCard(): FeedSidebar['continue'] {
  const c = summary().continue ?? { courseId: 'solar', title: 'El sistema solar', done: 0, total: 1 }
  const p = practiceSummary(c.courseId)
  const total = p?.total ?? c.total
  return { courseId: c.courseId, title: p?.name ?? c.title, done: Math.min(c.done, total), total }
}

/* ---------- demo vivo: lo que entra en vivo (RAM) ---------- */
/** Una noticia que entró en vivo: en qué semana del ciclo y cuándo (para fecharla al servir). */
interface Fresh { item: FeedItem; week: number; at: number }
/** Del más nuevo al más viejo: va ARRIBA del feed. */
let fresh: Fresh[] = []
let freshSeq = 0
let bursts = 0
/** Noticias del pool de los NPCs ya publicadas: no se repiten hasta agotarlo (y nunca las de la ráfaga anterior). */
let usedNews = new Set<string>()
let lastBurstKeys: string[] = []
const MAX_FRESH = 90

/** Vuelve al seed: sin noticias en vivo y sin reacciones de Ian (registrarlo en POST /api/demo/reset). */
export function resetFeed(): void {
  fresh = []; freshSeq = 0; bursts = 0; usedNews = new Set(); lastBurstKeys = []
  reactions.clear()
}

/** Lo que miran los filtros de la familia en una noticia en vivo (la de la liga no se filtra: es el ciclo de Ian). */
const freshText = (it: FeedItem) => (it.kind === 'friend' ? it.text : it.kind === 'route' ? it.course.name : '')
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
const glue = (text: string) => text.replace(/ (?=\p{Extended_Pictographic})/gu, '\u00A0')
function newsItem(nick: string, color: string, text: string, icon: NewsIcon, counts: (id: string) => number[] = smallCounts): FeedItem {
  const id = `fx-${++freshSeq}`
  preset(id, counts(id))
  return { kind: 'friend', id, time: 'recién', friend: { nick, color }, text: glue(text), icon, reactions: [] }
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
    if (!blocked(text)) out.push(newsItem(r.me.nick, r.me.color, text, 'medal', cheerCounts))
  }
  fresh = fresh.filter(f => f.item.kind !== 'league')
  out.push({ kind: 'league', id: `fl-w${r.week}`, time: 'recién', name: r.to.name, desc: '' })
  if (amigos) {
    for (const p of r.podium.slice(0, 2)) {
      const tail = p.up ? (p.withMe ? ` y sube con vos a la ${toLeague(p.up)}` : ` y subió a la ${toLeague(p.up)}`) : ''
      const text = `ganó la medalla de ${MEDAL_NAME[p.medal]} ${MEDAL_EMOJI[p.medal]} en tu ${r.from.name}${tail}`
      if (!blocked(text)) out.push(newsItem(p.nick, p.color, text, 'medal'))
    }
  }
  pushFresh(out, r.week)
  return out.length
}

/* ---------- "Simular NPCs": lo que publican los NPCs del demo ---------- */
/** Los amigos de Ian (MISMOS nicks que friendsFake —ese módulo no se toca: van como datos acá—; el color sale de
 *  friendNews() cuando el amigo tiene noticias, así coincide con Amigos). NicoRobot es el de la solicitud de amistad:
 *  hace Fracciones como Ian. Ligas de cada uno: las de su perfil en Amigos. */
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
/** Rutas que comparten los amigos (kind 'route': un curso REAL del demo, con su arte; se abre en Aprender). */
const ENG: RouteCourse = { id: 'eng', name: 'Inglés inicial', units: 8, img: 'c_english', bg: ['#8A5CF5', '#5431B3'] }
const SHARES: { nick: string; course: RouteCourse }[] = [
  { nick: 'TomiCohete', course: ROUTES[0] }, { nick: 'LuliVolcan', course: ROUTES[1] }, { nick: 'CataEstrella', course: ENG },
  { nick: 'MartuLuna', course: ROUTES[2] }, { nick: 'JuanchiRayo', course: ROUTES[3] },
]
/** La carrera de la liga, contada para el chico. */
function raceText(ev: NpcRace): string {
  if (ev.passedMe) return `te pasó en la ${ev.league}: sumó ${ev.gain} XP y ahora va ${ev.to}º 😮`
  if (ev.to < ev.from) return `sumó ${ev.gain} XP y subió al ${ev.to}º puesto de tu ${ev.league} 📈`
  return `practicó un montón: +${ev.gain} XP en tu ${ev.league} 💪`
}

/** Botón "Simular NPCs" (Home): los NPCs "viven" un rato. Mete ARRIBA del feed 4-6 noticias frescas y variadas, con
 *  reacciones de arranque (para que Ian sume la suya):
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
      if (!blocked(text)) { out.push(newsItem(ev.nick, ev.color, text, 'league')); who.add(ev.nick) }
    }
  }
  if (n % 2 === 1) {
    const s = SHARES[((n - 1) / 2) % SHARES.length]
    if (!blocked(s.course.name)) {
      out.push({ kind: 'route', id: `fs-${++freshSeq}`, time: 'recién', reason: `La compartió ${s.nick}`, course: s.course })
      who.add(s.nick)
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
      out.push(newsItem(e.nick, friendColor(e.nick), e.text, e.icon))
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
  console.log(`[feed] Simular NPCs #${n}: +${items.length} noticias`)
  return { added: items.length }
}

/* ---------- servir ---------- */
const PAGE = 9
export function getFeed(after?: string | null): FeedResponse {
  const week = cycleWeek()
  const blocked = familyFilter()
  // Lo que entró en vivo va arriba, con los mismos filtros vivos de la familia; lo de esta semana se fecha por la hora real
  // ("recién", "hace 5 min"), lo de semanas anteriores por semanas.
  const live = fresh
    .filter(f => f.item.kind === 'league' || !blocked(freshText(f.item)))
    .map((f): FeedItem => ({ ...f.item, time: f.week === week ? sinceLabel(f.at) : weeksAgoLabel(week - f.week) }))
  // Después de un cierre simulado, la tarjeta de la liga de la semana es la del cierre (arriba): la del seed se va, y lo
  // del seed pasa a ser de "la semana pasada" (o de hace N semanas).
  const seed = build()
    .filter(it => week === 0 || it.kind !== 'league')
    .map((it): FeedItem => {
      if (week > 0) return { ...it, time: weeksAgoLabel(week) }
      // Medallas y ascensos salen del cierre semanal: van fechados en el último cierre, no "hace 1 h".
      return it.kind === 'friend' && (it.icon === 'medal' || it.icon === 'league') ? { ...it, time: lastCloseLabel() } : it
    })
  const all = [...live, ...seed]
  const off = Math.max(0, Number(after ?? 0) || 0)
  const items = all.slice(off, off + PAGE).map((it): FeedItem => {
    if (it.kind === 'league') return { ...it, ...leagueNews(), time: lastCloseLabel() } // la liga se asignó en el cierre
    if (it.kind !== 'friend') return it
    return { ...it, reactions: reactionsOf(it.id).map(r => ({ ...r })) }
  })
  const next = off + PAGE < all.length ? String(off + PAGE) : null
  if (off > 0) return { items, next }
  return {
    items, next,
    sidebar: { league: leagueSidebar(), continue: continueCard(), topics: topicsUsed.slice(0, 6) },
  }
}
