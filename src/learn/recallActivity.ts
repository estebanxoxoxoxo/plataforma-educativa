/* eslint-disable @typescript-eslint/no-explicit-any */
import { createActivity, type ActivityHandle } from './activity'
import { multiModule, makeMultiRuntime, type MultiChild } from './activities/multi'
import { buildDefinition, definitionsForTarget } from './definitions'
import { dueTargets, type DueOptions } from './recall'
import type { ActivityResultRow } from '../api/types'

/* Active recall — armado de la actividad (ACTIVIDADES.md §7). Toma los objetivos
   DUE (lib/recall, urgencia = fallas + espaciado) y los convierte en un Tipo
   Multi-actividad ENDLESS: cicla los objetivos regenerando un Ejercicio NUEVO de la
   Definición de cada uno (misma skill, números/datos distintos). Scroll infinito:
   se repasa todo el tiempo que se quiera. Cada sub-resultado lo graba el overlay a
   SU objetivo (child-finished) → repasar mueve las postas reales. */

/* PORTE INNERITH: W2 portó el ARMADOR del multi (`buildRecallActivity`); W4 suma `recallableTargets` tal cual el POC
   (sobre `dueTargets` de ./recall, el port de lib/recall). Único cambio: las filas son las de NUESTRO server
   (`ActivityResultRow` de src/api/types.ts, misma forma que la fila de Dexie). */

/** La Definición leaf (no-multi) que entrena un objetivo, si existe. */
function leafDef(target: string) {
  return definitionsForTarget(target).find((d) => d.typeId !== 'multi')
}

function recallChildFor(target: string, seed: number): MultiChild | null {
  const d = leafDef(target)
  if (!d) return null
  return { make: () => buildDefinition(d.id, seed), typeId: d.typeId, title: d.title, target: d.target, definitionId: d.id }
}

/** Objetivos repasables (ya vistos + con Definición leaf), ordenados por urgencia.
 *  `opts.scope` acota a los objetivos de UNA ruta (recall in-route, 3c). */
export function recallableTargets(rows: ActivityResultRow[], now: number, opts?: DueOptions): string[] {
  return dueTargets(rows, now, opts)
    .map((d) => d.target)
    .filter((t) => leafDef(t) != null)
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
