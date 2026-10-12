/**
 * Generadores de contenido para el TIPO Multiple Choice. Hoy uno solo: `static` — las
 * preguntas llegan LITERALES en los params (lo emite route-lab desde los facts de un
 * artículo/video). El seed sólo BARAJA el orden de preguntas y de opciones: regenerar con
 * otro seed = mismo set en distinto orden (lo que el repaso espaciado necesita). Igual que
 * flashcards/quiz: el motor no genera, el generador sí.
 */
import { mulberry32, shuffle } from '../../activity/index'
import type { MCQuestion, MultipleChoiceContent } from './types'

export interface StaticMultipleChoiceParams {
  /** Las preguntas literales (dato serializable). */
  questions: MCQuestion[]
}

/** Generador `static`: baraja preguntas Y opciones por seed, sin tocar el contenido. */
export function staticMultipleChoiceGenerator(params: StaticMultipleChoiceParams, seed: number): MultipleChoiceContent {
  const rng = mulberry32(seed)
  const src = Array.isArray(params?.questions) ? params.questions : []
  const questions = shuffle([...src], rng).map((q) => ({
    ...q,
    options: shuffle([...q.options], rng),
  }))
  return { questions }
}
