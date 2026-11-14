// i18n (regla del dueño, 10-nov: TODO lo visible en inglés se traduce, también los premios del padre). Los premios viven
// en castellano en server/data/parent.json (y en la RAM: canjes, premio de la liga de la familia, movimientos de la billetera)
// y se traducen AL SERVIR, por el título castellano EXACTO de los premios sembrados. Un premio que el padre tipeó de verdad
// (o una descripción propia) no está en la tabla y sale tal cual lo escribió. Nunca se guarda inglés.
import { requestLang } from './requestContext'

const PRIZE_EN: Record<string, { title: string; desc: string; descEs: string }> = {
  '1 hora extra de juego el sábado': { descEs: 'Una hora más de tu juego, el sábado, con las tareas hechas.', title: '1 extra hour of gaming on Saturday', desc: 'One more hour of your game, on Saturday, with your homework done.' },
  'Elegís la película del viernes': { descEs: 'Noche de peli en familia: esta vez la elección es tuya.', title: 'You pick Friday’s movie', desc: 'Family movie night: this time the choice is yours.' },
  'Salida a escalar': { descEs: 'Una tarde en el muro de escalada, con el equipo alquilado.', title: 'Climbing trip', desc: 'An afternoon at the climbing wall, gear rental included.' },
  'Pizza a elección': { descEs: 'La noche de pizza la elegís vos: gustos y lugar.', title: 'Pizza your way', desc: 'You choose pizza night: toppings and place.' },
  'Un libro nuevo que elijas': { descEs: 'Vamos a la librería y te llevás el que quieras.', title: 'A new book of your choice', desc: 'We go to the bookstore and you take home the one you want.' },
  '1 hora más despierto el sábado': { descEs: 'Te acostás una hora más tarde un viernes o un sábado.', title: 'Stay up 1 hour later on Saturday', desc: 'You go to bed one hour later on a Friday or a Saturday.' },
  'Un día sin lavar los platos': { descEs: 'Por un día, los platos los lava otro.', title: 'A day off dish duty', desc: 'For one day, someone else does the dishes.' },
  'Entradas para un recital o un partido': { descEs: 'La gran salida, a elección: es para ahorrar varias semanas.', title: 'Tickets to a concert or a game', desc: 'The big outing, your choice: worth saving up for a few weeks.' },
}
/** Las descripciones sembradas, por su castellano exacto (para traducir la desc aunque el padre haya cambiado el título). */
const DESC_EN: Record<string, string> = Object.fromEntries(Object.values(PRIZE_EN).map(p => [p.descEs, p.desc]))

/** El premio sembrado en inglés (por el título castellano exacto); undefined si no está en la tabla. No mira el idioma. */
export function prizeEn(title: string): { title: string; desc: string } | undefined {
  const p = Object.prototype.hasOwnProperty.call(PRIZE_EN, title) ? PRIZE_EN[title] : undefined
  return p ? { title: p.title, desc: p.desc } : undefined
}
/** El título en inglés; fallback: tal cual (lo que tipeó el padre). No mira el idioma. */
export const prizeTitleEn = (title: string): string => prizeEn(title)?.title ?? title
/** La descripción en inglés si es una de las sembradas; si es una propia del padre, tal cual. No mira el idioma. */
export const prizeDescEn = (desc: string): string => (Object.prototype.hasOwnProperty.call(DESC_EN, desc) ? DESC_EN[desc] : desc)

/** Un objeto con `title` (y `desc` opcional) de premio, en el idioma del pedido. En castellano devuelve el MISMO objeto. */
export function localizePrize<T extends { title: string; desc?: string }>(p: T): T {
  if (requestLang() !== 'en') return p
  return { ...p, title: prizeTitleEn(p.title), ...(p.desc !== undefined ? { desc: prizeDescEn(p.desc) } : {}) }
}

/* ---------- avisos al padre (Familia → Avisos): plantillas de parent.notifyParent / notifyUnreviewed, AL SERVIR ----------
   alerts.json guarda el cuerpo ya armado en castellano. En inglés se reconoce cada plantilla por regex (patrón txLabelEn de
   progress.ts) y se rearma en inglés dejando TAL CUAL lo que escribió el chico (lo citado) y su nombre. Lo que no matchea
   ninguna plantilla (un aviso viejo con otra redacción) sale tal cual. */
const kidEn = (k: string) => (k === 'Tu hijo' ? 'Your child' : k === 'tu hijo' ? 'your child' : k)
/** Dónde pasó (va dentro de la oración, en minúscula; el cliente le pone la mayúscula a la etiqueta de la fuente). */
export function alertSourceEn(src: string): string {
  if (src === 'el chat con el asistente') return 'the chat with the assistant'
  if (src === 'el buscador') return 'Search'
  const m = /^la conversación con (.+) \(Amigos\)$/.exec(src)
  if (m) return `the conversation with ${m[1]} (Friends)`
  return src
}
const SUPPORT_ES = 'Se le mostró el mensaje de contención de la familia, que lo invita a hablarlo con un adulto de confianza.'
const SUPPORT_EN = 'They were shown the family’s support message, which encourages them to talk it over with a trusted adult.'
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const S = esc(SUPPORT_ES)
const RX = {
  crisisU: new RegExp(`^Posible mensaje de crisis en (.+?), sin clasificar: el revisor automático no respondió y una red de frases lo marcó\\.(?: (.+?) escribió: «([\\s\\S]*)»\\.)? ${S} Leelo y, si hace falta, hablalo con (.+?) con calma cuanto antes\\.$`),
  crisis: new RegExp(`^Hubo un mensaje de crisis en (.+?)\\.(?: (.+?) escribió: «([\\s\\S]*)»\\.)? ${S} Hablalo con (.+?) con calma cuanto antes\\.$`),
  contacto: /^(.+?) quiso pasar un dato de contacto o seguir la charla fuera de Smarty en (.+?)(?:: «([\s\S]*)»)?\. El Moderador lo frenó y el mensaje no llegó\.$/,
  bloqueos: /^(.+?) insistió: el Moderador frenó (\d+) mensajes suyos en (.+?) en pocos minutos \(palabras, insultos o temas que la familia no quiere\)\. Ninguno llegó\.(?: El último: «([\s\S]*)»\.)?$/,
  unreviewed: /^Sin clasificar: el revisor automático no pudo revisar (un mensaje|(\d+) mensajes) de (.+?) en (.+?) \(no respondió\)\. No se le mostró ninguna respuesta y se le sugirió hablar con un adulto de confianza si le pasa algo\. Por si era importante, (esto es lo último que escribió|esto es lo que escribió): ([\s\S]*)\.$/,
}
/** Lo citado entre «…» (uno o varios, separados por « · ») con comillas inglesas; el contenido, intacto. */
const quotesEn = (said: string) => (/^«[\s\S]*»$/.test(said) ? said.slice(1, -1).split('» · «').map(q => `“${q}”`).join(' · ') : said)
/** El cuerpo de un aviso en inglés (sin mirar el idioma: lo decide quien sirve). */
export function alertTextEn(t: string): string {
  let m = RX.crisisU.exec(t)
  if (m) return `Possible crisis message in ${alertSourceEn(m[1])}, unclassified: the automatic reviewer didn’t respond and a phrase filter flagged it.${m[2] !== undefined ? ` ${kidEn(m[2])} wrote: “${m[3]}”.` : ''} ${SUPPORT_EN} Read it and, if needed, talk it over calmly with ${kidEn(m[4])} as soon as you can.`
  if ((m = RX.crisis.exec(t))) return `There was a crisis message in ${alertSourceEn(m[1])}.${m[2] !== undefined ? ` ${kidEn(m[2])} wrote: “${m[3]}”.` : ''} ${SUPPORT_EN} Talk it over calmly with ${kidEn(m[4])} as soon as you can.`
  if ((m = RX.contacto.exec(t))) return `${kidEn(m[1])} tried to share contact info or move the chat outside Smarty in ${alertSourceEn(m[2])}${m[3] !== undefined ? `: “${m[3]}”` : ''}. The Moderator stopped it and the message wasn’t delivered.`
  if ((m = RX.bloqueos.exec(t))) return `${kidEn(m[1])} kept trying: the Moderator stopped ${m[2]} of their messages in ${alertSourceEn(m[3])} within a few minutes (words, insults or topics the family doesn’t want). None got through.${m[4] !== undefined ? ` The last one: “${m[4]}”.` : ''}`
  if ((m = RX.unreviewed.exec(t))) {
    const what = m[2] ? `${m[2]} messages` : 'a message'
    const lead = m[5] === 'esto es lo último que escribió' ? 'here’s the latest they wrote' : 'here’s what they wrote'
    return `Unclassified: the automatic reviewer couldn’t check ${what} from ${kidEn(m[3])} in ${alertSourceEn(m[4])} (it didn’t respond). No reply was shown, and they were encouraged to talk to a trusted adult if something’s going on. In case it was important, ${lead}: ${quotesEn(m[6])}.`
  }
  return t
}

/* ---------- presets: los temas que SUGIERE o SACA cada preset, solo para MOSTRARLOS (los valores aplicados no cambian) ---------- */
export const PRESET_TOPIC_EN: Record<string, string> = {
  animales: 'animals', 'canciones infantiles': 'children’s songs', Biblia: 'Bible', historia: 'history',
  'ideología de género': 'gender ideology', 'política partidaria': 'partisan politics', 'activismo climático': 'climate activism',
  Halloween: 'Halloween', brujería: 'witchcraft',
}
