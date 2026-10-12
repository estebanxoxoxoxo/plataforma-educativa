/**
 * Emisor pub/sub mínimo y tipado. La actividad emite por acá; los adaptadores
 * (audio, telemetría, el panel de log del demo) se suscriben. Deliberadamente
 * sin dependencias para poder reusarlo en cualquier lab.
 */

export type Listener<T> = (value: T) => void

export class Emitter<T> {
  private listeners = new Set<Listener<T>>()

  emit = (value: T): void => {
    // copia defensiva: un listener puede desuscribirse durante el despacho.
    // try/catch POR listener: este bus lo comparten efectos (audio/visual) y
    // persistencia — un consumidor que tire no puede cortar a los siguientes.
    for (const listener of [...this.listeners]) {
      try {
        listener(value)
      } catch (err) {
        console.error('[activity] un listener de eventos tiró; se continúa con el resto:', err)
      }
    }
  }

  subscribe = (listener: Listener<T>): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  clear = (): void => {
    this.listeners.clear()
  }
}
