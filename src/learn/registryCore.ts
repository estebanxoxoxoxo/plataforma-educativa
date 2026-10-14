import { createActivity, type ActivityHandle, type ActivityInstance, type ActivityMode, type CommonSnapshot } from './activity'
import { dominoModule, mathDominoGenerator, equivalenceDominoGenerator, makeRuntime, PAIS_CAPITAL, type DominoContent, type MathDominoParams } from './activities/domino'
import { quizModule, mathQuizGenerator, factQuizGenerator, makeQuizRuntime, type QuizContent, type MathQuizParams, type FactQuizParams } from './activities/quiz'
import { multiModule, makeMultiRuntime, type MultiChild } from './activities/multi'
import { flashcardsModule, staticFlashcardsGenerator, makeFlashcardsRuntime, type FlashcardsContent, type StaticFlashcardsParams } from './activities/flashcards'
import { multipleChoiceModule, staticMultipleChoiceGenerator, makeMultipleChoiceRuntime, type MultipleChoiceContent, type StaticMultipleChoiceParams } from './activities/multiplechoice'

/* NÚCLEO del REGISTRY de Tipos (smarty-poc app/src/learn/registry.ts) SIN los tableros: typeId → { module, build }.
   PORTE INNERITH (deuda de W1, tanda "Deudas técnicas" 14-oct): el registry del POC ata en UN objeto mecánica (module),
   vista (Board) y acuñado (build). Los Boards son .tsx con CSS, así que el SERVER no podía cargarlo y el import de rutas
   no hacía el ACUÑADO SECO completo (generador + portero). Se partió en dos sin cambiar una línea de lógica:
     · ESTE archivo = todo lo que no es vista: el DefinitionRecipe, los generadores registrados por Tipo, el portero
       (`gate`) y el `build` de cada Tipo — código idéntico al del registry del POC. TS puro: lo importan el cliente y
       el server (server/src/learnRoutes.ts, vía definitions.ts + dryMint.ts).
     · `registry.ts` = este núcleo + los Boards (TYPES = { ...núcleo, Board }), con la MISMA forma y el mismo orden de
       claves que el registry del POC: sus consumidores no cambian.
   Un Tipo nuevo = su carpeta en activities/ + UNA entrada acá + su Board en registry.ts (si falta, registry.ts no
   compila: `satisfies Record<ActivityTypeId, …>`). ActivityTypeId se DERIVA de las claves de este núcleo.

   Los GENERADORES también se registran acá por id → una Definición es DATO puro
   ({generatorId, params}) y puede persistirse/publicarse (ver definitions.ts). */

/**
 * DEFINICIÓN como DATO (ACTIVIDADES.md §2: "dato/config catalogable"): serializable
 * de punta a punta — persistible en Dexie, publicable a un marketplace, generable
 * por LLM (gateada por el portero del Tipo al acuñar).
 */
export interface DefinitionRecipe {
  id: string
  typeId: ActivityTypeId
  title: string
  /** Objetivo de aprendizaje que entrena (clave de maestría/repaso, §6). */
  target: string
  /** Generador registrado del Tipo que acuña el Ejercicio. */
  generatorId: string
  /** Parámetros del generador — dato plano serializable. */
  params: unknown
  mode: ActivityMode
  durationSec: number
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnyHandle = ActivityHandle<ActivityInstance<CommonSnapshot>>
/** Resuelve una Definición hija (la provee el catálogo; evita el ciclo registry↔definitions). */
export type ResolveChild = (definitionId: string, seed: number) => MultiChild | null

export interface CoreTypeEntry {
  module: { id: string; validateContent?: (content: unknown) => { ok: true } | { ok: false; reason: string } }
  /** Acuña el Ejercicio del recipe (pasa el portero) y lo monta con identidad. */
  build: (recipe: DefinitionRecipe, seed: number, resolveChild: ResolveChild) => AnyHandle
}

/** Corre el portero del Tipo; si el contenido no cumple, falla con la causa concreta. */
function gate<C>(entry: { id: string; validateContent?: CoreTypeEntry['module']['validateContent'] }, content: C): C {
  const v = entry.validateContent?.(content)
  if (v && !v.ok) throw new Error(`[learn] contenido inválido para el Tipo "${entry.id}": ${v.reason}`)
  return content
}

// --- generadores registrados por Tipo (el dataset es parte del registro; los params quedan dato) ---
const DOMINO_GENERATORS: Record<string, (params: any, seed: number) => DominoContent> = {
  math: (p: MathDominoParams, s) => mathDominoGenerator(p, s),
  'capitales-latam': (p: { count: number }, s) => equivalenceDominoGenerator(PAIS_CAPITAL, p, s),
}
const QUIZ_GENERATORS: Record<string, (params: any, seed: number) => QuizContent> = {
  math: (p: MathQuizParams, s) => mathQuizGenerator(p, s),
  'capitales-latam': (p: FactQuizParams, s) => factQuizGenerator(PAIS_CAPITAL, p, s),
}
const FLASHCARDS_GENERATORS: Record<string, (params: any, seed: number) => FlashcardsContent> = {
  // 'static': el mazo llega LITERAL en params (lo emite route-lab); el seed baraja el orden
  static: (p: StaticFlashcardsParams, s) => staticFlashcardsGenerator(p, s),
}
const MULTIPLECHOICE_GENERATORS: Record<string, (params: any, seed: number) => MultipleChoiceContent> = {
  // 'static': las preguntas llegan LITERALES en params (lo emite route-lab); el seed baraja el orden
  static: (p: StaticMultipleChoiceParams, s) => staticMultipleChoiceGenerator(p, s),
}

function generatorOf<C>(generators: Record<string, (params: any, seed: number) => C>, typeId: string, generatorId: string) {
  const gen = generators[generatorId]
  if (!gen) throw new Error(`[learn] generador desconocido "${generatorId}" para el Tipo "${typeId}" (hay: ${Object.keys(generators).join(', ')})`)
  return gen
}

export const CORE_TYPES = {
  domino: {
    module: dominoModule,
    build: (r, seed) => {
      const content = gate(dominoModule, generatorOf(DOMINO_GENERATORS, 'domino', r.generatorId)(r.params, seed))
      return createActivity(dominoModule, { content, runtime: makeRuntime(r.mode, r.durationSec) }, { identity: { definitionId: r.id, seed } }) as AnyHandle
    },
  },
  quiz: {
    module: quizModule,
    build: (r, seed) => {
      const content = gate(quizModule, generatorOf(QUIZ_GENERATORS, 'quiz', r.generatorId)(r.params, seed))
      return createActivity(quizModule, { content, runtime: makeQuizRuntime(r.mode, r.durationSec) }, { identity: { definitionId: r.id, seed } }) as AnyHandle
    },
  },
  flashcards: {
    module: flashcardsModule,
    build: (r, seed) => {
      const content = gate(flashcardsModule, generatorOf(FLASHCARDS_GENERATORS, 'flashcards', r.generatorId)(r.params, seed))
      return createActivity(flashcardsModule, { content, runtime: makeFlashcardsRuntime(r.mode, r.durationSec) }, { identity: { definitionId: r.id, seed } }) as AnyHandle
    },
  },
  multiplechoice: {
    module: multipleChoiceModule,
    build: (r, seed) => {
      const content = gate(multipleChoiceModule, generatorOf(MULTIPLECHOICE_GENERATORS, 'multiplechoice', r.generatorId)(r.params, seed))
      return createActivity(multipleChoiceModule, { content, runtime: makeMultipleChoiceRuntime(r.mode, r.durationSec) }, { identity: { definitionId: r.id, seed } }) as AnyHandle
    },
  },
  multi: {
    module: multiModule,
    // generatorId 'fixed': params = { childIds } → secuencia fija de Definiciones del catálogo
    build: (r, seed, resolveChild) => {
      const p = r.params as { childIds: string[] }
      if (!Array.isArray(p?.childIds) || p.childIds.length === 0)
        throw new Error(`[learn] multi "${r.id}" sin childIds en params`)
      return createActivity(
        multiModule,
        {
          total: p.childIds.length,
          runtime: makeMultiRuntime(r.mode, r.durationSec),
          next: (i) => {
            const id = p.childIds[i]
            return id ? resolveChild(id, seed + i + 1) : null
          },
        },
        { identity: { definitionId: r.id, seed } },
      ) as AnyHandle
    },
  },
} satisfies Record<string, CoreTypeEntry>
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Derivado de las claves del registry — la unión ya no se escribe a mano. */
export type ActivityTypeId = keyof typeof CORE_TYPES
