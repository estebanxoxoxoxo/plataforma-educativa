// Circuito de jueces de BUSCAR (tanda FS-BASE-A; hallazgo ALTA index.ts:287 del workflow base-review). Port del /buscar del
// POC —smarty-poc app/src/zones/child/Search.tsx:159-176 (corte de la consulta + juez de entrada UNA vez por consulta, con
// crisis y lista negra) y 77-140 (por tipo: veto ítem por ítem + juez de salida)— en el server, para las TRES solapas
// (GET /api/search/pages|images|videos) y SOLO con un CHICO activo: los candados son del chico; con un adulto las solapas
// siguen como antes (lista blanca y palabras de fábrica sobre el resultado). Fail-closed en todo el camino: un juez que no
// responde bloquea, nunca deja pasar.
//   1) Corte determinístico de la consulta: las palabras bloqueadas (fábrica + familia + nombres de sus temas negros: el
//      default de matchBlockedWord) y, además, el NOMBRE de cada tema negro DE FÁBRICA, como frase entera (el chat ya los
//      veta así en sus medios: blackTopicsAll; antes «couple kissing» o «satanismo» se buscaban sin modelo). → block 'tema'
//      con el texto del POC («Mejor busquemos otra cosa 🙂»).
//   2) Juez de ENTRADA una vez por consulta: el cliente pide las tres solapas EN PARALELO (SearchPage.tsx) y las tres
//      comparten UNA llamada (promesa en vuelo + memo de JUDGED_MS por usuario, política y consulta: el aviso de crisis sale
//      UNA vez). es_crisis → block 'crisis' con el guion de contención de la familia y aviso al padre CON el texto (como el
//      chat); en_lista_negra → block 'tema' («Eso mejor no. ¿Probamos con otra cosa? 🙂», del POC). Juez caído, vencido o
//      con un veredicto fuera de esquema → onInputJudgeDown (chat.ts): la red de crisis decide entre 'crisis' (guion + aviso
//      sin clasificar) y 'falla' (con la línea de cuidado y un aviso sin clasificar agrupado).
//   3) Por tipo: veto ítem por ítem (el vetarItemsDeMedios del chat: palabras de fábrica + de la familia + nombres de los
//      temas negros) sobre títulos —y el resumen en Páginas—, términos de imagen y epígrafes; y el juez de SALIDA sobre lo
//      que queda (el anexo de medios del chat). Bloqueado → la solapa sale vacía (como el POC); `mediosVetados` → se sacan
//      esos; error del juez → la solapa sale vacía con block 'falla'. Videos respeta saltearJuezVideos (como el POC).
// Las respuestas suman el campo ADITIVO `block` (src/api/types.ts: SearchResponse.block) con `items: []`. Los logs de
// index.ts no llevan la consulta de una búsqueda bloqueada (podría ser una crisis).
import { config } from './config'
import { matchBlockedWord } from './filters'
import { blackTopicsAll, familyBlockedTerms, familyWords, notifyParent } from './parent'
import { currentUser } from './requestContext'
import { judgeInput, judgeOutput } from './judge'
import { spotlight } from './llm'
import { guionCrisis, onInputJudgeDown, safetyLine } from './chat'
import { searchPages, type SerperOrganic } from './search'
import { expandQuery, galleryFor, searchImages, type ImageItem } from './images'
import { searchVideos, type CatalogVideo } from './videos'

/** La consulta ENTERA (o la solapa) no se buscó: 'crisis' = guion de contención (y el padre recibió el aviso), 'tema' =
 *  palabra bloqueada o tema de la lista negra, 'falla' = no se pudo revisar (fail-closed). `text` = lo que se le muestra. */
export type SearchBlock = { kind: 'crisis' | 'tema' | 'falla'; text: string }

/** Textos del POC (Search.tsx). */
export const BLOCK_TEXT = {
  palabra: 'Mejor busquemos otra cosa 🙂',
  tema: 'Eso mejor no. ¿Probamos con otra cosa? 🙂',
  falla: 'Hubo un problema con la búsqueda. Probá de nuevo.',
  fallaSolapa: 'Hubo un problema. Probá de nuevo.',
} as const
/** El "dónde pasó" de los avisos al padre (va dentro de una oración: «Hubo un mensaje de crisis en el buscador»). */
export const SEARCH_SOURCE = 'el buscador'

const isChild = () => currentUser()?.kind === 'child'
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
/** Nombres de la lista negra que rige (fábrica + la de la familia del chico). */
const blackNames = () => blackTopicsAll().map(t => t.name).filter(Boolean)
/** Los términos del veto ítem por ítem: los del vetarItemsDeMedios del chat (chat.ts). */
const vetoTerms = () => [...config.blockedWords, ...familyWords(), ...blackNames()].filter(Boolean)
const vetoed = (label: string, terms: string[]) => !!label && matchBlockedWord(label, terms) !== null

/* ---------- 1 + 2: la consulta (UNA vez por consulta) ---------- */
const JUDGED_MS = 60_000
const judged = new Map<string, { at: number; p: Promise<SearchBlock | null> }>()

async function judgeQuery(q: string): Promise<SearchBlock | null> {
  let v
  try {
    v = await judgeInput(`ÚLTIMO MENSAJE DEL NIÑO (lo que escribió en el buscador; no es una conversación):\n${spotlight(q)}`)
  } catch (e) {
    console.error('[search] juez de entrada:', String((e as Error)?.message ?? e).slice(0, 160))
    const down = onInputJudgeDown(q, SEARCH_SOURCE)
    return down.crisis ? { kind: 'crisis', text: guionCrisis() } : { kind: 'falla', text: BLOCK_TEXT.falla + safetyLine() }
  }
  if (v.es_crisis) {
    // Aviso al padre CON el texto (decisión de Esteban, 11-oct), como el chat.
    notifyParent('crisis', q, SEARCH_SOURCE)
    return { kind: 'crisis', text: guionCrisis() }
  }
  if (v.en_lista_negra) return { kind: 'tema', text: BLOCK_TEXT.tema }
  return null
}

/** El corte y el juez de entrada de una consulta (con un adulto: null, no rige). Memo por usuario + política + consulta:
 *  las tres solapas paralelas comparten la llamada y una falla se olvida al terminar (el reintento vuelve a juzgar). */
export async function guardQuery(q: string): Promise<SearchBlock | null> {
  if (!isChild()) return null
  if (matchBlockedWord(q) !== null || matchBlockedWord(q, blackNames()) !== null) return { kind: 'tema', text: BLOCK_TEXT.palabra }
  const now = Date.now()
  for (const [k, v] of judged) if (now - v.at > JUDGED_MS) judged.delete(k)
  const key = JSON.stringify([currentUser()?.id ?? '-', blackNames(), familyBlockedTerms(), norm(q)])
  const hit = judged.get(key)
  if (hit) return hit.p
  const p = judgeQuery(q)
  judged.set(key, { at: now, p })
  void p.then(r => { if (r?.kind === 'falla') judged.delete(key) })
  return p
}

/* ---------- 3: el juez de SALIDA por tipo ---------- */
type MediaKind = 'images' | 'videos' | 'articles'
const ANNEX_HEAD: Record<MediaKind, string> = {
  images: 'Imágenes que se buscarán y mostrarán', videos: 'Videos que se mostrarán', articles: 'Artículos sugeridos para leer',
}
/** El anexo de medios del chat (mediaAnnexForJudge de chat.ts / moderation.ts del POC), con lo de UN tipo. */
const annex = (kind: MediaKind, shown: string[]) =>
  `\n\nAdemás del texto, al niño se le mostrarán estos elementos (evaluá también su contenido):\n${ANNEX_HEAD[kind]}: ${shown.join(kind === 'articles' ? ' · ' : ', ')}`

/** Juez de salida sobre los ítems de una solapa (tira si el juez falla: el llamador hace fail-closed). Bloqueado → [];
 *  aprobado con `mediosVetados` → sin esos (mismo emparejamiento que dropVetoJuez del chat). */
async function judgeItems<T>(items: T[], kind: MediaKind, label: (t: T) => string, shown: (t: T) => string): Promise<T[]> {
  if (!items.length) return items
  const v = await judgeOutput(annex(kind, items.map(shown)))
  if (v.veredicto === 'bloqueado') return []
  const vet = (v.mediosVetados ?? []).map(x => norm(x.replace(/[«»]/g, ''))).filter(Boolean)
  if (!vet.length) return items
  return items.filter(it => {
    const n = norm(label(it))
    return !(n && vet.some(x => x === n || x.includes(n) || (n.length > 4 && n.includes(x))))
  })
}
const FALLA_SOLAPA: SearchBlock = { kind: 'falla', text: BLOCK_TEXT.fallaSolapa }
const logOut = (tab: string, e: unknown) => console.error(`[search] juez de salida (${tab}):`, String((e as Error)?.message ?? e).slice(0, 160))

/** Páginas: lista blanca + palabras de siempre (search.ts) y, con un chico, el circuito entero. */
export async function guardedPages(q: string): Promise<{ block?: SearchBlock; results: SerperOrganic[]; error?: string }> {
  const block = await guardQuery(q)
  if (block) return { block, results: [] }
  const r = await searchPages(q)
  if (!isChild()) return r
  const terms = vetoTerms()
  const kept = r.results.filter(h => !vetoed(`${h.title} ${h.snippet ?? ''}`, terms))
  try {
    return { results: await judgeItems(kept, 'articles', h => h.title, h => `«${h.title}»${h.snippet ? ` (resumen: ${h.snippet.replace(/\s+/g, ' ').slice(0, 240)})` : ''}`), ...(r.error ? { error: r.error } : {}) }
  } catch (e) { logOut('páginas', e); return { block: FALLA_SOLAPA, results: [] } }
}

/** Videos: el catálogo aprobado (videos.ts) y, con un chico, el circuito entero (saltearJuezVideos como el POC). */
export async function guardedVideos(q: string): Promise<{ block?: SearchBlock; hits: CatalogVideo[] }> {
  const block = await guardQuery(q)
  if (block) return { block, hits: [] }
  const hits = searchVideos(q)
  if (!isChild()) return { hits }
  const terms = vetoTerms()
  const kept = hits.filter(v => !vetoed(v.title, terms))
  if (config.saltearJuezVideos) return { hits: kept }
  try { return { hits: await judgeItems(kept, 'videos', v => v.title, v => `«${v.title}»`) } } catch (e) { logOut('videos', e); return { block: FALLA_SOLAPA, hits: [] } }
}

/** Imágenes: con un chico, los términos del expansor pasan el veto y el juez de salida ANTES de buscarse (Search.tsx
 *  loadImages) y los epígrafes con palabra bloqueada salen como "Filtrado" (ImageGallery del POC). */
export async function guardedImages(q: string): Promise<{ block?: SearchBlock; terms: string[]; items: ImageItem[] }> {
  const block = await guardQuery(q)
  if (block) return { block, terms: [], items: [] }
  if (!isChild()) return searchImages(q)
  const terms = vetoTerms()
  const expanded = (await expandQuery(q)).filter(t => !vetoed(t.q, terms))
  let ok: typeof expanded
  try { ok = await judgeItems(expanded, 'images', t => t.q, t => `«${t.q}»`) } catch (e) { logOut('imágenes', e); return { block: FALLA_SOLAPA, terms: [], items: [] } }
  const items = (await galleryFor(ok)).map((it): ImageItem => (!it.blocked && vetoed(it.title, terms) ? { id: `veto-${it.id}`, blocked: true, reason: 'palabras bloqueadas' } : it))
  return { terms: ok.map(t => t.q), items }
}
