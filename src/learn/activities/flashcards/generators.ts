/**
 * Generadores de contenido para el TIPO Flashcards. Hoy uno solo: `static` — el mazo
 * llega LITERAL en los params (lo emite la etapa `generate` del pipeline de rutas de
 * route-lab desde los facts de un artículo). El seed sólo BARAJA el orden: regenerar con
 * otro seed = mismo set de cards en distinto orden, exactamente lo que el repaso
 * espaciado necesita. Igual que dominó/quiz: el motor no genera, el generador sí.
 */
import { mulberry32, shuffle } from '../../activity/index'
import type { Card, FlashcardsContent } from './types'

export interface StaticFlashcardsParams {
  /** El mazo literal (dato serializable). */
  cards: Card[]
}

/** Generador `static`: pasa el mazo literal barajado por seed (sin distractores). */
export function staticFlashcardsGenerator(params: StaticFlashcardsParams, seed: number): FlashcardsContent {
  const cards = Array.isArray(params?.cards) ? params.cards : []
  return { cards: shuffle(cards, mulberry32(seed)) }
}
