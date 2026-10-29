/**
 * Generadores de contenido para el TIPO Quiz. Cada uno produce un `QuizContent`
 * (un Ejercicio) que el MISMO motor juega. Igual que el dominó: el motor no
 * genera, los generadores sí. Hoy dos: matemático y capitales.
 */
import { mulberry32, shuffle } from '../../activity/index'
import { SCALED_PARAM_MAX } from '../../scaledParams'
import type { EquivPair } from '../domino/index'
import type { Question, QuizContent } from './types'

export type Operation = '+' | '-' | '×'

export function evalOp(a: number, op: Operation, b: number): number {
  switch (op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '×':
      return a * b
  }
}

function skillOf(op: Operation): string {
  return op === '+' ? 'suma' : op === '-' ? 'resta' : 'multiplicacion'
}

export interface MathQuizParams {
  /** Cantidad de preguntas (= aciertos para ganar). */
  questionCount: number
  /** Operando máximo. */
  maxValue: number
  /** Operaciones permitidas. */
  ops: Operation[]
  /** Opciones por pregunta (incluye la correcta). */
  optionCount: number
}

function makeMathQuestion(id: string, params: MathQuizParams, rng: () => number): Question {
  const { maxValue, ops, optionCount } = params
  const op = ops[Math.floor(rng() * ops.length)]
  let a = Math.floor(rng() * (maxValue + 1))
  let b = Math.floor(rng() * (maxValue + 1))
  if (op === '-' && b > a) [a, b] = [b, a] // sin resultados negativos
  const answer = evalOp(a, op, b)

  // distractores cercanos, no negativos, únicos y distintos de la respuesta
  const options = new Set<number>([answer])
  const deltas = [1, -1, 2, -2, 3, -3, 10, -10, a, b]
  let di = 0
  while (options.size < optionCount && di < 200) {
    const cand = di < deltas.length ? answer + deltas[di] : answer + (Math.floor(rng() * 11) - 5)
    di++
    if (cand >= 0 && cand !== answer) options.add(cand)
  }
  // por si no se llenó (rango muy chico), completa hacia arriba
  // FIX-MINT (desvío del POC, defensa en profundidad): con TOPE de vueltas, como el de arriba (di < 200). Sin él, una
  // respuesta NaN —`ops` vacío o con un operador desconocido: evalOp devuelve undefined— no llenaba nunca el Set (NaN ya
  // está: add(NaN) no lo agranda) y el while giraba PARA SIEMPRE (el acuñado seco colgaba el server al 100% de CPU, con
  // params en rango); un optionCount enorme eran millones de vueltas. Con optionCount en rango (≤ 12) el tope no se alcanza
  // nunca: el resultado es el del POC. Si se alcanza, la pregunta sale corta y el portero del Tipo decide.
  let up = answer + 1
  let ui = 0
  while (options.size < optionCount && ui++ < 200) options.add(up++)

  return {
    id,
    prompt: `${a} ${op} ${b} = ?`,
    answer: String(answer),
    options: shuffle([...options].map(String), rng),
    skill: skillOf(op),
  }
}

/** Quiz MATEMÁTICO (determinista por seed): cuentas de opción múltiple. */
export function mathQuizGenerator(params: MathQuizParams, seed: number): QuizContent {
  const rng = mulberry32(seed)
  // FIX-MINT: questionCount con tope duro (SCALED_PARAM_MAX; dentro del tope, idéntico al POC)
  const questions = Array.from({ length: Math.min(Math.max(1, params.questionCount), SCALED_PARAM_MAX.questionCount) }, (_, i) =>
    makeMathQuestion(`q${i}`, params, rng),
  )
  return { questions }
}

export interface FactQuizParams {
  /** Cantidad de preguntas. */
  count: number
  /** Opciones por pregunta (incluye la correcta). */
  optionCount: number
}

/**
 * Quiz de EQUIVALENCIAS (mismo motor): "¿Capital de X?" → elegir el miembro `b`.
 * Reusa el dataset país↔capital del dominó; los distractores salen de las otras
 * capitales del set. Determinista por seed.
 */
export function factQuizGenerator(pairs: EquivPair[], params: FactQuizParams, seed: number): QuizContent {
  const rng = mulberry32(seed)
  const count = Math.max(1, Math.min(params.count, pairs.length))
  const chosen = shuffle(pairs, rng).slice(0, count)
  const allAnswers = pairs.map((p) => p.b)
  const questions = chosen.map((p, i) => {
    const options = new Set<string>([p.b])
    const pool = shuffle(
      allAnswers.filter((x) => x !== p.b),
      rng,
    )
    let j = 0
    while (options.size < params.optionCount && j < pool.length) options.add(pool[j++])
    return {
      id: `q${i}`,
      prompt: `¿Capital de ${p.a}?`,
      answer: p.b,
      options: shuffle([...options], rng),
      skill: p.tag ?? 'capitales',
    }
  })
  return { questions }
}
