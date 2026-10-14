import { describe, expect, it } from 'vitest'
import { dryMint } from '../dryMint'
import { definitionFor } from '../definitions'
import type { DefinitionRecipe } from '../registryCore'
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

  it('un bundle sano pasa (flashcards + opción múltiple + multi) y sus definiciones quedan registradas', () => {
    const defs = [
      fc('t.sano.fc', [{ id: 'c1', front: 'Júpiter', back: 'el más grande' }, { id: 'c2', front: 'Marte', back: 'el rojo' }]),
      mc('t.sano.mc', [goodQ]),
      { id: 't.sano.multi', typeId: 'multi', title: 'multi', target: 't.sano.multi', generatorId: 'fixed',
        params: { childIds: ['t.sano.fc', 't.sano.mc'] }, mode: 'untimed', durationSec: 0 } as DefinitionRecipe,
    ]
    expect(dryMint(defs)).toBeNull()
    expect(definitionFor('t.sano.fc')?.typeId).toBe('flashcards')
    expect(definitionFor('t.sano.multi')?.typeId).toBe('multi')
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
