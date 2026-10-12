/**
 * Lifecycle compartido por las actividades: estado, reloj (con pausa), puntaje,
 * stats, construcción del `ActivityResult` y despacho de eventos semánticos.
 *
 * Un juego lo COMPONE (has-a, no hereda) y le agrega su estado de dominio +
 * reglas de jugada. Así, una actividad nueva reusa todo lo "de actividad" y solo
 * escribe su máquina de estados propia.
 *
 * Notificación de cambios: cada mutación incrementa `rev`. El juego cachea su
 * snapshot contra `rev` para dar estabilidad referencial a useSyncExternalStore.
 */

import { pointsForCorrect, timeBonus, type ScoreConfig } from './scoring'
import type {
  ActivityContext,
  ActivityEvent,
  ActivityOutcome,
  ActivityResult,
  ActivityStats,
  ActivityStatus,
  CommonSnapshot,
  SkillTally,
} from './types'

export interface CoreOptions {
  activityId: string
  version: number
  /** Config jugada, guardada verbatim en el result. */
  config: unknown
  score: ScoreConfig
  /** Presupuesto de tiempo (ms) en contrarreloj; null/undefined → sin reloj. */
  durationMs?: number | null
  /** Puntaje máximo teórico (lo calcula el juego, que conoce las jugadas). */
  maxScore: number
  ctx: ActivityContext
}

export class ActivityCore {
  status: ActivityStatus = 'idle'
  score = 0
  stats: ActivityStats = { correct: 0, wrong: 0, hintsUsed: 0, bestStreak: 0 }
  skills: Record<string, SkillTally> = {}
  /** Se incrementa en cada cambio de estado; el juego cachea su snapshot acá. */
  rev = 0

  private streak = 0
  private readonly opts: CoreOptions
  private readonly ctx: ActivityContext
  private startedAtStamp = 0
  private accumMs = 0 // elapsed acumulado antes de la última pausa / al terminar
  private runningSince = 0 // now() del último start/resume
  private result: ActivityResult | null = null
  private listeners = new Set<() => void>()

  constructor(opts: CoreOptions) {
    this.opts = opts
    this.ctx = opts.ctx
  }

  // ---------------------------------------------- cambios de estado (UI)
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Notifica cambio de estado. El juego lo llama tras mutar su dominio. */
  notify = (): void => {
    this.rev += 1
    // mismo criterio que Emitter.emit: un suscriptor que tire no corta al resto
    for (const listener of [...this.listeners]) {
      try {
        listener()
      } catch (err) {
        console.error('[activity] un suscriptor de notify tiró; se continúa con el resto:', err)
      }
    }
  }

  // ----------------------------------------------------------- reloj
  get durationMs(): number | null {
    return this.opts.durationMs ?? null
  }

  elapsedMs(): number {
    const live = this.status === 'running' ? this.ctx.now() - this.runningSince : 0
    return this.accumMs + live
  }

  remainingMs(): number | null {
    const d = this.durationMs
    return d == null ? null : Math.max(0, d - this.elapsedMs())
  }

  // ------------------------------------------------------- lifecycle
  start(): void {
    if (this.status !== 'idle') return
    const t = this.ctx.now()
    this.startedAtStamp = t
    this.runningSince = t
    this.accumMs = 0
    this.status = 'running'
    this.ctx.emit({ kind: 'started' })
    this.notify()
  }

  pause(): void {
    if (this.status !== 'running') return
    this.accumMs += this.ctx.now() - this.runningSince
    this.status = 'paused'
    this.ctx.emit({ kind: 'paused' })
    this.notify()
  }

  resume(): void {
    if (this.status !== 'paused') return
    this.runningSince = this.ctx.now()
    this.status = 'running'
    this.ctx.emit({ kind: 'resumed' })
    this.notify()
  }

  /** Contrarreloj: refresca el reloj y dispara timeout al llegar a 0. */
  tick(): void {
    if (this.status !== 'running') return
    const remaining = this.remainingMs()
    if (remaining != null) {
      this.ctx.emit({ kind: 'tick', elapsedMs: this.elapsedMs(), remainingMs: remaining })
      if (remaining <= 0) {
        this.finish('timeout')
        return
      }
    }
    this.notify() // refresca el elapsed mostrado (también en modo sin reloj)
  }

  // -------------------------------------------------------- scoring
  /** Registra un acierto y devuelve los puntos otorgados. No notifica. */
  registerCorrect(opts?: { skill?: string }): number {
    this.streak += 1
    this.stats.correct += 1
    this.stats.bestStreak = Math.max(this.stats.bestStreak, this.streak)
    const pts = pointsForCorrect(this.opts.score, this.streak)
    this.score += pts
    this.tallySkill(opts?.skill, true)
    this.ctx.emit({ kind: 'move:correct', points: pts, streak: this.streak, skill: opts?.skill })
    return pts
  }

  /** Registra un error y corta la racha. No notifica. */
  registerWrong(opts?: { skill?: string }): void {
    this.streak = 0
    this.stats.wrong += 1
    this.tallySkill(opts?.skill, false)
    this.ctx.emit({ kind: 'move:wrong', skill: opts?.skill })
  }

  /** Registra una pista y aplica la penalización (clamp a 0). No notifica. */
  registerHint(): void {
    this.stats.hintsUsed += 1
    this.score = Math.max(0, this.score - this.opts.score.hintPenalty)
    this.ctx.emit({ kind: 'hint' })
  }

  /**
   * Suma puntos ARBITRARIOS por una jugada — para Tipos cuyo puntaje por jugada NO es el fijo
   * de `registerCorrect` (p.ej. el crédito parcial del multiple choice, donde una pregunta vale
   * una fracción). Cuenta el intento en las stats y ajusta la racha según `correct` (acierto
   * pleno o no). NO emite evento (el Tipo decide qué señal semántica corresponde) y NO notifica.
   */
  addScore(points: number, opts: { correct: boolean; skill?: string }): void {
    if (opts.correct) {
      this.streak += 1
      this.stats.correct += 1
      this.stats.bestStreak = Math.max(this.stats.bestStreak, this.streak)
    } else {
      this.streak = 0
      this.stats.wrong += 1
    }
    this.score += Math.max(0, Math.round(points))
    this.tallySkill(opts.skill, opts.correct)
  }

  private tallySkill(skill: string | undefined, correct: boolean): void {
    if (!skill) return
    const tally = this.skills[skill] ?? { attempts: 0, correct: 0 }
    tally.attempts += 1
    if (correct) tally.correct += 1
    this.skills[skill] = tally
  }

  // ---------------------------------------------------------- finish
  finish(outcome: ActivityOutcome): ActivityResult {
    if (this.status === 'finished' && this.result) return this.result
    if (this.status === 'running') {
      this.accumMs += this.ctx.now() - this.runningSince
    }
    this.status = 'finished'
    if (outcome === 'completed' && this.durationMs != null) {
      const remaining = Math.max(0, this.durationMs - this.accumMs)
      this.score += timeBonus(this.opts.score, remaining, this.durationMs)
    }
    const result: ActivityResult = {
      activityId: this.opts.activityId,
      version: this.opts.version,
      startedAt: this.startedAtStamp,
      finishedAt: this.ctx.now(),
      durationMs: this.accumMs,
      outcome,
      score: this.score,
      maxScore: this.opts.maxScore,
      stats: { ...this.stats },
      config: this.opts.config,
      skills: Object.keys(this.skills).length ? { ...this.skills } : undefined,
      // identidad inyectada por el host (si la hay) → result autosuficiente
      definitionId: this.ctx.identity?.definitionId,
      seed: this.ctx.identity?.seed,
    }
    this.result = result
    this.ctx.emit({ kind: 'finished', result })
    this.notify()
    return result
  }

  abort(): void {
    this.finish('aborted')
  }

  getResult(): ActivityResult | null {
    return this.result
  }

  /** El juego puede fijar el maxScore cuando lo conoce recién en runtime
   *  (p.ej. la multi-actividad, que lo va sumando a medida que arma los hijos). */
  setMaxScore(maxScore: number): void {
    this.opts.maxScore = maxScore
  }

  /** Campos comunes del snapshot que consume el host genérico. */
  commonSnapshot(): CommonSnapshot {
    return {
      status: this.status,
      score: this.score,
      maxScore: this.opts.maxScore,
      stats: { ...this.stats },
      elapsedMs: this.elapsedMs(),
      remainingMs: this.remainingMs(),
    }
  }

  /** Para emitir eventos propios del juego que no cubre el core, si hiciera falta. */
  emit(event: ActivityEvent): void {
    this.ctx.emit(event)
  }

  /**
   * Emite un evento del canal LIBRE. `ns` = namespace de la actividad (evita
   * colisiones); quien entienda `ns`/`type` lo interpreta, el resto lo ignora.
   */
  signal(ns: string, type: string, data?: unknown): void {
    this.ctx.emit({ kind: 'signal', ns, type, data })
  }

  /** Racha de aciertos consecutivos actual (para que la actividad emita signals). */
  get currentStreak(): number {
    return this.streak
  }

  /** Corta la racha sin contar error. Lo usa un compositor (multi-actividad) al
   *  cambiar de hijo: si la racha cruzara hijos, el score de sesión superaría el
   *  denominador acumulado por-hijo (pct > 1). */
  resetStreak(): void {
    this.streak = 0
  }
}
