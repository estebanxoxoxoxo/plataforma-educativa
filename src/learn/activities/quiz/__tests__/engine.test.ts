import { describe, expect, it } from 'vitest'
import { createActivity } from '../../../activity/index'
import {
  quizModule,
  mathQuizGenerator,
  factQuizGenerator,
  makeQuizRuntime,
  MATH_PRESETS,
  FACT_PRESETS,
  evalOp,
  type Operation,
  type QuizConfig,
  type QuizContent,
  type QuizEngine,
  type QuizMode,
} from '../index'
import { PAIS_CAPITAL } from '../../domino/index'

// ---- helpers ----

function makeClock(start = 0) {
  let t = start
  return { now: () => t, advance: (ms: number) => (t += ms) }
}

/** Crea una actividad de quiz con un Ejercicio dado + runtime (espejo del test del dominó). */
function activity(content: QuizContent, mode: QuizMode, durationSec: number, now: () => number) {
  const config: QuizConfig = { content, runtime: makeQuizRuntime(mode, durationSec) }
  return createActivity(quizModule, config, { now })
}

/** Responde siempre la correcta hasta terminar. */
function solve(engine: QuizEngine): void {
  let guard = 0
  while (engine.getSnapshot().status === 'running') {
    if (guard++ > 500) throw new Error('runaway')
    const q = engine.getSnapshot().current
    if (!q) break
    engine.answer(q.answer)
  }
}

// ---- generadores (producen Ejercicios para el MISMO Tipo) ----

describe('mathQuizGenerator', () => {
  it('preguntas válidas para cada preset y semilla', () => {
    for (const preset of MATH_PRESETS) {
      for (let seed = 1; seed <= 30; seed++) {
        const { questions } = mathQuizGenerator(preset.math, seed)
        expect(questions.length).toBe(preset.math.questionCount)
        for (const q of questions) {
          const m = q.prompt.match(/^(\d+) ([+\-×]) (\d+) = \?$/)
          expect(m, q.prompt).not.toBeNull()
          const val = evalOp(+m![1], m![2] as Operation, +m![3])
          expect(String(val)).toBe(q.answer) // el prompt evalúa a la respuesta
          expect(val).toBeGreaterThanOrEqual(0) // sin resultados negativos
          expect(+m![1]).toBeLessThanOrEqual(preset.math.maxValue)
          expect(+m![3]).toBeLessThanOrEqual(preset.math.maxValue)
          expect(preset.math.ops).toContain(m![2])
          expect(q.options).toContain(q.answer) // la correcta está entre las opciones
          expect(q.options.length).toBe(preset.math.optionCount)
          expect(new Set(q.options).size).toBe(q.options.length) // únicas ⇒ una sola correcta
          expect(['suma', 'resta', 'multiplicacion']).toContain(q.skill)
        }
      }
    }
  })
})

describe('factQuizGenerator', () => {
  it('"¿Capital de X?" con distractores del propio set, para el MISMO motor', () => {
    const porPais = new Map(PAIS_CAPITAL.map((p) => [p.a, p]))
    const capitales = new Set(PAIS_CAPITAL.map((p) => p.b))
    for (const preset of FACT_PRESETS) {
      for (let seed = 1; seed <= 30; seed++) {
        const { questions } = factQuizGenerator(PAIS_CAPITAL, preset.fact, seed)
        expect(questions.length).toBe(preset.fact.count)
        expect(new Set(questions.map((q) => q.prompt)).size).toBe(questions.length) // sin repetidas
        for (const q of questions) {
          const pais = q.prompt.match(/^¿Capital de (.+)\?$/)![1]
          expect(q.answer).toBe(porPais.get(pais)!.b) // la respuesta es SU capital
          expect(q.options).toContain(q.answer)
          expect(q.options.length).toBe(preset.fact.optionCount)
          expect(new Set(q.options).size).toBe(q.options.length)
          expect(q.options.every((o) => capitales.has(o))).toBe(true) // distractores del set
          expect(q.skill).toBe('capitales')
        }
      }
    }
  })
})

// ---- el Tipo (motor) jugando Ejercicios ----

describe('QuizEngine — juega un Ejercicio', () => {
  it('resolver perfecto → completed, score = maxScore (sin reloj), para ambos generadores', () => {
    const contents: QuizContent[] = [
      mathQuizGenerator(MATH_PRESETS[1].math, 3),
      factQuizGenerator(PAIS_CAPITAL, FACT_PRESETS[0].fact, 3),
    ]
    for (const content of contents) {
      const total = content.questions.length
      const { instance } = activity(content, 'untimed', 60, makeClock().now)
      instance.start()
      solve(instance)
      const r = instance.getResult()!
      expect(r.outcome).toBe('completed')
      expect(r.stats.correct).toBe(total)
      expect(r.stats.wrong).toBe(0)
      expect(r.score).toBe(r.maxScore)
    }
  })

  it('respuesta incorrecta: cuenta error, descarta la opción y no avanza', () => {
    const content = mathQuizGenerator(MATH_PRESETS[1].math, 4)
    const { instance } = activity(content, 'untimed', 60, makeClock().now)
    instance.start()
    const q = instance.getSnapshot().current!
    const wrong = q.options.find((o) => o !== q.answer)!
    expect(instance.answer(wrong)).toBe(false)
    const s = instance.getSnapshot()
    expect(s.stats.wrong).toBe(1)
    expect(s.index).toBe(0) // sigue en la misma pregunta
    expect(s.ruledOut).toContain(wrong)
    expect(instance.answer(wrong)).toBe(false) // una opción descartada no se re-juega
    expect(instance.getSnapshot().stats.wrong).toBe(1)
  })

  it('contrarreloj: timeout con score parcial', () => {
    const clock = makeClock()
    const content = mathQuizGenerator(MATH_PRESETS[0].math, 7)
    const { instance } = activity(content, 'timed', 20, clock.now)
    instance.start()
    const q = instance.getSnapshot().current!
    instance.answer(q.answer)
    clock.advance(21000)
    instance.tick()
    const r = instance.getResult()!
    expect(r.outcome).toBe('timeout')
    expect(r.stats.correct).toBe(1)
  })

  it('result serializable con identidad del Tipo y skills del contenido', () => {
    const content = factQuizGenerator(PAIS_CAPITAL, FACT_PRESETS[0].fact, 9)
    const { instance } = activity(content, 'untimed', 60, makeClock().now)
    instance.start()
    solve(instance)
    const r = instance.getResult()!
    expect(r.activityId).toBe('quiz-relampago')
    expect(r.version).toBe(1)
    expect(r.skills).toBeDefined()
    expect(r.skills!.capitales).toBeDefined() // el skill vino del generador de hechos
  })
})
