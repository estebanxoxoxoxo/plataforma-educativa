import type { ActivityModule } from '../../activity/index'
import { makeMultiRuntime, type MultiConfig } from './config'
import { MULTI_ID, MultiEngine } from './engine'
import type { MultiSnapshot } from './types'

/**
 * Descriptor del TIPO Multi-actividad. El host lo lanza igual que cualquier otro:
 * createActivity(multiModule, { next, total, runtime }). Las Definiciones arman su
 * propia secuencia de hijos (§2/§7).
 */
export const multiModule: ActivityModule<MultiConfig, MultiSnapshot, MultiEngine> = {
  id: MULTI_ID,
  meta: {
    title: 'Multi-actividad',
    description: 'Una secuencia de ejercicios jugada como una sola actividad.',
    ageRange: [9, 12],
    tags: ['multi', 'secuencia'],
  },
  // default vacío (solo descubribilidad); las Definiciones proveen su secuencia
  defaultConfig: { next: () => null, total: 0, runtime: makeMultiRuntime('untimed', 0) },
  create: (config, ctx) => new MultiEngine(config, ctx),
}
