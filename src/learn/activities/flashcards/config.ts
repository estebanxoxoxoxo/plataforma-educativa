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
   un artículo → params { cards } del generador `static`. */
export const SISTEMA_SOLAR: Card[] = [
  { id: 'ss1', front: '¿Cuántos planetas tiene el sistema solar?', back: '8', skill: 'sistema-solar.planetas' },
  { id: 'ss2', front: 'El planeta más grande', back: 'Júpiter', skill: 'sistema-solar.planetas' },
  { id: 'ss3', front: 'El "planeta rojo"', back: 'Marte', skill: 'sistema-solar.planetas' },
  { id: 'ss4', front: 'El planeta más cercano al Sol', back: 'Mercurio', skill: 'sistema-solar.planetas' },
  { id: 'ss5', front: 'El planeta con los anillos más visibles', back: 'Saturno', skill: 'sistema-solar.planetas' },
  { id: 'ss6', front: 'La estrella del sistema solar', back: 'el Sol', skill: 'sistema-solar.sol' },
  { id: 'ss7', front: 'El planeta donde vivimos', back: 'la Tierra', skill: 'sistema-solar.tierra' },
  { id: 'ss8', front: 'El planeta más lejano al Sol', back: 'Neptuno', skill: 'sistema-solar.planetas', hint: 'empieza con N' },
]

export const ANIMALES: Card[] = [
  { id: 'an1', front: 'El animal terrestre más grande', back: 'el elefante', skill: 'animales.mamiferos' },
  { id: 'an2', front: 'El animal más rápido del mundo', back: 'el guepardo', skill: 'animales.mamiferos' },
  { id: 'an3', front: 'El único mamífero que puede volar', back: 'el murciélago', skill: 'animales.mamiferos' },
  { id: 'an4', front: 'El ave que no vuela y vive en la Antártida', back: 'el pingüino', skill: 'animales.aves' },
  { id: 'an5', front: 'El animal más alto', back: 'la jirafa', skill: 'animales.mamiferos' },
  { id: 'an6', front: 'El animal más grande del mundo', back: 'la ballena azul', skill: 'animales.mamiferos' },
]

export const DEMO_DECKS: { id: string; label: string; cards: Card[] }[] = [
  { id: 'solar', label: '🪐 Sistema solar', cards: SISTEMA_SOLAR },
  { id: 'animales', label: '🦉 Animales', cards: ANIMALES },
]
