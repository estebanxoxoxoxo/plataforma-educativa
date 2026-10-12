/**
 * Provider del DragDropKit. El elemento arrastrado sigue al puntero por
 * transform (sin clon); los drop targets se detectan por hit-test de rects; al
 * soltar sobre uno se dispara su onDrop. Listeners de window → robusto para
 * mouse/touch/pen. La lógica vive acá; los hooks (useDraggable/useDropTarget)
 * en hooks.ts y el contexto en context.ts (Fast Refresh: 1 componente/archivo).
 */
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { DragCtx, type DragApi } from './context'

interface OnDropRef {
  current: (data: unknown) => void
}
interface TargetReg {
  el: HTMLElement
  onDropRef: OnDropRef
}

export function DragDropProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeData, setActiveData] = useState<unknown>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const targets = useRef(new Map<string, TargetReg>())
  const drag = useRef<{ data: unknown; el: HTMLElement; x: number; y: number } | null>(null)
  const overRef = useRef<string | null>(null)

  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    d.el.style.transform = `translate(${e.clientX - d.x}px, ${e.clientY - d.y}px)`
    let over: string | null = null
    for (const [id, t] of targets.current) {
      const r = t.el.getBoundingClientRect()
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        over = id
        break
      }
    }
    if (over !== overRef.current) {
      overRef.current = over
      setOverId(over)
    }
  }, [])

  // pointerup se auto-remueve con { once: true }, así onUp no se referencia a sí mismo
  const onUp = useCallback(() => {
    window.removeEventListener('pointermove', onMove)
    const d = drag.current
    if (d) {
      d.el.style.transform = ''
      d.el.style.transition = ''
      d.el.style.zIndex = ''
      d.el.style.cursor = ''
      if (overRef.current) targets.current.get(overRef.current)?.onDropRef.current(d.data)
    }
    drag.current = null
    overRef.current = null
    setActiveId(null)
    setActiveData(null)
    setOverId(null)
  }, [onMove])

  const begin = useCallback(
    (id: string, data: unknown, el: HTMLElement | null, e: ReactPointerEvent) => {
      if (!el) return
      e.preventDefault()
      drag.current = { data, el, x: e.clientX, y: e.clientY }
      el.style.transition = 'none'
      el.style.zIndex = '1000'
      el.style.cursor = 'grabbing'
      setActiveId(id)
      setActiveData(data)
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp, { once: true })
    },
    [onMove, onUp],
  )

  const register = useCallback((id: string, el: HTMLElement, onDropRef: OnDropRef) => {
    targets.current.set(id, { el, onDropRef })
  }, [])
  const unregister = useCallback((id: string) => {
    targets.current.delete(id)
  }, [])

  const api = useMemo<DragApi>(
    () => ({ activeId, activeData, overId, begin, register, unregister }),
    [activeId, activeData, overId, begin, register, unregister],
  )
  return <DragCtx.Provider value={api}>{children}</DragCtx.Provider>
}
