/**
 * Quiz relámpago — segundo Tipo, prueba de que el framework escala. Forma muy
 * distinta al dominó (sin tablero: una secuencia de preguntas de opción múltiple)
 * pero MISMO contrato: compone `ActivityCore` (reloj/puntaje/result), emite los
 * MISMOS eventos (move:correct/wrong, finished) y por eso anda con el mismo
 * audioBridge/visual/header/host. El motor JUEGA un Ejercicio ya generado
 * (`content`) — la generación vive en generators.ts (separación Tipo ↔ generador).
 */
import {
  ActivityCore,
  perfectScore,
  type ActivityContext,
  type ActivityInstance,
} from '../../activity/index'
import { resolveDurationMs, resolveScore, type QuizConfig } from './config'
import type { Question, QuizSnapshot } from './types'

export const QUIZ_ID = 'quiz-relampago'
export const QUIZ_VERSION = 1

export class QuizEngine implements ActivityInstance<QuizSnapshot> {
  private core: ActivityCore
  private questions: Question[]
  private index = 0
  private ruledOut: string[] = []
  private snap: QuizSnapshot | null = null
  private snapRev = -1

  constructor(config: QuizConfig, ctx: ActivityContext) {
    this.questions = config.content.questions
    const score = resolveScore(config.runtime)
    this.core = new ActivityCore({
      activityId: QUIZ_ID,
      version: QUIZ_VERSION,
      config,
      score,
      durationMs: resolveDurationMs(config.runtime),
      maxScore: perfectScore(score, this.questions.length),
      ctx,
    })
  }

  // ---- ActivityInstance (delegación) ----
  start = (): void => this.core.start()
  pause = (): void => this.core.pause()
  resume = (): void => this.core.resume()
  abort = (): void => this.core.abort()
  tick = (): void => this.core.tick()
  dispose = (): void => {}
  subscribe = (listener: () => void): (() => void) => this.core.subscribe(listener)
  getResult = () => this.core.getResult()

  getSnapshot = (): QuizSnapshot => {
    if (this.snap && this.snapRev === this.core.rev) return this.snap
    const current = this.questions[this.index] ?? null
    this.snap = {
      ...this.core.commonSnapshot(),
      total: this.questions.length,
      index: this.index,
      current: current ? { ...current, options: [...current.options] } : null,
      ruledOut: [...this.ruledOut],
    }
    this.snapRev = this.core.rev
    return this.snap
  }

  // ---- acciones del quiz ----
  /** Responde la pregunta actual con una opción. Devuelve true si fue correcta. */
  answer(option: string): boolean {
    if (this.core.status !== 'running') return false
    const q = this.questions[this.index]
    if (!q) return false
    if (this.ruledOut.includes(option)) return false
    if (option !== q.answer) {
      this.ruledOut.push(option)
      this.core.registerWrong({ skill: q.skill })
      this.core.notify()
      return false
    }
    this.core.registerCorrect({ skill: q.skill })
    // canal libre: hito de racha (mismo patrón que el dominó, distinto namespace)
    const streak = this.core.currentStreak
    if (streak === 3 || (streak >= 5 && streak % 5 === 0)) {
      this.core.signal(QUIZ_ID, 'streak-milestone', { streak })
    }
    this.index += 1
    this.ruledOut = []
    if (this.index >= this.questions.length) this.core.finish('completed')
    else this.core.notify()
    return true
  }
}
