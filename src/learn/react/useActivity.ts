import { useEffect, useSyncExternalStore } from 'react'
import type { ActivityInstance, CommonSnapshot } from '../activity/index'

/**
 * Lee el snapshot de una actividad (mismo patrón external-store que
 * useAudioEngine). Solo lectura: el reloj lo bombea `useActivityClock`, que el
 * host monta UNA sola vez, así varios componentes pueden leer el snapshot sin
 * disparar ticks duplicados.
 */
export function useActivitySnapshot<S extends CommonSnapshot>(instance: ActivityInstance<S>): S {
  return useSyncExternalStore(instance.subscribe, instance.getSnapshot)
}

/**
 * Bombea `tick()` mientras la actividad corre (contrarreloj + refresco del
 * elapsed mostrado). El intervalo se rearma según el status: pausar lo detiene,
 * reanudar lo retoma. Montar una sola vez por instancia.
 */
export function useActivityClock(instance: ActivityInstance<CommonSnapshot>, tickMs = 250): void {
  const status = useSyncExternalStore(instance.subscribe, () => instance.getSnapshot().status)
  useEffect(() => {
    if (status !== 'running') return
    const id = setInterval(() => instance.tick(), tickMs)
    return () => clearInterval(id)
  }, [instance, status, tickMs])
}
