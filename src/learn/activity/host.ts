/**
 * `createActivity` es EL punto de entrada genérico: dado un módulo + su config,
 * arma el contexto (con su bus de eventos y su reloj) y devuelve la instancia
 * lista para jugar más un `onEvent` para suscribir consumidores (audio,
 * telemetría, log). Cualquier invocador —un tool del chat, una sección del menú,
 * After Day, una tarjeta embebida, o un test— lanza la actividad siempre así, y
 * obtiene de vuelta el `ActivityResult` persistible al terminar.
 */

import { Emitter, type Listener } from './events'
import type {
  ActivityContext,
  ActivityEvent,
  ActivityIdentity,
  ActivityInstance,
  ActivityModule,
  CommonSnapshot,
} from './types'

export interface ActivityHandle<Instance> {
  instance: Instance
  /** Suscribe a los eventos semánticos de la partida; devuelve unsubscribe. */
  onEvent: (listener: Listener<ActivityEvent>) => () => void
}

export interface CreateActivityOptions {
  /** Reloj inyectable (tests deterministas). Default: Date.now. */
  now?: () => number
  /** Identidad de la Instancia (definitionId/seed) → se estampa en el result. */
  identity?: ActivityIdentity
}

export function createActivity<
  Config,
  Snapshot extends CommonSnapshot,
  Instance extends ActivityInstance<Snapshot>,
>(
  module: ActivityModule<Config, Snapshot, Instance>,
  config: Config,
  options: CreateActivityOptions = {},
): ActivityHandle<Instance> {
  const events = new Emitter<ActivityEvent>()
  const ctx: ActivityContext = {
    emit: events.emit,
    now: options.now ?? (() => Date.now()),
    identity: options.identity,
  }
  const instance = module.create(config, ctx)
  return { instance, onEvent: events.subscribe }
}
