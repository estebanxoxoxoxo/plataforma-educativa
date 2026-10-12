/**
 * Flashcards — Tipo benévolo pensado para el active recall. Mecánica distinta a todos
 * los demás: no se elige entre opciones; se REVELA el reverso y el niño se AUTOCALIFICA
 * (¿la sabías?). Pero reusa el MISMO contrato: compone `ActivityCore` (reloj/puntaje/
 * result) y emite los MISMOS eventos (move:correct/wrong, finished) → anda con el mismo
 * audioBridge/visual/host y con el motor de recall sin cambios.
 *
 * El mazo llega YA ARMADO en `content.cards` (lo baraja el generador `static` por seed);
 * el motor sólo lo reproduce en orden.
 */
import {
  ActivityCore,
  perfectScore,
  type ActivityContext,
  type ActivityInstance,
} from '../../activity/index'
import { resolveDurationMs, resolveScore, type FlashcardsConfig } from './config'
import type { Card, FlashcardsSnapshot } from './types'

export const FLASHCARDS_ID = 'flashcards'
export const FLASHCARDS_VERSION = 1

export class FlashcardsEngine implements ActivityInstance<FlashcardsSnapshot> {
  private core: ActivityCore
  private cards: Card[]
  private index = 0
  private revealed = false
  private snap: FlashcardsSnapshot | null = null
  private snapRev = -1

  constructor(config: FlashcardsConfig, ctx: ActivityContext) {
    this.cards = config.content.cards
    const score = resolveScore(config.runtime)
    this.core = new ActivityCore({
      activityId: FLASHCARDS_ID,
      version: FLASHCARDS_VERSION,
      config,
      score,
      durationMs: resolveDurationMs(config.runtime),
      maxScore: perfectScore(score, this.cards.length),
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

  getSnapshot = (): FlashcardsSnapshot => {
    if (this.snap && this.snapRev === this.core.rev) return this.snap
    const current = this.cards[this.index] ?? null
    this.snap = {
      ...this.core.commonSnapshot(),
      total: this.cards.length,
      index: this.index,
      current: current ? { ...current } : null,
      revealed: this.revealed,
    }
    this.snapRev = this.core.rev
    return this.snap
  }

  // ---- acciones de flashcards ----
  /** Da vuelta la tarjeta para ver el reverso. NO es una jugada puntuable. */
  reveal(): void {
    if (this.core.status !== 'running' || this.revealed) return
    this.revealed = true
    this.core.notify()
  }

  /**
   * Autocalificación tras revelar: ¿la sabías? Alimenta la maestría por skill
   * (move:correct/wrong) y avanza a la siguiente. Sólo vale con la tarjeta revelada.
   */
  grade(knew: boolean): void {
    if (this.core.status !== 'running' || !this.revealed) return
    const c = this.cards[this.index]
    if (!c) return
    if (knew) {
      this.core.registerCorrect({ skill: c.skill })
      // canal libre: hito de racha (mismo patrón que dominó/quiz, distinto namespace)
      const streak = this.core.currentStreak
      if (streak === 3 || (streak >= 5 && streak % 5 === 0)) {
        this.core.signal(FLASHCARDS_ID, 'streak-milestone', { streak })
      }
    } else {
      this.core.registerWrong({ skill: c.skill })
    }
    this.index += 1
    this.revealed = false
    if (this.index >= this.cards.length) this.core.finish('completed')
    else this.core.notify()
  }
}
