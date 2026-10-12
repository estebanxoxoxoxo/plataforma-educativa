/**
 * Dominó — motor headless del TIPO (sin React, agnóstico de contenido). Mecánica:
 * cadena lineal ("el tren") de dos extremos abiertos; se conecta una mitad cuya
 * `key` de equivalencia iguala la del extremo. El motor NO genera nada: juega un
 * `DominoContent` (un Ejercicio) que produce un generador. Así el mismo motor
 * sirve para dominó matemático, país↔capital, sinónimos, etc.
 *
 * La garantía de resolubilidad (keys de empalme TODAS distintas → en cada extremo
 * a lo sumo una ficha jugable = el vecino correcto → sin callejones) es
 * responsabilidad del generador; el motor solo juega.
 */

import {
  ActivityCore,
  perfectScore,
  type ActivityContext,
  type ActivityInstance,
} from '../../activity/index'
import { resolveDurationMs, resolveScore, type DominoConfig } from './config'
import type { Cell, DominoContent, DominoSnapshot, EndSide, PlacedTile, Tile } from './types'

export const DOMINO_ID = 'domino'
export const DOMINO_VERSION = 1

export class DominoEngine implements ActivityInstance<DominoSnapshot> {
  private core: ActivityCore
  private board: PlacedTile[]
  private hand: Tile[]
  private leftEnd: Cell
  private rightEnd: Cell
  private lastWrongId: string | null = null
  private snap: DominoSnapshot | null = null
  private snapRev = -1

  constructor(config: DominoConfig, ctx: ActivityContext) {
    const { content, runtime } = config
    const starter = content.starter
    this.board = [{ id: starter.id, cells: [starter.left, starter.right] }]
    this.leftEnd = starter.left
    this.rightEnd = starter.right
    this.hand = content.hand.map((t) => ({ ...t }))
    const score = resolveScore(runtime)
    this.core = new ActivityCore({
      activityId: DOMINO_ID,
      version: DOMINO_VERSION,
      config: runtime, // el runtime va al result; el Ejercicio (content) se referencia aparte
      score,
      durationMs: resolveDurationMs(runtime),
      maxScore: perfectScore(score, content.hand.length),
      ctx,
    })
  }

  // --------------------------------------------- ActivityInstance (delegación)
  start = (): void => this.core.start()
  pause = (): void => this.core.pause()
  resume = (): void => this.core.resume()
  abort = (): void => this.core.abort()
  tick = (): void => this.core.tick()
  dispose = (): void => {}
  subscribe = (listener: () => void): (() => void) => this.core.subscribe(listener)
  getResult = () => this.core.getResult()

  getSnapshot = (): DominoSnapshot => {
    if (this.snap && this.snapRev === this.core.rev) return this.snap
    this.snap = {
      ...this.core.commonSnapshot(),
      board: this.board.map((p) => ({ id: p.id, cells: [p.cells[0], p.cells[1]] })),
      leftEnd: this.leftEnd,
      rightEnd: this.rightEnd,
      hand: this.hand.map((t) => ({ ...t })),
      playableIds: this.playableIds(),
      lastWrongId: this.lastWrongId,
    }
    this.snapRev = this.core.rev
    return this.snap
  }

  // ------------------------------------------------ acciones del dominó
  private matchingSide(tile: Tile, key: string): EndSide | null {
    if (tile.left.key === key) return 'left'
    if (tile.right.key === key) return 'right'
    return null
  }

  private endCell(end: EndSide): Cell {
    return end === 'left' ? this.leftEnd : this.rightEnd
  }

  private playableIds(): string[] {
    return this.hand
      .filter((t) => this.matchingSide(t, this.leftEnd.key) != null || this.matchingSide(t, this.rightEnd.key) != null)
      .map((t) => t.id)
  }

  private skillOf(tile: Tile): string {
    return tile.left.tag ?? tile.right.tag ?? 'general'
  }

  /** Qué extremos admiten esta ficha (para resaltar en la UI). */
  legalEndsFor(tileId: string): { left: boolean; right: boolean } {
    const tile = this.hand.find((t) => t.id === tileId)
    if (!tile) return { left: false, right: false }
    return {
      left: this.matchingSide(tile, this.leftEnd.key) != null,
      right: this.matchingSide(tile, this.rightEnd.key) != null,
    }
  }

  /** Intenta colocar una ficha en un extremo. Devuelve true si fue válida. */
  play(tileId: string, end: EndSide): boolean {
    if (this.core.status !== 'running') return false
    const idx = this.hand.findIndex((t) => t.id === tileId)
    if (idx < 0) return false
    const tile = this.hand[idx]
    const side = this.matchingSide(tile, this.endCell(end).key)
    if (side == null) {
      this.lastWrongId = tileId
      this.core.registerWrong({ skill: this.skillOf(tile) })
      this.core.notify()
      return false
    }
    const inner = side === 'left' ? tile.left : tile.right
    const outer = side === 'left' ? tile.right : tile.left
    if (end === 'right') {
      this.board.push({ id: tile.id, cells: [inner, outer] })
      this.rightEnd = outer
    } else {
      this.board.unshift({ id: tile.id, cells: [outer, inner] })
      this.leftEnd = outer
    }
    this.hand.splice(idx, 1)
    this.lastWrongId = null
    this.core.registerCorrect({ skill: this.skillOf(tile) })
    const streak = this.core.currentStreak
    if (streak === 3 || (streak >= 5 && streak % 5 === 0)) {
      this.core.signal(DOMINO_ID, 'streak-milestone', { streak })
    }
    if (this.hand.length === 0) this.core.finish('completed')
    else this.core.notify()
    return true
  }

  /** Sugiere (y cuenta) una jugada legal; null si no hay status running. */
  hint(): { tileId: string; end: EndSide } | null {
    if (this.core.status !== 'running') return null
    for (const t of this.hand) {
      if (this.matchingSide(t, this.leftEnd.key) != null) {
        this.core.registerHint()
        this.core.notify()
        return { tileId: t.id, end: 'left' }
      }
      if (this.matchingSide(t, this.rightEnd.key) != null) {
        this.core.registerHint()
        this.core.notify()
        return { tileId: t.id, end: 'right' }
      }
    }
    return null
  }
}

export type { Cell, DominoContent, DominoSnapshot, EndSide, PlacedTile, Tile }
