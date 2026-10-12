import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ActivityCore,
  DEFAULT_SCORE,
  Emitter,
  createActivity,
  durationMsFor,
  perfectScore,
  pointsForCorrect,
  timeBonus,
  timedScore,
  type ActivityContext,
  type ActivityEvent,
  type ScoreConfig,
} from '../activity/index'
import { flashcardsModule, makeFlashcardsRuntime, TIME_BONUS_MAX as FC_TIME_BONUS, type Card } from '../activities/flashcards/index'
import {
  multipleChoiceModule,
  makeMultipleChoiceRuntime,
  TIME_BONUS_MAX as MC_TIME_BONUS,
  type MCQuestion,
  type MultipleChoiceEngine,
} from '../activities/multiplechoice/index'
import { quizModule, makeQuizRuntime, mathQuizGenerator, TIME_BONUS_MAX as QUIZ_TIME_BONUS, type QuizEngine } from '../activities/quiz/index'
import { dominoModule, makeRuntime, mathDominoGenerator, TIME_BONUS_MAX as DOMINO_TIME_BONUS } from '../activities/domino/index'
import { multiModule, makeMultiRuntime, isChildFinished, TIME_BONUS_MAX as MULTI_TIME_BONUS, type MultiChild } from '../activities/multi/index'
import {
  DEFINITIONS,
  buildDefinition,
  clearImportedDefinition,
  definitionFor,
  definitionsForTarget,
  registerImportedDefinitions,
} from '../definitions'
import { TYPES, type DefinitionRecipe } from '../registry'
import { SISTEMA_SOLAR } from '../activities/flashcards/index'
import { createVisualBridge } from '../visual/visualBridge'
import type { VisualSink } from '../visual/types'
import { createAudioBridge, type AudioSink } from '../audio/audioBridge'
import { gameManifest } from '../audio/gameManifest'
import { AudioEngine, validateManifest } from '../audio/engine/index'
import { loopStems as loopStemsOf } from '../audio/engine/manifest'

/* PORTE INNERITH (W2) — suite NUEVA de FIDELIDAD: fija contra regresiones, punto por punto, lo que el
   informe 02 dice del motor (§5 núcleo, §6 tipos, §9 gamificación) y las trampas que se portan TAL
   CUAL (§15: 6, 13, 17, 38, 39, 40). Si alguien "arregla" un quirk documentado, esto se pone rojo.
   No cambia runtime. */

// ---------------------------------------------------------------- helpers
function makeClock(start = 0) {
  let t = start
  return { now: () => t, advance: (ms: number) => (t += ms), set: (ms: number) => (t = ms) }
}

function coreWith(opts: { score?: ScoreConfig; durationMs?: number | null; now: () => number }) {
  const events: ActivityEvent[] = []
  const ctx: ActivityContext = { emit: (e) => events.push(e), now: opts.now }
  const core = new ActivityCore({
    activityId: 't',
    version: 1,
    config: { dato: true },
    score: opts.score ?? DEFAULT_SCORE,
    durationMs: opts.durationMs ?? null,
    maxScore: 0,
    ctx,
  })
  return { core, events }
}

const cards = (n: number): Card[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, front: `frente ${i}`, back: `dorso ${i}`, skill: 'sk' }))

const singleQ = (id: string): MCQuestion => ({
  id,
  mode: 'single',
  skill: 'mc',
  prompt: `pregunta ${id}`,
  options: [
    { id: 'ok', text: 'correcta', correct: true },
    { id: 'no', text: 'incorrecta', correct: false },
  ],
})

/** Recorre un MC literal (sin barajar): `answers[i]` = ids a marcar en la pregunta i. */
function playMC(engine: MultipleChoiceEngine, answers: string[][]): void {
  for (const ids of answers) {
    for (const id of ids) engine.toggle(id)
    engine.commit()
    engine.next()
  }
}

// ======================================================================= §5 NÚCLEO
describe('§5 núcleo — ciclo idle→running↔paused→finished y reloj con pausa', () => {
  it('transiciones con guardas (start solo desde idle, pause solo running, resume solo paused)', () => {
    const clock = makeClock()
    const { core, events } = coreWith({ now: clock.now })
    expect(core.status).toBe('idle')
    core.pause()
    core.resume()
    expect(core.status).toBe('idle')
    core.start()
    core.start() // no re-arranca
    expect(core.status).toBe('running')
    core.resume() // corriendo → no-op
    core.pause()
    core.pause() // ya pausado → no-op
    expect(core.status).toBe('paused')
    core.resume()
    expect(core.status).toBe('running')
    core.abort()
    expect(core.status).toBe('finished')
    expect(events.map((e) => e.kind)).toEqual(['started', 'paused', 'resumed', 'finished'])
  })

  it('finish es idempotente: devuelve el MISMO result y emite finished una sola vez', () => {
    const { core, events } = coreWith({ now: () => 0 })
    core.start()
    const a = core.finish('completed')
    const b = core.finish('aborted')
    expect(b).toBe(a)
    expect(a.outcome).toBe('completed')
    expect(events.filter((e) => e.kind === 'finished').length).toBe(1)
  })

  it('el reloj NO cuenta el tiempo en pausa; durationMs/startedAt/finishedAt salen del reloj inyectado', () => {
    const clock = makeClock(1000)
    const { core } = coreWith({ now: clock.now })
    core.start() // t=1000
    clock.advance(1000)
    expect(core.elapsedMs()).toBe(1000)
    core.pause() // t=2000
    clock.advance(5000)
    expect(core.elapsedMs()).toBe(1000) // pausado: no corre
    core.resume() // t=7000
    clock.advance(500)
    expect(core.elapsedMs()).toBe(1500)
    const r = core.finish('completed') // t=7500
    expect(r.durationMs).toBe(1500)
    expect(r.startedAt).toBe(1000)
    expect(r.finishedAt).toBe(7500)
    expect(core.remainingMs()).toBeNull() // sin reloj
  })

  it('tick: sin reloj solo refresca (sin evento tick); con reloj emite {elapsedMs, remainingMs} y a 0 → timeout', () => {
    const c1 = makeClock()
    const untimed = coreWith({ now: c1.now })
    untimed.core.start()
    const rev = untimed.core.rev
    untimed.core.tick()
    expect(untimed.core.rev).toBe(rev + 1) // notificó
    expect(untimed.events.some((e) => e.kind === 'tick')).toBe(false)

    const c2 = makeClock()
    const timed = coreWith({ now: c2.now, durationMs: 10_000 })
    timed.core.start()
    c2.advance(4000)
    timed.core.tick()
    expect(timed.events.at(-1)).toEqual({ kind: 'tick', elapsedMs: 4000, remainingMs: 6000 })
    c2.advance(6000)
    timed.core.tick()
    expect(timed.events.at(-2)).toEqual({ kind: 'tick', elapsedMs: 10_000, remainingMs: 0 })
    expect(timed.core.getResult()!.outcome).toBe('timeout')
  })
})

describe('§5 puntaje EXACTO (scoring.ts)', () => {
  it('DEFAULT_SCORE = {base 10, streakBonus 2, hintPenalty 5}; acierto = 10 + 2·(racha−1)', () => {
    expect(DEFAULT_SCORE).toEqual({ base: 10, streakBonus: 2, hintPenalty: 5 })
    expect([1, 2, 3, 4, 5].map((k) => pointsForCorrect(DEFAULT_SCORE, k))).toEqual([10, 12, 14, 16, 18])
  })

  it('perfectScore(n) = n·(n+9) sin reloj', () => {
    for (let n = 0; n <= 30; n++) expect(perfectScore(DEFAULT_SCORE, n)).toBe(n * (n + 9))
  })

  it('bonos SOLO en timed: el pozo se inyecta solo en contrarreloj y la duración solo existe en timed', () => {
    expect(timedScore(DEFAULT_SCORE, 'untimed', 100).timeBonusMax).toBe(0)
    expect(timedScore(DEFAULT_SCORE, 'timed', 100).timeBonusMax).toBe(100)
    expect(durationMsFor('untimed', 60)).toBeNull()
    expect(durationMsFor('timed', 60)).toBe(60_000)
    expect(timeBonus(DEFAULT_SCORE, 30_000, 60_000)).toBe(0)
    // pozo por Tipo (exacto del POC)
    expect({ FC_TIME_BONUS, MC_TIME_BONUS, QUIZ_TIME_BONUS, DOMINO_TIME_BONUS, MULTI_TIME_BONUS }).toEqual({
      FC_TIME_BONUS: 100,
      MC_TIME_BONUS: 100,
      QUIZ_TIME_BONUS: 100,
      DOMINO_TIME_BONUS: 80,
      MULTI_TIME_BONUS: 0,
    })
  })

  it('timed: completed suma el bono proporcional al tiempo restante; timeout no', () => {
    const c = makeClock()
    const ok = coreWith({ now: c.now, durationMs: 60_000, score: { ...DEFAULT_SCORE, timeBonusMax: 100 } })
    ok.core.start()
    c.advance(30_000)
    expect(ok.core.finish('completed').score).toBe(50)

    const c2 = makeClock()
    const late = coreWith({ now: c2.now, durationMs: 60_000, score: { ...DEFAULT_SCORE, timeBonusMax: 100 } })
    late.core.start()
    c2.advance(30_000)
    expect(late.core.finish('timeout').score).toBe(0)
  })

  it('racha POR PARTIDA: el error la corta; pista −5 con piso 0; stats y skills', () => {
    const { core, events } = coreWith({ now: () => 0 })
    core.start()
    core.registerHint() // score 0 → sigue 0 (clamp)
    expect(core.score).toBe(0)
    expect(core.registerCorrect({ skill: 'a' })).toBe(10)
    expect(core.registerCorrect({ skill: 'a' })).toBe(12)
    core.registerWrong({ skill: 'b' })
    expect(core.registerCorrect({ skill: 'b' })).toBe(10) // racha cortada
    core.registerHint() // 32 − 5
    expect(core.score).toBe(27)
    const r = core.finish('completed')
    expect(r.stats).toEqual({ correct: 3, wrong: 1, hintsUsed: 2, bestStreak: 2 })
    expect(r.skills).toEqual({ a: { attempts: 2, correct: 2 }, b: { attempts: 2, correct: 1 } })
    expect(events.filter((e) => e.kind === 'hint').length).toBe(2)
  })

  it('skills ausentes → result.skills undefined (no {})', () => {
    const { core } = coreWith({ now: () => 0 })
    core.start()
    core.registerCorrect()
    expect(core.finish('completed').skills).toBeUndefined()
  })
})

describe('§5 bus de eventos (Emitter) y notify a prueba de throws', () => {
  afterEach(() => vi.restoreAllMocks())

  it('Emitter: try/catch POR listener (un throw no corta a los siguientes) y copia defensiva al despachar', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bus = new Emitter<number>()
    const seen: string[] = []
    let unsubB: () => void = () => {}
    bus.subscribe((v) => {
      seen.push(`a${v}`)
      unsubB() // se desuscribe a B DURANTE el despacho
      throw new Error('boom')
    })
    unsubB = bus.subscribe((v) => seen.push(`b${v}`))
    bus.emit(1)
    bus.emit(2)
    expect(seen).toEqual(['a1', 'b1', 'a2']) // B recibió el 1 (copia) y no el 2
    expect(spy).toHaveBeenCalledWith('[activity] un listener de eventos tiró; se continúa con el resto:', expect.any(Error))
  })

  it('ActivityCore.notify: un suscriptor que tira no corta al resto (mismo criterio)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { core } = coreWith({ now: () => 0 })
    let calls = 0
    core.subscribe(() => {
      throw new Error('boom')
    })
    core.subscribe(() => calls++)
    core.start()
    expect(calls).toBe(1)
    expect(spy).toHaveBeenCalledWith('[activity] un suscriptor de notify tiró; se continúa con el resto:', expect.any(Error))
  })

  it('diccionario exacto: started · move:correct{points,streak,skill} · move:wrong{skill} · hint · paused · resumed · finished{result} · signal{ns,type,data}', () => {
    const content = mathDominoGenerator({ maxValue: 10, ops: ['+'], tileCount: 6 }, 5)
    const { instance, onEvent } = createActivity(dominoModule, { content, runtime: makeRuntime('untimed', 60) }, { now: () => 0 })
    const events: ActivityEvent[] = []
    onEvent((e) => events.push(e))
    instance.start()
    instance.hint()
    const s = instance.getSnapshot()
    const wrong = s.hand.find((t) => !s.playableIds.includes(t.id))!
    instance.play(wrong.id, 'left')
    instance.pause()
    instance.resume()
    // 3 aciertos seguidos → hito de racha por el canal libre
    for (let i = 0; i < 3; i++) {
      const id = instance.getSnapshot().playableIds[0]
      instance.play(id, instance.legalEndsFor(id).left ? 'left' : 'right')
    }
    instance.abort()
    const shape = (e: ActivityEvent) => `${e.kind}{${Object.keys(e).filter((k) => k !== 'kind').sort().join(',')}}`
    expect(events.map(shape)).toEqual([
      'started{}',
      'hint{}',
      'move:wrong{skill}',
      'paused{}',
      'resumed{}',
      'move:correct{points,skill,streak}',
      'move:correct{points,skill,streak}',
      'move:correct{points,skill,streak}',
      'signal{data,ns,type}',
      'finished{result}',
    ])
    expect(events[8]).toEqual({ kind: 'signal', ns: 'domino', type: 'streak-milestone', data: { streak: 3 } })
  })
})

describe('§5 ActivityResult: identidad (definitionId + seed) y config como DATO', () => {
  it('el host estampa definitionId/seed; sin identidad quedan undefined', () => {
    const content = mathQuizGenerator({ questionCount: 2, maxValue: 5, ops: ['+'], optionCount: 3 }, 1)
    const withId = createActivity(quizModule, { content, runtime: makeQuizRuntime('untimed', 60) }, { identity: { definitionId: 'd', seed: 7 } })
    withId.instance.start()
    withId.instance.abort()
    expect(withId.instance.getResult()).toMatchObject({ definitionId: 'd', seed: 7 })
    const noId = createActivity(quizModule, { content, runtime: makeQuizRuntime('untimed', 60) })
    noId.instance.start()
    noId.instance.abort()
    expect(noId.instance.getResult()!.definitionId).toBeUndefined()
    expect(noId.instance.getResult()!.seed).toBeUndefined()
    expect(Object.keys(withId.instance.getResult()!).sort()).toEqual(
      ['activityId', 'config', 'definitionId', 'durationMs', 'finishedAt', 'maxScore', 'outcome', 'score', 'seed', 'skills', 'startedAt', 'stats', 'version'].sort(),
    )
  })

  it('config del result: dominó guarda SOLO el runtime; flashcards/MC/quiz el {content, runtime}', () => {
    const runtime = makeRuntime('untimed', 60)
    const dom = createActivity(dominoModule, { content: mathDominoGenerator({ maxValue: 10, ops: ['+'], tileCount: 6 }, 1), runtime })
    dom.instance.start()
    dom.instance.abort()
    expect(dom.instance.getResult()!.config).toEqual(runtime)
    const fcCfg = { content: { cards: cards(2) }, runtime: makeFlashcardsRuntime('untimed', 120) }
    const fc = createActivity(flashcardsModule, fcCfg)
    fc.instance.start()
    fc.instance.abort()
    expect(fc.instance.getResult()!.config).toEqual(fcCfg)
  })
})

// ======================================================================= §6 TIPOS
describe('§6 / trampa 17 — ids persistidos EXACTOS (activityId = id de módulo, ≠ typeId)', () => {
  it('typeIds del registry y activityId de cada módulo', () => {
    expect(Object.keys(TYPES)).toEqual(['domino', 'quiz', 'flashcards', 'multiplechoice', 'multi'])
    expect(Object.fromEntries(Object.entries(TYPES).map(([k, v]) => [k, v.module.id]))).toEqual({
      domino: 'domino',
      quiz: 'quiz-relampago',
      flashcards: 'flashcards',
      multiplechoice: 'multiplechoice',
      multi: 'multi-actividad',
    })
  })

  it('lo que va al result (y el POC persiste como typeId) es el id de MÓDULO', () => {
    const ids: Record<string, string> = {}
    for (const id of ['quiz-tablas', 'repaso-mixto', 'suma-0-10', 'flashcards-solar']) {
      const h = buildDefinition(id, 3)
      h.instance.start()
      h.instance.abort()
      ids[id] = h.instance.getResult()!.activityId
      h.instance.dispose()
    }
    expect(ids).toEqual({
      'quiz-tablas': 'quiz-relampago',
      'repaso-mixto': 'multi-actividad',
      'suma-0-10': 'domino',
      'flashcards-solar': 'flashcards',
    })
  })
})

describe('trampa 6 — el % NO es tasa de acierto en flashcards/quiz/dominó (ponderado por racha); en MC sí', () => {
  it('flashcards: 4 cartas, falla la 3ª → 32/52 = 0.615 < 0.7 con 75% de acierto', () => {
    const { instance } = createActivity(flashcardsModule, { content: { cards: cards(4) }, runtime: makeFlashcardsRuntime('untimed', 120) }, { now: () => 0 })
    instance.start()
    for (const knew of [true, true, false, true]) {
      instance.reveal()
      instance.grade(knew)
    }
    const r = instance.getResult()!
    expect([r.score, r.maxScore]).toEqual([32, 52])
    expect(r.score / r.maxScore).toBeCloseTo(0.615, 3)
    expect(r.stats.correct / (r.stats.correct + r.stats.wrong)).toBe(0.75)
  })

  it('quiz: un error en la 3ª (y después la acierta, sigue en la misma) → 44/52 = 0.846 ≠ acierto 4/5 = 0.8', () => {
    const content = mathQuizGenerator({ questionCount: 4, maxValue: 10, ops: ['+'], optionCount: 4 }, 11)
    const { instance } = createActivity(quizModule, { content, runtime: makeQuizRuntime('untimed', 60) }, { now: () => 0 })
    instance.start()
    for (let i = 0; i < 4; i++) {
      const q = instance.getSnapshot().current!
      if (i === 2) instance.answer(q.options.find((o) => o !== q.answer)!) // un error antes de acertar
      instance.answer(q.answer)
    }
    const r = instance.getResult()!
    expect([r.score, r.maxScore]).toEqual([44, 52]) // 10 + 12 + (racha cortada) 10 + 12
    expect(r.stats).toMatchObject({ correct: 4, wrong: 1 })
    expect(r.score / r.maxScore).not.toBe(r.stats.correct / (r.stats.correct + r.stats.wrong))
  })

  it('MC: puntaje plano → pct = tasa de acierto (falla 1 de 4 → 30/40)', () => {
    const qs = ['a', 'b', 'c', 'd'].map(singleQ)
    const { instance } = createActivity(multipleChoiceModule, { content: { questions: qs }, runtime: makeMultipleChoiceRuntime('untimed', 120) })
    instance.start()
    playMC(instance, [['ok'], ['ok'], ['no'], ['ok']])
    const r = instance.getResult()!
    expect(r.score / r.maxScore).toBe(0.75)
  })
})

describe('§6 multi — replica eventos del hijo, corta la racha entre hijos y emite child-finished', () => {
  const quizChild = (id: string, seed: number): MultiChild => ({
    make: () =>
      createActivity(quizModule, {
        content: mathQuizGenerator({ questionCount: 2, maxValue: 5, ops: ['+'], optionCount: 3 }, seed),
        runtime: makeQuizRuntime('untimed', 60),
      }),
    typeId: 'quiz',
    title: `Quiz ${id}`,
    target: `t-${id}`,
    definitionId: `d-${id}`,
  })

  it('la racha del multi NO cruza hijos (puntos 10,12 | 10,12) y bestStreak = 2', () => {
    const kids = [quizChild('a', 1), quizChild('b', 2)]
    const { instance, onEvent } = createActivity(multiModule, { total: 2, runtime: makeMultiRuntime('untimed', 0), next: (i) => kids[i] ?? null })
    const events: ActivityEvent[] = []
    onEvent((e) => events.push(e))
    instance.start()
    while (instance.getSnapshot().status === 'running') {
      const child = instance.currentChild()!.instance as unknown as QuizEngine
      child.answer(child.getSnapshot().current!.answer)
    }
    const pts = events.flatMap((e) => (e.kind === 'move:correct' ? [e.points] : []))
    expect(pts).toEqual([10, 12, 10, 12])
    const r = instance.getResult()!
    expect(r.stats.bestStreak).toBe(2)
    expect(r.score).toBe(r.maxScore) // 44 = 22 + 22
    // un solo 'started' (el del multi; el del hijo no se replica) y un child-finished por hijo, en orden
    expect(events.filter((e) => e.kind === 'started').length).toBe(1)
    expect(events.filter(isChildFinished).map((e) => e.data.definitionId)).toEqual(['d-a', 'd-b'])
  })

  it('las señales del hijo se replican en el bus del multi (p.ej. answered del MC)', () => {
    const child: MultiChild = {
      make: () => createActivity(multipleChoiceModule, { content: { questions: [singleQ('x')] }, runtime: makeMultipleChoiceRuntime('untimed', 120) }),
      typeId: 'multiplechoice',
    }
    const { instance, onEvent } = createActivity(multiModule, { total: 1, runtime: makeMultiRuntime('untimed', 0), next: (i) => (i === 0 ? child : null) })
    const events: ActivityEvent[] = []
    onEvent((e) => events.push(e))
    instance.start()
    playMC(instance.currentChild()!.instance as unknown as MultipleChoiceEngine, [['ok']])
    expect(events.filter((e) => e.kind === 'signal').map((e) => (e.kind === 'signal' ? `${e.ns}/${e.type}` : ''))).toEqual([
      'multiplechoice/answered',
      'multi-actividad/child-finished',
    ])
  })
})

describe('trampa 13 — inflado del puntaje del multi con hijos de opción múltiple (EXACTO, no se corrige)', () => {
  function multiOfMC(questions: MCQuestion[]) {
    const child: MultiChild = {
      make: () => createActivity(multipleChoiceModule, { content: { questions }, runtime: makeMultipleChoiceRuntime('untimed', 120) }),
      typeId: 'multiplechoice',
      target: 't-mc',
    }
    const handle = createActivity(multiModule, { total: 1, runtime: makeMultiRuntime('untimed', 0), next: (i) => (i === 0 ? child : null) })
    const events: ActivityEvent[] = []
    handle.onEvent((e) => events.push(e))
    return { ...handle, events }
  }

  it('8 preguntas perfectas: el hijo da 80/80 pero la sesión del multi da 136/80 (pct 1.7)', () => {
    const { instance, events } = multiOfMC(['1', '2', '3', '4', '5', '6', '7', '8'].map(singleQ))
    instance.start()
    playMC(instance.currentChild()!.instance as unknown as MultipleChoiceEngine, Array.from({ length: 8 }, () => ['ok']))
    const r = instance.getResult()!
    expect([r.score, r.maxScore]).toEqual([136, 80])
    expect(r.score / r.maxScore).toBe(1.7)
    const child = events.filter(isChildFinished)[0].data.result
    expect([child.score, child.maxScore]).toEqual([80, 80])
  })

  it('el crédito parcial cuenta como acierto PLENO en las stats del multi (en el hijo cuenta como error)', () => {
    const partial: MCQuestion = {
      id: 'p',
      mode: 'multi',
      skill: 'mc',
      prompt: '¿cuáles?',
      options: [
        { id: 'a', text: 'uno', correct: true },
        { id: 'b', text: 'dos', correct: true },
        { id: 'c', text: 'tres', correct: false },
      ],
    }
    const { instance, events } = multiOfMC([partial])
    instance.start()
    playMC(instance.currentChild()!.instance as unknown as MultipleChoiceEngine, [['a']]) // 0.5
    const multi = instance.getResult()!
    const child = events.filter(isChildFinished)[0].data.result
    expect(child.stats).toMatchObject({ correct: 0, wrong: 1 })
    expect(child.score).toBe(5)
    expect(multi.stats).toMatchObject({ correct: 1, wrong: 0 })
    expect(multi.score).toBe(10) // registerCorrect del multi: 10, no los 5 del hijo
  })
})

// ======================================================================= registry + definiciones
describe('registry: build = generador registrado → PORTERO → createActivity', () => {
  const tmp: string[] = []
  const reg = (d: DefinitionRecipe) => {
    registerImportedDefinitions([d])
    tmp.push(d.id)
  }
  afterEach(() => {
    while (tmp.length) clearImportedDefinition(tmp.pop()!)
  })

  it('generador desconocido → falla RUIDOSO con la lista de los que hay', () => {
    reg({ id: 'w2.gen', typeId: 'quiz', title: 'x', target: 'w2.gen', generatorId: 'nope', params: {}, mode: 'untimed', durationSec: 60 })
    expect(() => buildDefinition('w2.gen', 1)).toThrow('[learn] generador desconocido "nope" para el Tipo "quiz" (hay: math, capitales-latam)')
  })

  it('contenido que no pasa el portero → falla con la CAUSA del Tipo', () => {
    const bad = [
      { id: 'x', front: 'a', back: 'b', skill: 's' },
      { id: 'x', front: 'c', back: 'd', skill: 's' },
    ]
    reg({ id: 'w2.bad', typeId: 'flashcards', title: 'x', target: 'w2.bad', generatorId: 'static', params: { cards: bad }, mode: 'untimed', durationSec: 60 })
    expect(() => buildDefinition('w2.bad', 1)).toThrow('[learn] contenido inválido para el Tipo "flashcards": id de tarjeta repetido: "x"')
  })

  it('multi sin childIds → falla con causa', () => {
    reg({ id: 'w2.multi0', typeId: 'multi', title: 'x', target: 'w2.multi0', generatorId: 'fixed', params: { childIds: [] }, mode: 'untimed', durationSec: 0 })
    expect(() => buildDefinition('w2.multi0', 1)).toThrow('[learn] multi "w2.multi0" sin childIds en params')
  })

  it("multi 'fixed': el hijo i se acuña con seed + i + 1 y lleva la identidad real del hijo", () => {
    const h = buildDefinition('repaso-mixto', 100)
    const events: ActivityEvent[] = []
    h.onEvent((e) => events.push(e))
    h.instance.start()
    // abortar cada HIJO lo termina → el multi graba child-finished y avanza
    const multi = h.instance as unknown as { currentChild: () => { instance: { abort: () => void } } | null }
    while (multi.currentChild()) multi.currentChild()!.instance.abort()
    const kids = events.filter(isChildFinished).map((e) => [e.data.definitionId, e.data.target, e.data.result.seed, e.data.title])
    expect(kids).toEqual([
      ['suma-0-10', 'suma-0-10', 101, 'Sumas hasta 10'],
      ['geo-repaso', 'geo-repaso', 102, 'Repaso de capitales'],
      ['sumaresta-0-12', 'sumaresta-0-12', 103, 'Sumas y restas'],
    ])
    expect(h.instance.getResult()).toMatchObject({ outcome: 'completed', definitionId: 'repaso-mixto', seed: 100 })
  })
})

describe('definiciones: catálogo SEED exacto (las 12) + hook de importadas (seed primero)', () => {
  afterEach(() => {
    for (const id of ['w2.imp', 'suma-0-10#dup']) clearImportedDefinition(id)
  })

  it('las 12 Definiciones seed son EXACTAMENTE las del POC (mismo orden, mismos params)', () => {
    const d = (id: string, typeId: string, title: string, generatorId: string, params: unknown, durationSec: number) => ({
      id, typeId, title, target: id, generatorId, params, mode: 'untimed', durationSec,
    })
    expect(DEFINITIONS).toEqual({
      'suma-0-10': d('suma-0-10', 'domino', 'Sumas hasta 10', 'math', { maxValue: 10, ops: ['+'], tileCount: 6 }, 60),
      'sumaresta-0-12': d('sumaresta-0-12', 'domino', 'Sumas y restas', 'math', { maxValue: 12, ops: ['+', '-'], tileCount: 8 }, 75),
      'quiz-tablas': d('quiz-tablas', 'quiz', 'Quiz relámpago', 'math', { questionCount: 8, maxValue: 12, ops: ['+', '-', '×'], optionCount: 4 }, 60),
      'resta-dificil': d('resta-dificil', 'domino', 'Restas difíciles', 'math', { maxValue: 20, ops: ['-'], tileCount: 8 }, 90),
      'desafio-calculo': d('desafio-calculo', 'quiz', 'Desafío final', 'math', { questionCount: 10, maxValue: 12, ops: ['+', '-', '×'], optionCount: 4 }, 75),
      'capitales-latam': d('capitales-latam', 'domino', 'Países y capitales', 'capitales-latam', { count: 8 }, 75),
      'capitales-latam-2': d('capitales-latam-2', 'domino', 'Más capitales', 'capitales-latam', { count: 10 }, 90),
      'geo-repaso': d('geo-repaso', 'quiz', 'Repaso de capitales', 'capitales-latam', { count: 8, optionCount: 4 }, 75),
      'mezcla-1': d('mezcla-1', 'domino', 'Mezcla 1', 'math', { maxValue: 12, ops: ['+', '-'], tileCount: 8 }, 75),
      'mezcla-2': d('mezcla-2', 'quiz', 'Mezcla 2', 'math', { questionCount: 8, maxValue: 12, ops: ['+', '-'], optionCount: 4 }, 60),
      'flashcards-solar': d('flashcards-solar', 'flashcards', 'Flashcards: Sistema solar', 'static', { cards: SISTEMA_SOLAR }, 120),
      'repaso-mixto': d('repaso-mixto', 'multi', 'Repaso mixto', 'fixed', { childIds: ['suma-0-10', 'geo-repaso', 'sumaresta-0-12'] }, 0),
    })
    expect(Object.keys(DEFINITIONS)).toEqual([
      'suma-0-10', 'sumaresta-0-12', 'quiz-tablas', 'resta-dificil', 'desafio-calculo', 'capitales-latam',
      'capitales-latam-2', 'geo-repaso', 'mezcla-1', 'mezcla-2', 'flashcards-solar', 'repaso-mixto',
    ])
  })

  it('definitionsForTarget: seed PRIMERO y después las importadas', () => {
    registerImportedDefinitions([
      { id: 'w2.imp', typeId: 'quiz', title: 'Importada', target: 'suma-0-10', generatorId: 'math', params: { questionCount: 2, maxValue: 5, ops: ['+'], optionCount: 3 }, mode: 'untimed', durationSec: 60 },
    ])
    expect(definitionsForTarget('suma-0-10').map((d) => d.id)).toEqual(['suma-0-10', 'w2.imp'])
    expect(definitionFor('w2.imp')!.title).toBe('Importada')
    clearImportedDefinition('w2.imp')
    expect(definitionFor('w2.imp')).toBeUndefined()
    expect(definitionsForTarget('suma-0-10').map((d) => d.id)).toEqual(['suma-0-10'])
  })

  it('ante empate de id gana el seed (definitionFor)', () => {
    registerImportedDefinitions([{ ...DEFINITIONS['suma-0-10'], title: 'pisada' }])
    expect(definitionFor('suma-0-10')!.title).toBe('Sumas hasta 10')
    clearImportedDefinition('suma-0-10') // limpia SOLO la importada (el seed no se toca)
    expect(definitionFor('suma-0-10')!.title).toBe('Sumas hasta 10')
  })

  it('trampa 40 — nada usa `timed`: todas las Definiciones seed son untimed', () => {
    expect(Object.values(DEFINITIONS).every((r) => r.mode === 'untimed')).toBe(true)
  })
})

// ======================================================================= §9 GAMIFICACIÓN
describe('§9 visualBridge — efectos e intensidades EXACTOS', () => {
  function sink() {
    const calls: unknown[][] = []
    const s: VisualSink = {
      burst: (o) => calls.push(['burst', o]),
      flash: (t) => calls.push(['flash', t]),
      shake: (i) => calls.push(['shake', i]),
      pop: (o) => calls.push(['pop', o]),
      setBackground: (m) => calls.push(['bg', m]),
    }
    return { s, calls }
  }
  const result = (outcome: 'completed' | 'timeout' | 'aborted') =>
    ({ outcome }) as unknown as Extract<ActivityEvent, { kind: 'finished' }>['result']

  it('started/correct/wrong/hint/finished', () => {
    const { s, calls } = sink()
    const v = createVisualBridge(s)
    v({ kind: 'started' })
    v({ kind: 'move:correct', points: 10, streak: 1 })
    v({ kind: 'move:correct', points: 14, streak: 3 })
    v({ kind: 'move:correct', points: 26, streak: 9 })
    v({ kind: 'move:wrong' })
    v({ kind: 'hint' })
    v({ kind: 'paused' })
    v({ kind: 'resumed' })
    v({ kind: 'signal', ns: 'x', type: 'y' })
    v({ kind: 'finished', result: result('completed') })
    v({ kind: 'finished', result: result('aborted') })
    expect(calls).toEqual([
      ['bg', 'play'],
      ['burst', { kind: 'spark', intensity: 1 }],
      ['pop', { text: '+10', tone: 'good' }],
      ['flash', 'good'],
      ['burst', { kind: 'confetti', intensity: 1.4 }],
      ['pop', { text: '+14', tone: 'good' }],
      ['flash', 'good'],
      ['burst', { kind: 'confetti', intensity: 2.2 }], // min(1 + 0.2·8, 2.2)
      ['pop', { text: '+26', tone: 'good' }],
      ['flash', 'good'],
      ['shake', 1],
      ['flash', 'bad'],
      ['pop', { text: '💡', tone: 'good' }],
      ['bg', 'win'],
      ['flash', 'win'],
      ['burst', { kind: 'confetti', intensity: 2.2, y: 0.3 }],
      ['bg', 'lose'],
    ])
  })

  it('tick ≤ 5 s (solo con reloj) → fondo tense UNA vez; started lo rearma', () => {
    const { s, calls } = sink()
    const v = createVisualBridge(s)
    v({ kind: 'tick', elapsedMs: 0, remainingMs: null })
    v({ kind: 'tick', elapsedMs: 0, remainingMs: 5001 })
    v({ kind: 'tick', elapsedMs: 0, remainingMs: 5000 })
    v({ kind: 'tick', elapsedMs: 0, remainingMs: 100 })
    v({ kind: 'started' })
    v({ kind: 'tick', elapsedMs: 0, remainingMs: 10 })
    expect(calls).toEqual([['bg', 'tense'], ['bg', 'play'], ['bg', 'tense']])
  })

  it('MC con crédito parcial (racha 0 en el evento) → spark de intensidad 0.8', () => {
    const { s, calls } = sink()
    createVisualBridge(s)({ kind: 'move:correct', points: 5, streak: 0 })
    expect(calls[0]).toEqual(['burst', { kind: 'spark', intensity: 0.8 }])
  })
})

describe('§9 audioBridge — FX/moods EXACTOS', () => {
  it('mapea cada evento al canal del gameManifest con su volumen', () => {
    const calls: unknown[][] = []
    const s: AudioSink = { triggerFx: (id, o) => calls.push(['fx', id, o]), setMood: (id) => calls.push(['mood', id]) }
    const a = createAudioBridge(s)
    const fin = (outcome: string) => ({ kind: 'finished', result: { outcome } }) as unknown as ActivityEvent
    a({ kind: 'started' })
    a({ kind: 'move:correct', points: 10, streak: 2 })
    a({ kind: 'move:correct', points: 14, streak: 3 })
    a({ kind: 'move:wrong' })
    a({ kind: 'hint' })
    a({ kind: 'tick', elapsedMs: 0, remainingMs: 4000 })
    a({ kind: 'tick', elapsedMs: 0, remainingMs: 3000 })
    a(fin('completed'))
    a(fin('timeout'))
    expect(calls).toEqual([
      ['mood', 'play'],
      ['fx', 'chime', { volume: 0.9 }],
      ['fx', 'chime-hi', { volume: 0.9 }],
      ['fx', 'buzz', { volume: 0.7 }],
      ['fx', 'hint', undefined],
      ['mood', 'tense'],
      ['mood', 'win'],
      ['fx', 'fanfare', undefined],
      ['mood', 'lose'],
      ['fx', 'fail', undefined],
    ])
  })

  it('los ids de FX del bridge existen como canales oneshot del manifest', () => {
    const oneshots = gameManifest.channels.filter((c) => c.mode === 'oneshot').map((c) => c.id)
    expect(oneshots).toEqual(['chime', 'chime-hi', 'buzz', 'hint', 'fanfare', 'fail'])
  })
})

describe('trampa 38 — los moods son INAUDIBLES (solo tocan `bed`, que nadie arranca)', () => {
  it('manifest válido; los 4 moods son del grupo ambient y solo direccionan `bed`', () => {
    expect(validateManifest(gameManifest).ok).toBe(true)
    expect(gameManifest.moods.map((m) => m.id)).toEqual(['play', 'tense', 'win', 'lose'])
    for (const m of gameManifest.moods) {
      expect(m.group).toBe('ambient')
      expect(Object.keys(m.channels)).toEqual(['bed'])
    }
    expect(gameManifest.channels.filter((c) => c.group === 'ambient')).toEqual([
      { id: 'bed', file: 'stem-amb-wind.wav', mode: 'loop', sync: false, group: 'ambient' },
    ])
    expect(loopStemsOf(gameManifest)).toEqual(['ambient', 'temaA', 'temaB'])
  })

  it('en el código portado nadie arranca el stem `ambient` (ni startLoops): solo el director cruza temaA/temaB', () => {
    const src = import.meta.glob(['../**/*.ts', '../**/*.tsx', '!../**/__tests__/**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
    // llamadas reales: se descartan comentarios, `export function …` y las firmas de los métodos del motor
    const isDecl = (t: string) => /^(\*|\/\/|\/\*|export function )/.test(t) || /^(startStem|crossfadeTo)\(stemId: string/.test(t) || /^startLoops\(\): void/.test(t)
    const callers = Object.entries(src)
      .flatMap(([file, text]) =>
        text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((t) => /\b(startStem|startLoops|crossfadeTo)\(/.test(t) && !isDecl(t))
          .map((t) => `${file.replace('../', '')}: ${t}`),
      )
      .sort()
    expect(callers).toEqual([
      'audio/engine/AudioEngine.ts: for (const stem of loopStems(this.manifest)) this.startStem(stem)',
      'audio/sceneDirector.ts: crossfadeTo(src.stem, { fadeTime: THEME_FADE })',
      'audio/service.ts: engine.crossfadeTo(stemId, opts)',
      'audio/service.ts: engine.startStem(stemId, opts)',
    ])
    // el director solo maneja temaA/temaB como temas y su receta de escenas no menciona ambient
    expect(src['../audio/sceneDirector.ts']).toContain("const THEME_STEMS = ['temaA', 'temaB']")
    expect(src['../audio/sceneDirector.ts']).not.toContain('ambient')
    // y el reloj del host bombea tick cada 250 ms por defecto (§5)
    expect(src['../react/useActivity.ts']).toContain('tickMs = 250')
  })
})

describe('trampa 39 — el audio exige gesto: sin init (desde un gesto) nada suena', () => {
  it('motor recién creado: idle; FX y moods son no-op; init sin load no crea AudioContext', async () => {
    const engine = new AudioEngine()
    expect(engine.getSnapshot().status).toBe('idle')
    expect(() => engine.triggerFx('chime', { volume: 0.9 })).not.toThrow()
    expect(() => engine.setMood('play')).not.toThrow()
    // en Node no existe AudioContext: si init intentara crearlo, esto tiraría ReferenceError
    await expect(engine.init()).resolves.toBeUndefined()
    expect(engine.getSnapshot().contextState).toBeNull()
  })
})
