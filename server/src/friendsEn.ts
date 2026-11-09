// i18n (pedido 9-nov: «Todos los mensajes también»): lo que «escriben» los amigos fake y el perfil de cada NPC, en inglés,
// resuelto AL SERVIR. friendsFake guarda en su estado (RAM) SIEMPRE el castellano —hilos sembrados, saludos, "¡gracias!"
// plantillados, frases de tope de costo— y acá se traduce lo que sale por la API cuando el pedido es en inglés: frases
// fijas por tabla exacta y plantillas ({kid}, {el}, {lo}, {puesto}) por patrón, reconstruyendo el inglés con los mismos
// datos. Lo que no está en la tabla (lo que tipeó el usuario real, o una respuesta del modelo, que ya se generó en el
// idioma del pedido) sale tal cual. Los nicks no se tocan. Nombres de ligas: universo fake, quedan.
import { requestLang } from './requestContext'

const en = () => requestLang() === 'en'

/** Frases sin datos (hilos y solicitudes sembrados, frases del tope de costo, regalo sin nombrar la prenda). */
const EXACT = new Map<string, string>([
  // GRAPH_SEEDS: solicitudes (nota + saludo al aceptar)
  ['Hola. Hacemos el mismo curso de Álgebra y yo armo robots con Arduino 🤖 ¿Te sumo a mis amigos?', 'Hi. We’re in the same Algebra course and I build robots with Arduino 🤖 Want to be friends?'],
  ['Gracias por aceptarme. ¿Vos también armás cosas o programás?', 'Thanks for accepting me. Do you build stuff or code too?'],
  ['Hola. Me gustan los problemas de lógica y el ajedrez ♟️ ¿Te sumo a mis amigos?', 'Hi. I like logic puzzles and chess ♟️ Want to be friends?'],
  ['Gracias por aceptarme. ¿Te animás a un problema de lógica?', 'Thanks for accepting me. Up for a logic puzzle?'],
  // GRAPH_SEEDS: hilos que ya estaban escritos
  ['Che, ¿viste el curso nuevo de paleontología?', 'Hey, did you see the new paleontology course?'],
  ['Ya terminé la primera unidad, está muy bueno.', 'I already finished the first unit, it’s really good.'],
  ['¿En qué unidad de El sistema solar vas?', 'Which unit of The solar system are you on?'],
  ['Llegué a 8 días de racha, no la pienso cortar.', 'I hit an 8-day streak, I’m not breaking it.'],
  ['¿Viste la Luna llena de anoche? 🌙 Me acordé de vos', 'Did you see the full Moon last night? 🌙 It made me think of you'],
  ['Anoche vi los anillos de Saturno con el telescopio. Una locura.', 'Last night I saw Saturn’s rings through the telescope. Wild.'],
  // CANNED (tope de costo)
  ['Dale, nos vemos en Aprender.', 'Cool, see you in Learn.'],
  ['¿Hacemos una carrera de XP?', 'Want to race for XP?'],
  ['Ahora estoy practicando, después te escribo.', 'I’m practicing right now, I’ll text you later.'],
  ['Me vuelvo al curso. Hablamos después.', 'Heading back to the course. Talk later.'],
  // GIFT_SAFE
  ['🎁 Te mandé un regalo.', '🎁 I sent you a gift.'],
])

/** Plantillas con datos: [castellano, inglés]. En inglés {lo} y {puesto} no hacen falta (concordancia del castellano). */
const TEMPLATES: [string, string][] = [
  // "¡gracias!" de cada NPC (Npc.thanks)
  ['Gracias, {kid}. Con {el} ya estoy listo para la carrera de esta semana en la liga 🚀', 'Thanks, {kid}. With {el} I’m ready for this week’s league race 🚀'],
  ['Gracias, {kid}. Me puse {el} y no me {lo} saco más 🌋', 'Thanks, {kid}. I put on {el} and I’m never taking it off 🌋'],
  ['Gracias, {kid}. Ya me puse {el}: queda mejor que cualquier fósil del museo 🦴', 'Thanks, {kid}. I’m already wearing {el}: looks better than any fossil in the museum 🦴'],
  ['Thank you, {kid}. Me encanta, ya {lo} tengo {puesto} ✨', 'Thank you, {kid}. I love it, I’m already wearing it ✨'],
  ['Golazo, {kid}. Gracias por {el}, ya {lo} tengo {puesto} ⚡', 'What a goal, {kid}. Thanks for {el}, I’m already wearing it ⚡'],
  ['Gracias, {kid}. Ya {lo} tengo {puesto}. ¿Cómo sabías justo qué regalarme? 🌙', 'Thanks, {kid}. I’m already wearing it. How did you know exactly what to get me? 🌙'],
  ['Gracias, {kid}. Ya {lo} tengo {puesto} en mi avatar: le queda mejor que a mi último robot 🤖', 'Thanks, {kid}. My avatar is already wearing it: looks better on it than on my last robot 🤖'],
  ['Gracias, {kid}. Me puse {el} para grabar el próximo beat 🎹', 'Thanks, {kid}. I put on {el} to record my next beat 🎹'],
  ['Gracias, {kid}. Con {el} me siento listo para un torneo ♟️', 'Thanks, {kid}. With {el} I feel ready for a tournament ♟️'],
  ['Gracias, {kid}. Me puse {el} y ya me dibujé así en el sketchbook 🎨', 'Thanks, {kid}. I put on {el} and already drew myself like this in my sketchbook 🎨'],
  ['Gracias, {kid}. Con {el} salgo a hacer avistaje re canchero 🦅', 'Thanks, {kid}. With {el} I’ll go birdwatching in style 🦅'],
  ['Gracias, {kid}. Me puse {el} para la observación de esta noche 🔭', 'Thanks, {kid}. I put on {el} for tonight’s stargazing 🔭'],
  ['Qué crack, {kid}. Gracias por {el}, ya {lo} tengo {puesto} ⚽', 'You’re the best, {kid}. Thanks for {el}, I’m already wearing it ⚽'],
  ['Gracias, {kid}. Me puse {el} para el próximo experimento 🧪', 'Thanks, {kid}. I put on {el} for my next experiment 🧪'],
  // saludos al aceptar una solicitud del activo (Npc.hello)
  ['Hola, {kid}. Qué bueno que me escribiste. ¿Vos también armás cosas o programás?', 'Hi, {kid}. Glad you messaged me. Do you build stuff or code too?'],
  ['Hola, {kid}. Qué bueno que me escribiste 🎹 ¿Vos escuchás música mientras estudiás?', 'Hi, {kid}. Glad you messaged me 🎹 Do you listen to music while you study?'],
  ['Hola, {kid}. Gracias por escribirme. ¿Jugás al ajedrez? ♟️', 'Hi, {kid}. Thanks for messaging me. Do you play chess? ♟️'],
  ['Hola, {kid}. Me alegra que me escribas. ¿Dibujás o hacés algo creativo? 🎨', 'Hi, {kid}. I’m glad you messaged me. Do you draw or make anything creative? 🎨'],
  ['Hola, {kid}. Gracias por escribirme. ¿Sabías que las aves descienden de los dinosaurios? 🦅', 'Hi, {kid}. Thanks for messaging me. Did you know birds descend from dinosaurs? 🦅'],
  ['Hola, {kid}. Qué bueno que me escribiste 🔭 ¿Viste la Luna anoche?', 'Hi, {kid}. Glad you messaged me 🔭 Did you see the Moon last night?'],
  ['Hola, {kid}. Gracias por escribirme. ¿Te gusta el fútbol? ⚽', 'Hi, {kid}. Thanks for messaging me. Do you like soccer? ⚽'],
  ['Hola, {kid}. Gracias por escribirme 🧪 ¿Alguna vez hiciste un experimento en tu casa?', 'Hi, {kid}. Thanks for messaging me 🧪 Have you ever done an experiment at home?'],
  // HELLO_DEFAULT / HELLO_SAFE, THANKS / THANKS_SAFE y el regalo del chico
  ['Hola, {kid}. Gracias por escribirme. ¿Qué estás practicando?', 'Hi, {kid}. Thanks for messaging me. What are you practicing?'],
  ['Hola, {kid}. Gracias por escribirme.', 'Hi, {kid}. Thanks for messaging me.'],
  ['Muchas gracias por {el}, {kid}. Ya {lo} tengo {puesto} 😄', 'Thanks so much for {el}, {kid}. I’m already wearing it 😄'],
  ['Qué buen regalo. Me puse {el} y me encanta. Gracias, {kid}.', 'What a great gift. I put on {el} and I love it. Thanks, {kid}.'],
  ['Muchas gracias por el regalo, {kid}.', 'Thanks so much for the gift, {kid}.'],
  ['🎁 Te regalé {el}.', '🎁 I gave you {el}.'],
]

/** Las prendas como las nombra market.theRopa ("la gorra") → en inglés. Espejo de market.ROPA (si se suma una prenda y no
 *  está acá, el texto cae a "the gift": nunca castellano a medias). */
export const GARMENT_EN: Record<string, string> = {
  'la gorra': 'the cap', 'la vincha deportiva': 'the sports headband', 'la bandana': 'the bandana',
  'los anteojos de sol': 'the sunglasses', 'los auriculares': 'the headphones', 'la corona': 'the crown',
}
export const garmentEn = (el: string) => GARMENT_EN[el.toLowerCase()] ?? 'the gift'

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Cada plantilla castellana como expresión (los huecos, capturados en orden) + su inglés. */
const COMPILED = TEMPLATES.map(([es, enTpl]) => {
  const keys: string[] = []
  const src = es.split(/(\{(?:kid|el|lo|puesto)\})/).map(part => {
    const m = /^\{(kid|el|lo|puesto)\}$/.exec(part)
    if (!m) return esc(part)
    keys.push(m[1])
    return m[1] === 'kid' || m[1] === 'el' ? '(.+?)' : '(\\S+)'
  }).join('')
  return { re: new RegExp(`^${src}$`), keys, en: enTpl }
})

/** Un texto de un hilo (o una nota de solicitud) en el idioma del pedido. */
export function dmText(text: string): string {
  if (!en()) return text
  const hit = EXACT.get(text)
  if (hit !== undefined) return hit
  for (const t of COMPILED) {
    const m = t.re.exec(text)
    if (!m) continue
    const v: Record<string, string> = {}
    t.keys.forEach((k, i) => { v[k] = m[i + 1] })
    return t.en.replace(/\{(kid|el)\}/g, (_, k: 'kid' | 'el') => (k === 'el' ? garmentEn(v.el ?? '') : v.kid ?? ''))
  }
  return text
}

/* ---------- el perfil del NPC (status, racha, desde cuándo, cursos) ---------- */
const COURSE_EN: Record<string, string> = {
  'El sistema solar': 'The solar system', Paleontología: 'Paleontology', 'Biología marina': 'Marine biology', Álgebra: 'Algebra',
  'Inglés intermedio': 'Intermediate English', Anatomía: 'Anatomy', Geología: 'Geology',
}
const course = (c: string) => COURSE_EN[c] ?? c
const MONTH_EN: Record<string, string> = {
  enero: 'January', febrero: 'February', marzo: 'March', abril: 'April', mayo: 'May', junio: 'June', julio: 'July',
  agosto: 'August', septiembre: 'September', setiembre: 'September', octubre: 'October', noviembre: 'November', diciembre: 'December',
}
export function statusEn(s: string): string {
  if (!en()) return s
  let m = /^Practicando: (.+)$/.exec(s)
  if (m) return `Practicing: ${course(m[1])}`
  m = /^Racha de (\d+) días?$/.exec(s)
  if (m) return `${m[1]}-day streak`
  m = /^Terminó la unidad (\d+) de (.+)$/.exec(s)
  if (m) return `Finished unit ${m[1]} of ${course(m[2])}`
  return s
}
export const streakEn = (s: string) => { const m = en() ? /^(\d+) días?$/.exec(s) : null; return m ? `${m[1]} ${m[1] === '1' ? 'day' : 'days'}` : s }
export const monthEn = (s: string) => (en() ? MONTH_EN[s.toLowerCase()] ?? s : s)
export const coursesEn = (cs: string[]) => (en() ? cs.map(course) : cs)
