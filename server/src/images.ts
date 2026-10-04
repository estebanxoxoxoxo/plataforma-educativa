// Búsqueda de imágenes. Port de smarty-poc/app/src/lib/imageSearch.ts (Pixabay + Commons, filtros por
// palabras no aptas, re-rank por título) + expandQuery de imageTools.ts (pedido → términos visuales en inglés).
// Diferencia con Smarty: como corre en el servidor, la moderación visual de Commons usa la Moderation API de
// OpenAI (en Smarty estaba bloqueada por CORS y se usaba NudeNet local). Pixabay viene preModerated (safesearch).
import { MODELS, config, fill, ov } from './config'
import { matchBlockedWord } from './filters'
import { complete, openai } from './llm'

export interface ImageHit { id: string; thumb: string; full: string; title: string; source: string; pageUrl: string; preModerated?: boolean }
export type ImageItem = (ImageHit & { blocked?: false }) | { id: string; blocked: true; reason: string }

const WM = 'https://commons.wikimedia.org/w/api.php'
const PIXABAY = 'https://pixabay.com/api/'
const FETCH_COUNT = 50
const TARGET_COUNT = 24
const UA = 'InnerithBot/0.1 (educational; contact andres@innerith.com)'
const TERM_OK = /^[\p{L}\p{N} \-]{2,40}$/u
const RERANK_STOP = new Set(['planet', 'dog', 'cat', 'bird', 'fish', 'food', 'dish', 'fruit', 'vegetable', 'flower', 'plant', 'tree', 'insect', 'animal', 'monument', 'museum', 'cathedral', 'basilica', 'temple', 'building', 'tower', 'statue', 'bridge', 'castle', 'church'])

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const tokenize = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(Boolean)
export const sanitizeTerm = (raw: string) => { const t = raw.trim().replace(/\s+/g, ' '); return TERM_OK.test(t) ? t : null }
const hasUnsafeWord = (text: string) => { const unsafe = new Set(ov.words('images.unsafeWords').map(w => w.toLowerCase())); return norm(text).split(/[^a-z0-9]+/).some(t => t && unsafe.has(t)) }
const isWikimediaHost = (url: string) => { try { return new URL(url).hostname === 'upload.wikimedia.org' } catch { return false } }

function relevanceScore(title: string, tokens: string[]): number {
  if (!tokens.length) return 0
  const tt = new Set(tokenize(title))
  const matched = tokens.filter(t => tt.has(t)).length
  return matched / tokens.length + (matched === tokens.length ? 1 : 0)
}

/* Devuelve los aptos y cuántos se descartaron por el filtro de palabras (para mostrarlos como "Filtrado"). */
async function fetchPixabay(term: string): Promise<{ ok: ImageHit[]; dropped: number }> {
  const key = (process.env.PIXABAY_API_KEY ?? '').trim()
  if (!key) return { ok: [], dropped: 0 }
  const p = new URLSearchParams({ key, q: term, safesearch: 'true', per_page: String(FETCH_COUNT), image_type: 'all', lang: 'en' })
  try {
    const r = await fetch(`${PIXABAY}?${p}`)
    if (!r.ok) return { ok: [], dropped: 0 }
    const data = (await r.json()) as { hits?: { id: number; tags?: string; pageURL?: string; webformatURL?: string; largeImageURL?: string }[] }
    let dropped = 0
    const ok = (data.hits ?? []).flatMap(h => {
      if (!/^https:\/\//.test(h.webformatURL ?? '')) return []
      if (hasUnsafeWord(h.tags ?? '')) { dropped++; return [] }
      return [{ id: 'px' + h.id, thumb: h.webformatURL!, full: h.largeImageURL ?? h.webformatURL!, title: (h.tags ?? '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 3).join(', ') || 'Imagen', source: 'Pixabay', pageUrl: h.pageURL ?? '', preModerated: true }]
    })
    return { ok, dropped }
  } catch { return { ok: [], dropped: 0 } }
}

async function fetchCommons(term: string): Promise<{ ok: ImageHit[]; dropped: number }> {
  const p = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrsearch: `filetype:bitmap ${term}`, gsrnamespace: '6', gsrlimit: String(FETCH_COUNT),
    prop: 'imageinfo|categories', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '400', cllimit: 'max',
  })
  try {
    const r = await fetch(`${WM}?${p}`, { headers: { 'User-Agent': UA } })
    if (!r.ok) return { ok: [], dropped: 0 }
    type Pg = { pageid: number; title: string; index?: number; categories?: { title: string }[]; imageinfo?: { thumburl?: string; url?: string; mime?: string; descriptionurl?: string }[] }
    const data = (await r.json()) as { query?: { pages?: Record<string, Pg> } }
    let dropped = 0
    const ok = Object.values(data.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).flatMap(pg => {
      const ii = pg.imageinfo?.[0]
      if (!ii?.thumburl || !ii.url || !isWikimediaHost(ii.thumburl) || !isWikimediaHost(ii.url)) return []
      if (!/^image\/(jpeg|png|gif|webp)$/.test(ii.mime ?? '')) return []
      if (hasUnsafeWord(pg.title) || (pg.categories ?? []).some(c => hasUnsafeWord(c.title.replace(/^Category:/, '')))) { dropped++; return [] }
      return [{ id: String(pg.pageid), thumb: ii.thumburl, full: ii.url, title: pg.title.replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''), source: 'Wikimedia Commons', pageUrl: ii.descriptionurl ?? '' }]
    })
    return { ok, dropped }
  } catch { return { ok: [], dropped: 0 } }
}

/* Moderación visual (reemplaza a NudeNet). Cache en memoria por URL. Si la API falla: modo estricto → oculta; si no → muestra (como Smarty). */
const modCache = new Map<string, boolean>()
async function isFlagged(url: string): Promise<boolean> {
  if (modCache.has(url)) return modCache.get(url)!
  try {
    const r = await openai().moderations.create({ model: 'omni-moderation-latest', input: [{ type: 'image_url', image_url: { url } }] })
    const flagged = r.results.some(x => x.flagged)
    modCache.set(url, flagged)
    return flagged
  } catch {
    return config.moderacionEstricta
  }
}

/* searchImages de Smarty (un término) + moderación visual de los resultados de Commons. */
const termCache = new Map<string, { at: number; items: ImageItem[] }>()
export async function searchImageTerm(term: string): Promise<ImageItem[]> {
  const clean = sanitizeTerm(term)
  if (!clean || matchBlockedWord(clean) !== null) return []
  const key = norm(clean)
  const hit = termCache.get(key)
  if (hit && Date.now() - hit.at < 7 * 24 * 3600e3) return hit.items

  const [pix, commons] = await Promise.all([fetchPixabay(clean), fetchCommons(clean)])
  const seen = new Set<string>()
  const merged = [...pix.ok, ...commons.ok].filter(r => (seen.has(r.id) ? false : (seen.add(r.id), true)))
  const all = tokenize(clean), subject = all.filter(t => !RERANK_STOP.has(t))
  const tokens = subject.length ? subject : all
  const top = merged.map((r, i) => ({ r, i, s: relevanceScore(r.title, tokens) })).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, TARGET_COUNT).map(x => x.r)

  const flags = await Promise.all(top.map(r => (r.preModerated ? false : isFlagged(r.thumb))))
  const items: ImageItem[] = top.map((r, i) => (flags[i] ? { id: `mod-${r.id}`, blocked: true as const, reason: 'moderación visual' } : r))
  // Los descartados por palabras no aptas también se muestran como "Filtrado" (sin su contenido).
  const dropped = Math.min(pix.dropped + commons.dropped, 6)
  for (let k = 0; k < dropped; k++) items.splice(Math.min(items.length, 2 + k * 4), 0, { id: `word-${key}-${k}`, blocked: true, reason: 'palabras no aptas' })
  termCache.set(key, { at: Date.now(), items })
  return items
}

/* expandQuery (imageTools.ts): pedido del niño → 1..8 búsquedas visuales en inglés, con lente opcional. */
export async function expandQuery(raw: string): Promise<{ q: string; lente: string | null }[]> {
  try {
    const valid = new Set(config.lenses.map(l => l.lenteId.toLowerCase()))
    const lentesTxt = config.lenses.length ? config.lenses.map(l => `${l.lenteId}: ${l.definicion}`).join('\n') : '(ninguno)'
    const { text } = await complete({ model: MODELS.juez, system: fill(ov.text('images.expander'), { lentes: lentesTxt }), messages: [{ role: 'user', content: raw }], maxTokens: 160 })
    const out: { q: string; lente: string | null }[] = []
    const seen = new Set<string>()
    for (const piece of text.split(/[,\n]+/)) {
      const [rawQ, rawLente] = piece.split('::')
      const q = sanitizeTerm((rawQ || '').replace(/^[\s"'`0-9.\-)]+|[\s"'`.]+$/g, ''))
      if (!q) continue
      const l = (rawLente || '').trim().toLowerCase()
      const lente = l && valid.has(l) ? l : null
      const k = q.toLowerCase() + '|' + (lente ?? '')
      if (!seen.has(k)) { seen.add(k); out.push({ q, lente }) }
      if (out.length >= 8) break
    }
    if (out.length) return out
  } catch { /* fallback abajo */ }
  const fb = sanitizeTerm(raw.replace(/[^\p{L}\p{N} \-]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ').slice(0, 40))
  return fb ? [{ q: fb, lente: null }] : []
}

/* Galería de un pedido: expande, busca cada término y entrelaza los resultados (como la galería del chat de Smarty). */
export async function searchImages(raw: string, cap = 30): Promise<{ terms: string[]; items: ImageItem[] }> {
  if (matchBlockedWord(raw) !== null) return { terms: [], items: [] }
  const terms = await expandQuery(raw)
  const lists = await Promise.all(terms.map(t => searchImageTerm(t.q)))
  const items: ImageItem[] = []
  const seen = new Set<string>() // la misma imagen puede aparecer en dos términos
  for (let i = 0; items.length < cap && lists.some(l => i < l.length); i++) {
    for (const l of lists) {
      const it = l[i]
      if (!it || items.length >= cap || seen.has(it.id)) continue
      seen.add(it.id); items.push(it)
    }
  }
  return { terms: terms.map(t => t.q), items }
}
