import type { CommonSnapshot } from '../../activity/index'

/* Ejercicio del multiple choice (lo que el Tipo JUEGA): preguntas YA armadas. Genérico —
   un generador `static` (lo emite route-lab desde los facts de un artículo/video) produce
   esto literal. El motor sólo lo reproduce; la generación vive en generators.ts. */

/** Modo de una pregunta: una sola correcta (radio) o varias posibles (checkbox + crédito parcial). */
export type MCMode = 'single' | 'multi'

export interface MCOption {
  id: string
  /** Texto de la opción, listo para mostrar. */
  text: string
  /** ¿Es una respuesta correcta? (en 'single' hay exactamente una; en 'multi', 0..N). */
  correct: boolean
}

export interface MCQuestion {
  id: string
  /** Enunciado completo, listo para mostrar en grande. */
  prompt: string
  mode: MCMode
  /** Opciones a elegir. Las cards fijas "Todas"/"Ninguna" NO viven acá: son atajos de UI. */
  options: MCOption[]
  /** Skill/objetivo fino para las estadísticas y el active recall (lo fija el generador). */
  skill: string
}

export interface MultipleChoiceContent {
  questions: MCQuestion[]
}

export interface MultipleChoiceSnapshot extends CommonSnapshot {
  total: number
  /** Índice de la pregunta actual (0-based). */
  index: number
  current: MCQuestion | null
  mode: MCMode
  /** Ids de opciones marcadas (antes de confirmar). */
  selected: string[]
  /** ¿El chico ya interactuó? Habilita "Comprobar" en múltiple (donde "Ninguna" = 0 marcadas). */
  touched: boolean
  /** ¿Ya confirmó (OK)? → mostrar el flip con el resultado. */
  committed: boolean
  /** Fracción 0..1 lograda en la pregunta ya confirmada (null hasta confirmar). */
  fraction: number | null
}
