// ============================== SERVER FAKE DEL FEED ==============================
// El backend real del feed (algoritmo de recomendación del padre + intereses del chico,
// eventos sociales reales) TODAVÍA NO EXISTE — ver docs/VISION.md §3 "Feed".
// Este módulo lo simula para que la UI quede como esqueleto definitivo:
//   - Los ítems de VIDEO salen del catálogo aprobado real (se pueden abrir y reproducir).
//   - Las LECTURAS son URLs reales de sitios de la lista blanca (pasan por el lector moderado).
//   - Los eventos de AMIGOS, la invitación a LIGA y las reacciones son datos de demo en memoria.
// Para conectar el backend real: reemplazar getFeed()/reactFeed() manteniendo las formas.
import { whiteTopics } from './config'
import { searchVideos, toVideoResult, type CatalogVideo } from './videos'

type VideoCard = ReturnType<typeof toVideoResult>
export interface FeedReaction { emoji: string; count: number; mine: boolean }
export type FeedItem =
  | { kind: 'video'; id: string; time: string; reason: string; video: VideoCard }
  | { kind: 'article'; id: string; time: string; reason: string; title: string; url: string; source: string; snippet?: string }
  | { kind: 'route'; id: string; time: string; reason: string; course: { id: string; name: string; units: number; img: string; bg: [string, string] } }
  | { kind: 'friend'; id: string; time: string; friend: { nick: string; color: string }; text: string; icon: 'medal' | 'streak' | 'badge' | 'route' | 'league'; reactions: FeedReaction[] }
  | { kind: 'league'; id: string; time: string; name: string; desc: string }
export interface FeedSidebar {
  /** Liga ASIGNADA por los resultados del chico + puestos por puntaje (zona y país). */
  league: { name: string; pos: number; total: number; zone: { name: string; pos: number }; country: { name: string; pos: number } }
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
// Amigos: mismos nombres/colores que la sección Amigos (coherencia visual en la demo).
const FRIENDS: [string, string][] = [['TomiCohete', '#3A5BD9'], ['LuliVolcan', '#F26B3A'], ['MateoDino', '#13A39A'], ['CataEstrella', '#E5487A'], ['JuanchiRayo', '#F2A81D'], ['MartuLuna', '#8A5CF5']]
const FRIEND_EVENTS: { f: number; text: string; icon: Extract<FeedItem, { kind: 'friend' }>['icon'] }[] = [
  { f: 2, text: 'ganó la medalla de oro 🥇 en la Liga Cometa', icon: 'medal' },
  { f: 0, text: 'llegó a una racha de 12 días seguidos practicando', icon: 'streak' },
  { f: 1, text: 'se ganó la insignia «Guardiana de los Volcanes»', icon: 'badge' },
  { f: 5, text: 'compartió la ruta «El cuerpo humano por dentro»', icon: 'route' },
  { f: 3, text: 'subió a la Liga Estrella ⭐', icon: 'league' },
  { f: 4, text: 'terminó la unidad 1 de Fracciones', icon: 'badge' },
  { f: 2, text: 'completó 40 pasos este mes 💪', icon: 'streak' },
  { f: 0, text: 'ganó la medalla de plata 🥈 en la Liga Cometa', icon: 'medal' },
  { f: 1, text: 'compartió la ruta «Volcanes de Argentina»', icon: 'route' },
]
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
const ROUTES: Extract<FeedItem, { kind: 'route' }>['course'][] = [
  { id: 'solar', name: 'El sistema solar', units: 6, img: 'c_solar', bg: ['#3A5BD9', '#1E2F7A'] },
  { id: 'ocean', name: 'Animales del océano', units: 6, img: 'c_ocean', bg: ['#1C9BD6', '#0E5F8A'] },
  { id: 'body', name: 'Mi cuerpo', units: 5, img: 'c_body', bg: ['#E5487A', '#9E2350'] },
  { id: 'frac', name: 'Fracciones', units: 7, img: 'c_fractions', bg: ['#F26B3A', '#B8431C'] },
]
const timeOf = (i: number) => (i < 2 ? 'hace 1 h' : i < 4 ? 'hace 3 h' : i < 8 ? 'hoy' : i < 13 ? 'ayer' : i < 19 ? 'hace 2 días' : 'esta semana')

/* ---------- armado (una vez por proceso) ---------- */
let built: FeedItem[] | null = null
let topicsUsed: string[] = []
function build(): FeedItem[] {
  if (built) return built
  // Videos del catálogo aprobado. Temas blancos del padre INTERCALADOS con temas generales
  // (si no, un tema de la config domina toda la home) — 1 video por tema por ronda.
  const white = whiteTopics().map(t => t.name)
  const fallback = ['el sistema solar', 'dinosaurios', 'volcanes', 'tiburones', 'inventos', 'fracciones']
  const queries: string[] = []
  for (let i = 0; i < Math.max(white.length, fallback.length); i++) {
    if (white[i]) queries.push(white[i])
    if (fallback[i]) queries.push(fallback[i])
  }
  const qs = [...new Set(queries)]
  const vids: { video: VideoCard; reason: string }[] = []
  const seen = new Set<string>()
  const okTopics: string[] = []
  for (let round = 0; round < 2 && vids.length < 14; round++) {
    for (const q of qs) {
      if (vids.length >= 14) break
      const hit = (searchVideos(q, 8) as CatalogVideo[]).find(h => !seen.has(h.videoId) && h.duration >= 60 && h.duration <= 1500)
      if (!hit) continue
      seen.add(hit.videoId)
      vids.push({ video: toVideoResult(hit), reason: q })
      if (!okTopics.includes(q)) okTopics.push(q)
    }
  }
  topicsUsed = okTopics

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
      } else if (kind === 'article' && idx.article < ARTICLES.length) {
        const a = ARTICLES[idx.article++]
        items.push({ kind, id: `fa-${idx.article}`, time: timeOf(i), ...a })
      } else if (kind === 'route' && idx.route < ROUTES.length) {
        const c = ROUTES[idx.route++]
        items.push({ kind, id: `fr-${c.id}`, time: timeOf(i), reason: 'Por tus temas de interés', course: c })
      } else if (kind === 'friend' && idx.friend < FRIEND_EVENTS.length) {
        const e = FRIEND_EVENTS[idx.friend++]
        const [nick, color] = FRIENDS[e.f]
        items.push({ kind, id: `ff-${idx.friend}`, time: timeOf(i), friend: { nick, color }, text: e.text, icon: e.icon, reactions: [] })
      } else if (kind === 'league' && idx.league === 0) {
        idx.league = 1
        // La liga se ASIGNA por resultados: la noticia informa dónde competís esta semana, no invita a unirse.
        items.push({ kind, id: 'fl-cometa', time: timeOf(i), name: 'Liga Cometa', desc: 'Por tus resultados, esta semana competís con 30 chicos de tu nivel. La liga cierra el domingo.' })
      }
    }
  }
  return (built = items)
}

const PAGE = 9
export function getFeed(after?: string | null): FeedResponse {
  const all = build()
  const off = Math.max(0, Number(after ?? 0) || 0)
  const items = all.slice(off, off + PAGE).map(it => (it.kind === 'friend' ? { ...it, reactions: reactionsOf(it.id).map(r => ({ ...r })) } : it))
  const next = off + PAGE < all.length ? String(off + PAGE) : null
  if (off > 0) return { items, next }
  return {
    items, next,
    sidebar: {
      league: { name: 'Liga Cometa', pos: 7, total: 30, zone: { name: 'Palermo', pos: 37 }, country: { name: 'Argentina', pos: 4812 } },
      continue: { courseId: 'solar', title: 'El Sol y los planetas', done: 2, total: 13 },
      topics: topicsUsed.slice(0, 6),
    },
  }
}
