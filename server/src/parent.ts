// Zona del padre (v2): "recuperar el control: el padre programa la plataforma" (VISION §10; audios 8, 21-22, 34-35,
// 55-56, 66). "Si el papá dice no tiene que existir el Energy Coin, no existe" (22). La v2 es la CONFIGURACIÓN VIVA:
// lo que el padre elige acá se aplica al chico en el acto, en el server (no es un filtro de pantalla):
//   · Temas NEGROS de la familia → los jueces los suman a la lista negra de fábrica (judge.ts, friendsFake.ts y el veto de
//     medios de chat.ts: blackTopicsAll), el feed saca lo que pega con alguno (feedFake.ts: topicHit) y su nombre se corta
//     además como frase exacta en búsquedas, títulos, chat y mensajes (filters.matchBlockedWord: familyBlockedTerms).
//   · Temas BLANCOS de la familia → "las sugerencias del padre" (audio 8: guían, no dirigen): el feed los prioriza sin
//     volverse monotema y el chat los propone al redirigir (familyTopics().white; los blancos de FÁBRICA no se proponen).
//   · Palabras de la familia → se SUMAN a las de fábrica en matchBlockedWord (búsquedas, títulos, chat, Amigos…).
//   · Topes de volumen → GET /api/parent/limits (público) → bgAudio/MiniPlayer del chico (como settings.maxVol* de Smarty).
//   · Presets (audios 56/66: "grandes presets, no mil detalles") → aplican de una vez on-off + temas + palabras + topes.
//   · Avisos (notifyParent) → crisis (CON el texto del chico: decisión de Esteban 11-oct), contacto y bloqueos repetidos.
//
// FAMILIA (línea 14-oct, docs/USUARIOS.md §5): la Zona de padres pasó a ser el punto de menú "Familia" del ADULTO, SIN
// portón de PIN — es SU menú. La sesión es IMPLÍCITA: con un adulto como usuario activo (cabecera X-Innerith-User,
// users.ts) todas las rutas pasan. El portón del CLIENTE se retiró (ni AdultGate ni X-Parent-Token en src/); el del server
// queda DORMIDO para la versión futura (cuentas de verdad): unlock + token de 15 min siguen acá, sin que nadie los llame.
//
// U3 — VARIOS INTEGRANTES (27-oct, docs/USUARIOS.md §9): todo lo que era "del chico" (on-off, premios, temas, palabras,
// topes, preset y dial del Feed) es POR INTEGRANTE (`members[id]` de parent.json v3); la zona horaria y el PIN dormido son
// de la FAMILIA. Dos maneras de leer la config, y no se mezclan:
//   · ACCESOS EXPLÍCITOS por id (featureOn(key, childId), memberFeatures, memberVolume, itemOwner, anyParentItem): los usan
//     las rutas de Familia (siempre sobre el integrante M de `?member=`) y el gating que tiene `req` (index.ts, market.ts,
//     leaguesFake.ts, friendsFake.ts).
//   · POLÍTICA VIGENTE (familyWords, familyBlockedTerms, familyTopics, blackTopicsAll, whiteTopicsAll, feedMotion,
//     featureOnNow, policyMemberId, policyItems, policyItem): MISMAS firmas de siempre, leen el usuario del pedido en curso
//     (requestContext.ts, AsyncLocalStorage). Chico X → la de X (+ fábrica); ADULTO → solo fábrica, todo prendido, Tienda
//     sin premios (D1 del coordinador: `adultPolicy`); sin pedido (arranque) → la unión de todos (fail-closed).
//     OJO: dentro de /api/parent/* el usuario del pedido es el ADULTO: ahí se usan SIEMPRE los accesos explícitos con M.
// U4 (docs/USUARIOS.md §10): la economía (XP/⚡/racha, canjes), Learn, Mi espacio y amigos también son de cada integrante;
// Familia los lee con accesos EXPLÍCITOS sobre M (progress.summaryOf, space.allSavedForParent(M), market.listRedemptions(M)).
//
// Contrato HTTP (congelado; formas en src/api/types.ts). TODAS las rutas piden la sesión del padre —el adulto activo, o el
// token dormido (cabecera X-Parent-Token)— MENOS tres: POST unlock (el portón dormido) y GET features / GET limits (las
// lee la UI del chico). Un chico sin token, o con uno inventado o vencido → 401. M = el integrante de `?member=<id>`
// (users.ts:memberFor: ausente → el PRIMER dependiente del adulto; uno que no es de la familia → 400).
//   Sin sesión → 401 {error: 'Solo para un adulto de la familia.'} (texto neutro, el mismo de /api/mytube/admin/*).
//   POST /api/parent/unlock {pin}                 → {ok, token?, waitSeconds?}            (público; dormido)
//   GET  /api/parent/features[?member]            → ParentFeatures (público: chico → los suyos, member ignorado; adulto →
//                                                   los de M; adulto sin integrantes → todo prendido)
//   GET  /api/parent/limits                       → ParentVolume (público: chico → sus topes; adulto → 100/100: sin topes)
//   POST /api/parent/features?member {key,on}     → ParentFeatures de M (grandes on-off; persisten: son config del padre)
//   GET  /api/parent/activity?member              → ParentActivity & {member}: TODO DE M (U4: también xpWeek/ec/
//                                                   streakDays/continue y lo guardado en SU Mi espacio)
//   POST /api/parent/items?member {NewMarketItem} → MarketItem (premio de M; el id es ÚNICO en la familia)
//   POST /api/parent/items/update?member {id,...patch} → {ok}   (acepta `archived: false` = reactivar; premio que no es de
//                                                   M → 200 {ok:false, error:'Ese premio no existe.'})
//   POST /api/parent/items/archive?member {id}    → {ok}   (idem)
//   POST /api/parent/deliver?member {id}          → {ok}   (canje entregado; {ok:false} si no existe o no es de un premio de M)
//   GET  /api/parent/config?member                → ParentConfig {topics, words:{extra,builtin}, volume, preset, feedMotion,
//                                                   tz (de la FAMILIA), member, features (de M)}
//   POST /api/parent/topics?member {white?, black?} → ParentTopics de M  (cada lista que viene REEMPLAZA a la anterior)
//   POST /api/parent/words?member {extra}         → ParentWords de M   (reemplaza la lista; los 400 nombran a M)
//   POST /api/parent/volume?member {maxMusic?, maxNoise?} → ParentVolume de M
//   POST /api/parent/feed-motion?member {motion}  → {feedMotion} de M (dial de animación del Feed: calmo/normal/vivo; viaja
//                                                   en cada GET /api/feed del chico como FeedResponse.motion)
//   GET  /api/parent/alerts[?member]              → {alerts: ParentAlert[]} (el más nuevo primero; cada uno con childId y
//                                                   childName del chico que lo disparó; con member → solo los de M; SIN
//                                                   member → TODOS, a propósito)
//   POST /api/parent/alerts/seen[?member] {id}    → {ok}   (con member y un aviso de otro integrante → {ok:false})
//   GET  /api/parent/presets?member               → {presets: ParentPreset[], current: el preset de M}
//   POST /api/parent/presets/apply?member {id}    → {ok, config: ParentConfig de M, features: de M}
//   POST /api/parent/tz {tz}                      → {tz}  FAMILIA (deuda 14-oct: IANA válida —se prueba construyendo un
//                                                   Intl.DateTimeFormat; se guarda canónica— o null = Automática, la del server;
//                                                   otra cosa → 400. GET config la trae; el ciclo del día (schedule.ts)
//                                                   y la franja del Feed (feedFake.ts) de CADA integrante se evalúan en ella y
//                                                   viaja en GET /api/schedules. No forma parte de los presets)
//   GET  /api/parent/music                        → {tracks}  FAMILIA (After Day, porte Smarty W6; la lógica y music.json
//                                                   viven en afterday.ts)
//   POST /api/parent/music/add {url, title?}      → {ok:true, track} | {ok:false, error}  FAMILIA (rechazos de negocio con
//                                                   200: "No es un link de un video de YouTube" / "Ese video ya está en la lista.")
//   POST /api/parent/music/remove {videoId}       → {ok}  FAMILIA
//   GET  /api/parent/cycle?member                 → CycleResponse {cycle: {ranges}, member, serverNow, tz, demoRange}
//                                                   (Ciclo del día de M, tanda F1 — docs/USUARIOS.md §11)
//   POST /api/parent/cycle?member {ranges}        → CycleResponse  (la lista COMPLETA reemplaza a la anterior; inválida —ids
//                                                   repetidos, nombre, horas, secciones, más de 8— → 400 con el motivo. La
//                                                   lógica, la validación y schedules.json v3 viven en schedule.ts/cycleRules.ts)
//   POST /api/parent/schedules                    → 410 {error}  (los Horarios por sección de W7, RETIRADOS por el Ciclo del
//                                                   día: con cualquier método y sin mirar integrante; F2 retira el panel viejo)
//   En tz, music*, unlock y lock `member` se IGNORA. After Day y el ciclo del día NO forman parte de los presets: tocarlos
//   no deja la configuración como "propia".
// EXTENSIONES ADITIVAS (no rompen el contrato; pendientes de formalizar en types.ts por el coordinador):
//   · GET /api/parent/activity suma `items` y `protections` (v1; ya formalizados como opcionales) y `member` (U3).
//   · GET /api/parent/presets: cada preset trae además `spec` = qué deja configurado (features, temas, palabras,
//     topes) para que el panel muestre qué prende y qué apaga sin duplicar la definición en el cliente.
//   · POST /api/parent/lock (con sesión) → {ok}: invalida el token dormido; con el adulto (sin token) no tiene efecto.
//
// SESIÓN DORMIDA (el portón de antes, para la versión futura): token aleatorio de 32 bytes que vive SOLO en RAM (acá se
// guarda su sha256, nunca el token). Vence a los 15 min sin pedidos (deslizante: cada pedido autorizado la estira).
// Reiniciar el server las cierra todas. Tope de sesiones abiertas a la vez: se cae la más vieja. Un chico con ese token
// configura a TODOS los dependientes del seed (users.ts:familyMembersFor).
//
// PERSISTENCIA: server/data/parent.json = CONFIG del padre (regla 9: la config persiste; la ECONOMÍA no). v3 (U3):
//   { version: 3, seq, tz, pinHash, members: { [idDelIntegrante]: { features, items, topics, extraWords, volume, preset,
//     feedMotion } } }
// `seq` (próximo id de premio) es de la FAMILIA: los canjes, el stock y la lista de deseos referencian ids sin integrante.
// Los canjes, el saldo y el stock consumido siguen en RAM (market.ts / progress.ts). Los AVISOS PERSISTEN desde FS-BASE-A
// (antes vivían en RAM y un reinicio de tsx watch borraba una crisis sin ver: el POC los persistía en IndexedDB) en
// server/data/alerts.json `{version: 1, seq, alerts}` —de la FAMILIA, este módulo es su único dueño, FUERA de /api/demo/reset
// (también de {scope:'all'}), modo 0600 porque una crisis lleva el texto del chico—; `seq` SOLO CRECE (un id nunca se reusa:
// una pestaña vieja de Avisos no puede marcar como vista una crisis nueva) y, sin archivo, arranca en los segundos del reloj
// (no retrocede entre procesos). Tope propio (MAX_ALERTS) que desaloja primero lo VISTO más viejo y nunca una crisis sin
// ver. Siguen en RAM a propósito: el contador del "insistió" (blockTimes), las sesiones del token dormido y el rate-limit del
// PIN. Escritura atómica (el helper común durable.ts: tmp + fsync + rename) e INMEDIATA, sin debounce a propósito: son
// pocos cambios y un reinicio de tsx watch justo después no puede perderlos. FS-BASE-B (hallazgo parent.ts:732): todo
// cambio de la config va DISCO PRIMERO (commit, abajo): si parent.json no se escribe, el cambio NO rige (la RAM queda como
// estaba), la ruta responde el error y el reintento vuelve a intentar escribir (antes el cambio regía igual en RAM y el
// reintento caía en el "sin cambios" y respondía 200 sin guardar nada; un premio fallido quedaba canjeable y el reintento
// lo duplicaba).
// La primera vez (sin archivo) se escribe el seed: cada dependiente con todo prendido + los premios demo (ian 1–8, luna
// 9–16). Un parent.json v1/v2 (la config de UN chico) MIGRA en el acto (familyMigrate.ts, puro y testeado): lo de antes
// pasa ENTERO a ian, los dependientes sin entrada nacen con la config de fábrica (Luna: todo prendido, sin temas ni
// palabras, topes 100 y una copia de los 8 premios demo con ids nuevos), y el archivo original queda UNA vez en
// parent.json.pre-v3 (un checkout viejo leería el v3 como "todo apagado y sin premios" y lo reescribiría; FS-BASE-B: si ya
// hay un .pre-v3 con OTRO contenido, el respaldo va a .pre-v3-<ms>). Archivo ilegible —o con una `version` desconocida
// (FS-BASE-B: familyMigrate.ts)— → arranca CERRADO (todos los dependientes con todo apagado y sin premios; el archivo queda
// entero en .roto-*), como en la v1.
//
// PIN DE LA ZONA DE PADRES (dormido desde el 14-oct, con el portón): en parent.json va SOLO su hash (sha256 hex), nunca
// el texto, y es de la FAMILIA. POST /api/parent/unlock compara en tiempo constante y responde IGUAL (200 {ok:false})
// para un PIN mal formado o incorrecto. Rate-limit suave en RAM:
// 5 fallidos seguidos → 30 s de espera ({ok:false, waitSeconds}); se resetea con un acierto, con el reinicio del server
// o con resetUnlockAttempts() (registrado en POST /api/demo/reset).
//
// IMPORTS CRUZADOS: mytube.ts importa hasParentSession (solo lo llama al rutear un pedido). Mentores (teachersFake.ts,
// tanda U2) ya no: pide un ADULTO activo directo con isAdultReq de users.ts (sin el token dormido del portón).
// market.ts y filters.ts leen de acá (featureOn, premios, palabras/temas de la familia) y acá se lee
// de market.ts (canjes en RAM), de space.ts y de videos.ts (que a su vez importan filters.ts). afterday.ts, schedule.ts
// (W6/W7), users.ts (14-oct: el usuario activo), requestContext.ts y familyMigrate.ts (U3) no vuelven hacia acá. Es seguro
// porque NINGUNO llama al otro en el nivel superior del módulo (solo dentro de funciones): el orden de evaluación da igual.
// Mantener esa regla: nada de llamadas a market/filters/space/videos al cargar este módulo, ni de ellos hacia acá.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { addTrack, allTracks, removeTrack } from './afterday'
import { SERVER_ROOT, blackTopics, config, ov, whiteTopics, whitelistSites } from './config'
import { backupBeforeMigrate, quarantine, tryWriteFileAtomic } from './durable'
import { isObject, upgradeParentRaw } from './familyMigrate'
import { deliverRedemption, listRedemptions, redeemedCount, stockLeft } from './market'
import { medalsOf, registerMedalGate, syncMedals } from './medals'
import { currentUser, runAsUser } from './requestContext'
import { checkCycle, cycleOf, cycleView, saveCycle, setFamilyTzSource } from './schedule'
import { setProgressTzSource, summaryOf } from './progress'
import { allSavedForParent } from './space'
import { DEFAULT_USER_ID, actingUser, allDependents, isAdultReq, memberFor, userById } from './users'
import { catalogSize } from './videos'
import { readJson, send } from './web'
import { isValidTimeZone } from '../../src/shared/lib/zonedClock'

/* ---------- modelo ---------- */
export const FEATURE_KEYS = ['tienda', 'ligas', 'amigos', 'chat'] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]
export type ParentFeatures = Record<FeatureKey, boolean>
/** Premio publicado por el padre. `stock` = cupo de canjes que él configuró (null = sin límite): lo
 *  consumido sale de los canjes en RAM (market.stockLeft). Archivado ≠ borrado: no se ve en la Tienda
 *  pero queda acá y se puede reactivar. El id es ÚNICO EN LA FAMILIA (U3). */
export interface ParentItem {
  id: number; emoji: string; title: string; desc?: string; price: number; stock: number | null
  archived: boolean; createdAt: number; updatedAt?: number
}
/** Temas de la familia: los blancos se promueven (sugerencias), los negros se filtran en serio. */
export interface ParentTopics { white: string[]; black: string[] }
/** Topes de volumen (0-100) que la música y los ruidos de fondo del chico no pueden superar. */
export interface ParentVolume { maxMusic: number; maxNoise: number }
/** Dial de animación del Feed del chico (Feed v6): calma / normal / viva. El movimiento reducido del sistema fuerza
 *  'calmo' en el cliente aunque acá diga otra cosa. */
export const FEED_MOTIONS = ['calmo', 'normal', 'vivo'] as const
export type FeedMotion = (typeof FEED_MOTIONS)[number]
const isFeedMotion = (v: unknown): v is FeedMotion => typeof v === 'string' && (FEED_MOTIONS as readonly string[]).includes(v)
export type AlertKind = 'crisis' | 'contacto' | 'bloqueos'
/** U3: TODO lo que antes era "del chico", ahora por integrante (members[id] de parent.json v3). */
interface MemberConfig {
  features: ParentFeatures; items: ParentItem[]; topics: ParentTopics
  /** palabras bloqueadas de la familia para ESTE integrante (se suman a las de fábrica) */ extraWords: string[]
  volume: ParentVolume; /** id del preset aplicado; null = configuración propia (se editó algo a mano) */ preset: string | null
  /** Dial de animación del Feed (default 'normal') */ feedMotion: FeedMotion
}
interface ParentStore {
  version: 3
  /** próximo id de premio: ÚNICO EN LA FAMILIA (canjes, stock y lista de deseos referencian ids sin integrante) */ seq: number
  /** Zona horaria IANA de la FAMILIA; null = Automática (la del server). */ tz: string | null
  /** sha256 hex del PIN del portón dormido: de la FAMILIA */ pinHash: string
  /** clave = id de usuario del dependiente (users.ts) */ members: Record<string, MemberConfig>
}

const FILE = join(SERVER_ROOT, 'data', 'parent.json')
const LIMITS = { title: 60, desc: 140, price: 100_000, stock: 9_999 } as const
/** Topes de las listas de la familia (temas por lista, palabras) y largo máximo de cada término. */
const TERMS = { topics: 30, words: 100, topicLen: 60, wordLen: 40 } as const
/** Ids de integrante aceptables en disco (los del seed son así; nada de "__proto__"). */
const MEMBER_ID = /^(?!__proto__$)[a-z0-9_-]{1,40}$/

/* PIN del demo: 123456 — default PÚBLICO tipo admin/admin, elegido y dicho abiertamente por Esteban para
   la demo (NO tiene nada que ver con el PIN del respaldo de Smarty, que no se guarda ni se menciona).
   Es el seed de parent.json y la migración de un parent.json viejo sin pinHash. Acá y en disco va solo
   el hash. TODO (versión futura): cambiar el PIN desde el panel. */
const DEMO_PIN_HASH = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92' // = sha256 del PIN del demo
const isPinHash = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)

/* Seed DEMO "del padre" (se escribe la PRIMERA vez que no hay parent.json y para cada integrante que nace; antes vivía en
   market.ts). Es lo que el papá publicaría para arrancar. Precios calibrados a una cosecha semanal de ~1.200 ⚡: lo
   cotidiano sale 100–250, una salida 400, un libro 600 y hay UNA meta grande para ahorrar varias semanas. stock null =
   sin límite. Los ids 1..8 de Ian se conservan (la lista de deseos los usa); los de cada integrante nuevo salen de `seq`. */
const SEED_ITEMS: Pick<ParentItem, 'emoji' | 'title' | 'desc' | 'price' | 'stock'>[] = [
  { emoji: '🎮', title: '30 minutos de videojuegos', desc: 'Media hora de tu juego favorito, cuando terminás las tareas.', price: 150, stock: null },
  { emoji: '🍿', title: 'Elegís la película del viernes', desc: 'Noche de peli en familia: esta vez la elección es tuya.', price: 250, stock: null },
  { emoji: '🍦', title: 'Salida por un helado', desc: 'Vamos juntos a la heladería y elegís los gustos.', price: 400, stock: null },
  { emoji: '🚲', title: '1 hora de bici en la plaza', desc: 'Salimos a andar juntos. ¡Llevá el casco!', price: 200, stock: null },
  { emoji: '📚', title: 'Un libro nuevo que elijas', desc: 'Vamos a la librería y te llevás el que más te guste.', price: 600, stock: null },
  { emoji: '🦉', title: '30 minutos más despierto', desc: 'Te acostás media hora más tarde un viernes o un sábado.', price: 350, stock: 2 },
  { emoji: '🛏️', title: 'Día sin tender la cama', desc: 'Por un día la cama se queda como está. ¡Nadie te dice nada!', price: 100, stock: null },
  { emoji: '🎢', title: 'Un día en el parque de diversiones', desc: 'La gran salida: un día entero de juegos. ¡Es para ahorrar!', price: 3000, stock: 1 },
]
const allFeatures = (on: boolean): ParentFeatures => ({ tienda: on, ligas: on, amigos: on, chat: on })
/** El nombre del integrante para los textos del adulto ("bloquearía casi todo lo que lee Luna"). */
const memberName = (id: string) => userById(id)?.name || 'tu hijo'
const noTopics = (): ParentTopics => ({ white: [], black: [] })
const fullVolume = (): ParentVolume => ({ maxMusic: 100, maxNoise: 100 })

/** A3: un integrante nuevo nace con la config de FÁBRICA (lo que sembraba seed() para el único chico): todo prendido, sin
 *  temas ni palabras, topes 100, sin preset, animación normal y una COPIA de los 8 premios demo con ids de la familia
 *  (consume `s.seq`). Para que nazca sin premios: `items: []`. */
function memberDefaults(s: { seq: number }): MemberConfig {
  const now = Date.now()
  return {
    features: allFeatures(true), items: SEED_ITEMS.map(x => ({ id: s.seq++, ...x, archived: false, createdAt: now })),
    topics: noTopics(), extraWords: [], volume: fullVolume(), preset: null, feedMotion: 'normal',
  }
}
/** Fail-closed: un integrante sin config legible (o un chico sin entrada) no tiene NADA opcional prendido. */
const closedMember = (): MemberConfig => ({ features: allFeatures(false), items: [], topics: noTopics(), extraWords: [], volume: fullVolume(), preset: null, feedMotion: 'normal' })

/* ---------- presets (audios 56 y 66: "grandes presets, no mil detalles") ----------
   Honestos sobre lo que EXISTE: cada uno deja configurado exactamente lo que el server aplica (los cuatro on-off,
   temas, palabras de la familia y topes de volumen). Aplicar uno REEMPLAZA todo eso; editar cualquier cosa a mano
   después lo deja en null ("configuración propia"). Los temas del clásico conservador son los de la familia demo
   (familia conservadora que hace homeschooling: VISION §1) y se SUMAN a la protección de fábrica de Smarty. U3: se
   aplican a UN integrante (no hay "aplicar a toda la familia": D3). */
interface PresetDef { id: string; name: string; desc: string; features: ParentFeatures; topics: ParentTopics; words: string[]; volume: ParentVolume }
const PRESETS: readonly PresetDef[] = [
  {
    id: 'primeros-pasos', name: 'Primeros pasos (3 a 6 años)',
    desc: 'Para los más chicos: mirar, escuchar y aprender. Sin chat, sin amigos, sin ligas ni Tienda; la música y los ruidos llegan como mucho a la mitad del volumen.',
    features: allFeatures(false), topics: { white: ['animales', 'canciones infantiles'], black: [] }, words: [], volume: { maxMusic: 50, maxNoise: 50 },
  },
  {
    id: 'clasico-conservador', name: 'Clásico conservador',
    desc: 'Todo prendido, con los temas que una familia conservadora no quiere ver en la plataforma (se suman a la protección de fábrica) y la Biblia y la historia como sugerencias.',
    features: allFeatures(true),
    topics: { white: ['Biblia', 'historia'], black: ['ideología de género', 'política partidaria', 'activismo climático', 'Halloween', 'brujería'] },
    words: [], volume: fullVolume(),
  },
  {
    id: 'explorador-completo', name: 'Explorador completo',
    desc: 'Todo prendido y sin filtros extra de la familia: queda la protección de fábrica de Innerith.',
    features: allFeatures(true), topics: noTopics(), words: [], volume: fullVolume(),
  },
]

function seed(deps: string[]): ParentStore {
  const s: ParentStore = { version: 3, seq: 1, tz: null, pinHash: DEMO_PIN_HASH, members: {} }
  for (const d of deps) s.members[d] = memberDefaults(s) // ian → premios 1..8, luna → 9..16, seq = 17
  return s
}

/* ---------- validación (compartida por el archivo leído de disco y por la API) ---------- */
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const KEYCAP = String.fromCodePoint(0x20e3) // 1️⃣ y familia: no son Extended_Pictographic
const cleanText = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim()
const toInt = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*\d{1,9}\s*$/.test(v) ? Number(v) : NaN
  return Number.isSafeInteger(n) ? n : null
}
export type Check<T> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
function checkTitle(v: unknown): Check<string> {
  const t = typeof v === 'string' ? cleanText(v) : ''
  return t.length >= 2 && t.length <= LIMITS.title ? { ok: true, value: t } : fail(`El título tiene que tener entre 2 y ${LIMITS.title} caracteres.`)
}
function checkDesc(v: unknown): Check<string | undefined> {
  if (v === undefined || v === null) return { ok: true, value: undefined }
  if (typeof v !== 'string') return fail('La descripción tiene que ser texto.')
  const t = cleanText(v)
  return t.length <= LIMITS.desc ? { ok: true, value: t || undefined } : fail(`La descripción admite hasta ${LIMITS.desc} caracteres.`)
}
function checkPrice(v: unknown): Check<number> {
  const n = toInt(v)
  return n !== null && n >= 1 && n <= LIMITS.price ? { ok: true, value: n } : fail('El precio tiene que ser un número entero entre 1 y 100.000.')
}
function checkEmoji(v: unknown): Check<string> {
  const t = typeof v === 'string' ? v.trim() : ''
  const n = [...graphemes.segment(t)].length
  const pictographic = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(t) || t.includes(KEYCAP)
  return n >= 1 && n <= 2 && t.length <= 16 && pictographic ? { ok: true, value: t } : fail('Elegí un emoji para el premio (por ejemplo 🎮).')
}
function checkStock(v: unknown): Check<number | null> {
  if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) return { ok: true, value: null }
  const n = toInt(v)
  return n !== null && n >= 0 && n <= LIMITS.stock ? { ok: true, value: n } : fail('El stock tiene que ser un número entero (o vacío = sin límite).')
}
/** U5-A: los campos de TEXTO de un premio —título (2-60), descripción (≤ 140, opcional) y emoji (1 o 2)— con la MISMA
 *  validación y los MISMOS textos de error que un premio de la Tienda (en el orden de addItem). Lo usa el premio de la
 *  semana de la familia "Uno nuevo" (leaguesFake.ts; este módulo no importa leaguesFake). */
export function checkPrizeFields(b: Record<string, unknown>): Check<{ emoji: string; title: string; desc?: string }> {
  const title = checkTitle(b.title); if (!title.ok) return title
  const desc = checkDesc(b.desc); if (!desc.ok) return desc
  const emoji = checkEmoji(b.emoji); if (!emoji.ok) return emoji
  return { ok: true, value: { emoji: emoji.value, title: title.value, ...(desc.value ? { desc: desc.value } : {}) } }
}

/* Términos de la familia (temas y palabras). Se comparan como los compara el filtro de palabras: sin tildes, sin
   mayúsculas y con los espacios colapsados (ese es también el criterio para "repetido" y para "está en las dos listas"). */
const keyOf = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
/** Palabras tan comunes que, bloqueadas, dejarían al chico sin casi nada (búsquedas, títulos, chat). */
const TOO_COMMON = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'u', 'a', 'al', 'en', 'con', 'por', 'para', 'que', 'se', 'su', 'sus', 'lo', 'le', 'les', 'mi', 'tu', 'es', 'no', 'si', 'me', 'te', 'ya', 'muy', 'mas', 'como', 'pero', 'the', 'and', 'of', 'to'])
/** Conectores que no cuentan para decidir de qué trata un tema ("ideología de género" = ideología + género). */
const TOPIC_STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'e', 'o', 'u', 'a', 'al', 'en', 'con', 'por', 'para', 'sobre', 'su', 'sus', 'lo', 'que', 'sin'])
const topicWords = (topic: string) => keyOf(topic).split(/[^a-z0-9]+/).filter(w => w && !TOPIC_STOP.has(w))

/** `kid` = el nombre del integrante para el texto del 400 ("bloquearía casi todo lo que lee Luna"). */
function checkTerm(v: unknown, what: 'tema' | 'palabra', kid: string): Check<string> {
  const max = what === 'tema' ? TERMS.topicLen : TERMS.wordLen
  const t = typeof v === 'string' ? cleanText(v) : ''
  if (t.length < 2 || t.length > max) return fail(`Cada ${what} tiene que tener entre 2 y ${max} caracteres${t ? ` («${t.slice(0, 50)}»)` : ''}.`)
  if ((t.match(/[\p{L}\p{N}]/gu) ?? []).length < 2) return fail(`«${t}» no ${what === 'tema' ? 'es un tema válido' : 'es una palabra válida'}: tiene que tener letras.`)
  if (what === 'palabra' && TOO_COMMON.has(keyOf(t))) return fail(`«${t}» es demasiado común: bloquearía casi todo lo que lee ${kid}.`)
  if (what === 'tema' && !topicWords(t).length) return fail(`«${t}» no dice de qué tema se trata.`)
  return { ok: true, value: t }
}
/** Lista de la API: TODO tiene que ser válido (si no, 400 con el motivo). Sin repetidos (gana el primero). */
function checkTerms(v: unknown, what: 'tema' | 'palabra', max: number, kid: string): Check<string[]> {
  if (!Array.isArray(v)) return fail(what === 'tema' ? 'Los temas tienen que venir en una lista.' : 'Las palabras tienen que venir en una lista.')
  if (v.length > max * 3) return fail(`Hasta ${max} ${what === 'tema' ? 'temas por lista' : 'palabras'}.`)
  const out: string[] = [], seen = new Set<string>()
  for (const raw of v) {
    const c = checkTerm(raw, what, kid)
    if (!c.ok) return c
    const k = keyOf(c.value)
    if (!seen.has(k)) { seen.add(k); out.push(c.value) }
  }
  return out.length <= max ? { ok: true, value: out } : fail(`Hasta ${max} ${what === 'tema' ? 'temas por lista' : 'palabras'}.`)
}
/** Lista leída de disco: lo inválido o repetido se saltea con un aviso (no tumba el resto). `who` = el integrante. */
function sanitizeTerms(v: unknown, what: 'tema' | 'palabra', max: number, who: string): string[] {
  const out: string[] = [], seen = new Set<string>()
  for (const raw of Array.isArray(v) ? v : []) {
    const c = checkTerm(raw, what, memberName(who))
    if (!c.ok) { console.warn(`[parent] ${what} inválido en parent.json (${who}), lo salteo: ${JSON.stringify(raw).slice(0, 80)}`); continue }
    const k = keyOf(c.value)
    if (!seen.has(k) && out.length < max) { seen.add(k); out.push(c.value) }
  }
  return out
}
function sanitizeTopics(v: unknown, who: string): ParentTopics {
  const r = isObject(v) ? v : {}
  const black = sanitizeTerms(r.black, 'tema', TERMS.topics, who)
  const inBlack = new Set(black.map(keyOf))
  // Un tema no puede estar en las dos listas; si pasó (archivo editado a mano), gana la negra (fail-closed).
  return { white: sanitizeTerms(r.white, 'tema', TERMS.topics, who).filter(t => !inBlack.has(keyOf(t))), black }
}
function checkVolume(v: unknown, label: string): Check<number> {
  const n = toInt(v)
  return n !== null && n >= 0 && n <= 100 ? { ok: true, value: n } : fail(`${label} tiene que ser un número entero entre 0 y 100.`)
}
function sanitizeVolume(v: unknown): ParentVolume {
  const r = isObject(v) ? v : {}
  const one = (x: unknown) => { const c = checkVolume(x, 'tope'); return c.ok ? c.value : 100 } // sin dato válido = sin tope (como Smarty)
  return { maxMusic: one(r.maxMusic), maxNoise: one(r.maxNoise) }
}

/* ---------- persistencia ---------- */
/** FS-BASE-B: el helper común (durable.ts: tmp + fsync + rename); false = no quedó escrito (logueado). */
const writeAtomic = (s: ParentStore): boolean => tryWriteFileAtomic(FILE, JSON.stringify(s, null, 2), 'parent')
/** Un integrante leído de disco, validando todo (el cuerpo de la v2 por integrante). Lo que falta o vino mal en `features`
 *  queda APAGADO (fail-closed). `seen` = ids de premio de TODA la familia: uno repetido entre integrantes se saltea (los
 *  canjes y la lista de deseos no saben de integrantes). */
function sanitizeMember(raw: unknown, seen: Set<number>, who: string): MemberConfig {
  const r = isObject(raw) ? raw : {}
  const rf = isObject(r.features) ? r.features : {}
  const features = allFeatures(false)
  for (const k of FEATURE_KEYS) {
    if (typeof rf[k] === 'boolean') features[k] = rf[k] as boolean
    else console.warn(`[parent] parent.json: ${who} sin "${k}" válido: queda APAGADO hasta que el adulto lo prenda`)
  }
  const items: ParentItem[] = []
  for (const it of Array.isArray(r.items) ? r.items : []) {
    const o = isObject(it) ? it : {}
    const id = toInt(o.id), title = checkTitle(o.title), desc = checkDesc(o.desc), price = checkPrice(o.price), emoji = checkEmoji(o.emoji), stock = checkStock(o.stock)
    if (id !== null && seen.has(id)) { console.warn(`[parent] premio #${id} repetido en parent.json (${who}): ya es de otro integrante o está dos veces, lo salteo`); continue }
    if (id === null || id < 1 || !title.ok || !desc.ok || !price.ok || !emoji.ok || !stock.ok) {
      console.warn(`[parent] premio inválido en parent.json (${who}), lo salteo:`, JSON.stringify(it).slice(0, 160)); continue
    }
    seen.add(id)
    const updatedAt = toInt(o.updatedAt)
    items.push({
      id, emoji: emoji.value, title: title.value, ...(desc.value ? { desc: desc.value } : {}), price: price.value, stock: stock.value,
      archived: o.archived === true, createdAt: toInt(o.createdAt) ?? Date.now(), ...(updatedAt ? { updatedAt } : {}),
    })
  }
  return {
    features, items,
    topics: sanitizeTopics(r.topics, who),
    extraWords: sanitizeTerms(r.extraWords, 'palabra', TERMS.words, who),
    volume: sanitizeVolume(r.volume),
    preset: typeof r.preset === 'string' && PRESETS.some(p => p.id === r.preset) ? r.preset : null,
    // Feed v6 (aditivo con default; su falta no reescribe el archivo)
    feedMotion: isFeedMotion(r.feedMotion) ? r.feedMotion : 'normal',
  }
}
/** parent.json v3 (ya en esa forma: familyMigrate.upgradeParentRaw) → store validado. */
function sanitize(raw: Record<string, unknown>): ParentStore {
  const seen = new Set<number>()
  const members: Record<string, MemberConfig> = {}
  for (const [id, m] of Object.entries(isObject(raw.members) ? raw.members : {})) {
    if (!MEMBER_ID.test(id)) { console.warn(`[parent] integrante con un id inválido en parent.json, lo salteo: ${JSON.stringify(id).slice(0, 60)}`); continue }
    members[id] = sanitizeMember(m, seen, id)
  }
  const ids = Object.values(members).flatMap(m => m.items.map(i => i.id + 1))
  return {
    version: 3, seq: Math.max(toInt(raw.seq) ?? 1, ...ids, 1),
    // zona horaria de la familia (deuda 14-oct; null = la del server)
    tz: isValidTimeZone(raw.tz) ? raw.tz : null,
    // Sin pinHash válido (parent.json de antes del PIN) → el del PIN del demo; load() lo deja escrito.
    pinHash: isPinHash(raw.pinHash) ? raw.pinHash : DEMO_PIN_HASH,
    members,
  }
}
/** Cada dependiente del seed sin entrada nace con la config de fábrica (consume `seq`). Devuelve a quiénes creó. */
function ensureMembers(s: ParentStore, deps: string[]): string[] {
  const created: string[] = []
  for (const d of deps) if (!Object.hasOwn(s.members, d)) { s.members[d] = memberDefaults(s); created.push(d) }
  return created
}
/** Los campos de la v2 que le faltaban a algún integrante de un v3 (p. ej. un v1 pegado a mano adentro): reescribe. */
const V2_FIELDS = ['topics', 'extraWords', 'volume', 'preset'] as const
function memberFieldsMissing(raw: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const [id, m] of Object.entries(isObject(raw.members) ? raw.members : {})) {
    if (!MEMBER_ID.test(id)) continue
    for (const k of V2_FIELDS) if (!isObject(m) || !(k in m)) out.push(`${id}: ${k}`)
  }
  return out
}
function load(): ParentStore {
  const deps = allDependents() // ['ian','luna']
  if (!existsSync(FILE)) {
    const s = seed(deps)
    writeAtomic(s) // primera vez: queda escrito ya, no espera a un cambio
    console.log(`[parent] parent.json creado (v3): ${deps.join(', ')} con las funcionalidades prendidas y los premios demo + PIN del demo (hash)`)
    return s
  }
  // Leer y llevar a la forma v3: si ESTO falla, el archivo es ilegible. El saneo va afuera del try a propósito: escrito
  // para no tirar con ningún dato, y si tirara por un bug, mejor que el server no arranque a que renombre la config real.
  let up: ReturnType<typeof upgradeParentRaw>, text: string
  try {
    text = readFileSync(FILE, 'utf8')
    up = upgradeParentRaw(JSON.parse(text), DEFAULT_USER_ID)
  } catch (e) {
    // Fail-closed: sin la config del padre no se prende nada opcional. Se guarda copia del roto. El PIN
    // vuelve al del demo (si no, nadie podría entrar a la Zona de padres a prender las cosas de nuevo).
    console.error('[parent] parent.json ilegible → arranco CERRADO (todos los integrantes con todo apagado y sin premios); copia en .roto-*:', e)
    quarantine(FILE, 'parent') // sin copia: seguimos igual
    const s: ParentStore = { version: 3, seq: 1, tz: null, pinHash: DEMO_PIN_HASH, members: Object.fromEntries(deps.map(d => [d, closedMember()])) }
    writeAtomic(s) // si no, el próximo arranque vería "sin archivo" y sembraría todo prendido
    return s
  }
  if (up.from !== 3) backupBeforeMigrate(FILE, '.pre-v3', text, 'parent') // copia LITERAL (nunca saltea: durable.ts)
  const s = sanitize(up.raw)
  const created = ensureMembers(s, deps)
  const missing = memberFieldsMissing(up.raw)
  const noPin = !isPinHash(up.raw.pinHash)
  if (up.from !== 3 || created.length || missing.length || noPin) {
    writeAtomic(s) // migración en el acto
    console.log(`[parent] parent.json → v3${up.from !== 3 ? ` (desde v${up.from}: lo de antes pasa a ${DEFAULT_USER_ID})` : ''}${created.length ? ` · integrantes nuevos con la config de fábrica: ${created.join(', ')}` : ''}${missing.length ? ` · campos con su valor por defecto: ${missing.join(', ')}` : ''}${noPin ? ' · hash del PIN del demo' : ''}`)
  }
  return s
}
const store: ParentStore = load()
const save = () => writeAtomic(store)
/** FS-BASE-B (hallazgo parent.ts:732): un cambio de la config, DISCO PRIMERO. `change` trabaja sobre una COPIA del store; si
 *  parent.json se escribe, la copia pasa a regir; si no, la RAM queda como estaba (el candado NO rige) y devuelve false. */
function commit(change: (draft: ParentStore) => void): boolean {
  const draft = structuredClone(store)
  change(draft)
  if (!writeAtomic(draft)) return false
  store.seq = draft.seq; store.tz = draft.tz; store.pinHash = draft.pinHash; store.members = draft.members
  return true
}
// schedule.ts evalúa el ciclo del día en la zona de la familia: se la PRESTA este módulo (dueño del dato) sin que schedule.ts
// lo importe (no hay ciclo; la función recién se llama al atender pedidos). Lo mismo progress.ts (U4: el corte de semana de
// la XP y el día de la racha, en la misma zona que el ciclo de liga).
setFamilyTzSource(() => store.tz)
setProgressTzSource(() => store.tz)

/** La config de un integrante (sin crear nada); undefined si no tiene. */
const memberConf = (id: string): MemberConfig | undefined => (Object.hasOwn(store.members, id) ? store.members[id] : undefined)
/** El integrante M de las rutas de Familia (memberFor ya lo validó: es un dependiente, y load() creó a todos). */
function mem(id: string): MemberConfig {
  const m = memberConf(id)
  if (m) return m
  // No debería pasar (load() crea a todos los dependientes del seed): por las dudas nace con la config de fábrica.
  const fresh = memberDefaults(store)
  store.members[id] = fresh
  save()
  console.warn(`[parent] ${id} no tenía configuración: nace con la de fábrica`)
  return fresh
}

/* ---------- API para los módulos del server (imports, no HTTP) ---------- */
/* ACCESOS EXPLÍCITOS (rutas de Familia sobre el integrante M y el gating que tiene req: index/market/leagues/friends). */
/** ¿Esta funcionalidad está prendida PARA ESTE CHICO? Fail-closed: clave o integrante desconocidos → false. */
export const featureOn = (key: FeatureKey, childId: string): boolean => memberConf(childId)?.features[key] === true
// U5-B: los candados de las medallas (medals.ts no importa este módulo: este se registra). Las de `domain` ('amigos' /
// 'ligas') se ESCONDEN —no se borran— si ese chico tiene la funcionalidad apagada. ⚠ featureOn de un ADULTO da false
// (fail-closed: no tiene config de integrante): sin el `kind === 'adult'`, al adulto se le escondería su propia copa.
registerMedalGate((uid, d) => userById(uid)?.kind === 'adult' || featureOn(d, uid))
/** Los on-off de un integrante (copia); sin config → todo apagado (fail-closed). */
export const memberFeatures = (id: string): ParentFeatures => { const m = memberConf(id); return m ? { ...m.features } : allFeatures(false) }
/** Los topes de volumen de un integrante (copia); sin config → 100/100 (sin tope, como Smarty). */
export const memberVolume = (id: string): ParentVolume => { const m = memberConf(id); return m ? { ...m.volume } : fullVolume() }
/** De qué integrante es un premio (los ids son únicos en la familia); undefined si no es de nadie. */
export function itemOwner(itemId: number): string | undefined {
  for (const [id, m] of Object.entries(store.members)) if (m.items.some(i => i.id === itemId)) return id
  return undefined
}
/** U5-A: los premios NO archivados de un integrante (copias, en su orden): las opciones "De la Tienda de Luna" del premio de
 *  la semana de la familia. Sin config → []. */
export const memberItemsOf = (id: string): ParentItem[] => (memberConf(id)?.items ?? []).filter(i => !i.archived).map(i => ({ ...i }))
/** Un premio de CUALQUIER integrante (copia): para el 400 de "solo se puede regalar ropa". */
export function anyParentItem(itemId: number): ParentItem | undefined {
  for (const m of Object.values(store.members)) { const it = m.items.find(i => i.id === itemId); if (it) return { ...it } }
  return undefined
}
/** Zona horaria IANA de la familia (null = la del server): la franja del Feed (feedFake.ts) se lee en ella. */
export const familyTz = (): string | null => store.tz

/* POLÍTICA VIGENTE (requestContext.ts): lo que rige en ESTE pedido según su usuario activo (tabla §1.7 de la spec U3). */
interface Policy {
  /** de qué integrante es (null: el adulto o "sin pedido") */ memberId: string | null
  features: ParentFeatures; topics: ParentTopics; extraWords: readonly string[]; feedMotion: FeedMotion; items: readonly ParentItem[]
}
const CLOSED: MemberConfig = closedMember() // un chico sin config: nada opcional (no se muta nunca)
const policyOf = (id: string, m: MemberConfig): Policy => ({ memberId: id, features: m.features, topics: m.topics, extraWords: m.extraWords, feedMotion: m.feedMotion, items: m.items })
const ADULT_POLICY: Policy = { memberId: null, features: allFeatures(true), topics: noTopics(), extraWords: [], feedMotion: 'normal', items: [] }
/** D1 (coordinador, 28-oct): al ADULTO no lo alcanzan los filtros ni los candados de sus hijos — protección de FÁBRICA
 *  sola (sin temas ni palabras de la familia), todo prendido, sin topes, Feed normal y la Tienda solo con la ropa de
 *  plataforma (los premios son para los chicos). Si Esteban pide "el adulto con la suma de los filtros de sus hijos",
 *  esta función pasa a devolver `unionPolicy()` (y nada más cambia). */
const adultPolicy = (): Policy => ADULT_POLICY
/** Sin pedido (arranque, timers sueltos): una funcionalidad rige prendida solo si TODOS los integrantes la tienen
 *  prendida; temas negros y palabras = la unión de todos (fail-closed: esconde de más, nunca de menos); sin sugerencias. */
function unionPolicy(): Policy {
  const ms = allDependents().map(d => memberConf(d) ?? CLOSED)
  const features = allFeatures(true)
  for (const k of FEATURE_KEYS) features[k] = ms.every(m => m.features[k] === true)
  const union = (lists: readonly (readonly string[])[]) => {
    const out: string[] = [], seen = new Set<string>()
    for (const l of lists) for (const t of l) { const k = keyOf(t); if (!seen.has(k)) { seen.add(k); out.push(t) } }
    return out
  }
  return { memberId: null, features, topics: { white: [], black: union(ms.map(m => m.topics.black)) }, extraWords: union(ms.map(m => m.extraWords)), feedMotion: 'normal', items: [] }
}
function policyNow(): Policy {
  const u = currentUser()
  if (!u) return unionPolicy()
  if (u.kind === 'adult') return adultPolicy()
  return policyOf(u.id, memberConf(u.id) ?? CLOSED)
}
/** ¿Prendida para el usuario del pedido en curso? (feed, respuesta en vuelo de los NPC). Adulto → siempre. */
export const featureOnNow = (key: FeatureKey): boolean => policyNow().features[key] === true
/** El integrante cuya config rige en este pedido (el chico activo); null con un adulto o sin pedido. */
export const policyMemberId = (): string | null => policyNow().memberId
/** Los premios del chico activo (archivados incluidos), como copias; con un adulto, ninguno (D1). */
export const policyItems = (): ParentItem[] => policyNow().items.map(i => ({ ...i }))
export function policyItem(id: number): ParentItem | undefined {
  const it = policyNow().items.find(i => i.id === id)
  return it ? { ...it } : undefined
}
/** Palabras bloqueadas de la familia que rigen (se suman a las de fábrica en filters.matchBlockedWord y en el veto de
 *  medios del chat). */
export const familyWords = (): readonly string[] => policyNow().extraWords
/** Lo que filters.matchBlockedWord corta POR DEFECTO además de las palabras de fábrica: las palabras de la familia y el
 *  nombre de cada tema NEGRO de la familia como frase exacta (así un tema negro tampoco aparece en búsquedas, títulos,
 *  Mi espacio, ejercicios, el chat o los mensajes a amigos; el sentido del tema lo vigilan además los jueces). */
export function familyBlockedTerms(): string[] {
  const p = policyNow()
  return p.topics.black.length ? [...p.extraWords, ...p.topics.black] : [...p.extraWords]
}
/** Temas de la familia que rigen (copias): el feed los usa para filtrar (negros) y priorizar (blancos). */
export const familyTopics = (): ParentTopics => { const t = policyNow().topics; return { white: [...t.white], black: [...t.black] } }
type Topic = ReturnType<typeof blackTopics>[number]
function withFamily(base: Topic[], extra: readonly string[], kind: Topic['kind']): Topic[] {
  if (!extra.length) return base
  const have = new Set(base.map(t => keyOf(t.name)))
  return [...base, ...extra.filter(n => !have.has(keyOf(n))).map((name): Topic => ({ kind, name, description: '', critical: false }))]
}
/** Lista NEGRA que vigilan los jueces (entrada/salida del chat, lector, mensajes entre amigos): la de fábrica (Smarty) +
 *  la de la familia que rige, sin repetidos. Reemplaza a config.blackTopics() en sus consumidores. */
export const blackTopicsAll = (): Topic[] => withFamily(blackTopics(), policyNow().topics.black, 'negra')
/** Lista BLANCA (lo que el chat puede tratar): la de fábrica + las sugerencias de la familia que rigen. OJO: la de fábrica
 *  trae temas que el chat trata SOLO si el chico pregunta (educación sexual): para proponer, familyTopics().white. */
export const whiteTopicsAll = (): Topic[] => withFamily(whiteTopics(), policyNow().topics.white, 'blanca')
/** Dial de animación del Feed que rige (feedFake lo manda en cada GET /api/feed: FeedResponse.motion). */
export const feedMotion = (): FeedMotion => policyNow().feedMotion

/** ¿El texto "pega" con alguno de estos temas? Determinístico (sin modelo) para el feed: todas las palabras con
 *  contenido del tema tienen que aparecer en el texto como palabra entera, sin tildes ni mayúsculas y tolerando el
 *  plural ("volcanes" pega con "volcán" y con "Volcanes de Argentina"; "ideología de género" pide las dos).
 *  Devuelve el tema que pegó (o null). Bloquear de más acá es seguro: es lo que la familia pidió que no aparezca. */
export function topicHit(text: string, topics: readonly string[]): string | null {
  if (!text || !topics.length) return null
  const hay = ` ${keyOf(text).replace(/[^a-z0-9]+/g, ' ').trim()} `
  const stem = (w: string) => (w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)
  // FS-BASE-B (hallazgo videos.ts:113, la misma regla acá): el plural de -z es -ces ("disfraz" pega con "Disfraces…", "cruz"
  // con "cruces"; antes no, y un tema NEGRO así dejaba pasar el plural: fail-open angosto).
  const zForms = (w: string) => (w.endsWith('z') ? [`${w.slice(0, -1)}ces`] : w.length > 4 && w.endsWith('ces') ? [`${w.slice(0, -3)}z`] : [])
  const has = (w: string) => { const s = stem(w); return [s, `${s}s`, `${s}es`, ...zForms(w)].some(f => hay.includes(` ${f} `)) }
  for (const t of topics) {
    const ws = topicWords(t)
    if (ws.length && ws.every(has)) return t
  }
  return null
}

/* ---------- avisos al padre (PERSISTIDOS desde FS-BASE-A en server/data/alerts.json; ver la cabecera) ---------- */
interface Alert {
  id: number; ts: number; kind: AlertKind; text: string; source: string; seen: boolean; /** U3: el chico ACTIVO que lo disparó */ childId?: string
  /** FS-BASE-A, INTERNO (no se sirve): el aviso agrupado "sin clasificar" de notifyUnreviewed — cuántos mensajes y los
   *  últimos textos. */ agg?: { n: number; quotes: string[] }
}
const ALERTS_FILE = join(SERVER_ROOT, 'data', 'alerts.json')
/** Tope de avisos guardados: al pasarse se van primero los VISTOS más viejos, después los no-crisis sin ver más viejos; una
 *  crisis sin ver no se desaloja (salvo que ellas solas pasen ALERTS_HARD, para que el archivo no crezca sin fin). */
const MAX_ALERTS = 200
const ALERTS_HARD = 1000
const ALERT_KINDS: readonly AlertKind[] = ['crisis', 'contacto', 'bloqueos']
/** Sin archivo (o ilegible): los ids arrancan en los segundos del reloj, que no retroceden entre procesos. */
const seqFloor = () => Math.max(1, Math.floor(Date.now() / 1000))
const strOf = (v: unknown, max: number) => (typeof v === 'string' ? cleanText(v).slice(0, max) : '')
/** Una fila de alerts.json leída de disco, validando todo; null = se descarta. */
function sanitizeAlert(r: unknown, ids: Set<number>): Alert | null {
  if (!isObject(r)) return null
  const id = typeof r.id === 'number' && Number.isSafeInteger(r.id) && r.id > 0 ? r.id : null
  if (id === null || ids.has(id)) return null
  const kind = ALERT_KINDS.find(k => k === r.kind)
  const text = strOf(r.text, 2000), source = strOf(r.source, 80)
  if (!kind || !text || typeof r.ts !== 'number' || !Number.isFinite(r.ts)) return null
  ids.add(id)
  const a: Alert = { id, ts: Math.round(r.ts), kind, text, source: source || 'Innerith', seen: r.seen === true } // sin dato: SIN VER (lo seguro)
  if (typeof r.childId === 'string' && MEMBER_ID.test(r.childId)) a.childId = r.childId
  if (isObject(r.agg) && typeof r.agg.n === 'number' && r.agg.n > 0 && Array.isArray(r.agg.quotes)) {
    a.agg = { n: Math.min(Math.round(r.agg.n), 9999), quotes: r.agg.quotes.map(q => strOf(q, 160)).filter(Boolean).slice(-3) }
  }
  return a
}
function loadAlerts(): { seq: number; list: Alert[] } {
  if (!existsSync(ALERTS_FILE)) return { seq: seqFloor(), list: [] } // nace con el primer aviso
  try {
    const raw: unknown = JSON.parse(readFileSync(ALERTS_FILE, 'utf8'))
    if (!isObject(raw) || !Array.isArray(raw.alerts)) throw new Error('forma inesperada')
    const ids = new Set<number>()
    const list = raw.alerts.map(r => sanitizeAlert(r, ids)).filter((a): a is Alert => a !== null).sort((a, b) => a.id - b.id)
    if (list.length < raw.alerts.length) console.warn(`[parent] alerts.json: descarto ${raw.alerts.length - list.length} aviso(s) mal formados`)
    const maxId = list.reduce((m, a) => Math.max(m, a.id), 0)
    const stored = typeof raw.seq === 'number' && Number.isSafeInteger(raw.seq) ? raw.seq : 1
    return { seq: Math.max(stored, maxId + 1, 1), list }
  } catch (e) {
    console.error('[parent] alerts.json ilegible → arranco sin avisos (copia en .roto-*):', e)
    quarantine(ALERTS_FILE, 'parent') // sin copia: seguimos igual
    return { seq: seqFloor(), list: [] }
  }
}
const loadedAlerts = loadAlerts()
const alerts: Alert[] = loadedAlerts.list // del más viejo al más nuevo
let alertSeq = loadedAlerts.seq
/** Guarda los avisos (atómico; 0600: una crisis lleva el texto del chico). Si falla: log y el aviso sigue en RAM (un "visto"
 *  que no se guardó vuelve como Nuevo tras un reinicio: la dirección segura). */
function saveAlerts(): boolean {
  return tryWriteFileAtomic(ALERTS_FILE, JSON.stringify({ version: 1, seq: alertSeq, alerts }), 'parent', { mode: 0o600 }) // durable.ts
}
/** El tope (ver MAX_ALERTS): nunca desaloja una crisis sin ver mientras haya otra cosa que sacar. */
function evictAlerts(): void {
  const drop = (pick: (a: Alert) => boolean, limit: number) => {
    while (alerts.length > limit) { const i = alerts.findIndex(pick); if (i < 0) return; alerts.splice(i, 1) }
  }
  drop(a => a.seen, MAX_ALERTS)
  drop(a => a.kind !== 'crisis', MAX_ALERTS)
  drop(() => true, ALERTS_HARD)
}
/** Agrega un aviso (id nuevo, nunca reusado), aplica el tope y persiste. */
function pushAlert(a: Omit<Alert, 'id'>): void {
  alerts.push({ id: alertSeq++, ...a })
  evictAlerts()
  saveAlerts()
}
/** Bloqueos repetidos: cuántos hacen un aviso ("insistió") y en qué ventana. El umbral es el del sondeo de Smarty
 *  (const.sondeoUmbral: N redirecciones en una sesión → evento 'sondeo' para el padre). U3: se cuentan POR CHICO y fuente
 *  (Ian + Luna no suman un "insistió" entre los dos). */
const BLOCK_WINDOW_MS = 10 * 60_000
const blockTimes = new Map<string, number[]>()
const blockThreshold = () => Math.max(2, Math.round(ov.num('const.sondeoUmbral')) || 3)
const quote = (s: string, n: number) => { const t = cleanText(s); return t.length > n ? `${t.slice(0, n - 1)}…` : t }
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** Aviso para el padre (Familia → Avisos). Lo llaman los ganchos de friendsFake.ts y chat.ts.
 *  - kind 'crisis': `text` = lo que el chico escribió, y el aviso lo MUESTRA entero (decisión de Esteban, 11-oct-2026:
 *    "que se vea con toda la info"; revierte la cuarentena del aviso que había elegido la tanda P — la cuarentena del
 *    CONTEXTO del chat sigue intacta, esto es solo el panel del padre).
 *  - kind 'contacto': `text` = el mensaje que el Moderador frenó (link, teléfono, otra app, encuentros, datos personales).
 *  - kind 'bloqueos': cada llamada es UN mensaje frenado; el aviso sale recién al juntar `const.sondeoUmbral` en la
 *    misma fuente dentro de 10 minutos ("insistió"), y el contador vuelve a cero.
 *  U3: el aviso es SOBRE el chico activo del pedido (requestContext): queda etiquetado con su id y el texto usa su nombre
 *  ("Luna escribió: «…»"); con un ADULTO activo no se genera (solo log: los avisos son sobre los integrantes); fuera de un
 *  pedido, sin etiqueta y "tu hijo".
 *  `source` = dónde pasó, en minúscula para ir dentro de una oración ("el chat con el asistente"). Nunca tira.
 *  FS-BASE-A: `opts.unclassified` (solo con 'crisis') = la crisis NO la vio el juez —no respondió— sino la red de frases
 *  (crisisNet.ts): el aviso lo dice ("sin clasificar") para que el padre lo lea sabiendo que puede no serlo. Todo aviso
 *  queda PERSISTIDO (alerts.json) apenas nace. */
export function notifyParent(kind: AlertKind, text: string, source: string, opts?: { unclassified?: boolean }): void {
  try {
    const src = quote(String(source ?? ''), 80) || 'Innerith'
    const u = currentUser()
    if (u?.kind === 'adult') { console.log(`[parent] ${kind} con un adulto activo en ${src}: sin aviso (los avisos son sobre los integrantes)`); return }
    const child = u?.kind === 'child' ? u : undefined
    const kid = child?.name || 'tu hijo', Kid = cap(kid)
    let body: string
    if (kind === 'crisis' && opts?.unclassified) {
      const said = quote(String(text ?? ''), 220)
      body = `Posible mensaje de crisis en ${src}, sin clasificar: el revisor automático no respondió y una red de frases lo marcó.${said ? ` ${Kid} escribió: «${said}».` : ''} Se le mostró el mensaje de contención de la familia, que lo invita a hablarlo con un adulto de confianza. Leelo y, si hace falta, hablalo con ${kid} con calma cuanto antes.`
    } else if (kind === 'crisis') {
      const said = quote(String(text ?? ''), 220)
      body = `Hubo un mensaje de crisis en ${src}.${said ? ` ${Kid} escribió: «${said}».` : ''} Se le mostró el mensaje de contención de la familia, que lo invita a hablarlo con un adulto de confianza. Hablalo con ${kid} con calma cuanto antes.`
    } else if (kind === 'contacto') {
      const said = quote(String(text ?? ''), 140)
      body = `${Kid} quiso pasar un dato de contacto o seguir la charla fuera de Innerith en ${src}${said ? `: «${said}»` : ''}. El Moderador lo frenó y el mensaje no llegó.`
    } else {
      const now = Date.now(), key = `${child?.id ?? '-'}|${src}`
      const recent = (blockTimes.get(key) ?? []).filter(t => now - t < BLOCK_WINDOW_MS)
      recent.push(now)
      if (recent.length < blockThreshold()) { blockTimes.set(key, recent); return }
      blockTimes.delete(key)
      const said = quote(String(text ?? ''), 100)
      body = `${Kid} insistió: el Moderador frenó ${recent.length} mensajes suyos en ${src} en pocos minutos (palabras, insultos o temas que la familia no quiere). Ninguno llegó.${said ? ` El último: «${said}».` : ''}`
    }
    pushAlert({ ts: Date.now(), kind, text: body, source: src, seen: false, ...(child ? { childId: child.id } : {}) })
    console.log(`[parent] AVISO ${kind.toUpperCase()}${opts?.unclassified && kind === 'crisis' ? ' (sin clasificar)' : ''} en ${src}${child ? ` · sobre ${child.id}` : ''}`) // nunca se loguea lo que escribió el chico
  } catch (e) { console.error('[parent] no pude registrar el aviso:', e) }
}
/** FS-BASE-A: un mensaje del chico que el revisor automático NO pudo revisar (juez de entrada caído, vencido o con un
 *  veredicto fuera de esquema) y que la red de frases (crisisNet.ts) no marcó. No se le mostró nada (fail-closed), pero
 *  podría ser importante y nadie más lo vio: el padre lo recibe como aviso de crisis "sin clasificar", con el texto. AGRUPADO
 *  para que una caída del modelo no llene Avisos: mientras haya uno SIN VER del mismo chico y la misma fuente con menos de
 *  10 minutos, se REEMPLAZA por uno nuevo (id nuevo: una pestaña vieja no marca como visto lo que todavía no leyó) con la
 *  cuenta y los últimos 3 textos. Con un adulto activo, nada (como notifyParent). Nunca tira. */
export function notifyUnreviewed(text: string, source: string): void {
  try {
    const src = quote(String(source ?? ''), 80) || 'Innerith'
    const u = currentUser()
    if (u?.kind === 'adult') { console.log(`[parent] mensaje sin revisar de un adulto en ${src}: sin aviso`); return }
    const child = u?.kind === 'child' ? u : undefined
    const Kid = cap(child?.name || 'tu hijo')
    const now = Date.now()
    const i = alerts.findIndex(a => !!a.agg && !a.seen && a.childId === child?.id && a.source === src && now - a.ts < BLOCK_WINDOW_MS)
    const prev = i >= 0 ? alerts.splice(i, 1)[0] : undefined
    const n = (prev?.agg?.n ?? 0) + 1
    const quotes = [...(prev?.agg?.quotes ?? []), quote(String(text ?? ''), 140)].filter(Boolean).slice(-3)
    const said = quotes.map(q => `«${q}»`).join(' · ')
    const body = `Sin clasificar: el revisor automático no pudo revisar ${n === 1 ? 'un mensaje' : `${n} mensajes`} de ${Kid} en ${src} (no respondió). No se le mostró ninguna respuesta y se le sugirió hablar con un adulto de confianza si le pasa algo. Por si era importante, ${quotes.length > 1 ? 'esto es lo último que escribió' : 'esto es lo que escribió'}: ${said}.`
    pushAlert({ ts: now, kind: 'crisis', text: body, source: src, seen: false, ...(child ? { childId: child.id } : {}), agg: { n, quotes } })
    console.log(`[parent] AVISO SIN CLASIFICAR (${n}) en ${src}${child ? ` · sobre ${child.id}` : ''}`) // sin el texto del chico
  } catch (e) { console.error('[parent] no pude registrar el aviso sin clasificar:', e) }
}
/** Los avisos (el más nuevo primero) con el nombre del chico; con `member`, solo los de ese integrante. La forma ParentAlert
 *  de types.ts (los campos internos, como `agg`, no se sirven). */
const alertList = (member?: string) => alerts.slice().reverse()
  .filter(a => member === undefined || a.childId === member)
  .map(a => ({
    id: a.id, ts: a.ts, kind: a.kind, text: a.text, source: a.source, seen: a.seen,
    ...(a.childId ? { childId: a.childId, childName: userById(a.childId)?.name ?? a.childId } : {}),
  }))

/* ---------- sesión de la Zona de padres (RAM) ---------- */
const SESSION_MS = 15 * 60_000
const MAX_SESSIONS = 20
const sessions = new Map<string, number>() // sha256(token) hex → vence (epoch ms)
const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest()
const tokenKey = (t: string) => sha256(t).toString('hex')
function openSession(): string {
  const now = Date.now()
  for (const [k, exp] of sessions) if (exp <= now) sessions.delete(k)
  while (sessions.size >= MAX_SESSIONS) { const oldest = sessions.keys().next().value; if (oldest === undefined) break; sessions.delete(oldest) }
  const token = randomBytes(32).toString('base64url')
  sessions.set(tokenKey(token), now + SESSION_MS)
  return token
}
const tokenOf = (req: IncomingMessage): string | null => {
  const t = req.headers['x-parent-token']
  return typeof t === 'string' && t.length >= 20 && t.length <= 200 ? t : null
}
/** ¿Trae una sesión válida? Si sí, la estira otros 15 minutos (deslizante). */
function touchSession(req: IncomingMessage): boolean {
  const t = tokenOf(req)
  if (!t) return false
  const k = tokenKey(t), exp = sessions.get(k)
  if (exp === undefined) return false
  if (exp <= Date.now()) { sessions.delete(k); return false }
  sessions.set(k, Date.now() + SESSION_MS)
  return true
}
function closeSession(req: IncomingMessage) { const t = tokenOf(req); if (t) sessions.delete(tokenKey(t)) }
/** ¿El pedido trae la sesión del padre? Desde el 14-oct (docs/USUARIOS.md §4) es IMPLÍCITA: el usuario activo es un
 *  ADULTO (users.ts). Si no, el token dormido del portón (X-Parent-Token válido; estira la sesión 15 min: deslizante); un
 *  chico sin token → false. Es EL MISMO chequeo de las rutas de este archivo y de las pantallas del PADRE que viven fuera
 *  de /api/parent/*: la ingesta de YouTube (mytube.ts: /api/mytube/admin/*). Sin sesión → 401. (Mentores, /api/mentors*, no
 *  pasa por acá: es SOLO del adulto activo —isAdultReq—, sin token.) */
export function hasParentSession(req: IncomingMessage): boolean { return isAdultReq(req) || touchSession(req) }

/* ---------- PIN de la Zona de padres ---------- */
const MAX_FAILS = 5
const WAIT_MS = 30_000
let fails = 0 // fallidos seguidos (RAM)
let waitUntil = 0
/** Vuelve a cero el rate-limit del PIN (lo llama un acierto y POST /api/demo/reset). */
export function resetUnlockAttempts() { fails = 0; waitUntil = 0 }
/** Mismo camino para TODO lo que no sea el PIN (mal formado, vacío, otro tipo o incorrecto): hash +
 *  comparación en tiempo constante, y la misma respuesta. Nunca se loguea lo que vino. */
function tryUnlock(pin: unknown): { ok: boolean; token?: string; waitSeconds?: number } {
  const now = Date.now()
  if (now < waitUntil) return { ok: false, waitSeconds: Math.ceil((waitUntil - now) / 1000) }
  const ok = timingSafeEqual(sha256(typeof pin === 'string' ? pin.slice(0, 64) : ''), Buffer.from(store.pinHash, 'hex'))
  if (ok) { resetUnlockAttempts(); return { ok: true, token: openSession() } }
  if (++fails < MAX_FAILS) return { ok: false }
  fails = 0
  waitUntil = now + WAIT_MS
  console.warn(`[parent] ${MAX_FAILS} PIN incorrectos seguidos: espera de ${WAIT_MS / 1000} s`)
  return { ok: false, waitSeconds: WAIT_MS / 1000 }
}

/* ---------- lógica (TODO sobre el integrante `mid`, ya validado por memberFor) ---------- */
/** Editar algo a mano deja la configuración de ESE integrante como "propia" (sin preset aplicado). */
function touchedByHand(m: MemberConfig, mid: string) { if (m.preset !== null) { console.log(`[parent] ${mid}: cambio a mano, el preset «${m.preset}» deja de estar aplicado`); m.preset = null } }

function setFeature(mid: string, key: FeatureKey, on: boolean): boolean {
  if (mem(mid).features[key] === on) return true
  const ok = commit(d => { const m = d.members[mid]; m.features[key] = on; touchedByHand(m, mid) })
  if (ok) console.log(`[parent] ${mid}: ${key} → ${on ? 'prendida' : 'APAGADA'}`)
  return ok
}

type Input = Record<string, unknown>
function addItem(mid: string, b: Input): Check<ParentItem> {
  const title = checkTitle(b.title); if (!title.ok) return title
  const desc = checkDesc(b.desc); if (!desc.ok) return desc
  const price = checkPrice(b.price); if (!price.ok) return price
  const emoji = checkEmoji(b.emoji); if (!emoji.ok) return emoji
  const stock = checkStock(b.stock); if (!stock.ok) return stock
  mem(mid)
  let it!: ParentItem
  // El id sale del `seq` de la COPIA: si no se guarda, ni el premio ni el id llegan a regir (el reintento no duplica).
  const ok = commit(d => {
    it = { id: d.seq++, emoji: emoji.value, title: title.value, ...(desc.value ? { desc: desc.value } : {}), price: price.value, stock: stock.value, archived: false, createdAt: Date.now() }
    d.members[mid].items.push(it)
  })
  if (!ok) return fail('No pude guardar el premio. Probá de nuevo.')
  console.log(`[parent] ${mid}: premio #${it.id} publicado: ${it.emoji} ${it.title} (${it.price} ⚡${it.stock !== null ? ` · stock ${it.stock}` : ''})`)
  return { ok: true, value: { ...it } }
}
/** Edición parcial: solo los campos que vienen. `desc: ''` la borra · `stock: null|''` = sin límite ·
 *  `archived: false` reactiva (true archiva). 'missing' = ese premio no existe o no es de este integrante. */
function updateItem(mid: string, id: number, b: Input): Check<true> | 'missing' {
  const m = mem(mid)
  const it = m.items.find(i => i.id === id)
  if (!it) return 'missing'
  const next: ParentItem = { ...it }
  let touched = false
  if ('title' in b) { const c = checkTitle(b.title); if (!c.ok) return c; next.title = c.value; touched = true }
  if ('desc' in b) { const c = checkDesc(b.desc ?? ''); if (!c.ok) return c; if (c.value) next.desc = c.value; else delete next.desc; touched = true }
  if ('price' in b) { const c = checkPrice(b.price); if (!c.ok) return c; next.price = c.value; touched = true }
  if ('emoji' in b) { const c = checkEmoji(b.emoji); if (!c.ok) return c; next.emoji = c.value; touched = true }
  if ('stock' in b) { const c = checkStock(b.stock); if (!c.ok) return c; next.stock = c.value; touched = true }
  if ('archived' in b) { if (typeof b.archived !== 'boolean') return fail('archived tiene que ser true o false.'); next.archived = b.archived; touched = true }
  if (!touched) return fail('No vino ningún cambio para guardar.')
  next.updatedAt = Date.now()
  const i = m.items.indexOf(it)
  if (!commit(d => { d.members[mid].items[i] = next })) return fail('No pude guardar el cambio. Probá de nuevo.')
  console.log(`[parent] ${mid}: premio #${next.id} editado: ${next.emoji} ${next.title} · ${next.price} ⚡ · stock ${next.stock ?? '∞'}${next.archived ? ' · ARCHIVADO' : ''}`)
  return { ok: true, value: true }
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i])
const topicsOf = (m: MemberConfig): ParentTopics => ({ white: [...m.topics.white], black: [...m.topics.black] })
/** Temas: cada lista que viene reemplaza a la anterior. Un tema no puede estar en las dos (400 con el motivo). */
function setTopics(mid: string, b: Input): Check<ParentTopics> {
  if (!('white' in b) && !('black' in b)) return fail('No vino ninguna lista de temas (white o black).')
  const m = mem(mid), kid = memberName(mid)
  const next: ParentTopics = { white: m.topics.white, black: m.topics.black }
  if ('white' in b) { const c = checkTerms(b.white, 'tema', TERMS.topics, kid); if (!c.ok) return c; next.white = c.value }
  if ('black' in b) { const c = checkTerms(b.black, 'tema', TERMS.topics, kid); if (!c.ok) return c; next.black = c.value }
  const inBlack = new Set(next.black.map(keyOf))
  const both = next.white.find(t => inBlack.has(keyOf(t)))
  if (both) return fail(`«${both}» no puede estar en las dos listas: sacalo de una primero.`)
  if (sameList(next.white, m.topics.white) && sameList(next.black, m.topics.black)) return { ok: true, value: topicsOf(m) }
  if (!commit(d => { const dm = d.members[mid]; dm.topics = { white: [...next.white], black: [...next.black] }; touchedByHand(dm, mid) })) return fail('No pude guardar los temas. Probá de nuevo.')
  const now = mem(mid)
  console.log(`[parent] ${mid}: temas de la familia → blancos: ${now.topics.white.length} · negros: ${now.topics.black.length}`)
  return { ok: true, value: topicsOf(now) }
}
function setWords(mid: string, b: Input): Check<string[]> {
  const m = mem(mid)
  const c = checkTerms(b.extra, 'palabra', TERMS.words, memberName(mid))
  if (!c.ok) return c
  if (sameList(c.value, m.extraWords)) return { ok: true, value: [...m.extraWords] }
  if (!commit(d => { const dm = d.members[mid]; dm.extraWords = [...c.value]; touchedByHand(dm, mid) })) return fail('No pude guardar las palabras. Probá de nuevo.')
  console.log(`[parent] ${mid}: palabras de la familia → ${c.value.length} (se suman a las ${config.blockedWords.length} de fábrica)`)
  return { ok: true, value: [...mem(mid).extraWords] }
}
function setVolume(mid: string, b: Input): Check<ParentVolume> {
  if (!('maxMusic' in b) && !('maxNoise' in b)) return fail('No vino ningún tope (maxMusic o maxNoise).')
  const m = mem(mid)
  const next = { ...m.volume }
  if ('maxMusic' in b) { const c = checkVolume(b.maxMusic, 'El tope de la música'); if (!c.ok) return c; next.maxMusic = c.value }
  if ('maxNoise' in b) { const c = checkVolume(b.maxNoise, 'El tope de los ruidos'); if (!c.ok) return c; next.maxNoise = c.value }
  if (next.maxMusic === m.volume.maxMusic && next.maxNoise === m.volume.maxNoise) return { ok: true, value: { ...m.volume } }
  if (!commit(d => { const dm = d.members[mid]; dm.volume = { ...next }; touchedByHand(dm, mid) })) return fail('No pude guardar los topes. Probá de nuevo.')
  console.log(`[parent] ${mid}: topes de volumen → música ${next.maxMusic} · ruidos ${next.maxNoise}`)
  return { ok: true, value: { ...mem(mid).volume } }
}
/** Dial de animación del Feed (patrón de los topes: valida, guarda al toque y rige en el próximo GET del feed). Los
 *  presets no dicen nada de la animación, así que moverlo NO deja la configuración como "propia" (no toca el preset). */
function setFeedMotion(mid: string, b: Input): Check<FeedMotion> {
  if (!isFeedMotion(b.motion)) return fail(`La animación tiene que ser una de: ${FEED_MOTIONS.join(', ')}.`)
  const m = mem(mid)
  if (b.motion === m.feedMotion) return { ok: true, value: m.feedMotion }
  const motion = b.motion
  if (!commit(d => { d.members[mid].feedMotion = motion })) return fail('No pude guardar la animación. Probá de nuevo.')
  console.log(`[parent] ${mid}: animación del Feed → ${motion}`)
  return { ok: true, value: mem(mid).feedMotion }
}

/** Zona horaria de la FAMILIA: una IANA que este motor conoce (se guarda canónica, p. ej. "america/new_york" →
 *  "America/New_York") o null = Automática. */
function setTz(b: Input): Check<string | null> {
  const raw = b.tz
  if (raw !== null && !isValidTimeZone(raw)) return fail('La zona horaria tiene que ser una IANA (por ejemplo America/Argentina/Buenos_Aires) o null = automática.')
  const tz = raw === null ? null : new Intl.DateTimeFormat('en-US', { timeZone: raw }).resolvedOptions().timeZone
  if (tz === store.tz) return { ok: true, value: store.tz }
  if (!commit(d => { d.tz = tz })) return fail('No pude guardar la zona horaria. Probá de nuevo.')
  console.log(`[parent] zona horaria de la familia → ${tz ?? 'automática (la del server)'}`)
  return { ok: true, value: store.tz }
}

const wordsView = (m: MemberConfig) => ({ extra: [...m.extraWords], builtin: config.blockedWords.length })
/** ParentConfig de un integrante (+ `member` y sus `features`; la `tz` es de la familia). */
function configView(mid: string) {
  const m = mem(mid)
  return { topics: topicsOf(m), words: wordsView(m), volume: { ...m.volume }, preset: m.preset, feedMotion: m.feedMotion, tz: store.tz, member: mid, features: { ...m.features } }
}
const presetView = (p: PresetDef) => ({
  id: p.id, name: p.name, desc: p.desc,
  // aditivo (ver cabecera): lo que deja configurado, para que el panel muestre qué prende y qué apaga
  spec: { features: { ...p.features }, topics: { white: [...p.topics.white], black: [...p.topics.black] }, words: [...p.words], volume: { ...p.volume } },
})
function applyPreset(mid: string, id: unknown): { ok: true; preset: PresetDef } | { ok: false; status: number; error: string } {
  const p = PRESETS.find(x => x.id === id)
  if (!p) return { ok: false, status: 400, error: 'Ese preset no existe.' }
  mem(mid)
  const ok = commit(d => {
    const m = d.members[mid]
    m.features = { ...p.features }
    m.topics = { white: [...p.topics.white], black: [...p.topics.black] }
    m.extraWords = [...p.words]
    m.volume = { ...p.volume }
    m.preset = p.id
  })
  if (!ok) return { ok: false, status: 500, error: 'No pude guardar el preset. Probá de nuevo.' }
  console.log(`[parent] ${mid}: preset «${p.name}» aplicado: ${FEATURE_KEYS.map(k => `${k} ${p.features[k] ? 'on' : 'OFF'}`).join(' · ')} · temas ${p.topics.white.length}+/${p.topics.black.length}- · palabras ${p.words.length} · topes ${p.volume.maxMusic}/${p.volume.maxNoise}`)
  return { ok: true, preset: p }
}

/** Lo que ya protege el backend real para ESTE integrante: lo de fábrica SIEMPRE + lo que sumó la familia para él
 *  (solo lectura en el panel). */
function protections(m: MemberConfig) {
  return {
    /** Sitios de la lista blanca activos (los únicos de donde se leen artículos). */ sites: whitelistSites().length,
    /** Videos del catálogo aprobado (buscador, chat, Mi espacio y Aprender salen de acá). */ videos: catalogSize(),
    /** Palabras bloqueadas: de fábrica + de la familia (búsquedas, títulos, chat, mensajes, ejercicios). */ blockedWords: config.blockedWords.length + m.extraWords.length,
    /** Temas de la lista negra que vigila el revisor automático: de fábrica + de la familia. */ blockedTopics: withFamily(blackTopics(), m.topics.black, 'negra').length,
    /** Modo de dominios para artículos: 'blanca' (solo la lista) · 'negra' · 'hibrido'. */ domainMode: config.articulosModo,
    policyVersion: config.policyVersion,
  }
}

/** La actividad que ve el adulto de un integrante. U4: TODO es DEL INTEGRANTE —su progreso (XP/⚡/racha), lo que está
 *  practicando, lo guardado en SU Mi espacio, sus premios, canjes y protecciones—. Accesos EXPLÍCITOS con `mid`: dentro de
 *  /api/parent/* el usuario del pedido es el ADULTO (summary() devolvería lo de él). */
function activity(mid: string) {
  const s = summaryOf(mid)
  const m = mem(mid)
  // U5-B: sus medallas frescas — el sync corre bajo SU runAsUser (si ganó una, la noticia cae en el feed de ÉL, no en el del
  // adulto que mira); después se leen TODAS (forParent: sin `fresh`, con `hidden` en las que un candado le esconde).
  runAsUser(mid, () => syncMedals(mid))
  return {
    xpWeek: s.xpWeek, ec: s.ec, streakDays: s.streakDays, continue: s.continue,
    saved: allSavedForParent(mid),
    redemptions: listRedemptions(mid),
    // aditivos de la v1 (ya formalizados en types.ts)
    items: m.items.map(i => ({
      id: i.id, emoji: i.emoji, title: i.title, ...(i.desc ? { desc: i.desc } : {}), price: i.price,
      stock: i.stock, left: stockLeft(i), redeemed: redeemedCount(i.id), archived: i.archived, createdAt: i.createdAt,
    })),
    protections: protections(m),
    member: mid,
    // U5-B (aditivo, ParentActivity.medals): TODAS las ganadas por el integrante, sin "Nueva"; `hidden` = 'ligas' | 'amigos'
    // en las que él no ve por un candado ("(Ligas apagadas: Luna no la ve)").
    medals: medalsOf(mid, { forParent: true }),
  }
}

/** id válido = entero positivo (número o string de dígitos). */
const parseId = (b: Input): number | null => { const n = toInt(b.id); return n !== null && n > 0 ? n : null }

/* ---------- rutas ---------- */
const GETS = new Set(['/api/parent/features', '/api/parent/limits', '/api/parent/activity', '/api/parent/config', '/api/parent/alerts', '/api/parent/presets', '/api/parent/music', '/api/parent/cycle'])
const POSTS = new Set([
  '/api/parent/unlock', '/api/parent/lock', '/api/parent/features', '/api/parent/items', '/api/parent/items/update', '/api/parent/items/archive',
  '/api/parent/deliver', '/api/parent/topics', '/api/parent/words', '/api/parent/volume', '/api/parent/alerts/seen', '/api/parent/presets/apply',
  '/api/parent/feed-motion', '/api/parent/music/add', '/api/parent/music/remove', '/api/parent/schedules', '/api/parent/tz', '/api/parent/cycle',
])
/** U3: las rutas POR INTEGRANTE (`?member=`; ausente = el primero). tz, music*, unlock y lock son de la familia; alerts y
 *  alerts/seen llevan member OPCIONAL (sin él: todos). F1: `cycle` (GET y POST) es por integrante; `schedules` ya no
 *  existe (410 antes de mirar el integrante). */
const MEMBER_GETS = new Set(['/api/parent/activity', '/api/parent/config', '/api/parent/presets', '/api/parent/cycle'])
const MEMBER_POSTS = new Set([
  '/api/parent/features', '/api/parent/items', '/api/parent/items/update', '/api/parent/items/archive', '/api/parent/deliver',
  '/api/parent/topics', '/api/parent/words', '/api/parent/volume', '/api/parent/feed-motion', '/api/parent/presets/apply', '/api/parent/cycle',
])
/** F1 (28-oct): el editor de horarios por sección se retiró; el cliente viejo (SchedulesPanel) le pega hasta que F2 lo saque. */
const SCHEDULES_GONE = { error: 'Los horarios por sección fueron reemplazados por el Ciclo del día.' }
/** El 401 de Familia sin sesión. Texto neutro (28-oct; el mismo que el de /api/mytube/admin/*): el portón de PIN y la
 *  "Zona de padres" se retiraron el 14-oct, y con un chico activo la respuesta solo dice que es del adulto. */
const NO_SESSION = { error: 'Solo para un adulto de la familia.' }

export async function parentRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const path = url.pathname.replace(/\/+$/, '')
  const method = req.method ?? 'GET'
  if (!GETS.has(path) && !POSTS.has(path)) return send(res, 404, { error: 'not found' })

  // --- Públicas: las dos que lee la UI del chico, y el portón (dormido: el cliente ya no lo llama). ---
  // Con un CHICO activo, `member` se ignora: cada chico ve lo suyo y nunca lo de un hermano.
  if (method === 'GET' && path === '/api/parent/features') {
    const me = actingUser(req)
    if (me.kind === 'child') return send(res, 200, memberFeatures(me.id))
    // Adulto (A4): los del integrante M —sin member, el primero: lo que muestra el panel de hoy—; sin integrantes, todo
    // prendido (sus propios candados no existen).
    if (!me.dependents?.length) return send(res, 200, allFeatures(true))
    const m = memberFor(req, url)
    return m.ok ? send(res, 200, memberFeatures(m.id)) : send(res, m.status, { error: m.error })
  }
  if (method === 'GET' && path === '/api/parent/limits') {
    const me = actingUser(req)
    return send(res, 200, me.kind === 'child' ? memberVolume(me.id) : fullVolume()) // el adulto no tiene topes (D1)
  }
  if (method === 'POST' && path === '/api/parent/unlock') {
    // Un cuerpo ilegible es un PIN mal formado más: mismo camino, misma respuesta (200 {ok:false}).
    let pin: unknown
    try { pin = (await readJson<Record<string, unknown> | null>(req))?.pin } catch { pin = undefined }
    return send(res, 200, tryUnlock(pin))
  }

  // --- Todo lo demás: con la sesión del padre (fail-closed): el ADULTO activo pasa todo; un chico, solo con el token dormido. ---
  if (!hasParentSession(req)) return send(res, 401, NO_SESSION)
  // Horarios por sección (W7): RETIRADOS por el Ciclo del día (F1). 410 con cualquier método, sin mirar integrante ni cuerpo.
  if (path === '/api/parent/schedules') return send(res, 410, SCHEDULES_GONE)

  // --- El integrante M (antes de leer el cuerpo): `?member=` o el primero; uno que no es de la familia → 400. ---
  let member = ''
  if ((method === 'GET' && MEMBER_GETS.has(path)) || (method === 'POST' && MEMBER_POSTS.has(path))) {
    const m = memberFor(req, url)
    if (!m.ok) return send(res, m.status, { error: m.error })
    member = m.id
  }
  let alertsOf: string | undefined // avisos: member OPCIONAL (sin él, TODOS: excepción deliberada a "el primero")
  if ((path === '/api/parent/alerts' || path === '/api/parent/alerts/seen') && (url.searchParams.get('member') ?? '').trim()) {
    const m = memberFor(req, url)
    if (!m.ok) return send(res, m.status, { error: m.error })
    alertsOf = m.id
  }

  if (method === 'GET') {
    switch (path) {
      case '/api/parent/activity': return send(res, 200, activity(member))
      case '/api/parent/config': return send(res, 200, configView(member))
      case '/api/parent/alerts': return send(res, 200, { alerts: alertList(alertsOf) })
      case '/api/parent/presets': return send(res, 200, { presets: PRESETS.map(presetView), current: mem(member).preset })
      case '/api/parent/music': return send(res, 200, { tracks: allTracks() })
      case '/api/parent/cycle': return send(res, 200, cycleView(member)) // Ciclo del día de M (F1)
    }
    return send(res, 405, { error: 'Método no permitido: usá POST.' })
  }
  if (method !== 'POST' || !POSTS.has(path)) return send(res, 405, { error: 'Método no permitido.' })
  // Cierra el token dormido; con el adulto (sesión implícita, sin token) no hay nada que cerrar: {ok:true} sin efecto.
  if (path === '/api/parent/lock') { closeSession(req); return send(res, 200, { ok: true }) }

  let b: Input
  try {
    const raw = await readJson<unknown>(req)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('no es un objeto')
    b = raw as Input
  } catch { return send(res, 400, { ok: false, error: 'Pedido inválido (se esperaba un objeto JSON).' }) }

  switch (path) {
    case '/api/parent/features': {
      const key = b.key
      if (typeof key !== 'string' || !(FEATURE_KEYS as readonly string[]).includes(key)) return send(res, 400, { error: `key tiene que ser una de: ${FEATURE_KEYS.join(', ')}.` })
      if (typeof b.on !== 'boolean') return send(res, 400, { error: 'on tiene que ser true o false.' })
      if (!setFeature(member, key as FeatureKey, b.on)) return send(res, 500, { error: 'No pude guardar el cambio. Probá de nuevo.' })
      return send(res, 200, memberFeatures(member))
    }
    case '/api/parent/items': {
      const r = addItem(member, b)
      if (!r.ok) return send(res, 400, { error: r.error })
      const it = r.value
      // Forma MarketItem (lo que vería el chico): recién publicado → stock completo y fuera de la lista de deseos.
      return send(res, 200, { id: it.id, title: it.title, ...(it.desc ? { desc: it.desc } : {}), price: it.price, emoji: it.emoji, source: 'padre', stock: it.stock, wished: false })
    }
    case '/api/parent/items/update':
    case '/api/parent/items/archive': {
      const id = parseId(b)
      if (id === null) return send(res, 400, { ok: false, error: 'Falta el premio (id entero positivo).' })
      const patch: Input = path.endsWith('/archive') ? { archived: true } : Object.fromEntries(Object.entries(b).filter(([k]) => k !== 'id'))
      const r = updateItem(member, id, patch)
      if (r === 'missing') return send(res, 200, { ok: false, error: 'Ese premio no existe.' })
      return r.ok ? send(res, 200, { ok: true }) : send(res, 400, { ok: false, error: r.error })
    }
    case '/api/parent/deliver': {
      const id = parseId(b)
      if (id === null) return send(res, 400, { ok: false, error: 'Falta el canje (id entero positivo).' })
      return send(res, 200, { ok: deliverRedemption(id, member) })
    }
    case '/api/parent/topics': {
      const r = setTopics(member, b)
      return r.ok ? send(res, 200, r.value) : send(res, 400, { error: r.error })
    }
    case '/api/parent/words': {
      const r = setWords(member, b)
      return r.ok ? send(res, 200, { extra: r.value, builtin: config.blockedWords.length }) : send(res, 400, { error: r.error })
    }
    case '/api/parent/volume': {
      const r = setVolume(member, b)
      return r.ok ? send(res, 200, r.value) : send(res, 400, { error: r.error })
    }
    case '/api/parent/feed-motion': {
      const r = setFeedMotion(member, b)
      return r.ok ? send(res, 200, { feedMotion: r.value }) : send(res, 400, { error: r.error })
    }
    case '/api/parent/tz': {
      const r = setTz(b)
      return r.ok ? send(res, 200, { tz: r.value }) : send(res, 400, { error: r.error })
    }
    case '/api/parent/alerts/seen': {
      const id = parseId(b)
      const a = id === null ? undefined : alerts.find(x => x.id === id && (alertsOf === undefined || x.childId === alertsOf))
      if (a && !a.seen) { a.seen = true; saveAlerts() } // FS-BASE-A: persiste (si no se pudo, vuelve como Nuevo tras un reinicio)
      return send(res, 200, { ok: !!a })
    }
    case '/api/parent/presets/apply': {
      const r = applyPreset(member, b.id)
      return r.ok ? send(res, 200, { ok: true, config: configView(member), features: memberFeatures(member) }) : send(res, r.status, { ok: false, error: r.error })
    }
    // After Day (W6): lo que no es un link de video (o falta) es un rechazo de negocio más, con el texto del POC.
    case '/api/parent/music/add':
      return send(res, 200, await addTrack(typeof b.url === 'string' ? b.url : '', typeof b.title === 'string' ? b.title : undefined))
    case '/api/parent/music/remove':
      return send(res, 200, { ok: typeof b.videoId === 'string' && b.videoId !== '' && removeTrack(b.videoId) })
    // Ciclo del día (F1) de M: {ranges} REEMPLAZA la lista completa. Inválido (ids repetidos, nombre, horas, secciones, más de
    // 8 rangos) → 400 con el motivo; la validación y schedules.json viven en schedule.ts / cycleRules.ts.
    case '/api/parent/cycle': {
      // FS-BASE-B: los ids que ya tenía M quedan reservados para los rangos nuevos (un id borrado no se recicla en este guardado)
      const c = checkCycle(b.ranges, memberName(member), cycleOf(member).map(r => r.id))
      if (!c.ok) return send(res, 400, { error: c.error })
      return saveCycle(member, c.value) ? send(res, 200, cycleView(member)) : send(res, 500, { error: 'No pude guardar el ciclo del día. Probá de nuevo.' })
    }
  }
  return send(res, 404, { error: 'not found' })
}
