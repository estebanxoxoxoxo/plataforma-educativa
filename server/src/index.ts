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
//   /api/space/*                  → Mi espacio: Drive (carpetas+papelera), listas, canales seguidos (space.ts)
import { createServer } from 'node:http'
import { config } from './config'
import { getArticle } from './articles'
import { queryTokens, searchPages } from './search'
import { searchImages } from './images'
import { allChannels, getVideo, loadChannelMeta, loadVideoMeta, searchVideos, toVideoResult, videosOfChannel } from './videos'
import { sendChildMessage } from './chat'
import { getCourse, prewarmCourses } from './learn'
import { getFeed, reactFeed } from './feedFake'
import * as space from './space'
import { practiceRoutes } from './practice'
import { progressRoutes, resetProgress } from './progress'
import * as market from './market'
import { leaguesRoutes } from './leaguesFake'
import { featureOn, parentRoutes } from './parent'
import { readJson, send } from './web'
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

/* ---------- servidor (send/readJson viven en web.ts, compartidos con los módulos de rutas) ---------- */
createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const t0 = Date.now()
  try {
    // --- DEMO: cada carga de página vuelve a los valores iniciales (la economía vive en RAM). ---
    if (url.pathname === '/api/demo/reset' && req.method === 'POST') {
      resetProgress()
      ;(market as { resetMarket?: () => void }).resetMarket?.()
      return send(res, 200, { ok: true })
    }

    // --- Dominios con módulo propio (cada uno maneja sus subrutas y métodos) ---
    if (url.pathname.startsWith('/api/practice/')) return await practiceRoutes(req, res, url)
    if (url.pathname.startsWith('/api/progress/')) return progressRoutes(req, res, url)
    if (url.pathname.startsWith('/api/market')) return await market.marketRoutes(req, res, url)
    if (url.pathname.startsWith('/api/leagues/')) return await leaguesRoutes(req, res, url)
    if (url.pathname.startsWith('/api/parent/')) return await parentRoutes(req, res, url)

    // --- FEED (FAKE): ver feedFake.ts ---
    if (url.pathname === '/api/feed' && req.method === 'GET') {
      return send(res, 200, getFeed(url.searchParams.get('after')))
    }
    if (url.pathname === '/api/feed/react' && req.method === 'POST') {
      const b = await readJson<{ id?: string; emoji?: string }>(req)
      if (!b.id || !b.emoji) return send(res, 400, { error: 'id/emoji' })
      return send(res, 200, reactFeed(String(b.id), String(b.emoji)))
    }

    // --- MI ESPACIO (backend real: server/src/space.ts, persistido en data/space.json) ---
    if (url.pathname.startsWith('/api/space/') && req.method === 'POST') {
      const b = await readJson<Record<string, unknown>>(req)
      const num = (k: string) => Number(b[k] ?? 0) || 0
      const str = (k: string) => String(b[k] ?? '')
      switch (url.pathname) {
        case '/api/space/save': {
          const r = space.saveItem(b as space.SavePayload)
          return r.error ? send(res, 400, { error: r.error }) : send(res, 200, r)
        }
        case '/api/space/drive/folder': return send(res, 200, space.createFolder(str('name'), num('parentId'), b.color ? str('color') : undefined, b.emoji ? str('emoji') : undefined))
        case '/api/space/drive/folder/update': return send(res, 200, { ok: space.updateFolder(num('id'), { name: b.name as string | undefined, color: b.color as string | undefined, emoji: b.emoji as string | undefined }) })
        case '/api/space/drive/folder/move': return send(res, 200, { ok: space.moveFolder(num('id'), num('parentId')) })
        case '/api/space/drive/folder/trash': return send(res, 200, { ok: (space.trashFolder(num('id')), true) })
        case '/api/space/drive/item/move': return send(res, 200, { ok: space.moveItem(num('id'), num('folderId')) })
        case '/api/space/drive/item/trash': return send(res, 200, { ok: (space.trashItem(num('id')), true) })
        case '/api/space/drive/restore': return send(res, 200, { ok: (b.kind === 'folder' ? space.restoreFolder(num('id')) : space.restoreItem(num('id')), true) })
        case '/api/space/drive/purge': return send(res, 200, { ok: (b.kind === 'folder' ? space.purgeFolder(num('id')) : space.purgeItem(num('id')), true) })
        case '/api/space/follow': return send(res, 200, { followed: space.toggleFollow(str('channelId'), typeof b.value === 'boolean' ? b.value : undefined) })
        case '/api/space/playlists/create': return send(res, 200, space.createPlaylist(str('name'), b.videoId ? str('videoId') : undefined))
        case '/api/space/playlists/rename': return send(res, 200, { ok: space.renamePlaylist(num('id'), str('name')) })
        case '/api/space/playlists/delete': return send(res, 200, { ok: (space.deletePlaylist(num('id')), true) })
        case '/api/space/playlists/add': return send(res, 200, space.playlistAdd(num('id'), str('videoId')))
        case '/api/space/playlists/remove': return send(res, 200, { ok: space.playlistRemove(num('id'), str('videoId')) })
        case '/api/space/playlists/swap': return send(res, 200, { ok: space.playlistSwap(num('id'), str('a'), str('b')) })
      }
      return send(res, 404, { error: 'not found' })
    }
    if (url.pathname.startsWith('/api/space/') && req.method === 'GET') {
      if (url.pathname === '/api/space/drive') return send(res, 200, space.driveView(Number(url.searchParams.get('folder') ?? 0) || 0))
      if (url.pathname === '/api/space/folders') return send(res, 200, space.folderTree())
      if (url.pathname === '/api/space/drive/trash') return send(res, 200, space.trashView())
      if (url.pathname === '/api/space/channels') {
        const follows = new Set(space.followedIds())
        return send(res, 200, { channels: allChannels().map(c => ({ ...c, followed: follows.has(c.id) })) })
      }
      if (url.pathname === '/api/space/channel') {
        const id = url.searchParams.get('id') ?? ''
        const c = allChannels().find(x => x.id === id)
        if (!c) return send(res, 404, { error: 'canal' })
        const vids = videosOfChannel(id)
        const shown = vids.slice(0, 120)
        await loadVideoMeta(shown.map(v => v.videoId))
        const m = await loadChannelMeta(id)
        return send(res, 200, {
          channel: { ...c, followed: space.isFollowed(id), thumb: m.thumb, subscribers: m.subscribers != null ? new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(m.subscribers) + ' de suscriptores' : '' },
          total: vids.length, videos: shown.map(toVideoResult),
        })
      }
      if (url.pathname === '/api/space/playlists') return send(res, 200, space.playlists())
      if (url.pathname === '/api/space/playlist') {
        const d = space.playlistDetail(Number(url.searchParams.get('id') ?? 0) || 0)
        return d ? send(res, 200, d) : send(res, 404, { error: 'lista' })
      }
      return send(res, 404, { error: 'not found' })
    }

    if (req.method === 'POST' && url.pathname === '/api/chat') {
      // Gate del padre (fail-closed): si la familia apagó el chat, ni se lee el mensaje.
      if (!featureOn('chat')) return send(res, 403, { error: 'El chat está apagado por tu familia' })
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
      return v ? send(res, 200, { ...v, followed: space.isFollowed(v.channelId) }) : send(res, 404, { error: 'Video no aprobado' })
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
