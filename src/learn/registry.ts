import { createElement, type ComponentType, type ReactElement } from 'react'
import { CORE_TYPES, type ActivityTypeId, type CoreTypeEntry } from './registryCore'
import DominoBoard from './DominoBoard'
import QuizBoard from './QuizBoard'
import MultiBoard from './MultiBoard'
import FlashcardsBoard from './FlashcardsBoard'
import MultipleChoiceBoard from './MultipleChoiceBoard'

/* REGISTRY ÚNICO de Tipos: typeId → { module, Board, build }. La ÚNICA fuente de
   verdad que ata mecánica (module), vista (Board) y acuñado de Ejercicios (build,
   con el PORTERO del Tipo y la identidad en el result). Un Tipo nuevo = su carpeta
   en activities/ + UNA entrada acá; ActivityTypeId se DERIVA de las claves (nada
   que olvidar en otros archivos). Los `any` del borde vista↔engine viven SOLO acá.

   Los GENERADORES también se registran acá por id → una Definición es DATO puro
   ({generatorId, params}) y puede persistirse/publicarse (ver definitions.ts).

   PORTE INNERITH (tanda "Deudas técnicas", 14-oct): mecánica + generadores + portero + build viven en
   `registryCore.ts` (TS puro: lo carga también el SERVER para el acuñado seco del import de rutas); acá se les suman
   los Boards. TYPES conserva la forma ({ module, Board, build }) y el orden de claves del registry del POC. */

export type { DefinitionRecipe, AnyHandle, ResolveChild, ActivityTypeId } from './registryCore'

/* eslint-disable @typescript-eslint/no-explicit-any */
interface TypeEntry extends CoreTypeEntry {
  Board: ComponentType<{ engine: any }>
}

export const TYPES = {
  domino: { ...CORE_TYPES.domino, Board: DominoBoard as ComponentType<{ engine: any }> },
  quiz: { ...CORE_TYPES.quiz, Board: QuizBoard as ComponentType<{ engine: any }> },
  flashcards: { ...CORE_TYPES.flashcards, Board: FlashcardsBoard as ComponentType<{ engine: any }> },
  multiplechoice: { ...CORE_TYPES.multiplechoice, Board: MultipleChoiceBoard as ComponentType<{ engine: any }> },
  multi: { ...CORE_TYPES.multi, Board: MultiBoard as ComponentType<{ engine: any }> },
} satisfies Record<ActivityTypeId, TypeEntry>
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Tablero para un typeId (multi incluido → multi anidado renderiza gratis). */
export function boardFor(typeId: string): ComponentType<{ engine: unknown }> | null {
  return (TYPES as Record<string, TypeEntry>)[typeId]?.Board ?? null
}

/** Renderiza el tablero de un typeId. Los Boards del registry son referencias
 *  estables de módulo (no se crean en render, aunque el lint no pueda saberlo). */
export function renderBoard(typeId: string, engine: unknown): ReactElement | null {
  const Board = boardFor(typeId)
  return Board ? createElement(Board, { engine }) : null
}
