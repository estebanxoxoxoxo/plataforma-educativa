import type { ActivityModule } from '../../activity/index'
import { makeRuntime, MATH_PRESETS, type DominoConfig } from './config'
import { mathDominoGenerator } from './generators'
import { DOMINO_ID, DominoEngine } from './engine'
import type { DominoContent, DominoSnapshot, Tile } from './types'

/**
 * PORTERO del Tipo (ACTIVIDADES.md §3): valida que un Ejercicio sea RESOLUBLE
 * SIN CALLEJONES antes de jugarlo, venga de donde venga (generador propio, LLM,
 * marketplace). Dos chequeos:
 *   1. Invariante de keys: cada key aparece ≤2 veces en total y exactamente dos
 *      keys aparecen una vez (los extremos) → en cada extremo hay a lo sumo una
 *      ficha jugable ⇒ ninguna jugada legal puede llevar a un callejón.
 *   2. Playout con el PROPIO motor (bajo 1, el greedy es completo): la mano debe
 *      vaciarse → detecta cadenas desconectadas o ciclos.
 */
function validateContent(content: unknown): { ok: true } | { ok: false; reason: string } {
  const c = content as DominoContent
  if (!c || typeof c !== 'object' || !c.starter || !Array.isArray(c.hand))
    return { ok: false, reason: 'el contenido no tiene forma de DominoContent ({starter, hand[]})' }
  const tiles: Tile[] = [c.starter, ...c.hand]
  for (const t of tiles) {
    if (!t?.id || !t.left?.key || !t.right?.key || t.left.label == null || t.right.label == null)
      return { ok: false, reason: `ficha malformada (id/left/right incompletos): ${JSON.stringify(t)}` }
  }
  const veces = new Map<string, number>()
  for (const t of tiles) for (const cell of [t.left, t.right]) veces.set(cell.key, (veces.get(cell.key) ?? 0) + 1)
  const repetidas = [...veces.entries()].filter(([, n]) => n > 2)
  if (repetidas.length)
    return { ok: false, reason: `keys con más de 2 apariciones (rompe la garantía sin-callejones): ${repetidas.map(([k, n]) => `${k}×${n}`).join(', ')}` }
  const sueltas = [...veces.entries()].filter(([, n]) => n === 1)
  if (sueltas.length !== 2)
    return { ok: false, reason: `debe haber exactamente 2 keys de extremo (aparecen 1 vez); hay ${sueltas.length}: ${sueltas.map(([k]) => k).join(', ') || '(ninguna)'}` }
  // playout con el motor real (ctx inerte): bajo el invariante 1 es determinista
  const engine = new DominoEngine({ content: c, runtime: makeRuntime('untimed', 60) }, { emit: () => {}, now: () => 0 })
  engine.start()
  let guard = 0
  while (engine.getSnapshot().hand.length > 0) {
    if (guard++ > tiles.length + 5) return { ok: false, reason: 'el playout no converge (contenido degenerado)' }
    const snap = engine.getSnapshot()
    const tileId = snap.playableIds[0]
    if (!tileId)
      return { ok: false, reason: `callejón: quedan ${snap.hand.length} fichas sin jugada legal (cadena desconectada o ciclo)` }
    const ends = engine.legalEndsFor(tileId)
    engine.play(tileId, ends.left ? 'left' : 'right')
  }
  return { ok: true }
}

/**
 * Descriptor del TIPO Dominó (genérico). El host lo lanza con un Ejercicio +
 * runtime: createActivity(dominoModule, { content, runtime }). La identidad
 * (título/tema) la pone cada DEFINICIÓN, no el Tipo. `Instance` estrechado a
 * `DominoEngine` para exponer `play`/`hint`/`legalEndsFor` con tipos.
 */
export const dominoModule: ActivityModule<DominoConfig, DominoSnapshot, DominoEngine> = {
  id: DOMINO_ID,
  meta: {
    title: 'Dominó',
    description: 'Encadená fichas emparejando equivalencias en cada extremo.',
    ageRange: [9, 12],
    tags: ['dominó', 'emparejar'],
  },
  // default solo para descubribilidad; las Definiciones generan su propio contenido
  defaultConfig: {
    content: mathDominoGenerator(MATH_PRESETS[0].math, 1),
    runtime: makeRuntime('untimed', MATH_PRESETS[0].durationSec),
  },
  create: (config, ctx) => new DominoEngine(config, ctx),
  validateContent,
}
