// Búsqueda de páginas: port de search_articles (smarty-poc/app/src/lib/articleTools.ts) + serper.ts.
// Diferencia con Smarty: no hay paso de "el modelo elige qué tarjetas mostrar" (eso es del chat);
// la solapa Páginas muestra directamente el top N ya filtrado y ordenado.
import { articleBlacklist, config, ov, whitelistSites } from './config'
import { applyDomainFilter, isBlockedSite, matchBlockedWord } from './filters'

export interface SerperOrganic { title: string; link: string; snippet?: string; date?: string; position?: number }

async function serperSearch(q: string): Promise<{ organic: SerperOrganic[]; error?: string }> {
  const key = (process.env.SERPER_API_KEY ?? '').trim()
  if (!key) return { organic: [], error: 'Falta SERPER_API_KEY' }
  try {
    const r = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q, num: 10, gl: config.searchGl, hl: config.searchHl }),
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
export const queryTokens = (q: string) => [...new Set(norm(q).split(/[^a-z0-9]+/).filter(t => t.length > 2 && !STOP.has(t)))]

/* opts.maxBatches: tope de búsquedas paralelas (créditos de Serper); por defecto el de Smarty. */
export async function searchPages(q: string, opts?: { maxBatches?: number; limit?: number }): Promise<{ results: SerperOrganic[]; error?: string }> {
  const blanca = whitelistSites()
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
    // veto por ítem: un resultado con palabra bloqueada en título o resumen se descarta solo a él
    .filter(h => matchBlockedWord(`${h.title} ${h.snippet ?? ''}`) === null)
  return { results: filtered.slice(0, opts?.limit ?? ov.num('const.articulosMostrados')), error }
}
