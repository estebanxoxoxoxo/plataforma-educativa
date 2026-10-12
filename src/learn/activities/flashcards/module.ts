import type { ActivityModule } from '../../activity/index'
import { makeFlashcardsRuntime, SISTEMA_SOLAR, type FlashcardsConfig } from './config'
import { staticFlashcardsGenerator } from './generators'
import { FLASHCARDS_ID, FlashcardsEngine } from './engine'
import type { FlashcardsContent, FlashcardsSnapshot } from './types'

/**
 * PORTERO del Tipo (ACTIVIDADES.md §3): el mazo debe traer cards con id/front/back no
 * vacíos y sin ids repetidos — la garantía determinista sobre cualquier productor
 * (generador `static`, LLM del pipeline de rutas, marketplace, import).
 */
function validateContent(content: unknown): { ok: true } | { ok: false; reason: string } {
  const c = content as FlashcardsContent
  if (!c || typeof c !== 'object' || !Array.isArray(c.cards) || c.cards.length === 0)
    return { ok: false, reason: 'el contenido no tiene forma de FlashcardsContent ({cards[]} no vacío)' }
  const ids = new Set<string>()
  for (const card of c.cards) {
    if (!card?.id || !card.front?.trim() || !card.back?.trim())
      return { ok: false, reason: `tarjeta malformada (id/front/back no vacíos): ${JSON.stringify(card)}` }
    if (ids.has(card.id)) return { ok: false, reason: `id de tarjeta repetido: "${card.id}"` }
    ids.add(card.id)
  }
  return { ok: true }
}

/**
 * Descriptor del TIPO Flashcards (genérico). El host lo lanza con un Ejercicio +
 * runtime idéntico a dominó/quiz: createActivity(flashcardsModule, { content, runtime }).
 * La identidad (mazo/tema) la pone cada DEFINICIÓN (un generador), no el Tipo.
 */
export const flashcardsModule: ActivityModule<FlashcardsConfig, FlashcardsSnapshot, FlashcardsEngine> = {
  id: FLASHCARDS_ID,
  meta: {
    title: 'Flashcards',
    description: 'Mirá el frente, pensá la respuesta, dala vuelta y decí si la sabías. La mecánica del repaso espaciado.',
    ageRange: [8, 12],
    tags: ['memoria', 'repaso', 'active recall'],
  },
  // default solo para descubribilidad; las Definiciones generan su propio mazo
  defaultConfig: {
    content: staticFlashcardsGenerator({ cards: SISTEMA_SOLAR }, 1),
    runtime: makeFlashcardsRuntime('untimed', 120),
  },
  create: (config, ctx) => new FlashcardsEngine(config, ctx),
  validateContent,
}
