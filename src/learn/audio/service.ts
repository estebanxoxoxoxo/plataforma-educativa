import { AudioEngine } from './engine'
import { gameManifest } from './gameManifest'
import type { AudioSink } from './audioBridge'

/* Servicio de audio de Learn: SINGLETON de módulo, persistente. Una sola instancia
   del AudioEngine + un solo AudioContext que se crea UNA vez (en el primer gesto de
   usuario) y NO se destruye al cerrar una actividad → transiciones suaves y el sonido
   sigue corriendo entre actividades. La cama de ambiente la posee el servicio; las
   actividades solo disparan FX + piden moods (vía el AudioSink). Ver ACTIVIDADES.md. */

const engine = new AudioEngine()
const loaded = engine.load(gameManifest) // arranca la carga de samples ya (no necesita gesto)
let startPromise: Promise<void> | null = null

/** Sink que delega en el engine singleton (lo consume el audioBridge de cada actividad). */
export const audioSink: AudioSink = {
  triggerFx: (id, opts) => engine.triggerFx(id, opts),
  setMood: (id) => engine.setMood(id),
}

/** Control de TEMAS (stems) del motor — lo consumirá el SceneDirector (ver MOTOR_AUDIO.md).
 *  crossfadeTo = cambiar de tema (slot con crossfade); startStem/stopStem = capas independientes. */
export function crossfadeTo(stemId: string, opts?: { fadeTime?: number }): void {
  engine.crossfadeTo(stemId, opts)
}
export function startStem(stemId: string, opts?: { fadeTime?: number }): void {
  engine.startStem(stemId, opts)
}
export function stopStem(stemId: string, opts?: { fadeTime?: number }): void {
  engine.stopStem(stemId, opts)
}

/**
 * Crea/reanuda el AudioContext y deja el motor listo para los FX. DEBE llamarse desde
 * un gesto de usuario (autoplay). Idempotente: una sola vez para toda la sesión.
 *
 * NO arranca ninguna pista de fondo: durante la partida no suena la cama de ambiente
 * (el viento placeholder). Los FX (chime/buzz/fanfare) van por triggerFx y no dependen
 * de los loops, así que suenan igual. Los temas los arranca el SceneDirector por escena.
 *
 * Cachea la promesa de init: llamadas CONCURRENTES (varios gestos, el director + el Lobby)
 * esperan el MISMO init → nadie dispara un crossfade antes de que el motor esté 'running'.
 */
export function ensureAudio(): Promise<void> {
  if (!startPromise) {
    startPromise = (async () => {
      try {
        await loaded
        await engine.init() // crea/reanuda el AudioContext + arma el grafo (habilita los FX)
      } catch {
        startPromise = null // falló → reintentar en el próximo gesto
      }
    })()
  }
  return startPromise
}

// TEMP dev/debug (solo dev): leer/manejar el motor desde la consola del preview.
if (import.meta.env.DEV) {
  ;(window as unknown as { __learnAudio?: unknown }).__learnAudio = {
    engine, ensureAudio, crossfadeTo, startStem, stopStem,
    stemGain: (id: string) => engine.getStemGain(id),
    snap: () => engine.getSnapshot(),
  }
}
