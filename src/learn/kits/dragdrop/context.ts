import { createContext, useContext, type PointerEvent as ReactPointerEvent } from 'react'

export interface DragApi {
  activeId: string | null
  activeData: unknown
  overId: string | null
  begin: (id: string, data: unknown, el: HTMLElement | null, e: ReactPointerEvent) => void
  register: (id: string, el: HTMLElement, onDropRef: { current: (data: unknown) => void }) => void
  unregister: (id: string) => void
}

export const DragCtx = createContext<DragApi | null>(null)

export function useDragApi(): DragApi {
  const ctx = useContext(DragCtx)
  if (!ctx) throw new Error('useDraggable/useDropTarget deben usarse dentro de <DragDropProvider>')
  return ctx
}
