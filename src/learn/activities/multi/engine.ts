/**
 * Tipo MULTI-ACTIVIDAD (ACTIVIDADES.md §4): un secuenciador que juega una serie de
 * sub-actividades como UNA sola actividad. Compone su propio `ActivityCore`
 * (status/reloj/puntaje de sesión/result) y va montando un hijo por vez:
 *
 *   - **espeja** los eventos del hijo (move:correct/wrong/hint/signal) a su core →
 *     el mismo onEvent del multi alimenta chrome/audio/efectos sin tocar nada;
 *   - al `finished` del hijo, emite un signal `child-finished` (con el result + su
 *     target, para que el recall lo grabe a su objetivo) y **avanza** al siguiente;
 *   - cuando `next()` devuelve null, termina (acotado). Endless = `next()` nunca da
 *     null → flujo continuo (scroll infinito) hasta que el usuario sale.
 *
 * No genera contenido: recibe los hijos ya resueltos (los arma el catálogo, §2).
 */
import {
  ActivityCore,
  type ActivityContext,
  type ActivityEvent,
  type ActivityHandle,
  type ActivityInstance,
  type ActivityResult,
  type CommonSnapshot,
} from '../../activity/index'
import { resolveDurationMs, resolveScore, type MultiConfig } from './config'
import type { MultiChild, MultiSnapshot } from './types'

export const MULTI_ID = 'multi-actividad'
export const MULTI_VERSION = 1
export const CHILD_FINISHED = 'child-finished'

/** Payload del signal `child-finished` — el contrato del que cuelga la persistencia. */
export interface ChildFinishedData {
  result: ActivityResult
  target?: string
  definitionId?: string
  title?: string
}

/**
 * Type-guard del contrato: el consumidor (overlay/recall/telemetría) matchea el
 * signal por acá, sin strings mágicos ni `data: unknown` repartidos.
 */
export function isChildFinished(e: ActivityEvent): e is Extract<ActivityEvent, { kind: 'signal' }> & { data: ChildFinishedData } {
  return e.kind === 'signal' && e.ns === MULTI_ID && e.type === CHILD_FINISHED && typeof e.data === 'object' && e.data != null && 'result' in e.data
}

interface ActiveChild {
  spec: MultiChild
  handle: ActivityHandle<ActivityInstance<CommonSnapshot>>
}

export class MultiEngine implements ActivityInstance<MultiSnapshot> {
  private core: ActivityCore
  private cfg: MultiConfig
  private index = -1
  private active: ActiveChild | null = null
  private unsubUi: (() => void) | null = null
  private unsubEvents: (() => void) | null = null
  private accumMax = 0
  private snap: MultiSnapshot | null = null
  private snapRev = -1

  constructor(config: MultiConfig, ctx: ActivityContext) {
    this.cfg = config
    this.core = new ActivityCore({
      activityId: MULTI_ID,
      version: MULTI_VERSION,
      // al result va solo el DATO (config.next es una FUNCIÓN: rompería la
      // premisa de ActivityResult serializable)
      config: { total: config.total ?? null, runtime: config.runtime },
      score: resolveScore(config.runtime),
      durationMs: resolveDurationMs(config.runtime),
      maxScore: 0, // se va sumando con cada hijo (setMaxScore)
      ctx,
    })
  }

  // ---- ActivityInstance ----
  start = (): void => {
    if (this.core.status !== 'idle') return
    this.core.start() // emite 'started' (el multi maneja su propio inicio)
    this.advance()
  }
  pause = (): void => {
    this.core.pause()
    this.active?.handle.instance.pause()
  }
  resume = (): void => {
    this.core.resume()
    this.active?.handle.instance.resume()
  }
  abort = (): void => {
    this.teardown() // desuscribe ANTES → el abort del hijo no dispara advance
    this.core.abort()
  }
  tick = (): void => {
    this.core.tick()
    this.active?.handle.instance.tick()
  }
  dispose = (): void => {
    this.teardown()
  }
  subscribe = (listener: () => void): (() => void) => this.core.subscribe(listener)
  getResult = (): ActivityResult | null => this.core.getResult()

  /** El hijo en juego, para que la vista del multi renderice su tablero. */
  currentChild(): { instance: ActivityInstance<CommonSnapshot>; typeId: string } | null {
    return this.active ? { instance: this.active.handle.instance, typeId: this.active.spec.typeId } : null
  }

  getSnapshot = (): MultiSnapshot => {
    if (this.snap && this.snapRev === this.core.rev) return this.snap
    this.snap = {
      ...this.core.commonSnapshot(),
      childIndex: Math.max(0, this.index),
      total: this.cfg.total ?? null,
      childTitle: this.active?.spec.title ?? null,
      childTypeId: this.active?.spec.typeId ?? null,
    }
    this.snapRev = this.core.rev
    return this.snap
  }

  // ---- secuencia ----
  private teardown(): void {
    this.unsubUi?.()
    this.unsubUi = null
    this.unsubEvents?.()
    this.unsubEvents = null
    this.active?.handle.instance.dispose()
    this.active = null
  }

  private advance(): void {
    this.teardown()
    const i = this.index + 1
    const spec = this.cfg.next(i)
    if (!spec) {
      this.core.finish('completed')
      return
    }
    this.index = i
    this.core.resetStreak() // la racha no cruza hijos (el denominador es por-hijo)
    const handle = spec.make()
    this.active = { spec, handle }
    // el max del hijo entra al denominador del multi (no se conoce antes)
    this.accumMax += handle.instance.getSnapshot().maxScore
    this.core.setMaxScore(this.accumMax)
    // propagar UI del hijo + reflejar sus eventos en el core del multi
    this.unsubUi = handle.instance.subscribe(() => this.core.notify())
    this.unsubEvents = handle.onEvent((e) => this.onChildEvent(e))
    handle.instance.start()
    this.core.notify()
  }

  private onChildEvent(e: ActivityEvent): void {
    switch (e.kind) {
      case 'move:correct':
        this.core.registerCorrect({ skill: e.skill }) // conserva la granularidad del hijo
        break
      case 'move:wrong':
        this.core.registerWrong({ skill: e.skill })
        break
      case 'hint':
        this.core.registerHint()
        break
      case 'finished':
        this.onChildFinished(e.result)
        break
      case 'signal':
        this.core.signal(e.ns, e.type, e.data)
        break
      default:
        break // started/paused/resumed/tick del hijo: el multi maneja los suyos
    }
  }

  private onChildFinished(result: ActivityResult): void {
    // canal libre: el overlay/recall puede grabar el sub-resultado a SU objetivo
    const data: ChildFinishedData = {
      result,
      target: this.active?.spec.target,
      definitionId: this.active?.spec.definitionId,
      title: this.active?.spec.title,
    }
    this.core.signal(MULTI_ID, CHILD_FINISHED, data)
    this.advance()
  }
}
