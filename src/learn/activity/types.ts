/**
 * Activity framework — contratos genéricos compartidos por todos los minijuegos
 * didácticos. Framework-agnóstico (sin React). Un juego concreto (p.ej. el
 * dominó) implementa una `ActivityInstance` y se publica como `ActivityModule`
 * para que el host lo descubra y lance siempre de la misma forma.
 */

/** Estado de vida de una actividad. */
export type ActivityStatus = 'idle' | 'running' | 'paused' | 'finished'

/** Cómo terminó una actividad. */
export type ActivityOutcome = 'completed' | 'timeout' | 'aborted'

/**
 * Eventos semánticos que una actividad emite durante el juego. Un adaptador de
 * audio / hápticos / telemetría se suscribe y los traduce a su propio mundo (el
 * `audioBridge` los mapea a `AudioEngine.triggerFx` / `setMood` del audio-lab).
 * La actividad NO conoce a sus consumidores: solo declara qué pasó.
 */
export type ActivityEvent =
  // --- diccionario BASE: contrato fuerte, versionado, del que SÍ pueden
  //     depender los servicios del núcleo (audio, visual, scoring) ---
  | { kind: 'started' }
  | { kind: 'tick'; elapsedMs: number; remainingMs: number | null }
  // `skill` viaja en el evento para que un compositor (p.ej. la multi-actividad)
  // pueda reconstruir la granularidad por-skill del hijo al espejar sus movidas.
  | { kind: 'move:correct'; points: number; streak: number; skill?: string }
  | { kind: 'move:wrong'; skill?: string }
  | { kind: 'hint' }
  | { kind: 'paused' }
  | { kind: 'resumed' }
  | { kind: 'finished'; result: ActivityResult }
  // --- canal LIBRE: cada actividad emite lo suyo; quien entienda `ns`/`type`
  //     lo interpreta, el resto lo ignora. Best-effort: ningún servicio puede
  //     EXIGIR un signal (lo obligatorio vive solo en el diccionario base).
  //     De acá lee, p.ej., el companion para comentar lo que pasa en el juego.
  | { kind: 'signal'; ns: string; type: string; data?: unknown }

/** Conteos didácticos acumulados durante la partida. */
export interface ActivityStats {
  correct: number
  wrong: number
  hintsUsed: number
  bestStreak: number
}

/** Desglose opcional por habilidad (p.ej. 'suma', 'resta') para la ficha de progreso. */
export interface SkillTally {
  attempts: number
  correct: number
}

/**
 * Identidad de la Instancia: quién acuñó el Ejercicio. La inyecta el HOST al
 * crear la actividad (el motor no la conoce ni la necesita) y viaja hasta el
 * `ActivityResult` → el resultado queda autosuficiente para atribución
 * (definitionId) y reproducción (seed + generador determinista).
 */
export interface ActivityIdentity {
  definitionId?: string
  seed?: number
}

/**
 * Resumen serializable que se emite al terminar. Es lo que el host persiste
 * (en la app: una tabla Dexie nueva). Estética alineada con las interfaces de
 * `app/src/db.ts` (ids/timestamps numéricos, sin clases ni Dates).
 */
export interface ActivityResult {
  activityId: string
  version: number
  startedAt: number
  finishedAt: number
  durationMs: number
  outcome: ActivityOutcome
  score: number
  maxScore: number
  stats: ActivityStats
  /** La config con la que se jugó — DATO serializable (nunca funciones/closures). */
  config: unknown
  skills?: Record<string, SkillTally>
  /** Identidad (si el host la inyectó): qué Definición acuñó el Ejercicio… */
  definitionId?: string
  /** …y con qué seed (junto al generador determinista, reconstruye el Ejercicio). */
  seed?: number
}

/**
 * Campos comunes que TODO snapshot de actividad expone, para que el host
 * (cabecera de puntaje/tiempo, barra de progreso) sea genérico. Cada juego
 * extiende esto con su propio estado de dominio.
 */
export interface CommonSnapshot {
  status: ActivityStatus
  score: number
  maxScore: number
  stats: ActivityStats
  elapsedMs: number
  /** ms restantes en modo contrarreloj; `null` si la partida no tiene reloj. */
  remainingMs: number | null
}

/**
 * Inversión de control que recibe una instancia al crearse. Mantiene a la
 * actividad desacoplada del host: emite eventos y lee el reloj por acá.
 */
export interface ActivityContext {
  /** Emite un evento semántico (lo escuchan audioBridge, telemetría, etc.). */
  emit: (event: ActivityEvent) => void
  /** Fuente de tiempo; inyectable para tests deterministas. Default: Date.now. */
  now: () => number
  /** Identidad de la Instancia (la inyecta el host); el core la estampa en el result. */
  identity?: ActivityIdentity
}

/**
 * Una actividad viva y jugable. La UI se ata vía subscribe/getSnapshot (mismo
 * patrón external-store que `AudioEngine`). El resultado final llega como evento
 * `finished` y queda accesible en `getResult()`.
 *
 * En modo contrarreloj el reloj NO corre solo: el host debe bombear `tick()`
 * periódicamente (el `ActivityRunner` de React lo hace por vos). Así la lógica
 * queda pura y testeable con `now()` inyectado.
 */
export interface ActivityInstance<Snapshot extends CommonSnapshot> {
  start: () => void
  pause: () => void
  resume: () => void
  /** Termina la partida ya; emite `finished` con outcome 'aborted'. */
  abort: () => void
  /** Avanza el reloj (modo contrarreloj): recalcula tiempo y puede disparar timeout. */
  tick: () => void
  /** Libera timers/listeners. */
  dispose: () => void
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => Snapshot
  /** El resultado una vez terminada; `null` mientras no terminó. */
  getResult: () => ActivityResult | null
}

/** Metadatos para descubrimiento/presentación de la actividad. */
export interface ActivityMeta {
  title: string
  description: string
  ageRange: [number, number]
  tags: string[]
}

/**
 * Descriptor registrable de una actividad. El host descubre y lanza CUALQUIER
 * actividad a través de esta misma forma, sin saber qué juego hay adentro — esto
 * es lo que hace al minijuego "invocable de diferentes maneras" (tool del chat,
 * menú, After Day, tarjeta embebida).
 */
export interface ActivityModule<
  Config,
  Snapshot extends CommonSnapshot,
  Instance extends ActivityInstance<Snapshot> = ActivityInstance<Snapshot>,
> {
  id: string
  meta: ActivityMeta
  defaultConfig: Config
  /**
   * El tipo `Instance` por defecto es la interfaz base, pero un juego puede
   * estrecharlo a su clase concreta (con acciones propias como `play`/`hint`)
   * para que el host las use con tipos sin castear.
   */
  create: (config: Config, ctx: ActivityContext) => Instance
  /**
   * PORTERO (opcional pero recomendado): valida un Ejercicio ANTES de jugarlo.
   * Es la garantía determinista del Tipo sobre CUALQUIER productor de contenido
   * (generador propio, LLM, marketplace, import): si el contenido no cumple las
   * reglas (p.ej. dominó resoluble, quiz con una sola correcta), se rechaza con
   * la CAUSA CONCRETA. Ver ACTIVIDADES.md §3 ("el Tipo es el portero").
   */
  validateContent?: (content: unknown) => { ok: true } | { ok: false; reason: string }
}
