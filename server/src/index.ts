// Backend de Innerith. Expone sobre HTTP la lógica de Smarty (búsqueda en lista blanca, lector moderado).
//   GET /api/health
//   GET /api/search/pages?q=...   → PageResult[] (formato de src/api/types.ts)
//   GET /api/article?url=...      → ArticleResult (ok | blocked | error)
//   GET /api/search/images?q=...  → galería moderada (Pixabay + Commons)
//   GET /api/search/videos?q=...  → videos del catálogo aprobado
//   GET /api/video?id=...         → un video aprobado + metadatos de YouTube
//   POST /api/chat                → turno del chat con el pipeline de moderación de Smarty
//   GET /api/feed?after=  ·  POST /api/feed/react   → FAKE (demo) hasta que exista el feed real
//   GET /api/me                   → apodo del chico
//   GET /api/learn/course?id=&name= → temario del curso con un contenido real por capítulo
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { config } from './config'
import { getArticle } from './articles'
import { queryTokens, searchPages } from './search'
import { searchImages } from './images'
import { getVideo, loadVideoMeta, searchVideos, toVideoResult } from './videos'
import { sendChildMessage } from './chat'
import { getCourse, prewarmCourses } from './learn'
import { getFeed, reactFeed } from './feedFake'
import type { Msg } from './llm'

const PORT = Number(process.env.PORT ?? 8787)

/* ---------- formato de tarjeta (lo que la UI ya espera) ---------- */
const SITE_NAMES: Record<string, string> = {
  'wikipedia.org': 'Wikipedia', 'kids.nationalgeographic.com': 'National Geographic Kids', 'spaceplace.nasa.gov': 'NASA Space Place',
  'esa.int': 'Agencia Espacial Europea', 'dbe.rah.es': 'Diccionario de la RAE', 'ecured.cu': 'EcuRed', 'todamateria.com': 'Toda Materia',
  'concepto.de': 'Concepto', 'mundoprimaria.com': 'Mundo Primaria', 'educapeques.com': 'Educapeques', 'biografiasyvidas.com': 'Biografías y Vidas',
  'geoenciclopedia.com': 'Geoenciclopedia', 'disfrutalasmatematicas.com': 'Disfruta las Matemáticas', 'artsandculture.google.com': 'Google Arts & Culture',
  'happylearning.tv': 'Happy Learning', 'sciencebuddies.org': 'Science Buddies',
}
const COLORS = ['#5F6368', '#3A5BD9', '#F26B3A', '#13A39A', '#8A5CF5', '#18A957', '#E5487A', '#1C9BD6']
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return u } }
function siteName(u: string): string {
  const h = host(u)
  const k = Object.keys(SITE_NAMES).find(d => h === d || h.endsWith('.' + d))
  return k ? SITE_NAMES[k] : h
}
function breadcrumb(u: string): string {
  try {
    const x = new URL(u)
    const segs = x.pathname.split('/').filter(Boolean).slice(0, 3).map(s => decodeURIComponent(s).replace(/_/g, ' '))
    return [`${x.protocol}//${x.hostname}`, ...segs].join(' › ')
  } catch { return u }
}
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
/* Negrita en las palabras de la búsqueda, como Google. */
function boldSnippet(snippet: string, q: string): string {
  let out = escapeHtml(snippet)
  for (const t of queryTokens(q)) {
    out = out.replace(new RegExp(`(^|[^\\p{L}])(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\p{L}*)`, 'giu'), (_, pre, w) => `${pre}<b>${w}</b>`)
  }
  return out
}
const colorFor = (h: string) => COLORS[[...h].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length]

/* ---------- servidor ---------- */
async function readJson<T>(req: IncomingMessage): Promise<T> {
  let raw = ''
  for await (const chunk of req) { raw += chunk; if (raw.length > 200_000) throw new Error('body demasiado grande') }
  return JSON.parse(raw || '{}') as T
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const t0 = Date.now()
  try {
    // --- FEED (FAKE): ver feedFake.ts ---
    if (url.pathname === '/api/feed' && req.method === 'GET') {
      return send(res, 200, getFeed(url.searchParams.get('after')))
    }
    if (url.pathname === '/api/feed/react' && req.method === 'POST') {
      const b = await readJson<{ id?: string; emoji?: string }>(req)
      if (!b.id || !b.emoji) return send(res, 400, { error: 'id/emoji' })
      return send(res, 200, reactFeed(String(b.id), String(b.emoji)))
    }

    if (req.method === 'POST' && url.pathname === '/api/chat') {
      const body = await readJson<{ history?: Msg[]; text?: string }>(req)
      const text = String(body.text ?? '').trim().slice(0, 2000) // límite de input de Smarty (RF-1.5)
      if (!text) return send(res, 400, { error: 'mensaje vacío' })
      const history = (Array.isArray(body.history) ? body.history : [])
        .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }))
      const r = await sendChildMessage(history, text)
      console.log(`[chat] «${text.slice(0, 60)}» → ${r.kind} · ${r.trace} (${Date.now() - t0} ms)`)
      return send(res, 200, r)
    }
    if (req.method !== 'GET') return send(res, 405, { error: 'method' })

    if (url.pathname === '/api/me') return send(res, 200, { name: config.apodo || 'Explorador', age: 9, nick: config.apodo || 'Explorador' })

    if (url.pathname === '/api/search/images') {
      const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200)
      if (!q) return send(res, 400, { error: 'q vacía' })
      const { terms, items } = await searchImages(q)
      const out = items.map(it => it.blocked ? { id: it.id, blocked: true } : {
        id: it.id, img: it.thumb, caption: it.title, source: { name: it.source, color: it.source === 'Pixabay' ? '#18A957' : '#5F6368' },
      })
      const firstOf = (k: number) => items.find((it, i) => !it.blocked && i % Math.max(terms.length, 1) === k)
      const related = terms.map((t, k) => ({ label: t, img: (firstOf(k) as { thumb?: string } | undefined)?.thumb ?? '' })).filter(r => r.img)
      console.log(`[images] «${q}» → ${terms.length} términos · ${out.filter(o => !('blocked' in o)).length} aptas · ${out.filter(o => 'blocked' in o).length} filtradas (${Date.now() - t0} ms)`)
      return send(res, 200, { query: q, items: out, related })
    }

    if (url.pathname === '/api/search/videos') {
      const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200)
      if (!q) return send(res, 400, { error: 'q vacía' })
      const hits = searchVideos(q)
      await loadVideoMeta(hits.map(h => h.videoId))
      console.log(`[videos] «${q}» → ${hits.length} del catálogo aprobado (${Date.now() - t0} ms)`)
      return send(res, 200, { query: q, items: hits.map(toVideoResult) })
    }

    if (url.pathname === '/api/learn/course') {
      const id = (url.searchParams.get('id') ?? '').trim()
      if (!id) return send(res, 400, { error: 'id vacío' })
      const c = await getCourse(id, (url.searchParams.get('name') ?? '').trim().slice(0, 120) || undefined)
      return send(res, 200, c)
    }

    if (url.pathname === '/api/video') {
      const v = await getVideo(url.searchParams.get('id') ?? '')
      return v ? send(res, 200, v) : send(res, 404, { error: 'Video no aprobado' })
    }

    if (url.pathname === '/api/health') return send(res, 200, { ok: true, policyVersion: config.policyVersion, sites: config.sites.length })

    if (url.pathname === '/api/search/pages') {
      const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200)
      if (!q) return send(res, 400, { error: 'q vacía' })
      const { results, error } = await searchPages(q)
      if (error) console.warn(`[search] «${q}»: ${error}`)
      const items = results.map(r => ({
        id: r.link, site: siteName(r.link), url: breadcrumb(r.link), title: r.title, date: r.date,
        snippet: boldSnippet(r.snippet ?? '', q), color: colorFor(host(r.link)), articleId: r.link,
      }))
      console.log(`[search] «${q}» → ${items.length} resultados (${Date.now() - t0} ms)`)
      return send(res, 200, { query: q, items })
    }

    if (url.pathname === '/api/article') {
      const target = (url.searchParams.get('url') ?? '').trim()
      if (!target) return send(res, 400, { error: 'url vacía' })
      const r = await getArticle(target)
      console.log(`[article] ${target} → ${r.status}${r.status !== 'ok' ? ` (${r.reason}${'motivo' in r && r.motivo ? `: ${r.motivo}` : ''})` : ''} (${Date.now() - t0} ms)`)
      return send(res, 200, r)
    }

    send(res, 404, { error: 'not found' })
  } catch (e) {
    console.error('[error]', e)
    send(res, 500, { error: 'internal' })
  }
}).listen(PORT, () => {
  setImmediate(() => { searchVideos('precalentar'); void prewarmCourses() }) // índice de videos (~5 s) y cursos de Aprender, al arrancar
  console.log(`Innerith API en http://localhost:${PORT} · policyVersion ${config.policyVersion} · ${config.sites.length} sitios`)
  if (!process.env.OPENAI_API_KEY || !process.env.SERPER_API_KEY) console.warn('Faltan claves en server/.env (correr el import de Smarty)')
})
