import type { ActivityHandle, ActivityInstance, CommonSnapshot } from '../../activity/index'

/* Contenido del Tipo Multi-actividad: una secuencia de HIJOS. Cada hijo trae su
   propio constructor (make), su Tipo (typeId, para elegir la vista) y, opcional, su
   objetivo (target, para grabar el sub-resultado en active recall). El multi no
   sabe generar: recibe los hijos ya resueltos (los arma el catálogo, §2). */

export interface MultiChild {
  /** Construye una Instancia jugable del hijo (seed/params ya resueltos). */
  make: () => ActivityHandle<ActivityInstance<CommonSnapshot>>
  /** Tipo del hijo (la vista del multi lo usa para renderizar el tablero correcto). */
  typeId: string
  title?: string
  /** Objetivo que entrena (para atribuir el sub-resultado; lo usa el recall). */
  target?: string
  /** Definición que acuñó este hijo (identidad REAL del sub-resultado; no usar el
   *  target como definitionId: hoy coinciden de casualidad, son campos distintos). */
  definitionId?: string
}

export interface MultiSnapshot extends CommonSnapshot {
  childIndex: number
  /** Cantidad de hijos si es acotado; null = endless (scroll infinito). */
  total: number | null
  childTitle: string | null
  childTypeId: string | null
}
