import type { DefinitionRecipe } from './registryCore'
import { registerImportedDefinitions, clearImportedDefinition, buildDefinition } from './definitions'

/* ACUÑADO SECO del importador de rutas — el bloque de smarty-poc app/src/learn/import.ts (importRouteBundle) entre la
   integridad referencial y la persistencia, TAL CUAL: registra las definiciones del bundle en el catálogo en memoria,
   acuña cada una con seed 1 (generador + PORTERO del Tipo, con el MISMO motor que juega el chico) y, si alguna falla,
   deshace el registro y devuelve el error del POC con TODAS las causas juntas.

   PORTE INNERITH (tanda "Deudas técnicas", 14-oct; deuda de W1): en el POC esto corre en el navegador; en Innerith el
   import vive en el SERVER (server/src/learnRoutes.ts: desvío forzado (b) del mapa §4), que llama a esta función. Solo
   carga TS puro (definitions.ts → registryCore.ts → activities/*), nunca los Boards. En el proceso del server el catálogo
   en memoria NO se hidrata al arrancar: no hace falta, porque el acuñado seco solo acuña definiciones del propio bundle
   (recién registradas) y el multi resuelve sus hijas recién al JUGARSE (next() perezoso), nunca al acuñarse — como en el
   POC, un multi con childIds inexistentes pasa el acuñado seco.
   Quirks fieles: una definición del bundle con el MISMO id que una del seed se acuña con la del SEED (definitionFor da
   prioridad al seed) y pasa; el rollback borra del catálogo en memoria también los ids que ya estaban registrados. */

/** null = el bundle pasa el acuñado seco; si no, el texto EXACTO del POC:
 *  "La app rechaza el bundle (acuñado seco falló):\n- <defId>: <causa>" (una línea por definición que falló). */
export function dryMint(definitions: DefinitionRecipe[]): string | null {
  // registrar en memoria PRIMERO (para que un multi resuelva sus hijas al acuñar)
  registerImportedDefinitions(definitions)

  // ACUÑADO SECO: acuñar cada Definición con seed fijo; el portero del Tipo la gatea.
  const failures: string[] = []
  for (const d of definitions) {
    try {
      buildDefinition(d.id, 1)
    } catch (e) {
      failures.push(`${d.id}: ${(e as Error).message}`)
    }
  }
  if (failures.length) {
    for (const d of definitions) clearImportedDefinition(d.id) // rollback en memoria
    return `La app rechaza el bundle (acuñado seco falló):\n- ${failures.join('\n- ')}`
  }
  return null
}
