export { flashcardsModule } from './module'
export { FlashcardsEngine, FLASHCARDS_ID, FLASHCARDS_VERSION } from './engine'
export { staticFlashcardsGenerator, type StaticFlashcardsParams } from './generators'
export {
  SISTEMA_SOLAR,
  ANIMALES,
  DEMO_DECKS,
  TIME_BONUS_MAX,
  makeFlashcardsRuntime,
  resolveScore,
  resolveDurationMs,
  type FlashcardsConfig,
  type FlashcardsRuntime,
  type FlashcardsMode,
} from './config'
export type { Card, FlashcardsContent, FlashcardsSnapshot } from './types'
