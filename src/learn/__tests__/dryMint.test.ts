import { describe, expect, it } from 'vitest'
import { dryMint } from '../dryMint'
import { definitionFor } from '../definitions'
import type { DefinitionRecipe } from '../registryCore'
import { mathQuizGenerator } from '../activities/quiz/generators'
import { mathDominoGenerator } from '../activities/domino/generators'
import { SCALED_PARAM_MAX } from '../scaledParams'
import seedRaw from '../../../server/seeds/poc-solar.route-bundle.json?raw'

/* ACUÑADO SECO del import de rutas (tanda "Deudas técnicas", 14-oct; deuda de W1). Es el bloque de
   smarty-poc app/src/learn/import.ts que el SERVER corre al importar (server/src/learnRoutes.ts) con el motor del
   cliente: estos casos fijan el texto exacto del rechazo, la causa del PORTERO, el rollback en memoria y que la seed
   real (poc-solar) y un bundle sano pasan. */

const PREFIX = 'La app rechaza el bundle (acuñado seco falló):\n- '

const fc = (id: string, cards: unknown[]): DefinitionRecipe =>
  ({ id, typeId: 'flashcards', title: id, target: id, generatorId: 'static', params: { cards }, mode: 'untimed', durationSec: 60 })
const mc = (id: string, questions: unknown[]): DefinitionRecipe =>
  ({ id, typeId: 'multiplechoice', title: id, target: id, generatorId: 'static', params: { questions }, mode: 'untimed', durationSec: 60 })
const goodQ = { id: 'q1', prompt: '¿Cuál es el planeta más grande?', mode: 'single', options: [
  { id: 'a', text: 'Júpiter', correct: true }, { id: 'b', text: 'Marte', correct: false }] }

describe('acuñado seco del import (dryMint)', () => {
  it('la seed real (poc-solar) pasa entera', () => {
    const bundle = JSON.parse(seedRaw) as { definitions: DefinitionRecipe[] }
    expect(bundle.definitions.length).toBeGreaterThan(0)
    expect(dryMint(bundle.definitions)).toBeNull()
  })

  it('un bundle sano pasa (flashcards + opción múltiple + multi) y NO deja nada registrado (FS-BASE-A: sin fuga en el server)', () => {
    const defs = [
      fc('t.sano.fc', [{ id: 'c1', front: 'Júpiter', back: 'el más grande' }, { id: 'c2', front: 'Marte', back: 'el rojo' }]),
      mc('t.sano.mc', [goodQ]),
      { id: 't.sano.multi', typeId: 'multi', title: 'multi', target: 't.sano.multi', generatorId: 'fixed',
        params: { childIds: ['t.sano.fc', 't.sano.mc'] }, mode: 'untimed', durationSec: 0 } as DefinitionRecipe,
    ]
    expect(dryMint(defs)).toBeNull()
    // FS-BASE-A: el acuñado seco no deja estado en el catálogo en memoria del proceso (antes quedaban para siempre)
    expect(definitionFor('t.sano.fc')).toBeUndefined()
    expect(definitionFor('t.sano.mc')).toBeUndefined()
    expect(definitionFor('t.sano.multi')).toBeUndefined()
  })

  it('una tarjeta sin back se rechaza con la causa del PORTERO y el texto exacto del POC', () => {
    const bad = { id: 'c2', front: '¿Qué planeta tiene anillos?' }
    const err = dryMint([fc('t.malo.fc', [{ id: 'c1', front: 'Júpiter', back: 'el más grande' }, bad])])
    expect(err).toBe(`${PREFIX}t.malo.fc: [learn] contenido inválido para el Tipo "flashcards": tarjeta malformada (id/front/back no vacíos): ${JSON.stringify(bad)}`)
  })

  it('junta TODAS las causas (una línea por definición) y deshace el registro en memoria', () => {
    const err = dryMint([
      fc('t.roll.ok', [{ id: 'c1', front: 'a', back: 'b' }]),
      fc('t.roll.vacio', []),
      mc('t.roll.mc', [{ ...goodQ, options: [{ id: 'a', text: 'Júpiter', correct: true }] }]),
      { ...fc('t.roll.gen', []), generatorId: 'nope' },
      { ...fc('t.roll.tipo', []), typeId: 'trivia' as DefinitionRecipe['typeId'] },
      { id: 't.roll.multi', typeId: 'multi', title: 'm', target: 'm', generatorId: 'fixed', params: { childIds: [] }, mode: 'untimed', durationSec: 0 },
    ])
    expect(err).toBe(PREFIX + [
      't.roll.vacio: [learn] contenido inválido para el Tipo "flashcards": el contenido no tiene forma de FlashcardsContent ({cards[]} no vacío)',
      `t.roll.mc: [learn] contenido inválido para el Tipo "multiplechoice": menos de 2 opciones en q1 ("${goodQ.prompt}")`,
      't.roll.gen: [learn] generador desconocido "nope" para el Tipo "flashcards" (hay: static)',
      "t.roll.tipo: Cannot read properties of undefined (reading 'build')",
      't.roll.multi: [learn] multi "t.roll.multi" sin childIds en params',
    ].join('\n- '))
    // rollback: ninguna del bundle queda en el catálogo en memoria (tampoco la que sí pasaba)
    expect(definitionFor('t.roll.ok')).toBeUndefined()
    expect(definitionFor('t.roll.vacio')).toBeUndefined()
  })

  it('quirks fieles: un multi con hijas inexistentes pasa (se resuelven al jugar) y un id del seed se acuña con el SEED', () => {
    expect(dryMint([{ id: 't.multi.fantasma', typeId: 'multi', title: 'm', target: 'm', generatorId: 'fixed',
      params: { childIds: ['no-existe'] }, mode: 'untimed', durationSec: 0 }])).toBeNull()
    expect(dryMint([fc('suma-0-10', [])])).toBeNull()
  })
})

/* FIX-MINT (hallazgo ALTA de QA-SEGURIDAD; defensa en profundidad de los generadores que corre el acuñado seco del SERVER):
   ningún param hace que un loop o una alocación crezcan sin cota. La cota real es la del importador (learnRoutes.ts
   checkBounds); estos topes son el respaldo por si algo llega por otro camino. */
describe('FIX-MINT: los generadores tienen tope (el acuñado seco no cuelga ni explota)', () => {
  const quiz = (params: unknown): DefinitionRecipe =>
    ({ id: 't.fm.quiz', typeId: 'quiz', title: 'q', target: 't', generatorId: 'math', params, mode: 'untimed', durationSec: 60 })

  it('el 2º while de los distractores tiene tope de vueltas: `ops` vacío (respuesta NaN) ya no lo deja girando para siempre', () => {
    // optionCount que CUENTA cada comparación `options.size < optionCount` (y corta si no hay tope): sin el arreglo, con la
    // respuesta NaN el Set no crecía nunca y el while giraba para siempre al 100% de CPU (el server colgado, params en rango).
    let cmp = 0
    const optionCount = { valueOf: () => { if (++cmp > 5_000) throw new Error('el while de los distractores no tiene tope'); return 4 } }
    for (const ops of [[], ['/']]) {
      cmp = 0
      expect(() => mathQuizGenerator({ questionCount: 1, maxValue: 5, ops: ops as never, optionCount: optionCount as never }, 1)).not.toThrow()
      expect(cmp).toBeLessThanOrEqual(402) // ≤ 200 + 200 vueltas (+ la comparación que corta cada while)
    }
    // y por el camino del server: termina (sin colgar) y lo decide el portero
    cmp = 0
    dryMint([quiz({ questionCount: 1, maxValue: 5, ops: [], optionCount })])
    expect(cmp).toBeLessThanOrEqual(402)
  })

  it('un optionCount enorme ya no son millones de vueltas por pregunta', () => {
    const { questions } = mathQuizGenerator({ questionCount: 2, maxValue: 5, ops: ['+'], optionCount: 1_000_000 }, 1)
    for (const q of questions) expect(q.options.length).toBeLessThanOrEqual(401)
  })

  it('questionCount, maxValue y tileCount con tope duro (SCALED_PARAM_MAX), aunque lleguen enormes o como texto', () => {
    expect(mathQuizGenerator({ questionCount: 10_000, maxValue: 5, ops: ['+'], optionCount: 4 }, 1).questions.length).toBe(SCALED_PARAM_MAX.questionCount)
    expect(mathQuizGenerator({ questionCount: '10000' as never, maxValue: 5, ops: ['+'], optionCount: 4 }, 1).questions.length).toBe(SCALED_PARAM_MAX.questionCount)
    const big = mathDominoGenerator({ maxValue: 5_000, ops: ['+', '-'], tileCount: 500 }, 1)
    const tiles = [big.starter, ...big.hand]
    expect(tiles.length).toBe(SCALED_PARAM_MAX.tileCount)
    for (const t of tiles) for (const cell of [t.left, t.right]) expect(Number(cell.key)).toBeLessThanOrEqual(SCALED_PARAM_MAX.maxValue)
    // la repro del QA con "5000000" (`+ 1` lo CONCATENABA → Array de 50.000.001: ~3,5 s de event loop bloqueado; con
    // "200000000", OOM) ahora termina enseguida y pasa el portero
    const t0 = Date.now()
    expect(dryMint([{ ...quiz({ maxValue: '5000000', ops: ['+'], tileCount: 10 }), id: 't.fm.domino', typeId: 'domino' }])).toBeNull()
    expect(Date.now() - t0).toBeLessThan(1000)
  })

  it('en el borde del tope el contenido es EXACTAMENTE el del POC (salida del generador del POC, sin topes, con el mismo seed)', () => {
    expect(mathDominoGenerator({ maxValue: 1000, ops: ['+', '-'], tileCount: 3 }, 7)).toEqual({
      starter: { id: 't1', left: { key: '561', label: '484 + 77', variant: 'expr', tag: 'suma' }, right: { key: '214', label: '214', variant: 'number' } },
      hand: [
        { id: 't0', left: { key: '929', label: '556 + 373', variant: 'expr', tag: 'suma' }, right: { key: '561', label: '561', variant: 'number' } },
        { id: 't2', left: { key: '214', label: '526 - 312', variant: 'expr', tag: 'resta' }, right: { key: '548', label: '548', variant: 'number' } },
      ],
    })
    expect(mathQuizGenerator({ questionCount: 1, maxValue: 1000, ops: ['+', '-', '×'], optionCount: 12 }, 7)).toEqual({ questions: [{
      id: 'q0', prompt: '62 + 977 = ?', answer: '1039', skill: 'suma',
      options: ['2016', '1036', '1049', '1039', '1037', '1035', '1029', '1038', '1041', '1040', '1042', '1101'],
    }] })
  })
})
