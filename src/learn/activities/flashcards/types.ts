import type { CommonSnapshot } from '../../activity/index'

/* Ejercicio de flashcards (lo que el Tipo JUEGA): un mazo de tarjetas YA armado.
   SIN distractores — por eso flashcards es el objetivo de generación más barato que
   existe: un fact de un artículo mapea directo a una Card (definición → término/def;
   relación → a/b; numérico → pregunta/valor). La generación vive en generators.ts. */

export interface Card {
  id: string
  /** Lo que se pregunta / el término (cara visible antes de dar vuelta). */
  front: string
  /** La respuesta a recordar (cara oculta hasta revelar). */
  back: string
  /** Skill/objetivo fino para las estadísticas y el active recall (lo fija el generador). */
  skill: string
  /** Pista opcional que se muestra en el frente antes de dar vuelta. */
  hint?: string
}

export interface FlashcardsContent {
  cards: Card[]
}

export interface FlashcardsSnapshot extends CommonSnapshot {
  total: number
  /** Índice de la tarjeta actual (0-based). */
  index: number
  current: Card | null
  /** ¿Ya se dio vuelta la tarjeta actual? (mostrar el reverso + botones de calificar). */
  revealed: boolean
}
