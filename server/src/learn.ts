// Aprender: cada capítulo de un curso apunta a UN contenido real y aprobado:
//   video   → del catálogo aprobado (lista blanca de YouTube de Smarty)
//   lectura → de un sitio aprobado (Serper sobre la lista blanca) que ADEMÁS ya pasó extracción + juez,
//             así el capítulo nunca lleva a algo que después se bloquea o no se puede leer.
// El temario de los cursos fijos está acá; el de los cursos generados lo arma un modelo a partir del tema.
// La resolución se cachea en disco (server/data/cache/courses/) por temario + policyVersion.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MODELS, SERVER_ROOT, config } from './config'
import { getArticle } from './articles'
import { matchBlockedWord } from './filters'
import { complete, parseJudgeJson } from './llm'
import { searchPages } from './search'
import { searchVideos, toVideoResult, type CatalogVideo } from './videos'

type Kind = 'video' | 'lectura'
interface ChapterSpec { t: string; k: Kind; q: string }
interface UnitSpec { t: string; ch: ChapterSpec[] }
export interface Chapter {
  title: string
  kind: Kind
  /** Texto del tag: "Video · 4:13" / "Lectura" */ label: string
  /** Canal o sitio de origen */ source: string
  target: { type: 'video'; id: string } | { type: 'article'; url: string }
}
export interface ResolvedCourse { id: string; units: { title: string; chapters: Chapter[] }[] }

const v = (t: string, q: string): ChapterSpec => ({ t, k: 'video', q })
const l = (t: string, q: string): ChapterSpec => ({ t, k: 'lectura', q })

/* Temarios de los cursos fijos (misma cantidad de unidades que muestra cada tarjeta). Las búsquedas de
   video están probadas contra el catálogo aprobado; las de lectura van a los sitios aprobados. */
const SYLLABI: Record<string, { english?: boolean; units: UnitSpec[] }> = {
  solar: { units: [
    { t: 'El Sol', ch: [l('¿Qué es el Sol?', 'el Sol estrella'), v('Curiosidades del Sol y la Luna', 'curiosidades sol luna sistema solar'), l('La luz y el calor del Sol', 'energía solar luz calor del Sol')] },
    { t: 'Los planetas', ch: [v('Planetas rocosos', 'planetas terrestres'), v('Gigantes gaseosos', 'planetas gaseosos'), l('¿Por qué Plutón ya no es planeta?', 'Plutón planeta enano')] },
    { t: 'La Luna', ch: [v('Las fases de la Luna', 'fases lunares'), l('Las mareas', 'mareas Luna'), l('El viaje a la Luna', 'Apolo 11 llegada a la Luna')] },
    { t: 'Estrellas y constelaciones', ch: [l('La vida de las estrellas', 'evolución estelar nacimiento muerte estrellas'), v('Cómo reconocer constelaciones', 'aprende reconocer constelaciones'), l('La Vía Láctea', 'Vía Láctea galaxia')] },
    { t: 'Cometas y asteroides', ch: [l('¿Qué es un cometa?', 'cometas cuerpos celestes cola núcleo'), l('El cinturón de asteroides', 'cinturón de asteroides'), l('Estrellas fugaces', 'meteoros estrellas fugaces')] },
    { t: 'Explorar el espacio', ch: [v('La Estación Espacial Internacional', 'estacion espacial internacional'), v('Robots en Marte', 'rover marte'), l('Cómo funcionan los cohetes', 'cohete espacial')] },
  ] },
  frac: { units: [
    { t: '¿Qué es una fracción?', ch: [v('Las fracciones', 'fracciones niños'), l('Numerador y denominador', 'numerador denominador fracción'), l('Fracciones en la vida diaria', 'fracciones ejemplos vida cotidiana')] },
    { t: 'Fracciones equivalentes', ch: [v('Fracciones equivalentes', 'fracciones equivalentes'), l('Simplificar fracciones', 'simplificar fracciones'), l('Amplificar fracciones', 'amplificar fracciones')] },
    { t: 'Comparar y ordenar', ch: [v('Comparar fracciones', 'comparar fracciones'), v('Ordenar fracciones y decimales', 'ordenar fracciones decimales'), l('Fracciones en la recta numérica', 'fracciones recta numérica')] },
    { t: 'Sumar y restar', ch: [l('Sumar con igual denominador', 'suma de fracciones con igual denominador'), v('Sumar y restar varias fracciones', 'sumar fracciones'), v('El método mariposa', 'restar fracciones mariposa')] },
    { t: 'Fracciones y decimales', ch: [v('Los números decimales', 'numeros decimales'), l('De fracción a decimal', 'convertir fracción a número decimal'), l('Fracciones y porcentajes', 'porcentaje fracción')] },
    { t: 'Multiplicar y dividir', ch: [v('Multiplicar fracciones', 'multiplicar fracciones'), l('Dividir fracciones', 'división de fracciones'), v('La fracción de un número', 'fraccion de un numero')] },
    { t: 'Problemas con fracciones', ch: [v('Resolver problemas', 'fracciones problemas'), l('Fracciones mixtas', 'números mixtos fracciones impropias'), l('Practicar problemas', 'problemas de fracciones primaria')] },
  ] },
  ocean: { units: [
    { t: 'Los peces', ch: [l('¿Qué es un pez?', 'peces animales acuáticos vertebrados branquias'), v('Los hábitats acuáticos', 'habitats acuaticos'), v('La vida en el arrecife', 'arrecife coral')] },
    { t: 'Mamíferos marinos', ch: [v('Nadar con mamíferos marinos', 'mamiferos marinos'), l('Las ballenas', 'ballenas cetáceos'), v('Hablar como un delfín', 'delfines kratt')] },
    { t: 'Tiburones y rayas', ch: [v('El mundo de los tiburones', 'tiburones'), l('Los tiburones', 'tiburón'), l('Las rayas', 'raya pez cartilaginoso')] },
    { t: 'Pulpos, medusas y estrellas', ch: [v('El pulpo, un animal muy inteligente', 'pulpo inteligente'), v('Las medusas', 'medusas'), l('Las estrellas de mar', 'estrellas de mar asteroideos')] },
    { t: 'Tortugas y océano profundo', ch: [v('Las tortugas marinas', 'tortugas marinas'), l('Los arrecifes de coral', 'arrecife de coral'), v('Un viaje al océano profundo', 'oceano profundo submarino')] },
    { t: 'Cuidar el océano', ch: [l('La contaminación de los océanos', 'contaminación de los océanos'), v('Usar menos plástico', 'reducir consumo plastico'), l('Proteger la vida marina', 'conservación de la vida marina')] },
  ] },
  body: { units: [
    { t: 'Los huesos', ch: [v('Los huesos y el sistema óseo', 'huesos niños'), l('El esqueleto humano', 'esqueleto humano'), v('Sostén y movimiento', 'sosten movimiento humanos')] },
    { t: 'Los músculos', ch: [v('El sistema muscular', 'musculos niños'), v('El aparato locomotor', 'sistema locomotor niños'), l('¿Cómo funcionan los músculos?', 'músculos del cuerpo humano')] },
    { t: 'El corazón y la sangre', ch: [v('El sistema circulatorio', 'corazon niños'), v('Cómo funciona el corazón', 'funciona corazon animacion'), l('La sangre', 'sangre glóbulos rojos plasma')] },
    { t: 'La respiración', ch: [v('El sistema respiratorio', 'aparato respiratorio'), l('Los pulmones', 'pulmones'), l('¿Cómo respiramos?', 'sistema respiratorio')] },
    { t: 'La digestión', ch: [v('El sistema digestivo', 'sistema digestivo'), l('El aparato digestivo', 'aparato digestivo'), v('Comer sano: las proteínas', 'proteinas alimentacion saludable')] },
  ] },
  eng: { english: true, units: [
    { t: 'Colors', ch: [v('Los colores en inglés', 'aprendemos ingles colores'), v('Los colores de las frutas', 'colores frutas ingles'), l('Vocabulario: colores', 'colores en inglés')] },
    { t: 'Numbers', ch: [v('Contar en inglés', 'ingles numeros'), v('Escribir los números', 'numeros ingles escribir'), l('Vocabulario: números', 'números en inglés')] },
    { t: 'Animals', ch: [v('Animales de Yellowstone', 'aprende ingles animales yellowstone'), v('Animales de la sabana', 'aprende ingles sabana'), l('Vocabulario: animales', 'animales en inglés')] },
    { t: 'Family', ch: [v('La familia en inglés', 'ingles familia cuento'), v('El árbol genealógico', 'familia ingles arbol genealogico'), l('Vocabulario: la familia', 'la familia en inglés vocabulario')] },
    { t: 'Food', ch: [v('Las verduras', 'verdura ingles'), v('Las frutas', 'fruta ingles vocabulario'), l('Vocabulario: comida', 'comida en inglés vocabulario')] },
    { t: 'My body', ch: [v('El cuerpo humano en inglés', 'ingles cuerpo'), l('Partes del cuerpo', 'partes del cuerpo en inglés'), v('El aparato circulatorio en inglés', 'aprende ingles aparato circulatorio')] },
    { t: 'Clothes', ch: [v('Ropa de invierno', 'ropa invierno ingles'), v('Ropa de verano', 'ropa verano ingles'), l('Vocabulario: la ropa', 'ropa en inglés')] },
    { t: 'Days and months', ch: [v('Los días de la semana', 'ingles dias semana'), v('Los meses del año', 'ingles meses'), l('Vocabulario: días y meses', 'meses del año en inglés')] },
  ] },
}

/* ---------- resolución ---------- */
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }
const EN_INGLES = /\b(en ingl[eé]s|in english)\b/i

/* Video: preferimos 1–20 min (sin shorts ni recopilaciones eternas), sin repetir dentro del curso
   y, salvo en el curso de inglés, sin la versión "EN INGLÉS" del mismo video. */
function pickVideo(q: string, used: Set<string>, english: boolean): CatalogVideo | null {
  const hits = searchVideos(q, 12).filter(h => !used.has(h.videoId) && (english || !EN_INGLES.test(h.title)))
  return hits.find(h => h.duration >= 60 && h.duration <= 1200) ?? hits[0] ?? null
}

/* Solo artículos: fuera fichas de archivo/categorías/páginas especiales de Wikipedia, PDFs y portadas. */
function isArticleUrl(u: string): boolean {
  try {
    const x = new URL(u)
    if (/\.(pdf|png|jpe?g|svg|gif)$/i.test(x.pathname)) return false
    if (/juegos?[-_/]|\/quiz|[-_/]test[-_/]|desambiguaci/i.test(decodeURIComponent(x.pathname))) return false // juegos, cuestionarios y desambiguaciones no son lecturas
    if (/wikipedia\.org$/.test(x.hostname)) {
      const t = decodeURIComponent(x.pathname.split('/wiki/')[1] ?? '')
      return !!t && !/^(Archivo|File|Categoría|Category|Especial|Special|Anexo|Plantilla|Template|Portal|Wikipedia|Ayuda|Help|Usuario|User|Discusión|Talk):/i.test(t)
    }
    return x.pathname.length > 1
  } catch { return false }
}

/* ¿El texto está en español? Cuenta palabras funcionales frecuentes de cada idioma. */
const ES = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'que', 'y', 'en', 'un', 'una', 'es', 'por', 'con', 'para', 'su', 'se', 'como', 'más', 'son'])
const EN = new Set(['the', 'of', 'and', 'to', 'in', 'is', 'that', 'it', 'for', 'with', 'as', 'are', 'on', 'this', 'by', 'be', 'from', 'or', 'an', 'was'])
function isSpanish(html: string): boolean {
  const words = html.replace(/<[^>]+>/g, ' ').toLowerCase().split(/[^a-záéíóúñü]+/).slice(0, 1500)
  let es = 0, en = 0
  for (const w of words) { if (ES.has(w)) es++; else if (EN.has(w)) en++ }
  return es > en
}

/* Lectura: probamos los resultados de los sitios aprobados hasta que uno se pueda leer Y el juez lo apruebe
   (y, fuera del curso de inglés, que esté en español). */
async function pickReading(q: string, used: Set<string>, english: boolean): Promise<{ url: string; title: string } | null> {
  const { results } = await searchPages(q, { maxBatches: 2, limit: 6 })
  for (const r of results.filter(r => !used.has(r.link) && isArticleUrl(r.link)).slice(0, 4)) {
    const a = await getArticle(r.link)
    if (a.status === 'ok' && (english || isSpanish(a.article.html))) return { url: r.link, title: a.article.title }
  }
  return null
}

async function resolveChapter(c: ChapterSpec, used: Set<string>, english: boolean): Promise<Chapter | null> {
  const tryVideo = (): Chapter | null => {
    const hit = pickVideo(c.q, used, english)
    if (!hit) return null
    used.add(hit.videoId)
    return { title: c.t, kind: 'video', label: `Video${hit.duration ? ' · ' + mmss(hit.duration) : ''}`, source: toVideoResult(hit).channel, target: { type: 'video', id: hit.videoId } }
  }
  const tryReading = async (): Promise<Chapter | null> => {
    const r = await pickReading(c.q, used, english)
    if (!r) return null
    used.add(r.url)
    return { title: c.t, kind: 'lectura', label: 'Lectura', source: host(r.url), target: { type: 'article', url: r.url } }
  }
  // Si el tipo pedido no tiene un contenido apto, se prueba el otro; si ninguno, el capítulo no se muestra.
  return c.k === 'video' ? tryVideo() ?? (await tryReading()) : (await tryReading()) ?? tryVideo()
}

async function resolveSyllabus(id: string, units: UnitSpec[], english: boolean): Promise<ResolvedCourse> {
  const used = new Set<string>()
  const out: ResolvedCourse = { id, units: [] }
  for (const u of units) { // en orden: los "used" evitan repetir contenidos entre capítulos
    const chapters: Chapter[] = []
    for (const c of u.ch) {
      if (matchBlockedWord(`${c.t} ${c.q}`) !== null) continue
      const ch = await resolveChapter(c, used, english).catch(() => null)
      if (ch) chapters.push(ch)
    }
    if (chapters.length) out.units.push({ title: u.t, chapters })
  }
  return out
}

/* ---------- temario de cursos generados (desde un tema) ---------- */
async function generateSyllabus(topic: string): Promise<UnitSpec[]> {
  const prompt = `Armá el temario de un curso corto para chicos de 9 a 12 años sobre: «${topic}».
4 unidades, 3 capítulos cada una, en español rioplatense, títulos cortos y concretos.
Cada capítulo es UN contenido: "video" o "lectura" (mezclá los dos tipos) y trae "q": una búsqueda corta (2 a 5 palabras, en español) para encontrar ese contenido.
Respondé SOLO JSON: {"unidades":[{"titulo":string,"capitulos":[{"titulo":string,"tipo":"video"|"lectura","q":string}]}]}`
  const { text } = await complete({ model: MODELS.principal, messages: [{ role: 'user', content: prompt }], maxTokens: 1800 })
  const j = parseJudgeJson<{ unidades: { titulo: string; capitulos: { titulo: string; tipo: string; q: string }[] }[] }>(text)
  return (j.unidades ?? []).slice(0, 6).map(u => ({
    t: u.titulo,
    ch: (u.capitulos ?? []).slice(0, 4).map(c => ({ t: c.titulo, k: c.tipo === 'video' ? 'video' as const : 'lectura' as const, q: c.q || c.titulo })),
  }))
}

/* ---------- cache + API ---------- */
const CACHE_DIR = join(SERVER_ROOT, 'data', 'cache', 'courses')
mkdirSync(CACHE_DIR, { recursive: true })
const inflight = new Map<string, Promise<ResolvedCourse>>()

export function getCourse(id: string, name?: string): Promise<ResolvedCourse> {
  const spec = SYLLABI[id]
  const key = createHash('sha1').update(JSON.stringify({ id, name: spec ? '' : name ?? '', spec: spec ?? null, pv: config.policyVersion })).digest('hex').slice(0, 16)
  const file = join(CACHE_DIR, `${id.replace(/[^\w-]/g, '_')}-${key}.json`)
  if (existsSync(file)) return Promise.resolve(JSON.parse(readFileSync(file, 'utf8')))
  if (inflight.has(file)) return inflight.get(file)!
  const p = (async () => {
    const t0 = Date.now()
    const units = spec ? spec.units : await generateSyllabus(name || id)
    const course = await resolveSyllabus(id, units, !!spec?.english)
    writeFileSync(file, JSON.stringify(course))
    console.log(`[learn] curso «${id}» resuelto: ${course.units.length} unidades, ${course.units.reduce((n, u) => n + u.chapters.length, 0)} capítulos (${Date.now() - t0} ms)`)
    return course
  })().finally(() => inflight.delete(file))
  inflight.set(file, p)
  return p
}

/* Precalienta los cursos fijos en segundo plano (la primera resolución usa Serper + juez). */
export async function prewarmCourses(): Promise<void> {
  for (const id of Object.keys(SYLLABI)) await getCourse(id).catch(e => console.warn(`[learn] ${id}:`, String(e).slice(0, 120)))
}
