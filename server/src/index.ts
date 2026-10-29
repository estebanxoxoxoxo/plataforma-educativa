// Backend de Innerith. Expone sobre HTTP la lógica de Smarty (búsqueda en lista blanca, lector moderado).
//   GET /api/health
//   GET /api/search/pages?q=...   → PageResult[] (formato de src/api/types.ts)
//   GET /api/article?url=...      → ArticleResult (ok | blocked | error)
//   GET /api/search/images?q=...  → galería moderada (Pixabay + Commons)
//   GET /api/search/videos?q=...  → videos del catálogo aprobado
//   (las tres solapas, con un CHICO activo: el circuito de jueces del /buscar del POC —corte de la consulta, juez de
//    entrada una vez por consulta con crisis y lista negra, veto ítem por ítem y juez de salida—: searchGuard.ts)
//   GET /api/video?id=...         → un video aprobado + metadatos de YouTube
//   POST /api/chat                → turno del chat con el pipeline de moderación de Smarty
//   GET /api/feed?after=  ·  POST /api/feed/react   → FAKE (demo) hasta que exista el feed real
//   GET /api/me                   → el usuario ACTIVO { id, name, age, nick, kind } (cabecera X-Innerith-User; users.ts)
//   GET /api/users                → los usuarios del demo (Ian y Luna, chicos · Andrés, adulto y su guardián; users.ts)
//   /api/space/*                → Mi espacio: Drive (carpetas+papelera), listas, canales seguidos (space.ts)
//   /api/friends*                 → FAKE (demo): amigos NPC con moderación REAL y respuestas del modelo (friendsFake.ts)
//   /api/mentors* · GET /api/calendar → FAKE (demo): mentores del ADULTO (plan, beneficiario y días) + las clases del
//                                   usuario activo (teachersFake.ts)
//   GET /api/medals · POST /api/medals/seen → las medallas GANADAS del usuario activo (U5-B: medals.ts; RAM derivada de hechos)
// Los CANDADOS de la familia (el ciclo del día —F1, ex horarios por sección— y funcionalidades apagadas) son del CHICO:
// con un adulto activo no rigen (docs/USUARIOS.md §4; acá, market.ts, leaguesFake.ts y friendsFake.ts). U3 (§9): rige
// la config DEL CHICO ACTIVO —cada integrante tiene la suya— y cada pedido corre dentro de su contexto
// (requestContext.ts: runWithRequest), así filtros, jueces, feed y chat aplican la política de ese chico sin recibir req.
// U4 (docs/USUARIOS.md §10): cada usuario tiene lo suyo —XP/⚡/racha, canjes y guardarropas, wishlist, Learn, Mi espacio,
// liga, amigos y feed en vivo— y el contexto del pedido elige DE QUIÉN es lo que se lee y escribe (perUser.ts). El reset
// del demo (abajo) vuelve al seed SOLO al usuario activo; {scope:'all'} a todos.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { config } from './config'
import { getArticle } from './articles'
import { queryTokens } from './search'
import { getVideo, loadVideoMeta, searchVideos, toVideoResult } from './videos'
import { sendChildMessage } from './chat'
// FS-BASE-A: el circuito de jueces de Buscar (con un chico activo) para las tres solapas.
import { guardedImages, guardedPages, guardedVideos } from './searchGuard'
import { feedLess, getFeed, reactFeed } from './feedFake'
import { friendsRoutes } from './friendsFake'
import { closeFamilyWeekIfRead, demoReset } from './demoReset'
import * as space from './space'
import { progressRoutes } from './progress'
import * as market from './market'
import { leaguesRoutes } from './leaguesFake'
import { featureOn, parentRoutes } from './parent'
import { identityRoutes } from './identity'
import { teachersRoutes } from './teachersFake'
import { simulateNpcs } from './feedFake'
import { afterdayRoutes } from './afterday'
import { closedSectionFor, scheduleRoutes } from './schedule'
import { learnRoutesRoutes } from './learnRoutes'
import { learnResultsRoutes } from './learnResults'
import { medalsRoutes } from './medals'
import { createRoutes } from './create'
import { mytubeRoutes } from './mytube'
import { runWithRequest } from './requestContext'
import { actingUser, usersRoutes } from './users'
import { BodyError, listenHost, readJson, send } from './web'
import { DiskWriteError } from './durable'
import type { Msg } from './llm'

const PORT = Number(process.env.PORT ?? 8787)
/** FS-BASE-B (faltante "superficie de red", WF3): por defecto la API escucha SOLO en 127.0.0.1 —no hay login: la cabecera
 *  X-Innerith-User es la única "sesión" y desde la LAN cualquiera podía leer los avisos de crisis o apagar protecciones como
 *  el adulto—. El navegador llega igual: Vite (5173) la llama por su proxy desde esta misma máquina. `INNERITH_LAN=1` la abre
 *  en TODAS las interfaces (lo de antes), para un cliente que le pegue directo desde otro equipo: README → "Probar desde un
 *  teléfono". */
const HOST = listenHost()
const LAN = HOST === undefined

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
async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const t0 = Date.now()
  const me = actingUser(req)
  try {
    // --- DEMO: cada carga de página vuelve a los valores iniciales (la economía vive en RAM) DEL USUARIO ACTIVO (U4, D1 del
    //     dueño: "tu F5 es tu demo nueva"; lo de los otros integrantes sigue donde estaba). {scope:'all'} → TODOS (QA). Lo
    //     persistido (Mi espacio, wishlist, Learn, identity, config del padre, mentorías) y los avisos al padre no entran.
    //     → DemoResetResult { ok: true, scope: 'user' | 'all', user? } (src/api/types.ts). Los resets de cada dominio, en su
    //     orden (las medallas AL FINAL), viven en demoReset.ts; ahí también —revisión de U5, el bug del lunes— el cierre de la
    //     semana de la familia que quedó PENDIENTE, con la foto ANTES de re-sembrar al activo (si no, tomaba su "semana
    //     pasada" del seed). ---
    if (url.pathname === '/api/demo/reset' && req.method === 'POST') {
      const b = await readJson<{ scope?: unknown } | null>(req).catch(() => null)
      const all = !!b && typeof b === 'object' && b.scope === 'all'
      const id = all ? undefined : me.id
      const r = demoReset(me.id, all)
      console.log(`[demo] reset ${all ? 'de TODOS los usuarios (y la semana de la familia)' : `de ${id}`}${r.closedFamilyWeek ? ' (antes cerró la semana de la familia que estaba pendiente, con la semana real de cada uno)' : ''}`)
      return send(res, 200, { ok: true, scope: all ? 'all' : 'user', ...(id ? { user: id } : {}) })
    }

    // --- U5-A: CIERRE REAL de la semana de la liga de la familia, PEREZOSO (docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §2.3): antes
    //     de rutear a los cuatro lectores de lo que el cierre produce —/api/leagues/* (el chip de liga de la barra superior
    //     lee /mine en cada carga: alcanza con que alguien abra la app), /api/parent/activity (el adulto ve el canje en
    //     Premios aunque nadie haya abierto Ligas), /api/market/redemptions y /api/medals*—. Antes de los candados (Ligas
    //     apagadas, Ciclo del día): cerrar la semana de la familia no le muestra nada a quien la dispara. Se dispara acá (la
    //     función vive en demoReset.ts, para poder testearla) y no en parent.ts porque leaguesFake ya importa parent (la vuelta
    //     armaría un ciclo). Un error acá no tumba el pedido. ---
    closeFamilyWeekIfRead(url.pathname, me.id)

    // --- CICLO DEL DÍA (tanda F1, 28-oct; reemplaza a los horarios por sección del porte W7): una sección que figura en
    //     rangos del ciclo del chico y no está disponible ahora (reloj del server en la zona de la familia, o el override de
    //     demo) responde 403 ANTES de rutear (el server es el candado). Qué prefijo es de qué sección —y qué no se gatea
    //     nunca: Feed, amigos, progreso, ligas, Familia, demo, lector y reproductor— en schedule.ts:sectionForApi. Capas
    //     independientes: si la familia APAGÓ la sección (Chat/Tienda), gana el apagado (responde la ruta con su propio
    //     403); el ciclo rige solo si está prendida. El ciclo es del CHICO: con un adulto como usuario activo no se mira
    //     (docs/USUARIOS.md §4). U3: el de ESE chico (cada integrante tiene el suyo), y el "gana el apagado" con SUS on-off.
    //     Misma forma de 403 que antes: {error: 'horario', section, opensAt} (opensAt = "HH:MM" de hoy o null).
    const closed = me.kind === 'child' ? closedSectionFor(url.pathname, me.id) : null
    if (closed && !((closed.key === 'chat' || closed.key === 'tienda') && !featureOn(closed.key, me.id))) {
      return send(res, 403, { error: 'horario', section: closed.key, opensAt: closed.opensAt })
    }

    // --- Dominios con módulo propio (cada uno maneja sus subrutas y métodos) ---
    if (url.pathname === '/api/users') return usersRoutes(req, res, url)
    if (url.pathname === '/api/identity') return await identityRoutes(req, res, url)
    // Mentores (SOLO del adulto: Buscar → Mentores y Familia → Mentorías) + el calendario de cada usuario: teachersFake.ts
    if (url.pathname.startsWith('/api/mentors') || url.pathname === '/api/calendar') return await teachersRoutes(req, res, url)
    // RETIRADOS con la tanda U2 (14-oct): GET /api/teachers · POST /api/teachers/hire · POST /api/teachers/cancel (el
    // marketplace de Profesores de Familia; hoy /api/mentors*). 404 explícito, también para los POST (que si no caerían en
    // el 405 genérico de más abajo).
    if (url.pathname === '/api/teachers' || url.pathname.startsWith('/api/teachers/')) return send(res, 404, { error: 'not found' })
    // Porte Smarty: rutas de Learn (catálogo) y la auditoría de facts de /crear
    if (url.pathname === '/api/afterday') return await afterdayRoutes(req, res, url)
    // Ciclo del día (F1): el GET público (el ciclo del integrante + reloj y tz) y el override de demo "estás en este rango".
    if (url.pathname === '/api/schedules' || url.pathname === '/api/demo/cycle') return await scheduleRoutes(req, res, url)
    if (url.pathname.startsWith('/api/learn-routes')) return await learnRoutesRoutes(req, res, url)
    if (url.pathname.startsWith('/api/learn/')) return await learnResultsRoutes(req, res, url)
    if (url.pathname.startsWith('/api/create/')) return await createRoutes(req, res, url)
    // MyTube (porte Smarty W5): canal enriquecido del chico + ingesta del padre
    if (url.pathname.startsWith('/api/mytube/')) return await mytubeRoutes(req, res, url)
    if (url.pathname.startsWith('/api/progress/')) return progressRoutes(req, res, url)
    if (url.pathname.startsWith('/api/market')) return await market.marketRoutes(req, res, url)
    if (url.pathname.startsWith('/api/leagues/')) return await leaguesRoutes(req, res, url)
    // Medallas de la plataforma (U5-B, medals.ts): la pila del usuario ACTIVO y "ya las vi". Sin sección ni funcionalidad
    // propia (el Ciclo del día no las cierra); el cierre real de la familia ya corrió arriba (familyCloseIfDue).
    if (url.pathname === '/api/medals' || url.pathname.startsWith('/api/medals/')) return medalsRoutes(req, res, url)
    if (url.pathname.startsWith('/api/parent/')) return await parentRoutes(req, res, url)
    if (url.pathname === '/api/friends' || url.pathname.startsWith('/api/friends/')) return await friendsRoutes(req, res, url)

    // --- FEED (FAKE): ver feedFake.ts ---
    if (url.pathname === '/api/feed' && req.method === 'GET') {
      return send(res, 200, getFeed(url.searchParams.get('after')))
    }
    if (url.pathname === '/api/feed/react' && req.method === 'POST') {
      const b = await readJson<{ id?: string; emoji?: string }>(req)
      if (!b.id || !b.emoji) return send(res, 400, { error: 'id/emoji' })
      return send(res, 200, reactFeed(String(b.id), String(b.emoji)))
    }
    // "Ver menos de esto" del hilo v6 (reversible con undo; RAM, se limpia en el reset del demo).
    if (url.pathname === '/api/feed/less' && req.method === 'POST') {
      const b = await readJson<{ id?: string; undo?: boolean }>(req)
      if (!b.id) return send(res, 400, { error: 'id' })
      return send(res, 200, feedLess(String(b.id), b.undo === true))
    }
    // Botón de demo "Simular NPCs" (Feed): ráfaga de 5 noticias frescas de los NPCs, una de cada tipo (feedFake/feedMix).
    // Con Amigos apagado del CHICO activo la ráfaga no existe: 403 fail-closed antes de tocar nada, como /api/friends*
    // (mismo texto; tanda "Feed diverso", 28-oct — antes respondía 200 {added: 0}). Con un adulto no rige.
    if (url.pathname === '/api/feed/simulate-npcs' && req.method === 'POST') {
      if (me.kind === 'child' && !featureOn('amigos', me.id)) return send(res, 403, { error: 'Los amigos están apagados por tu familia' })
      return send(res, 200, simulateNpcs())
    }

    // --- MI ESPACIO (backend real: server/src/space.ts, persistido en data/space.json v2: el del USUARIO ACTIVO, U4) ---
    if (url.pathname.startsWith('/api/space/') && req.method === 'POST') {
      const b = await readJson<Record<string, unknown>>(req)
      const num = (k: string) => Number(b[k] ?? 0) || 0
      const str = (k: string) => String(b[k] ?? '')
      // FS-BASE-A (hallazgo index.ts:212): id ausente o inválido en una operación sobre UNA carpeta o UN archivo → 400, nunca
      // la RAÍZ (antes num() lo volvía 0 y el borrado definitivo de la carpeta 0 se llevaba TODO el Mi espacio): space.spaceIdError.
      const idErr = space.spaceIdError(url.pathname, b)
      if (idErr) return send(res, 400, { error: idErr })
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
        // borrado definitivo: solo lo que está en la papelera ({ok:false} si no; FS-BASE-A)
        case '/api/space/drive/purge': return send(res, 200, { ok: b.kind === 'folder' ? space.purgeFolder(num('id')) : space.purgeItem(num('id')) })
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
      // /api/space/channels|channel se RETIRARON (12-oct): MyTube (W5) lee /api/mytube/* desde entonces.
      if (url.pathname === '/api/space/playlists') return send(res, 200, space.playlists(url.searchParams.get('video')))
      if (url.pathname === '/api/space/playlist') {
        const d = space.playlistDetail(Number(url.searchParams.get('id') ?? 0) || 0)
        return d ? send(res, 200, d) : send(res, 404, { error: 'lista' })
      }
      return send(res, 404, { error: 'not found' })
    }

    if (req.method === 'POST' && url.pathname === '/api/chat') {
      // Gate del padre (fail-closed): si la familia apagó el chat DE ESTE CHICO, ni se lee el mensaje (el adulto pasa).
      if (me.kind === 'child' && !featureOn('chat', me.id)) return send(res, 403, { error: 'El chat está apagado por tu familia' })
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

    // El usuario ACTIVO (forma User de src/api/types.ts: sin `dependents`, que viajan en GET /api/users).
    if (url.pathname === '/api/me') {
      const { id, name, age, nick, kind } = me
      return send(res, 200, { id, name, age, nick, kind })
    }

    // Las tres solapas de Buscar pasan por el circuito de jueces con un CHICO activo (searchGuard.ts, FS-BASE-A): una consulta
    // bloqueada responde {query, items: [], block} (ADITIVO: SearchResponse.block) y su log NO lleva la consulta.
    if (url.pathname === '/api/search/images') {
      const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200)
      if (!q) return send(res, 400, { error: 'q vacía' })
      const { block, terms, items } = await guardedImages(q)
      if (block) { console.log(`[images] consulta bloqueada (${block.kind}) (${Date.now() - t0} ms)`); return send(res, 200, { query: q, items: [], related: [], block }) }
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
      const { block, hits } = await guardedVideos(q)
      if (block) { console.log(`[videos] consulta bloqueada (${block.kind}) (${Date.now() - t0} ms)`); return send(res, 200, { query: q, items: [], block }) }
      await loadVideoMeta(hits.map(h => h.videoId))
      console.log(`[videos] «${q}» → ${hits.length} del catálogo aprobado (${Date.now() - t0} ms)`)
      return send(res, 200, { query: q, items: hits.map(toVideoResult) })
    }

    if (url.pathname === '/api/video') {
      const v = await getVideo(url.searchParams.get('id') ?? '')
      // `followed`: el canal en el Mi espacio DEL USUARIO ACTIVO (U4: cada uno sigue lo suyo)
      return v ? send(res, 200, { ...v, followed: space.isFollowed(v.channelId) }) : send(res, 404, { error: 'Video no aprobado' })
    }

    if (url.pathname === '/api/health') return send(res, 200, { ok: true, policyVersion: config.policyVersion, sites: config.sites.length })

    if (url.pathname === '/api/search/pages') {
      const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200)
      if (!q) return send(res, 400, { error: 'q vacía' })
      const { block, results, error } = await guardedPages(q)
      if (block) { console.log(`[search] consulta bloqueada (${block.kind}) (${Date.now() - t0} ms)`); return send(res, 200, { query: q, items: [], block }) }
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
    // FS-BASE-B: un cuerpo ilegible o demasiado grande es del pedido (400/413 con motivo, web.ts: antes 500 'internal', p. ej.
    // el chat cuando el contexto pasaba los 200 KB); un cambio que no se pudo guardar (Mi espacio, durable.ts) es un 500 CON
    // motivo y la RAM ya volvió a lo que hay en disco.
    if (e instanceof BodyError) return send(res, e.status, { error: e.message })
    if (e instanceof DiskWriteError) { console.error('[error]', e.message); return send(res, 500, { error: 'No pude guardar el cambio. Probá de nuevo.' }) }
    console.error('[error]', e)
    send(res, 500, { error: 'internal' })
  }
}

// FS-BASE-A (hallazgo ALTA chat.ts:246): RED DE SEGURIDAD. Node 24 corre con unhandled-rejections=throw: una promesa rechazada
// sin handler (como la del principal del chat cuando fallaba antes que el juez) mataba el proceso con exit 1 —el API de toda
// la familia caído, `tsx watch` no lo levanta solo, y la RAM (economía, semana de la familia, feed) perdida—. Con este
// handler un rechazo así queda en el log y el server sigue. No reemplaza al arreglo en el lugar (chat.ts lo marca manejado).
process.on('unhandledRejection', (e) => { console.error('[unhandled] una promesa rechazada quedó sin manejar (el server sigue andando):', e) })

// Cada pedido corre con SU usuario activo como contexto (requestContext.ts): la "política vigente" de parent.ts lo lee.
createServer((req, res) => { void runWithRequest(req, () => handle(req, res)) }).listen(PORT, HOST, () => {
  setImmediate(() => { searchVideos('precalentar') }) // índice de videos (~5 s), al arrancar
  console.log(`Innerith API en http://127.0.0.1:${PORT}${LAN ? ' y en la RED LOCAL (INNERITH_LAN=1: todas las interfaces)' : ' (solo esta máquina; INNERITH_LAN=1 la abre a la red)'} · policyVersion ${config.policyVersion} · ${config.sites.length} sitios`)
  if (LAN) console.warn('[red] INNERITH_LAN=1: cualquiera en tu red puede usar la API como cualquier usuario (no hay login). Cerralo al terminar la prueba.')
  if (!process.env.OPENAI_API_KEY || !process.env.SERPER_API_KEY) console.warn('Faltan claves en server/.env (correr el import de Smarty)')
})
