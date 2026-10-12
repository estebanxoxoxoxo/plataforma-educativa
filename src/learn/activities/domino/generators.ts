/**
 * Generadores de contenido para el TIPO Dominó. Cada uno produce un
 * `DominoContent` (un Ejercicio) que el MISMO motor juega. Demuestran la
 * separación Tipo ↔ generador: el motor no genera, los generadores sí.
 *
 * Estructura compartida: una cadena resoluble se arma de keys de empalme TODAS
 * distintas (garantía de no-callejones) + un renderizador de celdas por slot.
 */
import { mulberry32, shuffle } from '../../activity/index'
import type { Cell, DominoContent, Tile } from './types'

export type Operation = '+' | '-'

export interface MathDominoParams {
  maxValue: number
  ops: Operation[]
  tileCount: number
}

/** Par de equivalencia para el generador genérico (p.ej. país↔capital). */
export interface EquivPair {
  key: string
  a: string
  b: string
  tag?: string
}

/**
 * Ensambla la cadena: `keys` son las keys de empalme (distintas, longitud T+1);
 * `renderCell(key, slot)` produce la celda del slot 'a' (izq) o 'b' (der). Cada
 * ficha k = [render(keys[k],'a'), render(keys[k+1],'b')], así en cada empalme se
 * encuentran dos representaciones distintas de la misma key.
 */
function assembleContent(
  keys: string[],
  renderCell: (key: string, slot: 'a' | 'b') => Cell,
  rng: () => number,
): DominoContent {
  const tileCount = keys.length - 1
  const tiles: Tile[] = []
  for (let k = 0; k < tileCount; k++) {
    tiles.push({ id: `t${k}`, left: renderCell(keys[k], 'a'), right: renderCell(keys[k + 1], 'b') })
  }
  const starterIndex = Math.floor(tileCount / 2)
  const starter = tiles[starterIndex]
  const hand = shuffle(
    tiles.filter((_, i) => i !== starterIndex),
    rng,
  )
  return { starter, hand }
}

/** Renderiza un valor como expresión no-degenerada; cae a número si no puede. */
function makeExprCell(value: number, maxValue: number, ops: Operation[], rng: () => number): Cell {
  const cands: { a: number; op: Operation; b: number }[] = []
  if (ops.includes('+')) {
    for (let a = 0; a <= value; a++) {
      const b = value - a
      if (b >= 0 && b <= maxValue && a <= maxValue) cands.push({ a, op: '+', b })
    }
  }
  if (ops.includes('-')) {
    for (let a = value; a <= maxValue; a++) {
      const b = a - value
      if (b >= 0 && b <= maxValue) cands.push({ a, op: '-', b })
    }
  }
  const nice = cands.filter((c) => c.a !== 0 && c.b !== 0)
  const pool = nice.length ? nice : cands
  const key = String(value)
  if (!pool.length) return { key, label: String(value), variant: 'number' }
  const e = pool[Math.floor(rng() * pool.length)]
  return { key, label: `${e.a} ${e.op} ${e.b}`, variant: 'expr', tag: e.op === '+' ? 'suma' : 'resta' }
}

/** Dominó MATEMÁTICO (determinista por seed): expresión ↔ número. */
export function mathDominoGenerator(params: MathDominoParams, seed: number): DominoContent {
  const { maxValue, ops } = params
  const rng = mulberry32(seed)
  // keys distintas ⇒ se necesitan T+1 valores únicos en 0..maxValue
  const tileCount = Math.max(2, Math.min(params.tileCount, maxValue))
  const pool = shuffle(
    Array.from({ length: maxValue + 1 }, (_, i) => i),
    rng,
  )
  const keys = pool.slice(0, tileCount + 1).map(String)
  const renderCell = (key: string, slot: 'a' | 'b'): Cell => {
    const v = Number(key)
    if (slot === 'b') return { key, label: String(v), variant: 'number' }
    return makeExprCell(v, maxValue, ops, rng)
  }
  return assembleContent(keys, renderCell, rng)
}

/**
 * Dominó de EQUIVALENCIAS (mismo motor): empareja los dos miembros de cada par
 * (p.ej. país ↔ capital). `slot 'a'` muestra el miembro `a`, `slot 'b'` el `b`.
 */
export function equivalenceDominoGenerator(
  pairs: EquivPair[],
  opts: { count: number },
  seed: number,
): DominoContent {
  const rng = mulberry32(seed)
  const count = Math.max(2, Math.min(opts.count, pairs.length - 1))
  const chosen = shuffle(pairs, rng).slice(0, count + 1) // pares distintos
  const keys = chosen.map((p) => p.key)
  const byKey = new Map(chosen.map((p) => [p.key, p]))
  const renderCell = (key: string, slot: 'a' | 'b'): Cell => {
    const p = byKey.get(key)!
    return { key, label: slot === 'a' ? p.a : p.b, variant: 'term', tag: p.tag ?? 'equivalencia' }
  }
  return assembleContent(keys, renderCell, rng)
}
