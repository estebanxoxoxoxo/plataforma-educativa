import { describe, expect, it } from 'vitest'
import { createActivity, type ActivityEvent } from '../../../activity/index'
import {
  multipleChoiceModule,
  staticMultipleChoiceGenerator,
  makeMultipleChoiceRuntime,
  scoreQuestion,
  DEMO_MC,
  QUESTION_POINTS,
  TIME_BONUS_MAX,
  type MCQuestion,
  type MultipleChoiceConfig,
} from '../index'

/* PORTE INNERITH (W2) — suite NUEVA: el POC no tiene tests de opción múltiple. Fija el
   comportamiento EXACTO del motor portado (informe 02 §6): envío diferido, crédito parcial
   (single binario; multi clamp((aciertos−errores)/correctas); sin correctas → 1 solo si no marcó
   nada), puntaje PLANO round(fracción·10), fracción>0 emite move:correct, atajos Todas/Ninguna
   solo en multi, señal `answered` emitida, portero y generador `static`. No cambia runtime. */

const clock = () => 0

// --- preguntas de prueba (ids de opción fijos para razonar sin barajar) ---
const SINGLE: MCQuestion = {
  id: 'q-single',
  mode: 'single',
  skill: 's.single',
  prompt: '¿Cuál es el planeta más grande?',
  options: [
    { id: 'a', text: 'Júpiter', correct: true },
    { id: 'b', text: 'Saturno', correct: false },
    { id: 'c', text: 'Marte', correct: false },
  ],
}
const MULTI: MCQuestion = {
  id: 'q-multi',
  mode: 'multi',
  skill: 's.multi',
  prompt: '¿Cuáles son gigantes gaseosos?',
  options: [
    { id: 'a', text: 'Júpiter', correct: true },
    { id: 'b', text: 'Saturno', correct: true },
    { id: 'c', text: 'Mercurio', correct: false },
    { id: 'd', text: 'la Tierra', correct: false },
  ],
}
const MULTI_NONE: MCQuestion = {
  id: 'q-none',
  mode: 'multi',
  skill: 's.none',
  prompt: '¿Cuáles son estrellas?',
  options: [
    { id: 'a', text: 'Marte', correct: false },
    { id: 'b', text: 'la Luna', correct: false },
  ],
}

/** Actividad SIN barajar (content literal) para poder elegir por id. */
function activity(questions: MCQuestion[]) {
  const config: MultipleChoiceConfig = { content: { questions }, runtime: makeMultipleChoiceRuntime('untimed', 120) }
  const handle = createActivity(multipleChoiceModule, config, { now: clock })
  const events: ActivityEvent[] = []
  handle.onEvent((e) => events.push(e))
  return { ...handle, events }
}

describe('scoreQuestion — crédito parcial (exacto)', () => {
  it('single: binario (1 solo si marcó EXACTAMENTE la correcta)', () => {
    expect(scoreQuestion(SINGLE, ['a'])).toBe(1)
    expect(scoreQuestion(SINGLE, ['b'])).toBe(0)
    expect(scoreQuestion(SINGLE, [])).toBe(0)
    expect(scoreQuestion(SINGLE, ['a', 'b'])).toBe(0) // dos marcadas ≠ exactamente una
  })

  it('multi: clamp((aciertos − errores) / correctas, 0, 1)', () => {
    expect(scoreQuestion(MULTI, ['a', 'b'])).toBe(1)
    expect(scoreQuestion(MULTI, ['a'])).toBe(0.5)
    expect(scoreQuestion(MULTI, ['a', 'c'])).toBe(0) // 1 − 1 = 0
    expect(scoreQuestion(MULTI, ['a', 'b', 'c'])).toBe(0.5) // (2 − 1) / 2
    expect(scoreQuestion(MULTI, ['c', 'd'])).toBe(0) // negativo → recortado a 0
    expect(scoreQuestion(MULTI, [])).toBe(0)
  })

  it('multi: "Todas" o "Ninguna" al voleo NO regalan puntos (se cancelan)', () => {
    expect(scoreQuestion(MULTI, ['a', 'b', 'c', 'd'])).toBe(0) // (2 − 2) / 2
    expect(scoreQuestion(MULTI, [])).toBe(0)
  })

  it('multi sin correctas: 1 SOLO si no marcó nada', () => {
    expect(scoreQuestion(MULTI_NONE, [])).toBe(1)
    expect(scoreQuestion(MULTI_NONE, ['a'])).toBe(0)
  })
})

describe('MultipleChoiceEngine — envío diferido', () => {
  it('elegir NO corrige: ni puntaje, ni stats, ni eventos de jugada hasta "Comprobar"', () => {
    const { instance, events } = activity([SINGLE])
    instance.start()
    instance.toggle('a')
    const s = instance.getSnapshot()
    expect(s.selected).toEqual(['a'])
    expect(s.committed).toBe(false)
    expect(s.fraction).toBeNull()
    expect(s.score).toBe(0)
    expect(s.stats).toEqual({ correct: 0, wrong: 0, hintsUsed: 0, bestStreak: 0 })
    expect(events.map((e) => e.kind)).toEqual(['started'])
  })

  it('single actúa como radio: marcar otra reemplaza; re-tocar la marcada la desmarca', () => {
    const { instance } = activity([SINGLE])
    instance.start()
    instance.toggle('a')
    instance.toggle('b')
    expect(instance.getSnapshot().selected).toEqual(['b'])
    instance.toggle('b')
    expect(instance.getSnapshot().selected).toEqual([])
    expect(instance.getSnapshot().touched).toBe(true)
  })

  it('canCommit: single exige exactamente 1; multi alcanza con haber interactuado (Ninguna = 0 marcadas)', () => {
    const s = activity([SINGLE])
    s.instance.start()
    expect(s.instance.canCommit()).toBe(false)
    s.instance.toggle('a')
    expect(s.instance.canCommit()).toBe(true)

    const m = activity([MULTI])
    m.instance.start()
    expect(m.instance.canCommit()).toBe(false) // sin interactuar
    m.instance.toggle('a')
    m.instance.toggle('a') // marcar y desmarcar = interactuó
    expect(m.instance.getSnapshot().selected).toEqual([])
    expect(m.instance.canCommit()).toBe(true)
  })

  it('commit sin poder confirmar no hace nada; tocar opciones tras confirmar tampoco', () => {
    const { instance, events } = activity([SINGLE])
    instance.start()
    instance.commit() // nada marcado
    expect(instance.getSnapshot().committed).toBe(false)
    instance.toggle('a')
    instance.commit()
    expect(instance.getSnapshot().committed).toBe(true)
    instance.toggle('b') // ya confirmó → ignorado
    expect(instance.getSnapshot().selected).toEqual(['a'])
    instance.commit() // doble commit → ignorado
    expect(events.filter((e) => e.kind === 'move:correct').length).toBe(1)
  })

  it('next solo avanza tras confirmar, limpia la selección y termina al pasar la última', () => {
    const { instance } = activity([SINGLE, MULTI])
    instance.start()
    instance.next() // sin confirmar → nada
    expect(instance.getSnapshot().index).toBe(0)
    instance.toggle('a')
    instance.commit()
    instance.next()
    let s = instance.getSnapshot()
    expect(s.index).toBe(1)
    expect(s.selected).toEqual([])
    expect(s.touched).toBe(false)
    expect(s.committed).toBe(false)
    expect(s.fraction).toBeNull()
    expect(s.mode).toBe('multi')
    instance.selectAll()
    instance.commit()
    instance.next()
    s = instance.getSnapshot()
    expect(s.status).toBe('finished')
    expect(instance.getResult()!.outcome).toBe('completed')
  })
})

describe('MultipleChoiceEngine — puntaje PLANO y eventos', () => {
  it('maxScore = nPreguntas × 10 (sin bono de racha) y score = Σ round(fracción·10)', () => {
    expect(QUESTION_POINTS).toBe(10)
    const { instance } = activity([SINGLE, MULTI, MULTI_NONE])
    expect(instance.getSnapshot().maxScore).toBe(30)
    instance.start()
    instance.toggle('a') // single correcta → 10
    instance.commit()
    instance.next()
    instance.toggle('a') // multi 1 de 2 → round(0.5·10) = 5
    instance.commit()
    expect(instance.getSnapshot().fraction).toBe(0.5)
    instance.next()
    instance.clear() // "Ninguna" sobre una sin correctas → 10
    instance.commit()
    instance.next()
    const r = instance.getResult()!
    expect(r.score).toBe(25)
    expect(r.maxScore).toBe(30)
    // stats: acierto PLENO solo con fracción ≥ 1 (el parcial cuenta como wrong en el motor)
    expect(r.stats.correct).toBe(2)
    expect(r.stats.wrong).toBe(1)
    expect(r.skills).toEqual({
      's.single': { attempts: 1, correct: 1 },
      's.multi': { attempts: 1, correct: 0 },
      's.none': { attempts: 1, correct: 1 },
    })
  })

  it('fracción > 0 emite move:correct con points = round(fracción·10); fracción 0 emite move:wrong', () => {
    const { instance, events } = activity([MULTI, SINGLE])
    instance.start()
    instance.toggle('a') // parcial 0.5
    instance.commit()
    instance.next()
    instance.toggle('b') // incorrecta
    instance.commit()
    const moves = events.filter((e) => e.kind === 'move:correct' || e.kind === 'move:wrong')
    expect(moves).toEqual([
      // el parcial NO es acierto pleno → la racha del core quedó en 0 y viaja así en el evento
      { kind: 'move:correct', points: 5, streak: 0, skill: 's.multi' },
      { kind: 'move:wrong', skill: 's.single' },
    ])
  })

  it('aciertos plenos seguidos: el evento lleva la racha creciente, pero el puntaje sigue PLANO', () => {
    const q2: MCQuestion = { ...SINGLE, id: 'q2' }
    const q3: MCQuestion = { ...SINGLE, id: 'q3' }
    const { instance, events } = activity([SINGLE, q2, q3])
    instance.start()
    for (let i = 0; i < 3; i++) {
      instance.toggle('a')
      instance.commit()
      instance.next()
    }
    const pts = events.flatMap((e) => (e.kind === 'move:correct' ? [[e.points, e.streak]] : []))
    expect(pts).toEqual([[10, 1], [10, 2], [10, 3]])
    expect(instance.getResult()!.score).toBe(30)
    expect(instance.getResult()!.stats.bestStreak).toBe(3)
  })

  it('emite la señal libre `answered` {questionId, fraction, mode} en cada confirmación', () => {
    const { instance, events } = activity([MULTI, SINGLE])
    instance.start()
    instance.toggle('a')
    instance.commit()
    instance.next()
    instance.toggle('a')
    instance.commit()
    const answered = events.filter((e) => e.kind === 'signal' && e.ns === 'multiplechoice' && e.type === 'answered')
    expect(answered.map((e) => (e as { data: unknown }).data)).toEqual([
      { questionId: 'q-multi', fraction: 0.5, mode: 'multi' },
      { questionId: 'q-single', fraction: 1, mode: 'single' },
    ])
  })

  it('orden de eventos de una confirmación: move → signal answered', () => {
    const { instance, events } = activity([SINGLE])
    instance.start()
    instance.toggle('a')
    instance.commit()
    instance.next()
    expect(events.map((e) => (e.kind === 'signal' ? `signal:${e.type}` : e.kind))).toEqual([
      'started',
      'move:correct',
      'signal:answered',
      'finished',
    ])
  })

  it('result: activityId "multiplechoice", version 1, sin bono de tiempo (untimed) y serializable', () => {
    const { instance } = activity([SINGLE])
    instance.start()
    instance.toggle('a')
    instance.commit()
    instance.next()
    const r = instance.getResult()!
    expect(r.activityId).toBe('multiplechoice')
    expect(r.version).toBe(1)
    expect(r.score).toBe(10)
    expect(() => JSON.stringify(r)).not.toThrow()
    expect(TIME_BONUS_MAX).toBe(100) // solo aplicaría en 'timed' (ninguna definición lo usa)
  })
})

describe('MultipleChoiceEngine — atajos Todas/Ninguna (solo multi)', () => {
  it('en multi: "Todas" marca todas; "Ninguna" limpia y deja confirmar', () => {
    const { instance } = activity([MULTI])
    instance.start()
    instance.selectAll()
    expect([...instance.getSnapshot().selected].sort()).toEqual(['a', 'b', 'c', 'd'])
    instance.clear()
    const s = instance.getSnapshot()
    expect(s.selected).toEqual([])
    expect(s.touched).toBe(true)
    expect(instance.canCommit()).toBe(true)
  })

  it('en single los atajos NO hacen nada (ni tocan "touched")', () => {
    const { instance } = activity([SINGLE])
    instance.start()
    instance.selectAll()
    instance.clear()
    const s = instance.getSnapshot()
    expect(s.selected).toEqual([])
    expect(s.touched).toBe(false)
  })

  it('"Todas" en una multi de 2 correctas sobre 4 → fracción 0 → move:wrong', () => {
    const { instance, events } = activity([MULTI])
    instance.start()
    instance.selectAll()
    instance.commit()
    expect(instance.getSnapshot().fraction).toBe(0)
    expect(events.some((e) => e.kind === 'move:wrong')).toBe(true)
  })
})

describe('MultipleChoiceEngine — ciclo de vida', () => {
  it('sin running (idle / pausado / terminado) las acciones se ignoran', () => {
    const { instance } = activity([SINGLE])
    instance.toggle('a') // idle
    expect(instance.getSnapshot().selected).toEqual([])
    instance.start()
    instance.pause()
    instance.toggle('a') // pausado
    expect(instance.getSnapshot().selected).toEqual([])
    instance.resume()
    instance.toggle('a')
    instance.abort()
    instance.commit() // terminado
    expect(instance.getSnapshot().committed).toBe(false)
    expect(instance.getResult()!.outcome).toBe('aborted')
  })

  it('toggle de un id inexistente se ignora', () => {
    const { instance } = activity([SINGLE])
    instance.start()
    instance.toggle('zzz')
    expect(instance.getSnapshot().selected).toEqual([])
    expect(instance.getSnapshot().touched).toBe(false)
  })
})

describe('generador `static` (baraja preguntas Y opciones por seed)', () => {
  it('mismo set de preguntas y de opciones, determinista por seed', () => {
    const a = staticMultipleChoiceGenerator({ questions: DEMO_MC }, 1)
    const b = staticMultipleChoiceGenerator({ questions: DEMO_MC }, 2)
    expect(staticMultipleChoiceGenerator({ questions: DEMO_MC }, 1)).toEqual(a) // determinista
    expect(a.questions.map((q) => q.id).sort()).toEqual(DEMO_MC.map((q) => q.id).sort())
    expect(b.questions.map((q) => q.id).sort()).toEqual(DEMO_MC.map((q) => q.id).sort())
    for (const q of a.questions) {
      const orig = DEMO_MC.find((o) => o.id === q.id)!
      expect([...q.options].sort((x, y) => x.id.localeCompare(y.id))).toEqual(orig.options) // mismas opciones
      expect(q.prompt).toBe(orig.prompt)
      expect(q.mode).toBe(orig.mode)
    }
  })

  it('con alguna seed el orden cambia (baraja de verdad) y nunca muta los params', () => {
    const before = JSON.stringify(DEMO_MC)
    const orders = new Set<string>()
    for (let seed = 1; seed <= 20; seed++) {
      const c = staticMultipleChoiceGenerator({ questions: DEMO_MC }, seed)
      orders.add(c.questions.map((q) => q.id + ':' + q.options.map((o) => o.id).join('')).join('|'))
    }
    expect(orders.size).toBeGreaterThan(1)
    expect(JSON.stringify(DEMO_MC)).toBe(before)
  })

  it('params sin questions → contenido vacío (que el portero rechaza)', () => {
    const c = staticMultipleChoiceGenerator({} as never, 1)
    expect(c).toEqual({ questions: [] })
    expect(multipleChoiceModule.validateContent!(c).ok).toBe(false)
  })
})

describe('portero (validateContent)', () => {
  const v = (content: unknown) => multipleChoiceModule.validateContent!(content)
  const reason = (content: unknown) => {
    const r = v(content)
    return r.ok ? null : r.reason
  }

  it('acepta lo que produce su generador para varias seeds', () => {
    for (let seed = 1; seed <= 20; seed++) expect(v(staticMultipleChoiceGenerator({ questions: DEMO_MC }, seed)).ok).toBe(true)
  })

  it('rechaza con la CAUSA concreta (mismos textos que el POC)', () => {
    expect(reason({ questions: [] })).toContain('no tiene forma de MultipleChoiceContent')
    expect(reason({ questions: [{ ...SINGLE, prompt: '  ' }] })).toContain('pregunta malformada')
    expect(reason({ questions: [SINGLE, SINGLE] })).toContain('id de pregunta repetido: "q-single"')
    expect(reason({ questions: [{ ...SINGLE, mode: 'abierta' }] })).toContain("modo inválido en q-single (debe ser 'single' o 'multi')")
    expect(reason({ questions: [{ ...SINGLE, options: [SINGLE.options[0]] }] })).toContain('menos de 2 opciones en q-single')
    expect(reason({ questions: [{ ...SINGLE, options: [{ id: 'a', text: 'x', correct: 'si' }, SINGLE.options[1]] }] })).toContain('opción malformada en q-single')
    expect(reason({ questions: [{ ...SINGLE, options: [SINGLE.options[0], { ...SINGLE.options[1], id: 'a' }] }] })).toContain('id de opción repetido en q-single: "a"')
    // textos únicos case-insensitive (y con trim)
    expect(reason({ questions: [{ ...SINGLE, options: [SINGLE.options[0], { id: 'b', text: ' JÚPITER ', correct: false }] }] })).toContain('opciones con texto repetido en q-single')
    // single: exactamente 1 correcta
    expect(reason({ questions: [{ ...SINGLE, options: SINGLE.options.map((o) => ({ ...o, correct: true })) }] })).toContain("en modo 'single' debe haber exactamente 1 correcta (q-single tiene 3)")
    expect(reason({ questions: [{ ...SINGLE, options: SINGLE.options.map((o) => ({ ...o, correct: false })) }] })).toContain('(q-single tiene 0)')
  })

  it("multi admite 0..N correctas (0 = la respuesta es 'Ninguna')", () => {
    expect(v({ questions: [MULTI_NONE] }).ok).toBe(true)
    expect(v({ questions: [{ ...MULTI, options: MULTI.options.map((o) => ({ ...o, correct: true })) }] }).ok).toBe(true)
  })
})
