import { DEFAULT_SCORE, durationMsFor, timedScore, type ActivityMode, type ScoreConfig } from '../../activity/index'
import type { Card, FlashcardsContent } from './types'

export type FlashcardsMode = ActivityMode

/** Runtime = lo que afecta el JUEGO (no el contenido): modo, tiempo, scoring. */
export interface FlashcardsRuntime {
  mode: FlashcardsMode
  durationSec: number
  score: ScoreConfig
}

/** Lo que recibe el Tipo: un Ejercicio (content) + el runtime. */
export interface FlashcardsConfig {
  content: FlashcardsContent
  runtime: FlashcardsRuntime
}

export const TIME_BONUS_MAX = 100

export function resolveScore(runtime: FlashcardsRuntime): ScoreConfig {
  return timedScore(runtime.score, runtime.mode, TIME_BONUS_MAX)
}
export function resolveDurationMs(runtime: FlashcardsRuntime): number | null {
  return durationMsFor(runtime.mode, runtime.durationSec)
}
export function makeFlashcardsRuntime(mode: FlashcardsMode, durationSec: number): FlashcardsRuntime {
  return { mode, durationSec, score: { ...DEFAULT_SCORE } }
}

/* Mazos de ejemplo: contenido benévolo estilo "artículo wiki" (término ↔ dato). Es lo
   que la etapa `generate` del pipeline de rutas (route-lab) emitiría desde los facts de
   un artículo → params { cards } del generador `static`.
   TEEN-COPY (4-nov): el usuario modelo pasa de 9 a 13 años. Las dos cartas de jardín del mazo solar («La estrella del
   sistema solar», «El planeta donde vivimos») ceden lugar a datos de 13 (Urano acostado, los 8 minutos de la luz), y el
   mazo «Animales» (la jirafa, el elefante) pasa a Mitología griega. Mismos ids y mismo largo (ss7 pasa a skill .planetas: ya no es la Tierra): los tests del motor
   miden el largo del mazo y el seed `flashcards-solar` lo usa por referencia. */
export const SISTEMA_SOLAR: Card[] = [
  { id: 'ss1', front: '¿Cuántos planetas tiene el sistema solar?', back: '8', skill: 'sistema-solar.planetas' },
  { id: 'ss2', front: 'El planeta más grande', back: 'Júpiter', skill: 'sistema-solar.planetas' },
  { id: 'ss3', front: 'El "planeta rojo"', back: 'Marte', skill: 'sistema-solar.planetas' },
  { id: 'ss4', front: 'El planeta más cercano al Sol', back: 'Mercurio', skill: 'sistema-solar.planetas' },
  { id: 'ss5', front: 'El planeta con los anillos más visibles', back: 'Saturno', skill: 'sistema-solar.planetas' },
  { id: 'ss6', front: 'Cuánto tarda la luz del Sol en llegar a la Tierra', back: 'unos 8 minutos', skill: 'sistema-solar.sol' },
  { id: 'ss7', front: 'El planeta que gira "acostado", con el eje casi horizontal', back: 'Urano', skill: 'sistema-solar.planetas' },
  { id: 'ss8', front: 'El planeta más lejano al Sol', back: 'Neptuno', skill: 'sistema-solar.planetas', hint: 'empieza con N' },
]

export const MITOLOGIA_GRIEGA: Card[] = [
  { id: 'mg1', front: 'El rey de los dioses del Olimpo', back: 'Zeus', skill: 'mitologia-griega.dioses' },
  { id: 'mg2', front: 'La diosa de la sabiduría y la estrategia', back: 'Atenea', skill: 'mitologia-griega.dioses' },
  { id: 'mg3', front: 'El dios del mar, con su tridente', back: 'Poseidón', skill: 'mitologia-griega.dioses' },
  { id: 'mg4', front: 'El héroe de los doce trabajos', back: 'Heracles (Hércules)', skill: 'mitologia-griega.heroes' },
  { id: 'mg5', front: 'El titán que robó el fuego para dárselo a los humanos', back: 'Prometeo', skill: 'mitologia-griega.titanes' },
  { id: 'mg6', front: 'El monstruo del laberinto de Creta', back: 'el Minotauro', skill: 'mitologia-griega.criaturas' },
]

export const DEMO_DECKS: { id: string; label: string; cards: Card[] }[] = [
  { id: 'solar', label: '🪐 Sistema solar', cards: SISTEMA_SOLAR },
  { id: 'mitologia', label: '🏛️ Mitología griega', cards: MITOLOGIA_GRIEGA },
]
