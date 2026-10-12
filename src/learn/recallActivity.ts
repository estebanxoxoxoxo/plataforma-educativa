/* eslint-disable @typescript-eslint/no-explicit-any */
import { createActivity, type ActivityHandle } from './activity'
import { multiModule, makeMultiRuntime, type MultiChild } from './activities/multi'
import { buildDefinition, definitionsForTarget } from './definitions'

/* Active recall — armado de la actividad (ACTIVIDADES.md §7). Toma los objetivos
   DUE (lib/recall, urgencia = fallas + espaciado) y los convierte en un Tipo
   Multi-actividad ENDLESS: cicla los objetivos regenerando un Ejercicio NUEVO de la
   Definición de cada uno (misma skill, números/datos distintos). Scroll infinito:
   se repasa todo el tiempo que se quiera. Cada sub-resultado lo graba el overlay a
   SU objetivo (child-finished) → repasar mueve las postas reales. */

/* PORTE INNERITH (W2): este archivo porta EL ARMADOR del multi de recall (`buildRecallActivity`
   + sus helpers), que es motor puro. `recallableTargets(rows, now, opts)` del POC NO va acá todavía:
   depende de `dueTargets` (lib/recall: la urgencia 0.6·(1−lastPct) + 0.4·min(1, Δt/3 días)) y de
   las filas de `activityResults` (que W3 pasa a nuestro server). Lo porta W4 junto con lib/recall,
   tal cual el POC:
     export function recallableTargets(rows: ActivityResultRow[], now: number, opts?: DueOptions): string[] {
       return dueTargets(rows, now, opts)
         .map((d) => d.target)
         .filter((t) => leafDef(t) != null)
     }
*/

/** La Definición leaf (no-multi) que entrena un objetivo, si existe. */
function leafDef(target: string) {
  return definitionsForTarget(target).find((d) => d.typeId !== 'multi')
}

function recallChildFor(target: string, seed: number): MultiChild | null {
  const d = leafDef(target)
  if (!d) return null
  return { make: () => buildDefinition(d.id, seed), typeId: d.typeId, title: d.title, target: d.target, definitionId: d.id }
}

/** Multi de active recall sobre los objetivos due (orden de urgencia). Sin `count` =
 *  ENDLESS (cicla sin fin, raíz cross-ruta); con `count` = ACOTADO a K (posta in-route). */
export function buildRecallActivity(targetsInOrder: string[], seed: number, opts?: { count?: number }): ActivityHandle<any> {
  const order = targetsInOrder.filter((t) => leafDef(t) != null)
  const count = opts?.count
  return createActivity(multiModule, {
    runtime: makeMultiRuntime('untimed', 0),
    total: count, // definido = acotado (barra "de N"); undefined = endless
    next: (i) => {
      if (order.length === 0) return null
      if (count != null && i >= count) return null
      return recallChildFor(order[i % order.length], seed + i + 1)
    },
  })
}
/* eslint-enable @typescript-eslint/no-explicit-any */
