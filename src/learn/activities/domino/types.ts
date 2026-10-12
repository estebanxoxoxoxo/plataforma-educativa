import type { CommonSnapshot } from '../../activity/index'

/**
 * Tipos del TIPO Dominó (agnóstico de contenido). El motor juega un Ejercicio
 * (`DominoContent`) y matchea por `key` de equivalencia: dos celdas conectan si
 * comparten key. El generador decide qué key/label/tag tiene cada celda — por
 * eso el mismo motor sirve para dominó matemático, país↔capital, sinónimos, etc.
 */

export interface Cell {
  /** Clave de equivalencia: dos celdas matchean si comparten `key`. */
  key: string
  /** Lo que se muestra. */
  label: string
  /** Pista de estilo para el CSS ('expr' | 'number' | 'term'). */
  variant?: string
  /** Objetivo/skill para los stats del resultado ('suma', 'capitales'…). */
  tag?: string
}

export interface Tile {
  id: string
  left: Cell
  right: Cell
}

/** Ficha ya colocada en el tablero, en orden de izquierda a derecha. */
export interface PlacedTile {
  id: string
  cells: [Cell, Cell]
}

export type EndSide = 'left' | 'right'

/**
 * El EJERCICIO: el dato concreto que el motor juega. Lo produce un generador.
 * `starter` ya va en el tablero; `hand` son las fichas en la mano (orden de
 * presentación, ya barajado por el generador → reproducible).
 */
export interface DominoContent {
  starter: Tile
  hand: Tile[]
}

export interface DominoSnapshot extends CommonSnapshot {
  board: PlacedTile[]
  /** Celdas expuestas en cada extremo (se muestran por label, matchean por key). */
  leftEnd: Cell
  rightEnd: Cell
  hand: Tile[]
  /** Ids de la mano con jugada legal ahora. */
  playableIds: string[]
  /** Última ficha jugada mal (para animar); null si la última fue válida. */
  lastWrongId: string | null
}
