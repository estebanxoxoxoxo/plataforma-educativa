import { afterEach, describe, expect, it } from 'vitest'
import { buildRecallActivity } from '../recallActivity'
import { registerImportedDefinitions, clearImportedDefinition } from '../definitions'
import { isChildFinished, type MultiEngine } from '../activities/multi/index'
import type { ActivityEvent } from '../activity/index'

/* PORTE INNERITH (W2) — suite NUEVA del ARMADOR del multi de recall (el POC no la tiene). Fija:
   hoja = primera Definición no-multi del target (seed primero) · hijo i = order[i % n] con seed
   base+i+1 · acotado a K con `count` (total = K) · endless sin `count` (total null, cicla) ·
   targets sin hoja se filtran · sin targets termina al arrancar. No cambia runtime. */

/** Recorre N hijos abortando cada uno (el multi graba child-finished y avanza). */
function walk(h: ReturnType<typeof buildRecallActivity>, n: number) {
  const events: ActivityEvent[] = []
  h.onEvent((e) => events.push(e))
  const multi = h.instance as MultiEngine
  multi.start()
  for (let i = 0; i < n && multi.currentChild(); i++) multi.currentChild()!.instance.abort()
  return { multi, done: events.filter(isChildFinished).map((e) => e.data) }
}

describe('buildRecallActivity — armador del multi de active recall', () => {
  afterEach(() => clearImportedDefinition('w2.recall-multi'))

  it('ACOTADO (posta en ruta): K hijos, cicla el orden, seed base+i+1, identidad del hijo', () => {
    const h = buildRecallActivity(['suma-0-10', 'geo-repaso'], 500, { count: 3 })
    const { multi, done } = walk(h, 10)
    expect(done.map((d) => [d.target, d.definitionId, d.result.seed])).toEqual([
      ['suma-0-10', 'suma-0-10', 501],
      ['geo-repaso', 'geo-repaso', 502],
      ['suma-0-10', 'suma-0-10', 503], // i % n
    ])
    expect(multi.getResult()).toMatchObject({ outcome: 'completed', activityId: 'multi-actividad' })
    expect(multi.getResult()!.config).toEqual({ total: 3, runtime: { mode: 'untimed', durationSec: 0, score: { base: 10, streakBonus: 2, hintPenalty: 5 } } })
    // el outer del recall no lleva identidad de Definición (el overlay no lo graba)
    expect(multi.getResult()!.definitionId).toBeUndefined()
  })

  it('ENDLESS (raíz): sin count → total null, cicla sin fin hasta abortar', () => {
    const h = buildRecallActivity(['quiz-tablas', 'flashcards-solar', 'capitales-latam'], 0)
    const { multi, done } = walk(h, 7)
    expect(multi.getSnapshot().total).toBeNull()
    expect(multi.getSnapshot().status).toBe('running') // sigue: el 8º hijo ya está montado
    expect(done.map((d) => d.target)).toEqual([
      'quiz-tablas', 'flashcards-solar', 'capitales-latam',
      'quiz-tablas', 'flashcards-solar', 'capitales-latam',
      'quiz-tablas',
    ])
    expect(done.map((d) => d.result.seed)).toEqual([1, 2, 3, 4, 5, 6, 7])
    multi.abort()
    expect(multi.getResult()!.outcome).toBe('aborted')
  })

  it('solo hojas: targets sin Definición no-multi (o desconocidos) se filtran ANTES de ciclar', () => {
    const h = buildRecallActivity(['repaso-mixto', 'no-existe', 'mezcla-2'], 10, { count: 2 })
    const { done } = walk(h, 5)
    expect(done.map((d) => [d.target, d.result.seed])).toEqual([
      ['mezcla-2', 11],
      ['mezcla-2', 12],
    ])
  })

  it('la hoja es la PRIMERA no-multi del target (seed antes que importadas; se saltea un multi importado)', () => {
    registerImportedDefinitions([
      { id: 'w2.recall-multi', typeId: 'multi', title: 'x', target: 'resta-dificil', generatorId: 'fixed', params: { childIds: ['suma-0-10'] }, mode: 'untimed', durationSec: 0 },
    ])
    const h = buildRecallActivity(['resta-dificil'], 1, { count: 1 })
    const { done } = walk(h, 1)
    expect(done.map((d) => d.definitionId)).toEqual(['resta-dificil'])
  })

  it('sin targets repasables → el multi termina apenas arranca (completed, 0/0)', () => {
    const h = buildRecallActivity([], 1)
    const multi = h.instance as MultiEngine
    multi.start()
    expect(multi.getResult()).toMatchObject({ outcome: 'completed', score: 0, maxScore: 0 })
  })
})
