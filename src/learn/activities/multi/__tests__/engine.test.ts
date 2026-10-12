import { describe, expect, it, vi } from 'vitest'
import { createActivity, type ActivityEvent } from '../../../activity/index'
import { multiModule, makeMultiRuntime, isChildFinished, type ChildFinishedData, type MultiChild } from '../index'
import { quizModule, mathQuizGenerator, makeQuizRuntime } from '../../quiz/index'

/* Tests del SECUENCIADOR: espejado de eventos del hijo, denominador acumulado,
   identidad del sub-resultado (child-finished) y teardown. Hijos = quizzes reales
   chiquitos (fáciles de resolver por código: answer(current.answer)). */

function quizChild(id: string, seed: number): MultiChild {
  return {
    make: () =>
      createActivity(quizModule, {
        content: mathQuizGenerator({ questionCount: 2, maxValue: 5, ops: ['+'], optionCount: 3 }, seed),
        runtime: makeQuizRuntime('untimed', 60),
      }),
    typeId: 'quiz',
    title: `Quiz ${id}`,
    target: `target-${id}`,
    definitionId: `def-${id}`,
  }
}

function makeMulti(children: MultiChild[]) {
  return createActivity(
    multiModule,
    { total: children.length, runtime: makeMultiRuntime('untimed', 0), next: (i) => children[i] ?? null },
    { now: () => 0 },
  )
}

/** Resuelve el hijo ACTUAL del multi respondiendo siempre la correcta. */
function solveChildren(multi: ReturnType<typeof makeMulti>['instance']): void {
  let guard = 0
  while (multi.getSnapshot().status === 'running') {
    if (guard++ > 100) throw new Error('runaway')
    const child = multi.currentChild()
    if (!child) break
    const q = (child.instance.getSnapshot() as unknown as { current: { answer: string } | null }).current
    if (!q) break
    ;(child.instance as unknown as { answer: (option: string) => boolean }).answer(q.answer)
  }
}

describe('MultiEngine — secuenciador', () => {
  it('encadena hijos, acumula el denominador, espeja skills y emite child-finished con identidad', () => {
    const handle = makeMulti([quizChild('a', 1), quizChild('b', 2)])
    const events: ActivityEvent[] = []
    handle.onEvent((e) => events.push(e))

    handle.instance.start()
    solveChildren(handle.instance)

    const r = handle.instance.getResult()!
    expect(r.outcome).toBe('completed')
    expect(r.stats.correct).toBe(4) // 2 hijos × 2 preguntas, espejadas

    // un child-finished POR hijo, con la identidad REAL (target + definitionId),
    // matcheado por el GUARD tipado (el contrato oficial, sin strings mágicos)
    const datas: ChildFinishedData[] = events.filter(isChildFinished).map((f) => f.data)
    expect(datas.length).toBe(2)
    expect(datas.map((d) => d.target)).toEqual(['target-a', 'target-b'])
    expect(datas.map((d) => d.definitionId)).toEqual(['def-a', 'def-b'])

    // el maxScore del multi = suma de los maxScore de los hijos montados
    const sumaHijos = datas.reduce((acc, d) => acc + d.result.maxScore, 0)
    expect(r.maxScore).toBe(sumaHijos)
    expect(r.score).toBe(r.maxScore) // resolver perfecto, sin reloj

    // la granularidad por-skill del hijo sobrevive al espejado (viaja en el evento)
    expect(r.skills?.suma).toEqual({ attempts: 4, correct: 4 })

    // el config del result es DATO serializable (sin la función `next`)
    expect(() => JSON.stringify(r)).not.toThrow()
    expect(JSON.parse(JSON.stringify(r.config))).toEqual({ total: 2, runtime: makeMultiRuntime('untimed', 0) })
  })

  it('abort a mitad de camino NO dispara un advance extra ni un child-finished', () => {
    const handle = makeMulti([quizChild('a', 1), quizChild('b', 2)])
    const events: ActivityEvent[] = []
    handle.onEvent((e) => events.push(e))

    handle.instance.start()
    handle.instance.abort()

    const r = handle.instance.getResult()!
    expect(r.outcome).toBe('aborted')
    expect(events.filter(isChildFinished).length).toBe(0)
    expect(handle.instance.currentChild()).toBeNull() // teardown hecho
  })

  it('un listener que tira NO corta a los siguientes (bus a prueba de throws)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const handle = makeMulti([quizChild('a', 1)])
      const seen: string[] = []
      handle.onEvent(() => {
        throw new Error('boom')
      })
      handle.onEvent((e) => seen.push(e.kind)) // suscripto DESPUÉS del que tira
      handle.instance.start()
      expect(seen).toContain('started')
      expect(spy).toHaveBeenCalled() // el throw se reportó, no se tragó en silencio
    } finally {
      spy.mockRestore()
    }
  })
})
