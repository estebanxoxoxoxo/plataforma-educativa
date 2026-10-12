import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useDragApi } from './context'

/**
 * Marca un elemento como arrastrable. `data` viaja al onDrop del target.
 * Usa callback-ref + handler (sin leer refs en render) para cumplir las reglas
 * de hooks. `data`/`id` se capturan en el handler (siempre el valor actual).
 */
export function useDraggable(id: string, data: unknown) {
  const { activeId, begin } = useDragApi()
  const elRef = useRef<HTMLDivElement | null>(null)
  const setRef = useCallback((el: HTMLDivElement | null) => {
    elRef.current = el
  }, [])
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    begin(id, data, elRef.current, e)
  }
  return { setRef, onPointerDown, isDragging: activeId === id }
}

/** Marca un elemento como zona de drop. `onDrop` recibe el `data` del arrastrado. */
export function useDropTarget(id: string, onDrop: (data: unknown) => void) {
  const { overId, activeId, activeData, register, unregister } = useDragApi()
  const onDropRef = useRef(onDrop)
  useEffect(() => {
    onDropRef.current = onDrop // se mantiene fresco sin re-registrar el elemento
  })
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) register(id, el, onDropRef)
      else unregister(id)
    },
    [register, unregister, id],
  )
  return { setRef, isOver: overId === id, activeData, dragging: activeId != null }
}
