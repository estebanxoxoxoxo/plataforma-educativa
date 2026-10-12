import type { ActivityModule } from '../../activity/index'
import { makeQuizRuntime, MATH_PRESETS, type QuizConfig } from './config'
import { mathQuizGenerator } from './generators'
import { QUIZ_ID, QuizEngine } from './engine'
import type { QuizContent, QuizSnapshot } from './types'

/**
 * PORTERO del Tipo (ACTIVIDADES.md §3): cada pregunta debe tener UNA sola
 * correcta presente entre opciones únicas — la garantía determinista sobre
 * cualquier productor (generador propio, LLM, marketplace).
 */
function validateContent(content: unknown): { ok: true } | { ok: false; reason: string } {
  const c = content as QuizContent
  if (!c || typeof c !== 'object' || !Array.isArray(c.questions) || c.questions.length === 0)
    return { ok: false, reason: 'el contenido no tiene forma de QuizContent ({questions[]} no vacío)' }
  for (const q of c.questions) {
    if (!q?.id || !q.prompt || q.answer == null || !Array.isArray(q.options))
      return { ok: false, reason: `pregunta malformada (id/prompt/answer/options): ${JSON.stringify(q)}` }
    if (!q.options.includes(q.answer))
      return { ok: false, reason: `la respuesta correcta no está entre las opciones (${q.id}: "${q.prompt}" → "${q.answer}")` }
    if (new Set(q.options).size !== q.options.length)
      return { ok: false, reason: `opciones repetidas en ${q.id} ("${q.prompt}"): ${q.options.join(' | ')}` }
    if (q.options.length < 2)
      return { ok: false, reason: `menos de 2 opciones en ${q.id} ("${q.prompt}")` }
  }
  return { ok: true }
}

/**
 * Descriptor del TIPO Quiz (genérico). El host lo lanza con un Ejercicio +
 * runtime: createActivity(quizModule, { content, runtime }). La identidad
 * (tema/preguntas) la pone cada DEFINICIÓN (un generador), no el Tipo.
 */
export const quizModule: ActivityModule<QuizConfig, QuizSnapshot, QuizEngine> = {
  id: QUIZ_ID,
  meta: {
    title: 'Quiz relámpago',
    description: 'Elegí la respuesta correcta entre varias opciones.',
    ageRange: [9, 12],
    tags: ['quiz', 'opción múltiple'],
  },
  // default solo para descubribilidad; las Definiciones generan su propio contenido
  defaultConfig: {
    content: mathQuizGenerator(MATH_PRESETS[1].math, 1),
    runtime: makeQuizRuntime('untimed', MATH_PRESETS[1].durationSec),
  },
  create: (config, ctx) => new QuizEngine(config, ctx),
  validateContent,
}
