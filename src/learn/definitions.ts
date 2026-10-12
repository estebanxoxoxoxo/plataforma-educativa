import { TYPES, type AnyHandle, type DefinitionRecipe, type ResolveChild } from './registry'
import type { MultiChild } from './activities/multi'
import { SISTEMA_SOLAR } from './activities/flashcards'

/* Catálogo de DEFINICIONES (ACTIVIDADES.md §2) como DATO PURO: cada Definición es
   un recipe serializable {typeId, generatorId, params, ...} — persistible en Dexie,
   publicable a un marketplace y generable por LLM (el portero del Tipo la gatea al
   acuñar). El acuñado vive en el registry (TYPES[typeId].build); acá solo datos +
   `buildDefinition`. Antes cada entrada era una closure JS: no serializable. */

export type Definition = DefinitionRecipe

function def(
  id: string,
  typeId: DefinitionRecipe['typeId'],
  title: string,
  generatorId: string,
  params: unknown,
  durationSec: number,
): DefinitionRecipe {
  // seed del catálogo: id === target (son campos distintos; acá coinciden por diseño simple)
  return { id, typeId, title, target: id, generatorId, params, mode: 'untimed', durationSec }
}

/** El catálogo (hoy seed en código; mañana también filas en Dexie/marketplace). */
export const DEFINITIONS: Record<string, DefinitionRecipe> = {
  // cálculo mental
  'suma-0-10': def('suma-0-10', 'domino', 'Sumas hasta 10', 'math', { maxValue: 10, ops: ['+'], tileCount: 6 }, 60),
  'sumaresta-0-12': def('sumaresta-0-12', 'domino', 'Sumas y restas', 'math', { maxValue: 12, ops: ['+', '-'], tileCount: 8 }, 75),
  'quiz-tablas': def('quiz-tablas', 'quiz', 'Quiz relámpago', 'math', { questionCount: 8, maxValue: 12, ops: ['+', '-', '×'], optionCount: 4 }, 60),
  'resta-dificil': def('resta-dificil', 'domino', 'Restas difíciles', 'math', { maxValue: 20, ops: ['-'], tileCount: 8 }, 90),
  'desafio-calculo': def('desafio-calculo', 'quiz', 'Desafío final', 'math', { questionCount: 10, maxValue: 12, ops: ['+', '-', '×'], optionCount: 4 }, 75),
  // geografía
  'capitales-latam': def('capitales-latam', 'domino', 'Países y capitales', 'capitales-latam', { count: 8 }, 75),
  'capitales-latam-2': def('capitales-latam-2', 'domino', 'Más capitales', 'capitales-latam', { count: 10 }, 90),
  'geo-repaso': def('geo-repaso', 'quiz', 'Repaso de capitales', 'capitales-latam', { count: 8, optionCount: 4 }, 75),
  // repaso general
  'mezcla-1': def('mezcla-1', 'domino', 'Mezcla 1', 'math', { maxValue: 12, ops: ['+', '-'], tileCount: 8 }, 75),
  'mezcla-2': def('mezcla-2', 'quiz', 'Mezcla 2', 'math', { questionCount: 8, maxValue: 12, ops: ['+', '-'], optionCount: 4 }, 60),
  // flashcards (generador 'static': mazo literal; es lo que route-lab emitirá desde un artículo)
  'flashcards-solar': def('flashcards-solar', 'flashcards', 'Flashcards: Sistema solar', 'static', { cards: SISTEMA_SOLAR }, 120),
  // multi-actividad: secuencia fija de Definiciones del catálogo
  'repaso-mixto': def('repaso-mixto', 'multi', 'Repaso mixto', 'fixed', { childIds: ['suma-0-10', 'geo-repaso', 'sumaresta-0-12'] }, 0),
}

/* Catálogo IMPORTADO (rutas generadas por route-lab): vive en memoria, hidratado
   desde Dexie al boot y al importar. Se lee SÍNCRONO junto al seed → buildDefinition
   sigue siendo síncrono (no rompe el overlay). Ids namespaced (`ruta.<slug>.`) → sin
   colisión con el seed; el seed gana ante empate por las dudas. */
const imported: Record<string, DefinitionRecipe> = {}

export function registerImportedDefinitions(defs: DefinitionRecipe[]): void {
  for (const d of defs) imported[d.id] = d
}
export function clearImportedDefinition(id: string): void {
  delete imported[id]
}
/* PORTE INNERITH (W2): en el POC acá vive `hydrateImportedDefinitions()`, que lee
   `db.learnDefinitions.toArray()` (Dexie) y llama
   `registerImportedDefinitions(rows.map((r) => r.def as DefinitionRecipe))` UNA vez al arrancar.
   En Innerith las definiciones importadas viven en NUESTRO server (desvío forzado (b) del mapa
   00 §4: IndexedDB→server; las persiste el importador de W1 con la forma {id, routeId, target,
   importedAt, def}). La hidratación desde `api` la cableó W3 con EXACTAMENTE esa llamada
   (sections/learn/lib/learnData.ts → loadLearn(): GET /api/learn-routes/definitions →
   `registerImportedDefinitions(defs)`), al ENTRAR a Aprender en vez de al arrancar la app. */

export function definitionFor(id: string): DefinitionRecipe | undefined {
  return DEFINITIONS[id] ?? imported[id]
}

/** Definiciones que entrenan un objetivo dado (para el active recall). Seed ∪ importadas. */
export function definitionsForTarget(target: string): DefinitionRecipe[] {
  return [...Object.values(DEFINITIONS), ...Object.values(imported)].filter((d) => d.target === target)
}

/** Hijo de multi-actividad para una Definición del catálogo (con identidad real). */
const resolveChild: ResolveChild = (definitionId, seed) => {
  const d = definitionFor(definitionId)
  if (!d) return null
  const child: MultiChild = {
    make: () => buildDefinition(d.id, seed),
    typeId: d.typeId,
    title: d.title,
    target: d.target,
    definitionId: d.id,
  }
  return child
}

/**
 * Acuña un Ejercicio NUEVO de la Definición (determinista por seed, gateado por el
 * portero del Tipo) y lo monta como actividad con identidad en el result.
 */
export function buildDefinition(id: string, seed: number): AnyHandle {
  const r = definitionFor(id)
  if (!r) throw new Error(`[learn] definición desconocida: "${id}" (seed: ${Object.keys(DEFINITIONS).join(', ')}; importadas: ${Object.keys(imported).join(', ') || '—'})`)
  return TYPES[r.typeId].build(r, seed, resolveChild)
}
