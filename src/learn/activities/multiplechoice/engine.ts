/**
 * Multiple Choice animado — Tipo pensado como la primera actividad "de contenido" jugable de
 * las rutas. Forma: una secuencia de preguntas de opción con SUBMIT DIFERIDO (se elige, y
 * recién al confirmar se corrige y se revela el resultado con el flip de las cards). Soporta
 * selección simple (una correcta) y múltiple (varias, con CRÉDITO PARCIAL estilo Brilliant).
 *
 * Reusa el MISMO contrato que quiz/flashcards: compone `ActivityCore` (reloj/puntaje/result)
 * y emite los MISMOS eventos (move:correct/wrong, finished) → anda con el audioBridge/visual/
 * host y con el motor de recall sin cambios. El crédito parcial se puntúa vía `core.addScore`.
 */
import {
  ActivityCore,
  type ActivityContext,
  type ActivityInstance,
} from '../../activity/index'
import { QUESTION_POINTS, resolveDurationMs, resolveScore, type MultipleChoiceConfig } from './config'
import type { MCQuestion, MultipleChoiceSnapshot } from './types'

export const MC_ID = 'multiplechoice'
export const MC_VERSION = 1

/**
 * Crédito parcial de una pregunta (0..1).
 *  - single: binario (1 si marcó exactamente la correcta; si no, 0).
 *  - multi: estilo Brilliant → (correctas marcadas − incorrectas marcadas) / total correctas,
 *    recortado a [0,1]. Marcar "Todas" o "Ninguna" al voleo NO regala puntos (se cancelan).
 *    Caso "ninguna es correcta": 1 sólo si no marcó nada.
 */
export function scoreQuestion(q: MCQuestion, selected: string[]): number {
  const sel = new Set(selected)
  const correctIds = q.options.filter((o) => o.correct).map((o) => o.id)
  if (q.mode === 'single') {
    return sel.size === 1 && correctIds.length >= 1 && sel.has(correctIds[0]) ? 1 : 0
  }
  const totalCorrect = correctIds.length
  if (totalCorrect === 0) return sel.size === 0 ? 1 : 0
  let hit = 0
  let miss = 0
  for (const id of sel) {
    if (correctIds.includes(id)) hit++
    else miss++
  }
  return Math.max(0, Math.min(1, (hit - miss) / totalCorrect))
}

export class MultipleChoiceEngine implements ActivityInstance<MultipleChoiceSnapshot> {
  private core: ActivityCore
  private questions: MCQuestion[]
  private index = 0
  private selected = new Set<string>()
  private touched = false
  private committed = false
  private fraction: number | null = null
  private snap: MultipleChoiceSnapshot | null = null
  private snapRev = -1

  constructor(config: MultipleChoiceConfig, ctx: ActivityContext) {
    this.questions = config.content.questions
    this.core = new ActivityCore({
      activityId: MC_ID,
      version: MC_VERSION,
      config,
      score: resolveScore(config.runtime),
      durationMs: resolveDurationMs(config.runtime),
      // crédito parcial plano → una corrida perfecta suma nPreguntas × QUESTION_POINTS
      maxScore: this.questions.length * QUESTION_POINTS,
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

  getSnapshot = (): MultipleChoiceSnapshot => {
    if (this.snap && this.snapRev === this.core.rev) return this.snap
    const current = this.questions[this.index] ?? null
    this.snap = {
      ...this.core.commonSnapshot(),
      total: this.questions.length,
      index: this.index,
      current: current ? { ...current, options: current.options.map((o) => ({ ...o })) } : null,
      mode: current?.mode ?? 'single',
      selected: [...this.selected],
      touched: this.touched,
      committed: this.committed,
      fraction: this.fraction,
    }
    this.snapRev = this.core.rev
    return this.snap
  }

  // ---- acciones ----
  /** Marca/desmarca una opción (antes de confirmar). En 'single' actúa como radio (sólo una). */
  toggle(optionId: string): void {
    if (this.core.status !== 'running' || this.committed) return
    const q = this.questions[this.index]
    if (!q || !q.options.some((o) => o.id === optionId)) return
    if (q.mode === 'single') {
      this.selected = this.selected.has(optionId) ? new Set() : new Set([optionId])
    } else if (this.selected.has(optionId)) {
      this.selected.delete(optionId)
    } else {
      this.selected.add(optionId)
    }
    this.touched = true
    this.core.notify()
  }

  /** Atajo (sólo múltiple): marca TODAS las opciones. */
  selectAll(): void {
    if (this.core.status !== 'running' || this.committed) return
    const q = this.questions[this.index]
    if (!q || q.mode !== 'multi') return
    this.selected = new Set(q.options.map((o) => o.id))
    this.touched = true
    this.core.notify()
  }

  /** Atajo (sólo múltiple): limpia la selección → responde "ninguna". */
  clear(): void {
    if (this.core.status !== 'running' || this.committed) return
    const q = this.questions[this.index]
    if (!q || q.mode !== 'multi') return
    this.selected = new Set()
    this.touched = true
    this.core.notify()
  }

  /** ¿Se puede confirmar? single: exactamente 1 marcada; multi: con haber interactuado. */
  canCommit(): boolean {
    const q = this.questions[this.index]
    if (!q || this.committed) return false
    return q.mode === 'single' ? this.selected.size === 1 : this.touched
  }

  /** Confirma la respuesta (OK): calcula el crédito parcial, puntúa y revela el flip. */
  commit(): void {
    if (this.core.status !== 'running' || !this.canCommit()) return
    const q = this.questions[this.index]
    if (!q) return
    const frac = scoreQuestion(q, [...this.selected])
    const awarded = Math.round(frac * QUESTION_POINTS)
    const full = frac >= 1
    // suma el crédito parcial y cuenta el intento (acierto pleno o no) en las stats
    this.core.addScore(awarded, { correct: full, skill: q.skill })
    // evento semántico: cualquier crédito = alentador (no punitivo, estilo Duolingo); 0 = error
    if (frac > 0) {
      this.core.emit({ kind: 'move:correct', points: awarded, streak: this.core.currentStreak, skill: q.skill })
    } else {
      this.core.emit({ kind: 'move:wrong', skill: q.skill })
    }
    // canal libre: detalle para la vista/companion/audio (fracción exacta de la pregunta)
    this.core.signal(MC_ID, 'answered', { questionId: q.id, fraction: frac, mode: q.mode })
    this.committed = true
    this.fraction = frac
    this.core.notify()
  }

  /** Avanza a la siguiente pregunta (tras ver el reveal). Termina al pasar la última. */
  next(): void {
    if (this.core.status !== 'running' || !this.committed) return
    this.index += 1
    this.selected = new Set()
    this.touched = false
    this.committed = false
    this.fraction = null
    if (this.index >= this.questions.length) this.core.finish('completed')
    else this.core.notify()
  }
}
