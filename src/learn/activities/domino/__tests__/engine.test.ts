import { describe, expect, it } from 'vitest'
import { createActivity } from '../../../activity/index'
import {
  dominoModule,
  mathDominoGenerator,
  equivalenceDominoGenerator,
  makeRuntime,
  MATH_PRESETS,
  PAIRS_PRESETS,
  PAIS_CAPITAL,
  type DominoConfig,
  type DominoContent,
  type DominoEngine,
  type DominoMode,
  type Tile,
} from '../index'

// ---- helpers ----

function makeClock(start = 0) {
  let t = start
  return { now: () => t, advance: (ms: number) => (t += ms) }
}

function tilesOf(content: DominoContent): Tile[] {
  return [content.starter, ...content.hand]
}

/** Crea una actividad de dominó con un Ejercicio dado + runtime. */
function activity(content: DominoContent, mode: DominoMode, now: () => number) {
  const config: DominoConfig = { content, runtime: makeRuntime(mode, 60) }
  return createActivity(dominoModule, config, { now })
}

/** Solucionador perfecto: prueba a la vez que el Ejercicio es resoluble (sin
 *  callejones) y que el motor juega bien. */
function solve(engine: DominoEngine): void {
  let guard = 0
  while (engine.getSnapshot().hand.length > 0) {
    if (guard++ > 200) throw new Error('loop runaway')
    const snap = engine.getSnapshot()
    const tileId = snap.playableIds[0]
    if (!tileId) throw new Error('dead end: hand no vacía y sin jugadas')
    const ends = engine.legalEndsFor(tileId)
    engine.play(tileId, ends.left ? 'left' : 'right')
  }
}

// ---- generadores (producen Ejercicios para el MISMO Tipo) ----

describe('mathDominoGenerator', () => {
  it('produce Ejercicios válidos y resolubles para cada preset/semilla', () => {
    for (const preset of MATH_PRESETS) {
      for (let seed = 1; seed <= 20; seed++) {
        const content = mathDominoGenerator(preset.math, seed)
        const tiles = tilesOf(content)
        expect(tiles.length).toBe(preset.math.tileCount)

        for (const tile of tiles) {
          for (const cell of [tile.left, tile.right]) {
            expect(Number(cell.key)).toBeGreaterThanOrEqual(0)
            expect(Number(cell.key)).toBeLessThanOrEqual(preset.math.maxValue)
            if (cell.variant === 'expr') {
              const m = cell.label.match(/(\d+)\s*([+-])\s*(\d+)/)!
              const a = +m[1]
              const b = +m[3]
              const val = m[2] === '+' ? a + b : a - b
              expect(val).toBe(Number(cell.key)) // la expresión da la key
              expect(val).toBeGreaterThanOrEqual(0)
              expect(preset.math.ops).toContain(m[2])
            }
          }
        }

        const { instance } = activity(content, 'untimed', makeClock().now)
        instance.start()
        solve(instance)
        expect(instance.getResult()!.outcome).toBe('completed')
      }
    }
  })
})

describe('equivalenceDominoGenerator', () => {
  it('produce Ejercicios válidos y resolubles (país↔capital) con el MISMO motor', () => {
    const byKey = new Map(PAIS_CAPITAL.map((p) => [p.key, p]))
    for (const preset of PAIRS_PRESETS) {
      for (let seed = 1; seed <= 20; seed++) {
        const content = equivalenceDominoGenerator(PAIS_CAPITAL, { count: preset.count }, seed)
        const tiles = tilesOf(content)
        expect(tiles.length).toBe(preset.count)

        for (const tile of tiles) {
          expect(tile.left.variant).toBe('term')
          expect(tile.left.label).toBe(byKey.get(tile.left.key)!.a) // país
          expect(tile.right.label).toBe(byKey.get(tile.right.key)!.b) // capital
        }

        const { instance } = activity(content, 'untimed', makeClock().now)
        instance.start()
        solve(instance)
        expect(instance.getResult()!.outcome).toBe('completed')
      }
    }
  })
})

// ---- el Tipo (motor) jugando Ejercicios ----

describe('DominoEngine — juega un Ejercicio', () => {
  it('solver perfecto → completed, score = maxScore (sin reloj), para ambos generadores', () => {
    const contents: DominoContent[] = [
      mathDominoGenerator(MATH_PRESETS[1].math, 3),
      equivalenceDominoGenerator(PAIS_CAPITAL, { count: 8 }, 3),
    ]
    for (const content of contents) {
      const handSize = content.hand.length
      const { instance } = activity(content, 'untimed', makeClock().now)
      instance.start()
      solve(instance)
      const r = instance.getResult()!
      expect(r.outcome).toBe('completed')
      expect(r.stats.correct).toBe(handSize)
      expect(r.stats.wrong).toBe(0)
      expect(r.score).toBe(r.maxScore)
    }
  })

  it('jugada inválida: error + shake, sin tocar el tablero', () => {
    const content = mathDominoGenerator(MATH_PRESETS[1].math, 5)
    const { instance } = activity(content, 'untimed', makeClock().now)
    instance.start()
    const before = instance.getSnapshot()
    const Lkey = before.leftEnd.key
    const wrong = before.hand.find((t) => t.left.key !== Lkey && t.right.key !== Lkey)!
    expect(instance.play(wrong.id, 'left')).toBe(false)
    const after = instance.getSnapshot()
    expect(after.stats.wrong).toBe(1)
    expect(after.board.length).toBe(before.board.length)
    expect(after.lastWrongId).toBe(wrong.id)
  })

  it('hint sugiere una jugada legal y la cuenta', () => {
    const content = mathDominoGenerator(MATH_PRESETS[0].math, 5)
    const { instance } = activity(content, 'untimed', makeClock().now)
    instance.start()
    const s = instance.hint()
    expect(s).not.toBeNull()
    expect(instance.legalEndsFor(s!.tileId)[s!.end]).toBe(true)
    expect(instance.getSnapshot().stats.hintsUsed).toBe(1)
  })

  it('contrarreloj: timeout con score parcial', () => {
    const clock = makeClock()
    const content = mathDominoGenerator(MATH_PRESETS[0].math, 7)
    const { instance } = createActivity(
      dominoModule,
      { content, runtime: makeRuntime('timed', 30) },
      { now: clock.now },
    )
    instance.start()
    const s = instance.getSnapshot()
    instance.play(s.playableIds[0], instance.legalEndsFor(s.playableIds[0]).left ? 'left' : 'right')
    clock.advance(31000)
    instance.tick()
    const r = instance.getResult()!
    expect(r.outcome).toBe('timeout')
    expect(r.stats.correct).toBe(1)
  })

  it('result serializable con identidad del Tipo y skills del contenido', () => {
    const content = equivalenceDominoGenerator(PAIS_CAPITAL, { count: 6 }, 9)
    const { instance } = activity(content, 'untimed', makeClock().now)
    instance.start()
    solve(instance)
    const r = instance.getResult()!
    expect(r.activityId).toBe('domino')
    expect(r.version).toBe(1)
    expect(r.skills).toBeDefined()
    expect(r.skills!.capitales).toBeDefined() // el tag vino del generador de equivalencias
  })
})
