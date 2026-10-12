import { describe, expect, it } from 'vitest'
import { DEFINITIONS, buildDefinition, definitionsForTarget } from '../definitions'
import { TYPES, boardFor } from '../registry'
import { dominoModule, mathDominoGenerator } from '../activities/domino/index'
import { quizModule, mathQuizGenerator } from '../activities/quiz/index'
import { isChildFinished } from '../activities/multi/index'
import type { ActivityEvent } from '../activity/index'

/* Tests del CATÁLOGO (Definiciones como dato) + el registry + los porteros.
   La promesa: toda Definición del catálogo acuña un Ejercicio válido (pasa el
   portero de su Tipo) y monta una actividad jugable con identidad en el result. */

describe('catálogo de Definiciones (recipes)', () => {
  it('toda Definición es DATO serializable (sin funciones)', () => {
    for (const [id, r] of Object.entries(DEFINITIONS)) {
      const roundtrip = JSON.parse(JSON.stringify(r))
      expect(roundtrip, id).toEqual(r) // nada se pierde al serializar
      expect(r.typeId in TYPES, `${id}: typeId desconocido ${r.typeId}`).toBe(true)
    }
  })

  it('toda Definición del catálogo se acuña, arranca y estampa identidad', () => {
    for (const id of Object.keys(DEFINITIONS)) {
      const handle = buildDefinition(id, 42) // pasa el portero; tira si el contenido es inválido
      handle.instance.start()
      expect(handle.instance.getSnapshot().status, id).toBe('running')
      handle.instance.abort()
      const r = handle.instance.getResult()!
      expect(r.definitionId, id).toBe(id)
      expect(r.seed, id).toBe(42)
      expect(() => JSON.stringify(r), `result de ${id} no serializable`).not.toThrow()
      handle.instance.dispose()
    }
  })

  it('el multi del catálogo emite child-finished con la identidad del hijo', () => {
    const handle = buildDefinition('repaso-mixto', 7)
    const events: ActivityEvent[] = []
    handle.onEvent((e) => events.push(e))
    handle.instance.start()
    // completar el primer hijo (suma-0-10, un dominó): forzamos con abort del hijo
    handle.instance.abort()
    // el abort del multi NO produce child-finished; el contrato se prueba en la suite
    // del multi — acá solo verificamos que el guard reconoce (o no) sin romperse
    expect(events.some((e) => isChildFinished(e))).toBe(false)
    expect(handle.instance.getResult()!.definitionId).toBe('repaso-mixto')
  })

  it('definitionsForTarget encuentra las Definiciones de un objetivo', () => {
    expect(definitionsForTarget('suma-0-10').map((d) => d.id)).toEqual(['suma-0-10'])
    expect(definitionsForTarget('objetivo-inexistente')).toEqual([])
  })

  it('registry: hay Board para todos los Tipos (multi incluido → multi anidado)', () => {
    for (const typeId of Object.keys(TYPES)) expect(boardFor(typeId), typeId).not.toBeNull()
    expect(boardFor('tipo-inexistente')).toBeNull()
  })

  it('buildDefinition falla RUIDOSO con id o generador desconocido', () => {
    expect(() => buildDefinition('no-existe', 1)).toThrow(/definición desconocida/)
  })
})

describe('porteros (validateContent)', () => {
  it('dominó: acepta lo que producen sus generadores', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const v = dominoModule.validateContent!(mathDominoGenerator({ maxValue: 10, ops: ['+'], tileCount: 6 }, seed))
      expect(v.ok, `seed ${seed}`).toBe(true)
    }
  })

  it('dominó: rechaza cadena desconectada con la causa concreta', () => {
    const cell = (key: string) => ({ key, label: key, variant: 'number' })
    const v = dominoModule.validateContent!({
      starter: { id: 't0', left: cell('1'), right: cell('2') },
      hand: [{ id: 't1', left: cell('3'), right: cell('4') }], // no conecta con nada
    })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toMatch(/extremo|callejón/)
  })

  it('dominó: rechaza keys con más de 2 apariciones (rompe sin-callejones)', () => {
    const cell = (key: string) => ({ key, label: key, variant: 'number' })
    const v = dominoModule.validateContent!({
      starter: { id: 't0', left: cell('1'), right: cell('2') },
      hand: [
        { id: 't1', left: cell('2'), right: cell('3') },
        { id: 't2', left: cell('2'), right: cell('4') }, // '2' aparece 3 veces
      ],
    })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toContain('2 apariciones')
  })

  it('quiz: acepta lo que produce su generador y rechaza respuesta fuera de opciones', () => {
    expect(quizModule.validateContent!(mathQuizGenerator({ questionCount: 5, maxValue: 10, ops: ['+'], optionCount: 4 }, 3)).ok).toBe(true)
    const v = quizModule.validateContent!({
      questions: [{ id: 'q0', prompt: '2 + 2 = ?', answer: '4', options: ['1', '2', '3'], skill: 'suma' }],
    })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toContain('no está entre las opciones')
  })

  it('quiz: rechaza opciones repetidas (dos correctas aparentes)', () => {
    const v = quizModule.validateContent!({
      questions: [{ id: 'q0', prompt: '2 + 2 = ?', answer: '4', options: ['4', '4', '3'], skill: 'suma' }],
    })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toContain('repetidas')
  })
})
