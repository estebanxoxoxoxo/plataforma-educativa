import type { ActivityModule } from '../../activity/index'
import { DEMO_MC, makeMultipleChoiceRuntime, type MultipleChoiceConfig } from './config'
import { staticMultipleChoiceGenerator } from './generators'
import { MC_ID, MultipleChoiceEngine } from './engine'
import type { MultipleChoiceContent, MultipleChoiceSnapshot } from './types'

/**
 * PORTERO del Tipo (ACTIVIDADES.md §3): la garantía determinista sobre cualquier productor
 * (generador `static`, LLM del pipeline de rutas, marketplace, import). Valida la FORMA de las
 * preguntas; el veredicto de corrección lo da luego el motor (crédito parcial), no el portero.
 */
function validateContent(content: unknown): { ok: true } | { ok: false; reason: string } {
  const c = content as MultipleChoiceContent
  if (!c || typeof c !== 'object' || !Array.isArray(c.questions) || c.questions.length === 0)
    return { ok: false, reason: 'el contenido no tiene forma de MultipleChoiceContent ({questions[]} no vacío)' }
  const qids = new Set<string>()
  for (const q of c.questions) {
    if (!q?.id || !q.prompt?.trim() || !Array.isArray(q.options))
      return { ok: false, reason: `pregunta malformada (id/prompt/options): ${JSON.stringify(q)}` }
    if (qids.has(q.id)) return { ok: false, reason: `id de pregunta repetido: "${q.id}"` }
    qids.add(q.id)
    if (q.mode !== 'single' && q.mode !== 'multi')
      return { ok: false, reason: `modo inválido en ${q.id} (debe ser 'single' o 'multi'): ${JSON.stringify(q.mode)}` }
    if (q.options.length < 2)
      return { ok: false, reason: `menos de 2 opciones en ${q.id} ("${q.prompt}")` }
    const oids = new Set<string>()
    for (const o of q.options) {
      if (!o?.id || !o.text?.trim() || typeof o.correct !== 'boolean')
        return { ok: false, reason: `opción malformada en ${q.id} (id/text/correct): ${JSON.stringify(o)}` }
      if (oids.has(o.id)) return { ok: false, reason: `id de opción repetido en ${q.id}: "${o.id}"` }
      oids.add(o.id)
    }
    if (new Set(q.options.map((o) => o.text.trim().toLowerCase())).size !== q.options.length)
      return { ok: false, reason: `opciones con texto repetido en ${q.id} ("${q.prompt}")` }
    // 'single' exige exactamente una correcta; 'multi' admite 0..N (0 = la respuesta es "Ninguna").
    const nCorrect = q.options.filter((o) => o.correct).length
    if (q.mode === 'single' && nCorrect !== 1)
      return { ok: false, reason: `en modo 'single' debe haber exactamente 1 correcta (${q.id} tiene ${nCorrect})` }
  }
  return { ok: true }
}

/**
 * Descriptor del TIPO Multiple Choice (genérico). El host lo lanza con un Ejercicio + runtime
 * idéntico a quiz/flashcards: createActivity(multipleChoiceModule, { content, runtime }).
 * La identidad (preguntas/tema) la pone cada DEFINICIÓN (un generador), no el Tipo.
 */
export const multipleChoiceModule: ActivityModule<MultipleChoiceConfig, MultipleChoiceSnapshot, MultipleChoiceEngine> = {
  id: MC_ID,
  meta: {
    title: 'Opción múltiple',
    description: 'Leé la pregunta, elegí tu respuesta (una o varias) y comprobá. Las cards se dan vuelta y te muestran cómo te fue.',
    ageRange: [8, 12],
    tags: ['opción múltiple', 'comprensión', 'quiz'],
  },
  // default sólo para descubribilidad; las Definiciones generan su propio set
  defaultConfig: {
    content: staticMultipleChoiceGenerator({ questions: DEMO_MC }, 1),
    runtime: makeMultipleChoiceRuntime('untimed', 120),
  },
  create: (config, ctx) => new MultipleChoiceEngine(config, ctx),
  validateContent,
}
