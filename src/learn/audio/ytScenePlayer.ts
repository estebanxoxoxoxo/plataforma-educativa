/**
 * ytScenePlayer — fuente de audio de escena por STREAMING de YouTube (ver SCENE_DIRECTOR.md). Un
 * "backgroundAudio paralelo, por escena": un iframe oculto reproduce el audio de una LISTA de canciones
 * (elige una por escena; al terminar, la siguiente), con control de VOLUMEN para que el SceneDirector
 * cruce entre esta fuente y los stems del motor. Es SEPARADO de la música del MiniPlayer (backgroundAudio).
 *
 * FASE 2 (MVP): un solo iframe (yt↔yt cambia de track con recarga = un pequeño gap), sin el loop de
 * segmento [start,end] con auto-crossfade de 2 iframes (refinamiento posterior). El crossfade cross-FUENTE
 * (yt↔stem) lo hace el director fundiendo el volumen de acá contra el bus del stem.
 *
 * Realidad: el audio del iframe es cross-origin → NO pasa por el motor; se controla por setVolume (0-100,
 * escalonado). Autoplay-con-sonido puede bloquearse en iOS/Safari sin un tap directo (a probar en iPad).
 *
 * PORTE INNERITH (W2): archivo FIEL al POC pero SIN MONTAR (lo usará el SceneDirector cuando W3 lo
 * integre). Único cambio: el puente con YouTube es el port que Innerith ya tiene del mismo
 * `lib/ytBridge.ts` del POC (`src/shared/lib/ytBridge.ts`, mismas firmas).
 */
import { ytEmbedUrl, ytCommand, ytSubscribe, parseYtMessage } from '../../shared/lib/ytBridge'

export interface YtTrack {
  videoId: string
  /** Inicio (s) del segmento (opcional). Fin/loop de segmento = refinamiento posterior. */
  start?: number
  end?: number
}

let iframe: HTMLIFrameElement | null = null
let tracks: YtTrack[] = []
let idx = 0
let curVol = 0 // volumen actual (0-100), lo mueve el fade
let fadeTimer: ReturnType<typeof setInterval> | null = null
let bound = false
let ready = false // ¿el player ya aceptó comandos? (onReady). Comandar antes CRASHEA su onMessage interno.

function onMessage(e: MessageEvent): void {
  if (!iframe || e.source !== iframe.contentWindow) return
  // onReady: recién acá el player está inicializado y acepta comandos. setVolume/unMute antes de esto
  // crashea su handler ("isExternalMethodAvailable is not a function"), sobre todo en el embed videoseries.
  try {
    const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    if (d?.event === 'onReady') { ready = true; applyVol() } // aplicar el volumen actual apenas está listo
  } catch { /* mensaje no-JSON */ }
  const m = parseYtMessage(e)
  if (m?.state === 'ended') next() // al terminar una canción → la siguiente de la lista
}

/** Aplica el volumen actual al player — SOLO si ya está listo (onReady). unMute porque setVolume no
 *  des-mutea (el navegador puede mutear el iframe cuando arranca otro embed). */
function applyVol(): void {
  if (!ready || !iframe) return
  const v = Math.round(Math.max(0, Math.min(100, curVol)))
  if (v > 0) ytCommand(iframe, 'unMute')
  ytCommand(iframe, 'setVolume', [v])
}

/** SUELTA el iframe del DOM (no solo lo pausa): así deja de ser un embed de YouTube vivo que compite
 *  con el video de la ruta / el fondo (YouTube estrangula el embed más nuevo → "cargando sin avanzar").
 *  Se recrea en el próximo play (pequeño gap de recarga, aceptable). */
function release(): void {
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null }
  if (iframe) { iframe.src = 'about:blank'; iframe.remove(); iframe = null } // corta el streaming y lo quita del DOM
  ready = false
  curVol = 0
}

function ensureIframe(): HTMLIFrameElement {
  if (iframe) return iframe
  const el = document.createElement('iframe')
  el.title = 'Música de escena'
  el.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation') // misma contención que el fondo
  el.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture')
  el.setAttribute('aria-hidden', 'true')
  el.style.cssText = 'position:fixed;left:-10000px;top:0;width:320px;height:180px;pointer-events:none;border:0'
  // al (re)cargar un video: SOLO suscribirse (para recibir onReady + estados). NO comandar todavía:
  // el player aún no está listo → esperamos onReady (ver onMessage) antes de tocar volumen.
  el.addEventListener('load', () => { ytSubscribe(el) })
  document.body.appendChild(el)
  iframe = el
  if (!bound) {
    window.addEventListener('message', onMessage)
    bound = true
  }
  return el
}

function loadTrack(t: YtTrack): void {
  ready = false // nuevo documento → esperar onReady antes de comandar
  ensureIframe().src = ytEmbedUrl(t.videoId, t.start) // cambiar de video = recargar el src (autoplay)
}

function next(): void {
  if (tracks.length < 2) {
    if (tracks.length === 1) loadTrack(tracks[0]) // una sola → repetir
    return
  }
  idx = (idx + 1) % tracks.length
  loadTrack(tracks[idx])
}

/** Rampa `curVol` de a pasos hasta `to` (el volumen del iframe es discreto → fade escalonado). */
const FADE_STEP_MS = 30 // pasos finos → rampa suave (el volumen del iframe es discreto 0-100)

/** Rampa `curVol` hasta `to` con curva SMOOTHSTEP (arranca y —sobre todo— ATERRIZA suave cerca del 0,
 *  evitando el salto perceptual del final que da una rampa lineal). El volumen del iframe es discreto. */
function fadeVolume(to: number, ms: number): void {
  if (fadeTimer) clearInterval(fadeTimer)
  const from = curVol
  const steps = Math.max(1, Math.round(ms / FADE_STEP_MS))
  let i = 0
  fadeTimer = setInterval(() => {
    i += 1
    const p = i / steps
    const eased = p * p * (3 - 2 * p) // smoothstep: pendiente 0 en ambos extremos → sin salto al llegar a 0
    curVol = i >= steps ? to : from + (to - from) * eased
    applyVol() // comanda SOLO si el player ya está listo (onReady); si no, no-op hasta que lo esté
    if (i >= steps) {
      if (fadeTimer) clearInterval(fadeTimer)
      fadeTimer = null
      if (to <= 0) release() // fade-out completo → SOLTAR el iframe (no seguir compitiendo con otros embeds)
    }
  }, FADE_STEP_MS)
}

/** Reproduce una LISTA de videoIds: elige una (pick) y la toca fundiendo el volumen de 0 a `volume`. */
export function playList(list: YtTrack[], pick: 'first' | 'random' = 'first', opts?: { fadeMs?: number; volume?: number }): void {
  if (!list.length) return
  tracks = list
  idx = pick === 'random' ? Math.floor(Math.random() * list.length) : 0
  curVol = 0
  loadTrack(tracks[idx])
  fadeVolume(opts?.volume ?? 100, opts?.fadeMs ?? 1500)
}

/** Reproduce una PLAYLIST de YouTube (por su id PL...): el iframe la loopea y avanza solo entre canciones. */
export function playPlaylist(playlistId: string, opts?: { fadeMs?: number; volume?: number }): void {
  tracks = [] // YT maneja el avance de la playlist; no usamos la lista interna
  const origin = encodeURIComponent(location.origin)
  ready = false // nuevo documento → esperar onReady antes de comandar
  ensureIframe().src =
    `https://www.youtube-nocookie.com/embed/videoseries?list=${playlistId}&enablejsapi=1&origin=${origin}` +
    `&autoplay=1&controls=0&rel=0&playsinline=1&fs=0&disablekb=1&iv_load_policy=3&modestbranding=1&loop=1`
  curVol = 0
  fadeVolume(opts?.volume ?? 100, opts?.fadeMs ?? 1500)
}

/** Frena la música de escena: fade out y SUELTA el iframe (no solo lo pausa) → deja de ser un embed de
 *  YouTube vivo que compite con el video de la ruta / el fondo. Se recrea en el próximo play. */
export function stop(opts?: { fadeMs?: number }): void {
  if (!iframe) return
  if (curVol <= 0) { release(); return } // ya en silencio → soltar directo
  fadeVolume(0, opts?.fadeMs ?? 1500) // fade-out gentil; al completar, release() suelta el iframe
}

/** Volumen actual (0-100) — para debug/verificación. */
export function volume(): number {
  return curVol
}

// TEMP dev/debug (solo dev): manejar la fuente YT desde la consola del preview.
if (import.meta.env.DEV) {
  ;(window as unknown as { __ytScene?: unknown }).__ytScene = { playList, playPlaylist, stop, volume, hasIframe: () => !!iframe }
}
