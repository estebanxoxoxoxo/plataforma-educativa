// Repasar (nombre interno: Active Recall) — visión audio 17: "la plataforma va contabilizando la capacidad que
// está teniendo en cada uno de los facts y arma sesiones: todos los días le propone una sesión aparte que combina
// todo lo que todavía necesita mejorar, presentando cartas para practicar lo que tiene flojo".
//
// LEDGER POR FACT en RAM (regla 9 de AGENTS). Un fact = un ejercicio REAL de Practicar (con su cita textual del
// material: regla de oro) + su fuerza 0-100. Se alimenta de dos lados:
//   · seed demo: 24 ejercicios copiados TAL CUAL de la caché de Practicar (server/data/cache/practice/*.json) de
//     5 cursos, con fuerzas repartidas (10 flojas, 8 mejorando, 6 firmes) y vistos hace 1-9 días;
//   · en vivo: practice.ts llama recordResult() con CADA respuesta corregida (acierte o no) → upsert por
//     (curso, clave del ejercicio). Así lo que el chico practica ahora entra a Repasar al instante.
// Niveles: < 40 floja · 40-79 mejorando · ≥ 80 firme. Acierto +25, error −20 (siempre entre 0 y 100).
//
// Contrato HTTP (formas exactas en src/api/types.ts, CONGELADO):
//   GET  /api/recall/summary                        → RecallSummary
//   POST /api/recall/session {extra?}               → RecallSession: las cartas que FALTAN responder + total
//   POST /api/recall/answer  {sessionId,cardId,answer} → RecallAnswerResult (corrección + cita + fuerza)
//   POST /api/recall/finish  {sessionId}            → RecallFinish
// Reglas:
//   · La sesión del día es UNA: hasta 10 cartas, lo más flojo primero, intercalando cursos (máx. 4 por curso).
//     Si ya existe se devuelve la misma, con las cartas que faltan (el chico retoma donde dejó).
//   · {extra:true} con la de hoy hecha → otra sesión con lo que sigue (primero lo que hoy no salió). Sin XP.
//   · Corrección server-side con grade() de Practicar: vf/mc contra la clave; abiertas con el modelo y, si no
//     responde, palabras clave (fail-closed). La fuerza se mueve con la PRIMERA respuesta de cada carta.
//   · XP real: +5 la primera vez que se acierta una carta de la sesión del día (progress.addXp). Las extra no suman.
//   · Al responder la última carta la sesión queda terminada (la de hoy pasa a 'hecha' y suma racha), aunque el
//     chico cierre antes del resumen; /finish devuelve ese resumen (idempotente).
// resetRecall() está registrado en POST /api/demo/reset (index.ts): cada carga de página vuelve al seed.
//
// Ciclo de imports: practice.ts importa este módulo (recordResult) y este importa grade() de practice.ts. Es
// seguro porque acá NADA de practice se usa al cargar el módulo (el seed solo usa el TIPO GenEx).
import type { IncomingMessage, ServerResponse } from 'node:http'
import { grade, type Answer, type GenEx } from './practice'
import { addXp } from './progress'
import { readJson, send } from './web'

type Kind = GenEx['type']
type Level = 'floja' | 'mejorando' | 'firme'

/* ---------- constantes ---------- */
const SESSION_SIZE = 10
const PER_COURSE = 4
const UP = 25
const DOWN = 20
const XP_CARD = 5
/** Primera vez que un dato aparece en Practicar: arranca según cómo le fue. */
const START_OK = 65
const START_BAD = 25
/* Mismos tiempos y textos que la ficha de Practicar (practice.ts). */
const SECONDS: Record<Kind, number> = { vf: 20, mc: 30, open: 60 }
const HINT = 'Puede haber varias correctas, una sola o ninguna. Marcá todas las correctas.'
const PLACEHOLDER = 'Escribí tu respuesta con tus palabras…'

const levelOf = (s: number): Level => (s < 40 ? 'floja' : s < 80 ? 'mejorando' : 'firme')
const RANK: Record<Level, number> = { floja: 0, mejorando: 1, firme: 2 }
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))
const textOf = (e: GenEx) => (e.type === 'vf' ? e.statement ?? '' : e.question ?? '')
const short = (s: string, n = 60) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

/** Normalización de claves: la MISMA que normQ de practice.ts (sin tildes, minúsculas, solo [a-z0-9]). */
const normKey = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
/** Clave estable de un ejercicio: la misma que practice.ts manda en recordResult (exKey = normQ(exText(e))).
 *  Así, practicar un ejercicio que ya está en el seed mueve ESE fact en vez de duplicarlo. */
const keyOf = (e: GenEx) => normKey(e.type === 'vf' ? `Verdadero o falso: ${e.statement}` : e.type === 'mc' ? `${e.question} Opciones: ${(e.options ?? []).join(' / ')}` : `${e.question}`)

/* Días en hora local, como progress.ts. */
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = () => dayKey(new Date())
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d) }

/* ---------- modelo ---------- */
interface Fact {
  id: number
  courseId: string; courseName: string
  /** Nº de unidad (1..n) dentro del recorrido del curso */ unit: number
  key: string; kind: Kind
  /** Afirmación (vf) o pregunta (mc/abierta) */ text: string
  /** Cita textual del material (regla de oro) */ evidence: string
  /** El ejercicio completo, para volver a mostrarlo como carta y corregirlo (null = no se puede armar carta) */
  ex: GenEx | null
  strength: number; lastSeen: number; seen: number
}
interface Card {
  id: number; factId: number; pos: number
  /** La PRIMERA respuesta es la que mueve la fuerza */ answered: boolean; correct: boolean
  before: number; after: number
  /** XP pagada por esta carta (solo en la sesión del día, una vez) */ xp: number
}
interface Session { id: number; day: string; extra: boolean; cards: Card[]; done: boolean; at: number }
interface Store {
  seq: number
  facts: Map<number, Fact>
  byKey: Map<string, number>
  sessions: Map<number, Session>
  /** La sesión del día */ day: string; dailyId: number | null; dailyDone: boolean
  /** Racha de repaso: días seguidos con la sesión del día terminada */ streakDays: number; lastDay: string
  /** Correcciones en vuelo por carta (un doble envío espera la misma respuesta) */ grading: Map<string, Promise<unknown>>
}

/* ---------- seed demo: ejercicios REALES de la caché de Practicar (copiados tal cual, con su cita) ---------- */
const COURSE_NAMES: Record<string, string> = {
  solar: 'El sistema solar', ocean: 'Animales del océano', body: 'Mi cuerpo', eng: 'Inglés inicial', frac: 'Fracciones',
}
interface SeedRow { course: string; unit: number; strength: number; daysAgo: number; seen: number; ex: GenEx }
const SEED: SeedRow[] = [
  /* ---- flojas (10): la sesión de hoy ---- */
  { course: 'body', unit: 4, strength: 15, daysAgo: 6, seen: 3, ex: { type: 'vf', statement: 'La epiglotis deja pasar la comida a la laringe y a la tráquea al tragar.', answer: false, okText: 'La epiglotis impide que los alimentos entren en la laringe y en la tráquea.', badText: 'Es falso: la epiglotis impide que los alimentos entren en la laringe y en la tráquea.', evidence: 'Epiglotis: es una tapa que impide que los alimentos entren en la laringe y en la tráquea al tragar.', source: 3 } },
  { course: 'eng', unit: 4, strength: 18, daysAgo: 4, seen: 2, ex: { type: 'mc', question: "¿Cómo se dice 'codo' en inglés?", options: ['Elbow', 'Knee', 'Wrist', 'Shoulder'], correct: ['Elbow'], okText: 'Marcaste Elbow: así se dice codo.', badText: 'La correcta era Elbow.', evidence: 'Codo | Elbow', source: 2 } },
  { course: 'ocean', unit: 2, strength: 20, daysAgo: 5, seen: 3, ex: { type: 'vf', statement: 'Las ballenas dentadas tienen barbas en vez de dientes.', answer: false, okText: 'Las ballenas dentadas sí tienen dientes.', badText: 'Es falso: las ballenas dentadas tienen dientes.', evidence: 'La principal característica de las ballenas dentadas, es que evidentemente tienen dientes, mientras que las con barbas no los tienen.', source: 2 } },
  { course: 'solar', unit: 1, strength: 22, daysAgo: 3, seen: 2, ex: { type: 'mc', question: '¿Qué aprovecha la energía solar?', options: ['La luz del Sol', 'El calor del Sol', 'La lluvia', 'El viento'], correct: ['La luz del Sol', 'El calor del Sol'], okText: 'Marcaste las correctas: la luz y el calor del Sol.', badText: 'Las correctas eran La luz del Sol y El calor del Sol.', evidence: 'Hoy en día, el calor y la luz del Sol pueden aprovecharse por medio de diversos captadores como células fotoeléctricas.', source: 3 } },
  { course: 'frac', unit: 7, strength: 24, daysAgo: 7, seen: 2, ex: { type: 'vf', statement: 'En una fracción propia, el numerador es mayor que el denominador.', answer: false, okText: 'En una fracción propia, arriba es menor que abajo.', badText: 'Es falso: en una fracción propia, el numerador es menor que el denominador.', evidence: 'Fracciones propias: | El numerador es menor que el denominador', source: 2 } },
  { course: 'body', unit: 4, strength: 26, daysAgo: 6, seen: 2, ex: { type: 'mc', question: '¿Qué hace la vía nasal con el aire?', options: ['Lo humedece', 'Lo filtra', 'Lo calienta', 'Lo convierte en comida'], correct: ['Lo humedece', 'Lo filtra', 'Lo calienta'], okText: 'Elegiste tres cosas que hace la vía nasal con el aire.', badText: 'Las correctas eran Lo humedece, Lo filtra y Lo calienta.', evidence: 'Vía Nasal: Consiste en dos amplias cavidades cuya función es permitir la entrada del aire, el cual se humedece, filtra y calienta a una determinada temperatura a través de unas estructuras llamadas pituitarias.', source: 3 } },
  { course: 'solar', unit: 5, strength: 30, daysAgo: 4, seen: 2, ex: { type: 'vf', statement: 'La cola del cometa se forma cuando se acerca a la Luna.', answer: false, okText: 'Es falso: la cola se forma cuando el cometa se acerca al Sol.', badText: 'Es falso: la cola se forma cuando el cometa se acerca al Sol.', evidence: 'Una característica de los cometas es su cola visible, compuesta por una estela formada por los gases que se producen cuando el cometa se acerca al Sol.', source: 1 } },
  { course: 'body', unit: 5, strength: 32, daysAgo: 5, seen: 2, ex: { type: 'vf', statement: 'El tubo digestivo termina en la boca.', answer: false, okText: 'El tubo digestivo termina en el ano.', badText: 'Es falso: el tubo digestivo termina en el ano.', evidence: 'El tubo digestivo mide aproximadamente 11 metros de longitud, se inicia en la cavidad bucal y termina en el ano.', source: 2 } },
  { course: 'ocean', unit: 2, strength: 33, daysAgo: 5, seen: 2, ex: { type: 'open', question: '¿Para qué les sirve el grosor de grasa bajo la piel?', rubric: 'Que diga que ayuda a mantener constante la temperatura corporal.', keywords: ['grasa', 'piel', 'temperatura', 'corporal'], okText: 'Explicaste que esa grasa ayuda a mantener la temperatura del cuerpo.', badText: 'Pensá en el calor del cuerpo y en cómo lo conserva la ballena.', evidence: 'El grosor y la acumulación de grasa bajo la piel de las ballenas, les ayuda a mantener constante su temperatura corporal,', source: 2 } },
  { course: 'solar', unit: 4, strength: 35, daysAgo: 3, seen: 3, ex: { type: 'vf', statement: 'La Vía Láctea es un planeta del sistema solar.', answer: false, okText: 'La Vía Láctea no es un planeta: es una galaxia.', badText: 'Es falso: la Vía Láctea es una galaxia espiral barrada.', evidence: 'La Vía Láctea (...) es una galaxia espiral barrada donde se encuentra el sistema solar y a su vez la Tierra.', source: 3 } },
  /* ---- mejorando (8) ---- */
  { course: 'frac', unit: 2, strength: 44, daysAgo: 8, seen: 3, ex: { type: 'open', question: '¿Qué significa simplificar una fracción?', rubric: 'Que diga que es hacer una fracción equivalente con números menores en numerador y denominador.', keywords: ['fracción equivalente', 'números menores', 'numerador', 'denominador'], okText: 'Explicaste que queda una fracción equivalente con números más chicos.', badText: 'Pensá en una fracción equivalente con números menores.', evidence: 'La simplificación de fracciones consiste en conseguir una fracción equivalente a la que nos han dado pero con números menores a los que tiene la fracción inicial en el numerador y en el denominador.', source: 3 } },
  { course: 'body', unit: 5, strength: 45, daysAgo: 5, seen: 4, ex: { type: 'vf', statement: 'El estómago convierte el alimento en quimo.', answer: true, okText: 'En el estómago, el alimento se agita hasta convertirse en quimo.', badText: 'Es verdadero: en el estómago el alimento se convierte en quimo.', evidence: 'En el estómago el alimento es agitado hasta convertirse en el quimo.', source: 2 } },
  { course: 'solar', unit: 5, strength: 48, daysAgo: 4, seen: 3, ex: { type: 'vf', statement: 'El cinturón de asteroides está entre Marte y Júpiter.', answer: true, okText: 'Está ubicado entre las órbitas de Marte y Júpiter.', badText: 'Es verdadero: está entre Marte y Júpiter.', evidence: 'El cinturón de asteroides es un disco circunestelar del sistema solar que se encuentra entre las órbitas de Marte y Júpiter.', source: 2 } },
  { course: 'ocean', unit: 3, strength: 55, daysAgo: 6, seen: 4, ex: { type: 'mc', question: '¿Qué forma tiene el cuerpo de la raya?', options: ['Plano', 'Redondo', 'Alargado', 'Triangular'], correct: ['Plano'], okText: 'Elegiste plano: así es el cuerpo de la raya.', badText: 'La correcta era Plano.', evidence: 'Forma: Su cuerpo es plano y las aletas pectorales triangulares, muy desarrolladas y unidas a la cabeza.', source: 3 } },
  { course: 'eng', unit: 3, strength: 58, daysAgo: 2, seen: 4, ex: { type: 'mc', question: '¿Cómo se dice "abuela" en inglés?', options: ['Grandmother', 'Grandfather', 'Aunt', 'Cousin'], correct: ['Grandmother'], okText: '"Grandmother" es abuela.', badText: 'La correcta era "Grandmother".', evidence: 'Abuela | Grandmother', source: 3 } },
  { course: 'solar', unit: 5, strength: 62, daysAgo: 1, seen: 4, ex: { type: 'mc', question: '¿Qué pasa cuando la Tierra cruza la estela de un cometa?', options: ['Aumentan las estrellas fugaces', 'Baja la temperatura', 'Desaparecen los asteroides', 'Se apaga la Luna'], correct: ['Aumentan las estrellas fugaces'], okText: 'Aparecen muchas más estrellas fugaces.', badText: 'La correcta era Aumentan las estrellas fugaces.', evidence: 'En ciertas épocas del año, la Tierra cruza la estela de un cometa y, entonces, la cantidad de estrellas fugaces aumenta hasta quizás cien por hora.', source: 3 } },
  { course: 'frac', unit: 1, strength: 66, daysAgo: 9, seen: 5, ex: { type: 'mc', question: 'Si una pizza se divide en 4 partes iguales y tomás 1, ¿qué fracción se forma?', options: ['1/4', '1/3', '4/1', '2/4'], correct: ['1/4'], okText: '1/4 es un cuarto.', badText: 'La correcta era 1/4.', evidence: 'Por ejemplo: si una pizza se divide en 4 partes iguales y tomas 1, se forma la expresión 1/4 (un cuarto).', source: 2 } },
  { course: 'ocean', unit: 4, strength: 70, daysAgo: 3, seen: 5, ex: { type: 'vf', statement: 'Las estrellas de mar pueden regenerar brazos dañados o perdidos.', answer: true, okText: 'Muchas especies pueden volver a formar brazos dañados o perdidos.', badText: 'Es verdadero: muchas especies pueden regenerar brazos dañados o perdidos.', evidence: 'La mayoría tiene la capacidad de regenerar brazos dañados o perdidos.', source: 3 } },
  /* ---- firmes (6) ---- */
  { course: 'eng', unit: 4, strength: 82, daysAgo: 4, seen: 6, ex: { type: 'vf', statement: "'Arm' quiere decir 'pierna'.", answer: false, okText: "'Arm' quiere decir 'brazo'.", badText: "Es falso: 'Arm' quiere decir 'brazo'.", evidence: 'Brazo | Arm', source: 2 } },
  { course: 'frac', unit: 1, strength: 84, daysAgo: 9, seen: 6, ex: { type: 'vf', statement: 'El numerador va abajo.', answer: false, okText: 'El numerador va arriba, no abajo.', badText: 'Es falso: el numerador va arriba.', evidence: 'El número de arriba (numerador) indica cuántas partes se tomaron del total ya dividido.', source: 2 } },
  { course: 'ocean', unit: 3, strength: 86, daysAgo: 7, seen: 7, ex: { type: 'vf', statement: 'Los tiburones son peces cartilaginosos.', answer: true, okText: 'Son peces cartilaginosos, o sea, sin esqueleto óseo.', badText: 'Es verdadero: los tiburones son peces cartilaginosos.', evidence: 'Los tiburones son un conjunto de peces cartilaginosos (o sea, sin esqueleto óseo)', source: 2 } },
  { course: 'solar', unit: 1, strength: 88, daysAgo: 8, seen: 7, ex: { type: 'vf', statement: 'El Sol es una estrella de tamaño medio.', answer: true, okText: 'El Sol es una estrella de tamaño medio, no una estrella enorme.', badText: 'Es verdadero: el Sol es una estrella de tamaño medio.', evidence: 'Resulta que nuestro sol es una estrella de tamaño medio.', source: 1 } },
  { course: 'eng', unit: 4, strength: 88, daysAgo: 3, seen: 6, ex: { type: 'vf', statement: "'Nose' quiere decir 'nariz'.", answer: true, okText: 'Nose es nariz, una parte de la cabeza.', badText: "Es verdadero: 'Nose' quiere decir 'nariz'.", evidence: 'Nariz | Nose', source: 2 } },
  { course: 'eng', unit: 5, strength: 95, daysAgo: 5, seen: 8, ex: { type: 'mc', question: '¿Cómo se dice "diciembre" en inglés?', options: ['December', 'October', 'November', 'August'], correct: ['December'], okText: 'Elegiste "December", que es diciembre.', badText: 'La correcta era "December".', evidence: 'December | Diciembre', source: 3 } },
]

function addFact(st: Store, f: Omit<Fact, 'id'>): Fact {
  const fact: Fact = { id: st.seq++, ...f }
  st.facts.set(fact.id, fact)
  st.byKey.set(`${fact.courseId}|${fact.key}`, fact.id)
  return fact
}

/* Valores INICIALES del demo (a esto se vuelve con cada carga de página). */
function seed(): Store {
  const now = Date.now()
  const st: Store = {
    seq: 1, facts: new Map(), byKey: new Map(), sessions: new Map(),
    day: today(), dailyId: null, dailyDone: false,
    streakDays: 3, lastDay: yesterday(), // repasó ayer, anteayer y el día anterior: hoy la racha sigue viva
    grading: new Map(),
  }
  SEED.forEach((r, i) => addFact(st, {
    courseId: r.course, courseName: COURSE_NAMES[r.course], unit: r.unit, key: keyOf(r.ex), kind: r.ex.type,
    text: textOf(r.ex), evidence: r.ex.evidence, ex: r.ex, strength: r.strength,
    lastSeen: now - r.daysAgo * 864e5 - ((i * 47) % 300) * 6e4, // horas variadas dentro del día
    seen: r.seen,
  }))
  return st
}

let store: Store = seed()

/** Vuelve al seed (lo dispara POST /api/demo/reset en cada carga de página). */
export function resetRecall(): void { store = seed() }

/** Cambio de día con el server prendido: la sesión de hoy vuelve a estar disponible. */
function rollDay() {
  const d = today()
  if (store.day !== d) { store.day = d; store.dailyId = null; store.dailyDone = false }
}
/** Racha visible: si ayer no se repasó (y hoy todavía no), ya se cortó. */
const streakNow = () => (store.lastDay === today() || store.lastDay === yesterday() ? store.streakDays : 0)

/* ---------- ingesta en vivo desde Practicar ---------- */
/** Practicar avisa acá CADA respuesta corregida (acierte o no). Upsert por (curso, clave): si el dato es nuevo
 *  arranca en 65 (acertó) o 25 (no); si ya estaba, se le aplica el +25 / −20. Nunca tira: Practicar no se rompe. */
export function recordResult(r: {
  courseId: string; courseName: string
  /** Nº de unidad (1..n) dentro del recorrido */ unit: number
  /** Clave estable del ejercicio dentro del curso */ key: string
  kind: Kind
  /** Enunciado/pregunta y cita textual del material (regla de oro) */ text: string; evidence: string
  correct: boolean
  /** El ejercicio completo: con él Repasar lo vuelve a mostrar como carta */ ex?: GenEx
}): void {
  try {
    const courseId = String(r.courseId ?? '').trim().slice(0, 100)
    const key = normKey(String(r.key ?? ''))
    if (!courseId || !key) return
    const now = Date.now()
    const id = store.byKey.get(`${courseId}|${key}`)
    const f = id != null ? store.facts.get(id) : undefined
    if (f) {
      const before = f.strength
      f.strength = clamp(f.strength + (r.correct ? UP : -DOWN))
      f.lastSeen = now; f.seen++
      if (r.ex) f.ex = r.ex
      if (r.courseName) f.courseName = String(r.courseName).slice(0, 80)
      console.log(`[recall] Practicar «${courseId}» ${r.correct ? '✓' : '✗'} «${short(f.text)}» → ${levelOf(f.strength)} (${before}→${f.strength})`)
      return
    }
    const nf = addFact(store, {
      courseId, courseName: String(r.courseName || courseId).slice(0, 80), unit: Math.max(0, Math.round(Number(r.unit) || 0)),
      key, kind: r.kind, text: String(r.text ?? '').slice(0, 300), evidence: String(r.evidence ?? '').slice(0, 600),
      ex: r.ex ?? null, strength: r.correct ? START_OK : START_BAD, lastSeen: now, seen: 1,
    })
    console.log(`[recall] Practicar «${courseId}» ${r.correct ? '✓' : '✗'} dato nuevo «${short(nf.text)}» → ${levelOf(nf.strength)} (${nf.strength}) · ${store.facts.size} en el ledger`)
  } catch (e) {
    console.warn('[recall] recordResult:', String((e as Error)?.message ?? e).slice(0, 160))
  }
}

/* ---------- armado de sesiones ---------- */
const cardable = () => [...store.facts.values()].filter(f => f.ex)
/** Lo más flojo primero; a igual fuerza, lo que hace más que no se ve. */
const byNeed = (list: Fact[]) => [...list].sort((a, b) => a.strength - b.strength || a.lastSeen - b.lastSeen || a.id - b.id)

/** Toma hasta 10 de una lista ya priorizada con tope de 4 por curso (si no alcanza con otros cursos, se completa
 *  igual) y las intercala: cada carta, la más necesitada de un curso distinto al de la anterior. */
function pick(ranked: Fact[]): Fact[] {
  const out: Fact[] = []
  const per = new Map<string, number>()
  for (const f of ranked) {
    if (out.length >= SESSION_SIZE) break
    const n = per.get(f.courseId) ?? 0
    if (n >= PER_COURSE) continue
    out.push(f); per.set(f.courseId, n + 1)
  }
  for (const f of ranked) { if (out.length >= SESSION_SIZE) break; if (!out.includes(f)) out.push(f) }
  const rest = [...out], mixed: Fact[] = []
  while (rest.length) {
    const prev = mixed[mixed.length - 1]?.courseId
    const i = rest.findIndex(f => f.courseId !== prev)
    mixed.push(...rest.splice(i === -1 ? 0 : i, 1))
  }
  return mixed
}

/** La del día: todo lo que se puede repasar. Extra: primero lo que hoy no salió en ninguna sesión. */
function planFor(extra: boolean): Fact[] {
  const all = cardable()
  if (!extra) return pick(byNeed(all))
  const seenToday = new Set<number>()
  for (const s of store.sessions.values()) if (s.day === store.day) for (const c of s.cards) seenToday.add(c.factId)
  return pick([...byNeed(all.filter(f => !seenToday.has(f.id))), ...byNeed(all.filter(f => seenToday.has(f.id)))])
}

function createSession(extra: boolean): Session | null {
  const plan = planFor(extra)
  if (!plan.length) return null
  const s: Session = {
    id: store.seq++, day: store.day, extra, done: false, at: Date.now(),
    cards: plan.map((f, i) => ({ id: store.seq++, factId: f.id, pos: i + 1, answered: false, correct: false, before: f.strength, after: f.strength, xp: 0 })),
  }
  store.sessions.set(s.id, s)
  if (!extra) store.dailyId = s.id
  const courses = new Set(plan.map(f => f.courseId))
  console.log(`[recall] sesión #${s.id} (${extra ? 'extra, sin XP' : 'la de hoy'}): ${plan.length} cartas de ${courses.size} cursos · ${plan.map(f => `${f.courseId}:${f.strength}`).join(' ')}`)
  return s
}

/** La carta como la ve la UI: un ejercicio con la forma de Practicar (n = posición 1..total). */
function exerciseOf(e: GenEx, n: number, total: number) {
  const base = { n, progress: Math.round((n / total) * 100), seconds: SECONDS[e.type] }
  if (e.type === 'vf') return { ...base, type: 'vf' as const, statement: e.statement ?? '' }
  if (e.type === 'mc') return { ...base, type: 'mc' as const, question: e.question ?? '', hint: HINT, options: e.options ?? [] }
  return { ...base, type: 'open' as const, question: e.question ?? '', placeholder: PLACEHOLDER }
}
function sessionView(s: Session) {
  const cards = s.cards.filter(c => !c.answered).flatMap(c => {
    const f = store.facts.get(c.factId)
    return f?.ex ? [{ id: c.id, factId: f.id, course: { id: f.courseId, name: f.courseName }, ex: exerciseOf(f.ex, c.pos, s.cards.length) }] : []
  })
  return { id: s.id, cards, total: s.cards.length }
}

/** Nombres de curso sin repetir, en el orden en que aparecen. */
function coursesOf(factIds: number[]): string[] {
  const out: string[] = []
  for (const id of factIds) { const n = store.facts.get(id)?.courseName; if (n && !out.includes(n)) out.push(n) }
  return out
}

/** Cierra una sesión (idempotente). La del día pasa a 'hecha' y suma un día de racha. */
function finalize(s: Session) {
  if (s.done) return
  s.done = true
  if (!s.extra && s.id === store.dailyId && s.day === store.day) {
    store.dailyDone = true
    const t = today()
    if (store.lastDay !== t) { store.streakDays = store.lastDay === yesterday() ? store.streakDays + 1 : 1; store.lastDay = t }
  }
  const ok = s.cards.filter(c => c.correct).length
  console.log(`[recall] sesión #${s.id} terminada: ${ok}/${s.cards.length} bien · ${s.cards.filter(c => RANK[levelOf(c.after)] > RANK[levelOf(c.before)]).length} subieron de nivel · +${s.cards.reduce((a, c) => a + c.xp, 0)} XP${s.extra ? '' : ` · racha ${store.streakDays}`}`)
}

function finishOf(s: Session) {
  return {
    correct: s.cards.filter(c => c.correct).length,
    total: s.cards.length,
    improved: s.cards.filter(c => RANK[levelOf(c.after)] > RANK[levelOf(c.before)]).length,
    xpSession: s.cards.reduce((a, c) => a + c.xp, 0),
    facts: s.cards.flatMap(c => {
      const f = store.facts.get(c.factId)
      return f ? [{ id: f.id, statement: f.text, course: f.courseName, level: levelOf(c.after) }] : []
    }),
  }
}

/* ---------- resumen ---------- */
function todayOf(): { state: 'pendiente' | 'hecha' | 'sin-material'; cards: number; courses: string[] } {
  const daily = store.dailyId != null ? store.sessions.get(store.dailyId) : undefined
  if (daily && store.dailyDone) return { state: 'hecha', cards: daily.cards.length, courses: coursesOf(daily.cards.map(c => c.factId)) }
  if (daily) {
    const left = daily.cards.filter(c => !c.answered)
    return { state: 'pendiente', cards: left.length, courses: coursesOf(left.map(c => c.factId)) }
  }
  const plan = planFor(false)
  if (!plan.length) return { state: 'sin-material', cards: 0, courses: [] }
  return { state: 'pendiente', cards: plan.length, courses: coursesOf(plan.map(f => f.id)) }
}

function summaryOf() {
  rollDay()
  const all = [...store.facts.values()]
  const count = (l: Level) => all.filter(f => levelOf(f.strength) === l).length
  const groups = new Map<string, Fact[]>()
  for (const f of all) groups.set(f.courseId, [...(groups.get(f.courseId) ?? []), f])
  const perCourse = [...groups.entries()]
    .map(([courseId, fs]) => ({
      courseId, name: fs[0].courseName,
      weak: fs.filter(f => levelOf(f.strength) !== 'firme').length, total: fs.length,
      avg: Math.round(fs.reduce((a, f) => a + f.strength, 0) / fs.length),
    }))
    .sort((a, b) => a.avg - b.avg || b.weak - a.weak || a.name.localeCompare(b.name, 'es'))
  return { today: todayOf(), weak: count('floja'), improving: count('mejorando'), firm: count('firme'), total: all.length, perCourse, streakDays: streakNow() }
}

/* ---------- corrección ---------- */
function parseAnswer(a: unknown): Answer | null {
  if (!a || typeof a !== 'object') return null
  const x = a as Record<string, unknown>
  if (x.kind === 'timeout') return { kind: 'timeout' }
  if (x.kind === 'vf' && typeof x.value === 'boolean') return { kind: 'vf', value: x.value }
  if (x.kind === 'mc' && Array.isArray(x.selected)) return { kind: 'mc', selected: x.selected.filter((s): s is string => typeof s === 'string').slice(0, 10) }
  if (x.kind === 'open' && typeof x.text === 'string') return { kind: 'open', text: x.text.slice(0, 2000) }
  return null
}

async function answerCard(st: Store, s: Session, c: Card, f: Fact & { ex: GenEx }, a: Answer) {
  const r = await grade(f.ex, a)
  // Si hubo un reset mientras corregía (otra carga de página), esta sesión ya no existe: sin efectos.
  if (st !== store) return { ...r, cite: f.evidence, fact: { id: f.id, level: levelOf(f.strength), strength: f.strength, delta: 0 } }
  let delta = 0
  if (!c.answered) {
    c.answered = true; c.correct = r.correct; c.before = f.strength
    f.strength = clamp(f.strength + (r.correct ? UP : -DOWN)); f.lastSeen = Date.now(); f.seen++
    c.after = f.strength; delta = c.after - c.before
  }
  // Premio REAL: solo en la sesión del día y solo la primera vez que esta carta se acierta.
  if (r.correct && !s.extra && s.day === store.day && c.xp === 0) {
    const p = addXp(XP_CARD, `Repaso · «${f.courseName}»`)
    c.xp = p.xp
    Object.assign(r, { xp: p.xp, xpWeek: p.xpWeek, ec: p.ec })
  }
  console.log(`[recall] sesión #${s.id} carta ${c.pos}/${s.cards.length} «${short(f.text)}» ${r.correct ? '✓' : '✗'} → ${levelOf(f.strength)} (${f.strength}${delta ? `, ${delta > 0 ? '+' : ''}${delta}` : ''})${c.xp && r.correct ? ` +${c.xp} XP` : ''}`)
  if (!s.done && s.cards.every(x => x.answered)) finalize(s)
  return { ...r, cite: f.evidence, fact: { id: f.id, level: levelOf(f.strength), strength: f.strength, delta } }
}

/* ---------- rutas ---------- */
async function body(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  try {
    const b = await readJson<unknown>(req)
    return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : null
  } catch { return null }
}
const intOf = (x: unknown) => (typeof x === 'number' && Number.isInteger(x) && x > 0 ? x : null)

export async function recallRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const path = url.pathname
  if (path === '/api/recall/summary') {
    if (req.method !== 'GET') return send(res, 405, { error: 'method' })
    return send(res, 200, summaryOf())
  }
  if (path !== '/api/recall/session' && path !== '/api/recall/answer' && path !== '/api/recall/finish') return send(res, 404, { error: 'not found' })
  if (req.method !== 'POST') return send(res, 405, { error: 'method' })
  const b = await body(req)
  if (!b) return send(res, 400, { error: 'JSON inválido' })
  rollDay()

  if (path === '/api/recall/session') {
    if (b.extra !== undefined && typeof b.extra !== 'boolean') return send(res, 400, { error: 'extra inválido' })
    const daily = store.dailyId != null ? store.sessions.get(store.dailyId) : undefined
    let s: Session | null | undefined
    if (b.extra !== true || !store.dailyDone) {
      // La del día es UNA: si ya existe se devuelve la misma (hecha = sin cartas pendientes; la UI muestra el resumen).
      s = daily ?? createSession(false)
    } else {
      // Extra: si hay una de hoy sin terminar se retoma; si no, una nueva con lo que sigue.
      s = [...store.sessions.values()].reverse().find(x => x.day === store.day && x.extra && !x.done) ?? createSession(true)
    }
    if (!s) return send(res, 409, { error: 'Todavía no hay cartas para repasar: practicá un poco y volvé.' })
    return send(res, 200, sessionView(s))
  }

  const sessionId = intOf(b.sessionId)
  if (sessionId === null) return send(res, 400, { error: 'sessionId inválido' })
  const st = store
  const s = st.sessions.get(sessionId)

  if (path === '/api/recall/answer') {
    const cardId = intOf(b.cardId)
    if (cardId === null) return send(res, 400, { error: 'cardId inválido' })
    const a = parseAnswer(b.answer)
    if (!a) return send(res, 400, { error: 'respuesta inválida' })
    if (!s) return send(res, 404, { error: 'Sesión no encontrada' })
    const c = s.cards.find(x => x.id === cardId)
    const f = c ? st.facts.get(c.factId) : undefined
    if (!c || !f || !f.ex) return send(res, 404, { error: 'Carta no encontrada' })
    // Doble envío de la misma carta mientras se corrige: espera y devuelve la MISMA corrección.
    const k = `${s.id}:${c.id}`
    const inflight = st.grading.get(k)
    if (inflight) return send(res, 200, await inflight)
    const p = answerCard(st, s, c, f as Fact & { ex: GenEx }, a)
    st.grading.set(k, p)
    try { return send(res, 200, await p) } finally { st.grading.delete(k) }
  }

  // finish
  if (!s) return send(res, 404, { error: 'Sesión no encontrada' })
  if (!s.cards.every(c => c.answered)) return send(res, 409, { error: 'Todavía quedan cartas por responder' })
  finalize(s)
  return send(res, 200, finishOf(s))
}
