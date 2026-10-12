/**
 * SceneDirector — director de escenas de audio (ver SCENE_DIRECTOR.md). Capa app que, según la VISTA
 * del chico dentro de Learn (ruta / lectura / video / actividad / ganó / perdió), elige qué TEMA suena y
 * qué ánimo, y (fase 1b) coordina con la música de fondo + el ruido blanco. Singleton de módulo (patrón
 * backgroundAudio); los componentes que conocen SU vista pushean/popean su escena — el TOPE del stack es la
 * escena activa. Así las transiciones (abrir/cerrar overlays anidados) se resuelven solas sin coordinación.
 *
 * FASE 1a (esto): sólo maneja los TEMAS del motor (crossfade por escena) + el ánimo. La coordinación del
 * fondo/ruido y el "dueño único del duck" van en la fase 1b.
 *
 * PORTE INNERITH (W2): archivo FIEL al POC pero SIN MONTAR — nadie lo importa todavía (ni useScene ni
 * push/pop). La integración con el MiniPlayer de Innerith y las escenas (RutaView/ActivityOverlay) es
 * de W3. Único cambio: la música de fondo se lee del puerto `./bgAudioPort` (mismas firmas que el
 * `lib/backgroundAudio` del POC; inerte hasta que W3 lo enchufe con `bindBgAudio`).
 */
import { useEffect, useRef } from 'react'
import { crossfadeTo, stopStem, ensureAudio, audioSink } from './service'
import * as ytScene from './ytScenePlayer'
import type { YtTrack } from './ytScenePlayer'
import { getBgState, setMusicVolumeTransient, duckForForeground, unduck, playMusic } from './bgAudioPort'

export type Scene = 'ruta' | 'lectura' | 'video' | 'actividad' | 'gano' | 'perdio'

/** La FUENTE que musicaliza una escena: un tema del motor (stem, con capas+moods) o el audio de una
 *  LISTA de canciones de YouTube (elige una; al terminar, la siguiente). Ver SCENE_DIRECTOR.md. */
export type SceneSource =
  | { kind: 'stem'; stem: string; mood?: string }
  | { kind: 'yt'; playlist: string } // una PLAYLIST de YouTube (el iframe avanza/loopea solo)
  | { kind: 'yt'; tracks: YtTrack[]; pick?: 'first' | 'random' } // videoIds sueltos

interface Recipe {
  /** La fuente musical (undefined = sin música; p.ej. video, que lo maneja el propio video). */
  source?: SceneSource
  /** Qué hacer con la MÚSICA DE FONDO del chico (YouTube del MiniPlayer): 'fade' baja el volumen a
   *  `fondoVol`; 'fadeout' funde a 0 y PAUSA (la música de la escena queda sola); 'pause' pausa duro
   *  (video); undefined = no tocarla. Al salir de Learn se reanuda + sube el volumen suave. */
  fondo?: 'fade' | 'fadeout' | 'pause'
  /** Nivel (0-100) al que baja el fondo cuando `fondo:'fade'`. */
  fondoVol?: number
}

/**
 * Mapa escena → receta. Temas PLACEHOLDER (temaA/temaB) para verificar el cableado; se reemplazan por la
 * música real (stems y/o listas de YouTube) + moods. Niveles de fondo = default, se afinan. Ver SCENE_DIRECTOR.md.
 */
const SCENES: Record<Scene, Recipe> = {
  // TEMP test: la escena 'ruta' usa UN solo video de YouTube (embed liviano de un video, no el de
  // playlist videoseries que es más pesado/lento). Al terminar, repite. Revertir a { kind:'stem', stem:'temaA' }.
  ruta: { source: { kind: 'yt', tracks: [{ videoId: 'yJ6Lbsmb1lY' }] }, fondo: 'fadeout' },
  lectura: { source: { kind: 'stem', stem: 'temaA', mood: 'calmo' }, fondo: 'fade', fondoVol: 20 },
  video: { fondo: 'pause' }, // sin fuente + pausa el fondo: manda el audio del video
  actividad: { source: { kind: 'stem', stem: 'temaB', mood: 'play' }, fondo: 'fade', fondoVol: 20 },
  gano: { source: { kind: 'stem', stem: 'temaB', mood: 'win' }, fondo: 'fade', fondoVol: 20 },
  perdio: { source: { kind: 'stem', stem: 'temaB', mood: 'lose' }, fondo: 'fade', fondoVol: 20 },
}

/** Stems que el director maneja como "tema" (para apagarlos en escenas sin tema / al salir). */
const THEME_STEMS = ['temaA', 'temaB']
const THEME_FADE = 1.5 // s — duración ÚNICA de fade para todo (stems, YT, fondo) → transiciones parejas y suaves

// --- stack de escenas: el tope manda ---
let stack: { id: number; scene: Scene }[] = []
let seq = 0
let active: Scene | null = null

function stopThemes(fadeTime = THEME_FADE): void {
  for (const s of THEME_STEMS) stopStem(s, { fadeTime })
}

// --- coordinación de la MÚSICA DE FONDO del chico (YouTube del MiniPlayer) ---
// El director es el ÚNICO dueño del duck (decisión 5). Baja/pausa transitorio SIN pisar la
// preferencia del chico (state.volume queda intacto); al salir de la escena, restaura.
let fondoDucked: 'fade' | 'fadeout' | 'pause' | null = null
let fondoCur = 0 // último volumen comandado (para no saltar al re-fadear)
let fondoTimer: ReturnType<typeof setInterval> | null = null

function fadeFondo(to: number, ms = 1500, onDone?: () => void): void {
  if (fondoTimer) clearInterval(fondoTimer)
  const from = fondoCur
  const steps = Math.max(1, Math.round(ms / 30)) // pasos finos
  let i = 0
  fondoTimer = setInterval(() => {
    i += 1
    const p = i / steps
    const eased = p * p * (3 - 2 * p) // smoothstep: aterriza suave (sin salto perceptual cerca del 0)
    fondoCur = i >= steps ? to : from + (to - from) * eased
    setMusicVolumeTransient(fondoCur)
    if (i >= steps) {
      clearInterval(fondoTimer!)
      fondoTimer = null
      onDone?.()
    }
  }, 30)
}

function applyFondo(scene: Scene | null): void {
  const r = scene ? SCENES[scene] : undefined
  const policy = r?.fondo
  if (policy === 'pause') {
    if (getBgState().playing) {
      duckForForeground()
      fondoDucked = 'pause'
    }
  } else if (policy === 'fadeout') {
    // fundir el fondo a 0 y LUEGO pausar → la música de la ESCENA queda sola
    if (fondoDucked === null) fondoCur = getBgState().volume
    if (getBgState().playing) {
      fondoDucked = 'fadeout'
      fadeFondo(0, 1500, () => {
        if (fondoDucked === 'fadeout' && getBgState().playing) duckForForeground()
      })
    }
  } else if (policy === 'fade') {
    if (fondoDucked === null) fondoCur = getBgState().volume // veníamos de normal → arrancar del volumen del chico
    if (fondoDucked === 'pause') unduck() // veníamos de pausa → reanudar (queda al último comandado)
    if (getBgState().playing) {
      fadeFondo(Math.min(r?.fondoVol ?? 20, getBgState().volume)) // nunca MÁS fuerte de lo que el chico eligió
      fondoDucked = 'fade'
    }
  } else if (fondoDucked) {
    // sin política (fuera de escena / salir de Learn) → restaurar el fondo del chico, ROBUSTO + SUAVE:
    const st = getBgState()
    if (st.ducked) unduck() // reanuda (unMute + playVideo) si quedó pausado por nosotros
    fadeFondo(st.volume) // sube el volumen SUAVE (desde fondoCur; puede venir de 0 si hubo fadeout)
    fondoDucked = null
  }
}

/** Aplica el tope del stack a las 3 capas (fase 1a: sólo los temas del motor). */
async function apply(): Promise<void> {
  const scene = stack.length ? stack[stack.length - 1].scene : null
  if (scene === active) return
  active = scene // sincrónico → guarda contra reentradas mientras carga el audio
  applyFondo(scene) // fondo/ruido: no depende del motor → responde ya (aunque el audio no esté desbloqueado)
  await ensureAudio() // idempotente; el gesto lo desbloquea el click de abrir ruta (si no, es no-op grácil)
  if (active !== scene) return // cambió el tope mientras esperábamos → esta corrida quedó vieja
  const src = scene ? SCENES[scene].source : undefined
  // Crossfade CROSS-FUENTE: fundir la saliente contra la entrante (el motor cruza stem↔stem solo).
  if (src?.kind === 'stem') {
    ytScene.stop({ fadeMs: 1500 }) // sale la fuente YT (si estaba)
    crossfadeTo(src.stem, { fadeTime: THEME_FADE })
    if (src.mood) audioSink.setMood(src.mood)
  } else if (src?.kind === 'yt') {
    stopThemes() // sale el tema del motor (si estaba)
    if ('playlist' in src) ytScene.playPlaylist(src.playlist, { fadeMs: 1500 })
    else ytScene.playList(src.tracks, src.pick ?? 'first', { fadeMs: 1500 })
  } else {
    stopThemes()
    // Sin fuente (p.ej. escena 'video'): CORTE RÁPIDO de la música de escena. Si sigue sonando cuando el
    // video de primer plano arranca, el navegador MUTEA el video (mute a nivel elemento, que unMute no toca).
    // Soltarla rápido → sin audio compitiendo → el video arranca (y se queda) con sonido.
    ytScene.stop({ fadeMs: 200 })
  }
}

/** Un componente entra a una escena (push). Devuelve un id para `updateScene`/`popScene`. */
export function pushScene(scene: Scene): number {
  const id = ++seq
  stack.push({ id, scene })
  void apply()
  return id
}
export function updateScene(id: number, scene: Scene): void {
  const e = stack.find((x) => x.id === id)
  if (!e || e.scene === scene) return
  e.scene = scene
  void apply()
}
export function popScene(id: number): void {
  const before = stack.length
  stack = stack.filter((x) => x.id !== id)
  if (stack.length !== before) void apply()
}

/** El chico salió de Learn: limpiar todo + apagar los temas. (Fondo/ruido: fase 1b.) */
export function leaveLearn(): void {
  stack = []
  void apply()
}

/** La escena activa (tope del stack) — para debug/tests. */
export function currentScene(): Scene | null {
  return active
}

// TEMP dev/debug (solo dev): leer la escena desde la consola del preview.
if (import.meta.env.DEV) {
  ;(window as unknown as { __learnScene?: unknown }).__learnScene = {
    currentScene, pushScene, updateScene, popScene, leaveLearn,
    stack: () => stack.map((s) => s.scene),
    fondo: () => ({ ducked: fondoDucked, cur: Math.round(fondoCur), playing: getBgState().playing, vol: getBgState().volume }),
    testMusic: (id: string) => playMusic({ videoId: id } as Parameters<typeof playMusic>[0]),
  }
}

/**
 * Hook React: mientras el componente está montado, su `scene` está en el stack (push al montar, update al
 * cambiar, pop al desmontar). Para componentes cuya escena se deriva del render (p.ej. RutaView='ruta').
 * Los que necesitan actualizar por EVENTO (ActivityOverlay: finished→ganó/perdió) usan push/update/pop directo.
 */
export function useScene(scene: Scene): void {
  const idRef = useRef<number | null>(null)
  useEffect(() => {
    const id = pushScene(scene) // escena al montar; el segundo effect sincroniza los cambios
    idRef.current = id
    return () => popScene(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (idRef.current != null) updateScene(idRef.current, scene)
  }, [scene])
}
