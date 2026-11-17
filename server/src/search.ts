// Búsqueda de páginas: port de search_articles (smarty-poc/app/src/lib/articleTools.ts) + serper.ts.
// Diferencia con Smarty: no hay paso de "el modelo elige qué tarjetas mostrar" (eso es del chat);
// la solapa Páginas muestra directamente el top N ya filtrado y ordenado.
import { articleBlacklist, config, ov, whitelistSites } from './config'
import { applyDomainFilter, isBlockedSite, matchBlockedWord } from './filters'
import { type Lang, requestLang } from './requestContext'

export interface SerperOrganic { title: string; link: string; snippet?: string; date?: string; position?: number }

/** FS-BASE-B (hallazgo search.ts:13): timeout de cada búsqueda en Serper (responde en ~1 s). Sin él, un Serper colgado
 *  dejaba la solapa Páginas (y la tool search_articles del chat) esperando hasta los 300 s de undici, POR cada uno de los
 *  hasta 8 lotes en paralelo. Vencido: 0 resultados con `error` (lo mismo que un HTTP de error), en 15 s. */
const SERPER_TIMEOUT_MS = 15_000

async function serperSearch(q: string): Promise<{ organic: SerperOrganic[]; error?: string }> {
  const key = (process.env.SERPER_API_KEY ?? '').trim()
  if (!key) return { organic: [], error: 'Falta SERPER_API_KEY' }
  try {
    const r = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      // En inglés se busca como en EE. UU. (si no, Google prioriza resultados de Argentina/castellano); en castellano, los de config.
      body: JSON.stringify({ q, num: 10, ...(requestLang() === 'en' ? { gl: 'us', hl: 'en' } : { gl: config.searchGl, hl: config.searchHl }) }),
      signal: AbortSignal.timeout(SERPER_TIMEOUT_MS),
    })
    if (!r.ok) return { organic: [], error: `Serper HTTP ${r.status}` }
    const data = (await r.json()) as { organic?: SerperOrganic[] }
    return { organic: (data.organic ?? []).filter(o => o.link && o.title) }
  } catch (e) {
    return { organic: [], error: `Serper: ${String((e as Error).message).slice(0, 120)}` }
  }
}

const norm = (s: string) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const STOP = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'para', 'por', 'con', 'en', 'y', 'o', 'u', 'que', 'como', 'se', 'su', 'sus', 'a', 'al', 'sobre', 'mas', 'ninos', 'nino', 'chicos', 'chicas'])
const STOP_EN = new Set(['the', 'and', 'for', 'how', 'what', 'why', 'who', 'when', 'where', 'which', 'are', 'is', 'was', 'were', 'with', 'about', 'from', 'this', 'that', 'these', 'those', 'does', 'did', 'can', 'into', 'its', 'their', 'there', 'they', 'you', 'your', 'our', 'all', 'more', 'most', 'some', 'kids', 'kid', 'children', 'child', 'boys', 'girls'])
/** Palabras del tema (para el re-rank léxico). `lang` por defecto es el del pedido; en castellano, igual que siempre. */
export const queryTokens = (q: string, lang: Lang = requestLang()) => {
  const stop = lang === 'en' ? STOP_EN : STOP
  return [...new Set(norm(q).split(/[^a-z0-9]+/).filter(t => t.length > 2 && !stop.has(t)))]
}

/* Wikimedia (commons, upload…) está en la lista blanca por otros usos (imágenes), pero sus páginas son archivos y
   categorías, nunca artículos: no se piden con site: ni vuelven como resultado de páginas. */
const isWikimediaHost = (h: string) => { const x = h.toLowerCase().replace(/^www\./, ''); return x === 'wikimedia.org' || x.endsWith('.wikimedia.org') }
const isWikimediaUrl = (u: string) => { try { return isWikimediaHost(new URL(u).hostname) } catch { return false } }

/* opts.maxBatches: tope de búsquedas paralelas (créditos de Serper); por defecto el de Smarty. */
export async function searchPages(q: string, opts?: { maxBatches?: number; limit?: number }): Promise<{ results: SerperOrganic[]; error?: string }> {
  const blanca = whitelistSites().filter(d => !isWikimediaHost(d))
  const negra = articleBlacklist()
  const modo = config.articulosModo
  const MAX_SITIOS = 12
  const MAX_BATCHES = opts?.maxBatches ?? ov.num('const.articulosMaxBusquedas')

  let hits: SerperOrganic[]
  let error: string | undefined
  if ((modo === 'blanca' || modo === 'hibrido') && blanca.length) {
    // Restringir con site: en grupos de 12 dominios (límite de Google), en paralelo.
    const chunks: string[][] = []
    for (let i = 0; i < blanca.length && chunks.length < MAX_BATCHES; i += MAX_SITIOS) chunks.push(blanca.slice(i, i + MAX_SITIOS))
    const results = await Promise.all(chunks.map(c => serperSearch(`${q} (${c.map(d => `site:${d}`).join(' OR ')})`)))
    const seen = new Set<string>()
    const pool = results.flatMap(r => r.organic).filter(o => (seen.has(o.link) ? false : (seen.add(o.link), true)))
    if (chunks.length > 1) {
      // position no es comparable entre batches → re-rank léxico; se descartan los que no tienen ninguna palabra del tema.
      const qt = queryTokens(q)
      const lex = (h: SerperOrganic) => qt.reduce((s, t) => s + (norm(h.title).includes(t) ? 2 : norm(h.snippet ?? '').includes(t) ? 1 : 0), 0)
      const conLex = pool.filter(h => lex(h) > 0)
      hits = (conLex.length ? conLex : pool).sort((a, b) => lex(b) - lex(a) || (a.position ?? 99) - (b.position ?? 99))
    } else {
      hits = pool.sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
    }
    error = hits.length === 0 ? results.find(r => r.error)?.error : undefined
  } else {
    const r = await serperSearch(q)
    hits = r.organic
    error = r.error
  }

  const filtered = applyDomainFilter(hits, h => h.link, { modo, blanca, negra })
    .filter(h => !isBlockedSite(h.link))
    .filter(h => !isWikimediaUrl(h.link))
    // veto por ítem: un resultado con palabra bloqueada en título o resumen se descarta solo a él
    .filter(h => matchBlockedWord(`${h.title} ${h.snippet ?? ''}`) === null)
  return { results: filtered.slice(0, opts?.limit ?? ov.num('const.articulosMostrados')), error }
}
