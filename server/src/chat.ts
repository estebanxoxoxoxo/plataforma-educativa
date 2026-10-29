// Chat del niño. Port de sendChildMessage (smarty-poc/app/src/lib/pipeline.ts) + buildSystemPrompt (prompts.ts)
// + tools show_videos / search_images / search_articles / show_articles.
// Sin estado en el servidor: el cliente manda el historial (ya en su versión "de contexto") en cada turno.
// Fuera por ahora: tools de estilo/música/archivo, sondeo de redirecciones y log de eventos al padre (salvo crisis:
// notifyParent, Zona del padre v2).
// U3 (docs/USUARIOS.md §9): rige la config DEL CHICO ACTIVO (temas, palabras, veto de medios, redirección y el aviso de
// crisis la leen por el contexto del pedido: requestContext.ts) y el prompt le habla a ESE chico por su nombre; la "ficha"
// de Smarty (config.ficha) es la de Ian, así que solo va para él. U4 (A7): el chat de un ADULTO activo le habla por SU
// nombre y sin la ficha de Ian (antes decía "Ian" y llevaba su ficha); el bloque de seguridad (pensado para chicos) sigue
// igual para él: más protección de la necesaria, nunca menos.
import { MODELS, config, fill, ov } from './config'
import { matchBlockedWord } from './filters'
// Zona del padre v2: temas y palabras de fábrica + los de la familia, y el aviso de crisis al padre.
import { blackTopicsAll, familyTopics, familyWords, notifyParent, notifyUnreviewed } from './parent'
import { crisisNetHit } from './crisisNet'
import { currentUser } from './requestContext'
import { DEFAULT_USER_ID } from './users'
import { completeWithTools, spotlight, tool, type Msg } from './llm'
import { judgeInput, judgeOutput, type InputVerdict, type Verdict } from './judge'
import { searchPages } from './search'
import { articleTextForChat } from './articles'
import { expandQuery, searchImageTerm, type ImageHit } from './images'
import { getCatalogVideo, loadVideoMeta, searchVideos, toVideoResult, catalogSize } from './videos'

type Source = { title: string; url: string; snippet?: string }
type Ui = { kind: 'videos'; ids: string[] } | { kind: 'images'; terms: { q: string; lente: string | null }[] } | { kind: 'articles'; sources: Source[] }

export interface ChatReply {
  kind: 'normal' | 'redireccion' | 'crisis' | 'failclosed' | 'interceptado'
  text: string
  /** Cómo entra este turno de Smarty al contexto de los próximos turnos (texto + marcadores). */
  contextText: string
  /** Si se setea, reemplaza el mensaje del niño en el contexto (cuarentena: crisis / lista negra). */
  childContextText?: string
  media?: { videos?: ReturnType<typeof toVideoResult>[]; images?: ImageHit[]; articles?: Source[] }
  /** Resumen de la decisión (DecisionTrace de Smarty) — para depurar. */
  trace: string
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]
/** Redirección sin tema (cuando la familia no puso sugerencias): el mismo tono que las de Smarty, sin proponer nada. */
const REDIRECCION_SIN_TEMA = [
  'Esa pregunta es buena para charlarla con tu mamá o papá. Mientras tanto… ¿de qué otra cosa tenés ganas de hablar?',
  'Eso mejor lo hablás con un adulto de tu familia. ¿Hay otra cosa que te dé curiosidad?',
  'Hay temas que van mejor en persona con tu mamá o papá. Si querés, preguntame otra cosa.',
]
/** La redirección de la lista negra. Propone SOLO un tema blanco DE LA FAMILIA del chico activo (sus sugerencias): los
 *  blancos de FÁBRICA son lo que el chat puede tratar si el chico pregunta (hoy, educación sexual: "feto", "óvulos"…),
 *  nunca algo para ofrecerle (fix 28-oct: a una pregunta bloqueada le proponía "seguimos con feto."). Sin sugerencias de
 *  la familia → una redirección genérica, sin tema: las líneas configuradas que no piden {{tema}} o, si todas lo piden,
 *  las de REDIRECCION_SIN_TEMA. */
const pickRedireccion = () => {
  const blancos = familyTopics().white.filter(t => matchBlockedWord(t) === null)
  const arr = ov.lines('redirecciones')
  if (blancos.length) return fill(arr.length ? pick(arr) : pick(REDIRECCION_SIN_TEMA), { tema: pick(blancos) })
  const sinTema = arr.filter(l => !l.includes('{{tema}}'))
  return pick(sinTema.length ? sinTema : REDIRECCION_SIN_TEMA)
}
/** A quién le habla el chat: el chico activo por su nombre (la ficha de Smarty solo es de Ian); un ADULTO por SU nombre y
 *  sin ficha (U4, A7); un pedido sin usuario, como siempre (el apodo y la ficha de la config). */
function chatKid(): { name: string; ficha: typeof config.ficha } {
  const u = currentUser()
  if (u?.kind === 'child') return { name: u.name, ficha: u.id === DEFAULT_USER_ID ? config.ficha : [] }
  if (u?.kind === 'adult') return { name: u.name, ficha: [] }
  return { name: config.apodo, ficha: config.ficha }
}
const helplineSuffix = () => (config.helpline.trim() ? ` También podés comunicarte con: ${config.helpline.trim()}.` : '')
const guionCrisis = () => fill(ov.text('crisis.guion'), { helpline: helplineSuffix() })
/** FS-BASE-A: la línea de cuidado que acompaña al fail-closed cuando el juez de ENTRADA no pudo revisar lo que escribió el
 *  chico (no se sabe si era una crisis): lo invita a hablar con un adulto y le deja la línea de ayuda de la familia. */
const safetyLine = () => ` Si te pasa algo o te sentís mal, contáselo a un adulto de confianza.${helplineSuffix()}`
/** FS-BASE-A (hallazgo chat.ts:252): el juez de ENTRADA no respondió (caído, vencido o veredicto fuera de esquema) → el
 *  mensaje NO se responde normal y una crisis no se pierde en silencio. Si la red de frases (crisisNet.ts) pega, es el
 *  camino de crisis —el guion de contención y el aviso de crisis al padre, marcado "sin clasificar"—; si no, fail-closed con
 *  la línea de cuidado y un aviso "sin clasificar" agrupado (parent.ts: notifyUnreviewed) para que el padre lo lea. Lo usan
 *  el chat, Buscar (searchGuard.ts) y Amigos (friendsFake.ts). */
export function onInputJudgeDown(childText: string, source: string): { crisis: boolean; hit: string | null } {
  const hit = crisisNetHit(childText)
  if (hit) notifyParent('crisis', childText, source, { unclassified: true })
  else notifyUnreviewed(childText, source)
  return { crisis: !!hit, hit }
}
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ')

function buildSystemPrompt(): string {
  const kid = chatKid()
  /* Solo las sugerencias DE LA FAMILIA del chico activo: los blancos de FÁBRICA son lo que el chat puede tratar si el
     chico pregunta (educación sexual), nunca algo para proponerle (mismo criterio que pickRedireccion, fix 28-oct; el
     prompt principal tenía el mismo agujero: le ofrecía esos temas "cuando la charla decae"). */
  const sugerencias = familyTopics().white.filter(t => matchBlockedWord(t) === null)
  const temasBlancos = sugerencias.map(t => `- ${t}`).join('\n')
    || '(la familia no configuró sugerencias: no propongas temas puntuales, respondé lo que pregunte)'
  const fichaTxt = kid.ficha.length ? kid.ficha.map(f => `- [${f.category}] ${f.text}`).join('\n') : '(vacía)'
  const fuentesTxt = config.ytEntries.map(e => `«${e.title}»`).join(' · ')
  const parts = [
    fill(ov.text('sys.seguridad'), { apodo: kid.name || 'un niño' }),
    fill(ov.text('sys.instrucciones'), { instrucciones: config.instrucciones }),
    fill(ov.text('sys.temas'), { temas: temasBlancos }),
    fill(ov.text('sys.ficha'), { NOMBRE: (kid.name || 'EL NIÑO').toUpperCase(), ficha: fichaTxt }),
  ]
  if (fuentesTxt) parts.push(fill(ov.text('sys.videos'), { fuentes: fuentesTxt }))
  if (config.imagenesActivo) parts.push(ov.text('sys.imagenes'))
  parts.push(ov.text('sys.resultados'))
  parts.push(fill(ov.text('sys.formato'), { soloFuentes: config.soloFuentes ? '\n' + ov.text('sys.soloFuentesSufijo') : '' }))
  return parts.join('\n\n')
}

function buildTools() {
  return [
    tool('show_videos', ov.text('tool.showVideos.desc'), { query: { type: 'string', description: ov.text('tool.showVideos.query') } }),
    ...(config.imagenesActivo ? [tool('search_images', ov.text('tool.searchImages.desc'), { query: { type: 'string', description: ov.text('tool.searchImages.query') } })] : []),
    tool('search_articles', ov.text('tool.searchArticles.desc'), { query: { type: 'string', description: ov.text('tool.searchArticles.query') } }),
    tool('show_articles', ov.text('tool.showArticles.desc'), { ids: { type: 'array', items: { type: 'number' }, description: ov.text('tool.showArticles.ids') } }),
  ]
}

/* Executors de los tools. `ultimaBusqueda` es por turno (como en Smarty). */
function makeExecutors(onUi: (u: Ui) => void) {
  let ultimaBusqueda: { id: number; src: Source }[] = []
  return async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    if (name === 'show_videos') {
      const hits = searchVideos(String(args.query ?? ''))
      if (!hits.length) return { found: 0, totalAprobados: catalogSize() }
      onUi({ kind: 'videos', ids: hits.map(h => h.videoId) })
      return { found: hits.length, titulos: hits.map(h => h.title) }
    }
    if (name === 'search_images') {
      const raw = String(args.query ?? '').trim()
      const terms = raw ? await expandQuery(raw) : []
      if (!terms.length) return { error: 'término inválido' }
      onUi({ kind: 'images', terms })
      return { shown: true, terms: terms.map(t => t.q) }
    }
    if (name === 'search_articles') {
      const q = String(args.query ?? '').trim()
      if (!q) return { error: 'consulta vacía' }
      const { results } = await searchPages(q)
      ultimaBusqueda = results.map((r, i) => ({ id: i + 1, src: { title: r.title, url: r.link, snippet: r.snippet } }))
      if (!results.length) return { found: 0 }
      const limpio = (t?: string) => (t && matchBlockedWord(t) === null ? t : undefined)
      const nCuerpo = Math.min(results.length, ov.num('const.articulosCuerpoN'))
      const cuerpos = await Promise.all(results.slice(0, nCuerpo).map(r => articleTextForChat(r.link, ov.num('const.articulosCuerpoTimeoutMs'))))
      return {
        found: results.length,
        candidatos: ultimaBusqueda.map((c, i) => {
          const cuerpo = i < nCuerpo ? limpio(cuerpos[i]) : undefined
          return { id: c.id, titulo: c.src.title, ...(limpio(c.src.snippet) ? { resumen: c.src.snippet } : {}), ...(cuerpo ? { extracto: cuerpo.slice(0, ov.num('const.articulosCuerpoChars')).trim() } : {}) }
        }),
      }
    }
    if (name === 'show_articles') {
      const ids = Array.isArray(args.ids) ? (args.ids as unknown[]).map(Number) : []
      const elegidos = ultimaBusqueda.filter(c => ids.includes(c.id)).map(c => c.src)
      if (elegidos.length) onUi({ kind: 'articles', sources: elegidos })
      return { mostrados: elegidos.length }
    }
    return { error: 'tool desconocida' }
  }
}

/* ---------- veto por ítem y juez con pelado (pipeline.ts) ---------- */
const videoTitle = (id: string) => getCatalogVideo(id)?.title ?? ''

function filterUis(uis: Ui[], veta: (label: string) => boolean): Ui[] {
  return uis.map((u): Ui => {
    if (u.kind === 'articles') return { ...u, sources: u.sources.filter(s => !veta(s.title)) }
    if (u.kind === 'images') return { ...u, terms: u.terms.filter(t => !veta(t.q)) }
    return { ...u, ids: u.ids.filter(id => !veta(videoTitle(id))) }
  }).filter(u => (u.kind === 'articles' ? u.sources.length : u.kind === 'images' ? u.terms.length : u.ids.length) > 0)
}

function vetarItemsDeMedios(uis: Ui[]): { uis: Ui[]; vetados: string[] } {
  const terms = [...config.blockedWords, ...familyWords(), ...blackTopicsAll().map(t => t.name)].filter(Boolean)
  const vetados: string[] = []
  const out = filterUis(uis, label => { const hit = label ? matchBlockedWord(label, terms) : null; if (hit) vetados.push(`«${label}» (regla: ${hit})`); return !!hit })
  return { uis: out, vetados }
}

function dropVetoJuez(uis: Ui[], mediosVetados: string[]): { uis: Ui[]; vetados: string[] } {
  const lista = mediosVetados.map(v => normalize(v.replace(/[«»]/g, '')).trim()).filter(Boolean)
  if (!lista.length) return { uis, vetados: [] }
  const vetados: string[] = []
  const out = filterUis(uis, label => {
    if (!label) return false
    const n = normalize(label).trim()
    const hit = lista.some(v => v === n || v.includes(n) || (n.length > 4 && n.includes(v)))
    if (hit) vetados.push(label)
    return hit
  })
  return { uis: out, vetados }
}

function mediaAnnexForJudge(uis: Ui[]): string {
  const parts: string[] = []
  const img = uis.flatMap(u => (u.kind === 'images' ? u.terms.map(t => t.q) : []))
  if (img.length) parts.push(`Imágenes que se buscarán y mostrarán: ${img.map(t => `«${t}»`).join(', ')}`)
  const vids = uis.flatMap(u => (u.kind === 'videos' ? u.ids : [])).map(videoTitle).filter(Boolean)
  if (vids.length) parts.push(`Videos que se mostrarán: ${vids.map(t => `«${t}»`).join(', ')}`)
  const arts = uis.flatMap(u => (u.kind === 'articles' ? u.sources.map(s => s.title) : []))
  if (arts.length) parts.push(`Artículos sugeridos para leer: ${arts.map(t => `«${t}»`).join(', ')}`)
  return parts.length ? `\n\nAdemás del texto, al niño se le mostrarán estos elementos (evaluá también su contenido):\n${parts.join('\n')}` : ''
}

const mediaTitlesOf = (uis: Ui[]) => [
  ...uis.flatMap(u => (u.kind === 'articles' ? u.sources.map(s => s.title) : [])),
  ...uis.flatMap(u => (u.kind === 'images' ? u.terms.map(t => t.q) : [])),
  ...uis.flatMap(u => (u.kind === 'videos' ? u.ids.map(videoTitle) : [])).filter(Boolean),
]
function citaEsTituloDeMedia(cita: string | undefined, titulos: string[]): string | null {
  const c = cita ? normalize(cita.replace(/[«»]/g, '')).trim() : ''
  if (!c) return null
  return titulos.find(t => { const n = normalize(t).trim(); return n && (n === c || n.includes(c) || (c.length > 4 && c.includes(n))) }) ?? null
}

async function judgeOutputPeeling(text: string, uis0: Ui[]): Promise<{ verdict: Verdict; uis: Ui[]; vetados: string[] }> {
  let uis = uis0
  const vetados: string[] = []
  for (let i = 0; ; i++) {
    const verdict = await judgeOutput(`${text}${mediaAnnexForJudge(uis)}`)
    if (verdict.veredicto === 'aprobado') {
      if (verdict.mediosVetados?.length) { const r = dropVetoJuez(uis, verdict.mediosVetados); uis = r.uis; vetados.push(...r.vetados) }
      return { verdict, uis, vetados }
    }
    const objetivo = i < 3 ? citaEsTituloDeMedia(verdict.cita, mediaTitlesOf(uis)) : null
    if (!objetivo) return { verdict, uis, vetados }
    const r = dropVetoJuez(uis, [objetivo])
    if (!r.vetados.length) return { verdict, uis, vetados }
    uis = r.uis; vetados.push(...r.vetados)
  }
}

const markerFor = (u: Ui) => (u.kind === 'videos' ? u.ids.map(id => `[video:${id}]`).join(' ') : u.kind === 'images' ? u.terms.map(t => `[imagenes:${t.q}${t.lente ? '|' + t.lente : ''}]`).join(' ') : '')

/* Resuelve las directivas a lo que la UI muestra (tarjetas de video, galería, artículos). */
async function resolveMedia(uis: Ui[]): Promise<ChatReply['media']> {
  const ids = uis.flatMap(u => (u.kind === 'videos' ? u.ids : [])).slice(0, 6)
  await loadVideoMeta(ids)
  const videos = ids.map(getCatalogVideo).filter(Boolean).map(v => toVideoResult(v!))
  const terms = uis.flatMap(u => (u.kind === 'images' ? u.terms : []))
  const lists = await Promise.all(terms.map(t => searchImageTerm(t.q)))
  const images: ImageHit[] = []
  const seen = new Set<string>()
  for (let i = 0; images.length < 8 && lists.some(l => i < l.length); i++) {
    for (const l of lists) { const it = l[i]; if (it && !it.blocked && images.length < 8 && !seen.has(it.id)) { seen.add(it.id); images.push(it) } }
  }
  const articles = uis.flatMap(u => (u.kind === 'articles' ? u.sources : []))
  return { ...(videos.length ? { videos } : {}), ...(images.length ? { images } : {}), ...(articles.length ? { articles } : {}) }
}

export async function sendChildMessage(history: Msg[], childText: string): Promise<ChatReply> {
  const failClosed = (trace: string): ChatReply => ({ kind: 'failclosed', text: ov.text('copy.failClosed'), contextText: ov.text('copy.failClosed'), trace })
  const ctx = history.slice(-ov.num('const.principalTurnos'))

  // 1) Principal y juez de entrada EN PARALELO (si el juez bloquea, se aborta el principal).
  const controller = new AbortController()
  const uis: Ui[] = []
  const exec = makeExecutors(u => uis.push(u))
  const principalPromise = completeWithTools({
    model: MODELS.principal, system: buildSystemPrompt(), messages: [...ctx, { role: 'user', content: childText }],
    maxTokens: ov.num('const.principalMaxTokens'), tools: buildTools(), signal: controller.signal,
    onToolCall: async (name, args) => ({ output: JSON.stringify(await exec(name, args).catch(e => ({ error: String(e).slice(0, 120) }))) }),
  }).catch(err => { if (controller.signal.aborted) return null; throw err })
  // FS-BASE-A (hallazgo ALTA chat.ts:246): la promesa queda MANEJADA apenas nace. Si el principal falla (un 4xx, o 429/5xx tras
  // los reintentos del SDK) ANTES de que termine el juez de entrada, el rechazo quedaba sin handler hasta el await de abajo y
  // Node 24 (unhandled-rejections=throw) tumbaba TODO el server con exit 1. Esto no se traga nada: el `await principalPromise`
  // de más abajo igual recibe el error y responde el fail-closed. Red extra en index.ts: process.on('unhandledRejection').
  principalPromise.catch(() => {})

  const recent = ctx.slice(-ov.num('const.juezInputTurnos')).map(t => `${t.role === 'user' ? 'niño' : 'asistente'}: ${t.content.slice(0, ov.num('const.juezInputChars'))}`).join('\n')
  let verdict: InputVerdict
  try {
    verdict = await judgeInput(`Contexto reciente:\n${spotlight(recent || '(inicio de la conversación)')}\n\nÚLTIMO MENSAJE DEL NIÑO:\n${spotlight(childText)}`)
  } catch (e) {
    controller.abort()
    console.error('[chat] juez de entrada:', e)
    // FS-BASE-A: con el juez caído una crisis no se pierde en silencio (ver onInputJudgeDown).
    const down = onInputJudgeDown(childText, 'el chat con el asistente')
    if (down.crisis) {
      const t = guionCrisis()
      return { kind: 'crisis', text: t, contextText: t, childContextText: '[mensaje sensible — atendido con protocolo de contención]', trace: `El juez de entrada falló; la red de frases vio una posible crisis («${down.hit}»): guion fijo de contención y aviso al padre (sin clasificar).` }
    }
    const t = ov.text('copy.failClosed') + safetyLine()
    return { kind: 'failclosed', text: t, contextText: t, trace: 'El juez de entrada falló: no se mostró nada (fail-closed), con la línea de cuidado y aviso al padre (sin clasificar).' }
  }

  // 2) Crisis: guion fijo, no generativo.
  if (verdict.es_crisis) {
    controller.abort()
    // Aviso al padre CON el texto del chico (decisión de Esteban, 11-oct: "que se vea con toda la info").
    // La cuarentena del CONTEXTO del chat (childContextText) sigue intacta: esto es solo el aviso del panel.
    notifyParent('crisis', childText, 'el chat con el asistente')
    const t = guionCrisis()
    return { kind: 'crisis', text: t, contextText: t, childContextText: '[mensaje sensible — atendido con protocolo de contención]', trace: 'Crisis detectada: guion fijo de contención.' }
  }
  // 3) Lista negra: redirección sin nombrar el tema; el principal nunca responde.
  if (verdict.en_lista_negra) {
    controller.abort()
    const t = pickRedireccion()
    return { kind: 'redireccion', text: t, contextText: t, childContextText: '[pregunta sobre tema no permitido — redirigida]', trace: `Tema de la lista negra «${verdict.tema}»${verdict.es_critico ? ' [CRÍTICO]' : ''}: redirigido.` }
  }

  let principal: { text: string } | null
  try { principal = await principalPromise } catch (e) { console.error('[chat] principal:', e); return failClosed('El modelo principal falló (fail-closed).') }
  if (!principal) return failClosed('Generación cancelada.')

  // 4) Veto por ítem determinista + filtro de palabras sobre la prosa.
  let { uis: uisOk } = vetarItemsDeMedios(uis)
  const palabra = matchBlockedWord(principal.text)
  if (palabra) return { kind: 'interceptado', text: ov.text('copy.interceptado'), contextText: ov.text('copy.interceptado'), trace: `Palabra de la lista negra en la respuesta: «${palabra}».` }

  // 5) Juez de salida (modo estricto: antes de mostrar), salvo que el padre lo saltee para respuestas solo-videos.
  const kinds = new Set(uisOk.map(u => u.kind))
  const skip = config.saltearJuezVideos && kinds.has('videos') && !kinds.has('images') && !kinds.has('articles')
  let trace = skip ? 'Juez de salida salteado (solo videos aprobados).' : 'Juez de salida: aprobado.'
  if (!skip) {
    try {
      const peel = await judgeOutputPeeling(principal.text, uisOk)
      if (peel.verdict.veredicto === 'bloqueado') {
        const t = pickRedireccion()
        return { kind: 'redireccion', text: t, contextText: t, trace: `Juez de salida bloqueó (${peel.verdict.motivo ?? 's/d'}): redirigido.` }
      }
      uisOk = peel.uis
      if (peel.vetados.length) trace += ` Vetó ${peel.vetados.length} ítem(s): ${peel.vetados.join('; ')}.`
    } catch (e) {
      console.error('[chat] juez de salida:', e)
      return failClosed('El juez de salida falló (fail-closed).')
    }
  }

  const markers = uisOk.map(markerFor).filter(Boolean).join(' ')
  return { kind: 'normal', text: principal.text, contextText: markers ? `${principal.text} ${markers}` : principal.text, media: await resolveMedia(uisOk), trace }
}

/* ---------- exports aditivos (tanda 7): piezas del pipeline que reusan los mensajes entre amigos (friendsFake.ts) ---------- */
/** Guion fijo de crisis de la familia (crisis.guion + helpline): el MISMO protocolo de contención que el chat. FS-BASE-A:
 *  también la línea de cuidado del fail-closed con el juez caído (Amigos y Buscar). */
export { guionCrisis, safetyLine }
