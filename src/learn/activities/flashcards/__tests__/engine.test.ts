import { describe, expect, it } from 'vitest'
import { createActivity } from '../../../activity/index'
import { flashcardsModule, makeFlashcardsRuntime, staticFlashcardsGenerator, SISTEMA_SOLAR, type FlashcardsConfig } from '../index'

const clock = () => 0

/** Config de la app (content generado por el `static` + runtime), con seed variable. */
function cfg(seed: number): FlashcardsConfig {
  return {
    content: staticFlashcardsGenerator({ cards: SISTEMA_SOLAR }, seed),
    runtime: makeFlashcardsRuntime('untimed', 120),
  }
}

describe('Flashcards — mecánica', () => {
  it('revelar NO puntúa ni avanza; sólo muestra el reverso', () => {
    const { instance } = createActivity(flashcardsModule, cfg(3), { now: clock })
    instance.start()
    expect(instance.getSnapshot().revealed).toBe(false)
    instance.reveal()
    const s = instance.getSnapshot()
    expect(s.revealed).toBe(true)
    expect(s.index).toBe(0) // no avanzó
    expect(s.stats.correct).toBe(0)
    expect(s.stats.wrong).toBe(0)
    expect(s.score).toBe(0)
  })

  it('calificar sin revelar no hace nada (hay que dar vuelta primero)', () => {
    const { instance } = createActivity(flashcardsModule, cfg(4), { now: clock })
    instance.start()
    instance.grade(true)
    const s = instance.getSnapshot()
    expect(s.index).toBe(0)
    expect(s.stats.correct).toBe(0)
  })

  it('"La sabía" cuenta acierto; "No la sabía" cuenta error y avanza', () => {
    const { instance } = createActivity(flashcardsModule, cfg(5), { now: clock })
    instance.start()
    instance.reveal()
    instance.grade(true)
    let s = instance.getSnapshot()
    expect(s.stats.correct).toBe(1)
    expect(s.index).toBe(1)
    expect(s.revealed).toBe(false)
    instance.reveal()
    instance.grade(false)
    s = instance.getSnapshot()
    expect(s.stats.wrong).toBe(1)
    expect(s.index).toBe(2)
  })

  it('recorrer todo el mazo → completed con skills por objetivo', () => {
    const { instance } = createActivity(flashcardsModule, cfg(7), { now: clock })
    instance.start()
    let guard = 0
    while (instance.getSnapshot().status === 'running') {
      if (guard++ > 500) throw new Error('runaway')
      instance.reveal()
      instance.grade(true)
    }
    const r = instance.getResult()!
    expect(r.outcome).toBe('completed')
    expect(r.activityId).toBe('flashcards')
    expect(r.stats.correct).toBe(SISTEMA_SOLAR.length)
    expect(r.stats.wrong).toBe(0)
    expect(r.score).toBe(r.maxScore)
    expect(r.skills).toBeDefined() // maestría fina por skill (insumo del active recall)
  })

  it('el generador `static` sólo baraja el orden (mismo set de fronts, determinista)', () => {
    const frontsOf = (seed: number) => staticFlashcardsGenerator({ cards: SISTEMA_SOLAR }, seed).cards.map((c) => c.front)
    const a = frontsOf(1)
    const b = frontsOf(2)
    expect(a.length).toBe(SISTEMA_SOLAR.length)
    expect([...a].sort()).toEqual([...b].sort()) // mismo conjunto
    expect(frontsOf(1)).toEqual(a) // determinista por seed
  })

  it('el portero rechaza un mazo con una tarjeta vacía', () => {
    const bad = { cards: [{ id: 'x', front: '', back: 'y', skill: 's' }] }
    const v = flashcardsModule.validateContent!(bad)
    expect(v.ok).toBe(false)
  })
})
