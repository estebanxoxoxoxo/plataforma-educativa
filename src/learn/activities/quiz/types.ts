import type { CommonSnapshot } from '../../activity/index'

/* Ejercicio del quiz (lo que el Tipo JUEGA): una lista de preguntas YA generadas.
   Genérico — un generador matemático o uno de capitales producen lo mismo. La
   generación vive en generators.ts; el motor solo reproduce este contenido. */

export interface Question {
  id: string
  /** Texto completo de la pregunta, listo para mostrar (ej. "2 + 3 = ?" o "¿Capital de Chile?"). */
  prompt: string
  /** Respuesta correcta (string, así soporta números o palabras). */
  answer: string
  /** Opciones a elegir (incluye la correcta). */
  options: string[]
  /** Skill/objetivo fino para las estadísticas (lo fija el generador). */
  skill: string
}

export interface QuizContent {
  questions: Question[]
}

export interface QuizSnapshot extends CommonSnapshot {
  total: number
  /** Índice de la pregunta actual (0-based). */
  index: number
  current: Question | null
  /** Opciones ya descartadas (intentos fallidos) en la pregunta actual. */
  ruledOut: string[]
}
