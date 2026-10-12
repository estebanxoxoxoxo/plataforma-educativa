export { dominoModule } from './module'
export { DominoEngine, DOMINO_ID, DOMINO_VERSION } from './engine'
export {
  mathDominoGenerator,
  equivalenceDominoGenerator,
  type MathDominoParams,
  type EquivPair,
  type Operation,
} from './generators'
export { PAIS_CAPITAL } from './equivalenceData'
export {
  MATH_PRESETS,
  PAIRS_PRESETS,
  makeRuntime,
  resolveScore,
  resolveDurationMs,
  TIME_BONUS_MAX,
  type DominoConfig,
  type DominoRuntime,
  type DominoMode,
  type DominoMathPreset,
  type DominoPairsPreset,
} from './config'
export type { Cell, Tile, PlacedTile, EndSide, DominoContent, DominoSnapshot } from './types'
