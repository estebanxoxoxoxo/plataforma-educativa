import { useState } from 'react'
import { IcLightbulb as Lightbulb } from './icons'
import { useActivitySnapshot } from './react/useActivity'
import { DragDropProvider, useDraggable, useDropTarget } from './kits/dragdrop'
import type { Cell, DominoEngine, EndSide, Tile } from './activities/domino'
import './learn-engine.css'

/* Vista app-native (Tailwind) del dominó, sobre el motor + DragDropKit portados del
   lab. Arrastrá una ficha de la mano hasta el extremo donde encaja (matchea por key
   de equivalencia: número↔expresión, o país↔capital). Sin audio/efectos por ahora.
   PORTE INNERITH (W2): mismo DOM/textos/handlers que el POC; Tailwind → clases lrn-
   (learn-engine.css) y lucide → ícono local. Estética fina: W3. */

interface DragPayload {
  tileId: string
}

function halfColor(variant?: string): string {
  if (variant === 'expr') return 'v-expr'
  if (variant === 'number') return 'v-number'
  return 'v-term'
}

function Half({ cell }: { cell: Cell }) {
  return (
    <div className={`lrn-dom-half ${halfColor(cell.variant)}`}>
      {cell.label}
    </div>
  )
}

function HandTile({ tile, hintId, wrong }: { tile: Tile; hintId: string | null; wrong: boolean }) {
  const { setRef, onPointerDown, isDragging } = useDraggable(tile.id, { tileId: tile.id } satisfies DragPayload)
  const border = wrong
    ? 'is-wrong'
    : hintId === tile.id
      ? 'is-hint'
      : ''
  return (
    <div
      ref={setRef}
      onPointerDown={onPointerDown}
      style={{ touchAction: 'none' }}
      className={`lrn-dom-tile ${border} ${isDragging ? 'is-dragging' : ''}`}>
      <Half cell={tile.left} />
      <Half cell={tile.right} />
    </div>
  )
}

function EndZone({ side, cell, engine }: { side: EndSide; cell: Cell; engine: DominoEngine }) {
  const { setRef, isOver, activeData, dragging } = useDropTarget(`end-${side}`, (d) =>
    engine.play((d as DragPayload).tileId, side),
  )
  const draggedId = (activeData as DragPayload | null)?.tileId
  const valid = draggedId ? engine.legalEndsFor(draggedId)[side] : false
  const state = isOver
    ? valid
      ? 'is-over-ok'
      : 'is-over-bad'
    : dragging && valid
      ? 'is-valid'
      : ''
  return (
    <div ref={setRef} className={`lrn-dom-end ${state}`}>
      <div className="lrn-dom-endlabel">{cell.label}</div>
      <div className="lrn-dom-endhint">{side === 'left' ? '◀ soltar' : 'soltar ▶'}</div>
    </div>
  )
}

export default function DominoBoard({ engine }: { engine: DominoEngine }) {
  const snap = useActivitySnapshot(engine)
  const [hintId, setHintId] = useState<string | null>(null)
  const playing = snap.status === 'running'

  return (
    <DragDropProvider>
      <div className="lrn-dom-track">
        <EndZone side="left" cell={snap.leftEnd} engine={engine} />
        {snap.board.map((p) => (
          <div key={p.id} className="lrn-dom-placed">
            <Half cell={p.cells[0]} />
            <Half cell={p.cells[1]} />
          </div>
        ))}
        <EndZone side="right" cell={snap.rightEnd} engine={engine} />
      </div>

      <h3 className="lrn-dom-handtitle">Tu mano</h3>
      <div className="lrn-dom-hand">
        {snap.hand.map((t) => (
          <HandTile key={t.id} tile={t} hintId={hintId} wrong={snap.lastWrongId === t.id} />
        ))}
        {snap.hand.length === 0 && <p className="lrn-dom-empty">¡Vaciaste la mano! 🎉</p>}
      </div>

      <p className="lrn-help is-left">
        {playing ? 'Arrastrá una ficha hasta el extremo donde encaja (se pone verde si va).' : ''}
      </p>
      <button
        onClick={() => {
          const s = engine.hint()
          if (s) setHintId(s.tileId)
        }}
        disabled={!playing}
        className="lrn-hintbtn">
        <Lightbulb width={16} height={16} /> Pista
      </button>
    </DragDropProvider>
  )
}
