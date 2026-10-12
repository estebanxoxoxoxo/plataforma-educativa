import { describe, expect, it } from 'vitest'
import type { ActivityResultRow } from '../../api/types'
import { SPACING_WINDOW_MS, dueTargets, skillMastery, targetMastery, targetUrgency } from '../recall'
import { recallableTargets } from '../recallActivity'

/* PORTE INNERITH (W4) — suite NUEVA del Active Recall (el POC no tiene tests de lib/recall). Fija la urgencia EXACTA del
   informe 02 §7.3 (0.6·clamp01(1−lastPct) + 0.4·clamp01(Δt/3 días)), el orden finishedAt asc de la maestría, dueTargets
   SIN umbral ni límite (orden desc) y recallableTargets (scope + solo targets con Definición hoja). Quirk 10: lo dominado
   igual entra (al final). */

const DAY = 24 * 60 * 60 * 1000
const NOW = 1_800_000_000_000
let nextId = 1
function row(target: string, pct: number, finishedAt: number, extra: Partial<ActivityResultRow> = {}): ActivityResultRow {
  return { id: nextId++, target, source: 'test', typeId: 'flashcards', outcome: 'completed', score: pct * 10, maxScore: 10, pct, finishedAt, ...extra }
}

describe('targetMastery / skillMastery', () => {
  it('ordena por finishedAt ASC: lastPct = el intento más reciente (aunque llegue desordenado), bestPct = máx, lastSeen = máx', () => {
    const m = targetMastery([row('a', 0.9, NOW - 1000), row('a', 0.2, NOW), row('a', 0.5, NOW - 5000), row('b', 0, NOW - 10)])
    expect(m.get('a')).toEqual({ target: 'a', attempts: 3, lastPct: 0.2, bestPct: 0.9, lastSeen: NOW })
    expect(m.get('b')).toEqual({ target: 'b', attempts: 1, lastPct: 0, bestPct: 0, lastSeen: NOW - 10 })
  })

  it('skillMastery suma los tallies por skill (existe aunque nadie lo use, como en el POC)', () => {
    const m = skillMastery([
      row('a', 1, NOW - 5, { skills: { s1: { attempts: 2, correct: 1 } } }),
      row('b', 1, NOW, { skills: { s1: { attempts: 2, correct: 2 }, s2: { attempts: 1, correct: 0 } } }),
      row('c', 1, NOW),
    ])
    expect(m.get('s1')).toEqual({ skill: 's1', attempts: 4, correct: 3, accuracy: 0.75, lastSeen: NOW })
    expect(m.get('s2')).toEqual({ skill: 's2', attempts: 1, correct: 0, accuracy: 0, lastSeen: NOW })
  })
})

describe('targetUrgency — 0.6·(1−lastPct) + 0.4·min(1, Δt/3 días)', () => {
  const u = (lastPct: number, ago: number) => targetUrgency({ target: 't', attempts: 1, lastPct, bestPct: lastPct, lastSeen: NOW - ago }, NOW)
  it('los ejemplos del informe 02 §7.3', () => {
    expect(u(0, 0)).toBeCloseTo(0.6, 10) // lastPct 0 recién
    expect(u(0.5, DAY)).toBeCloseTo(0.4333, 4) // 0.5 hace 1 día
    expect(u(1, 0)).toBe(0) // 1 recién → 0 (igual entra, al final)
    expect(u(1, 3 * DAY)).toBeCloseTo(0.4, 10) // 1 hace ≥3 días
    expect(u(0, 10 * DAY)).toBeCloseTo(1, 10) // 0 hace ≥3 días (satura)
  })
  it('la ventana de espaciado es de 3 días y lineal', () => {
    expect(SPACING_WINDOW_MS).toBe(3 * DAY)
    expect(u(1, 1.5 * DAY)).toBeCloseTo(0.2, 10)
  })
  it('un % fuera de rango (multi inflado, trampa 13) se acota', () => {
    expect(u(1.7, 0)).toBe(0)
  })
})

describe('dueTargets — TODOS los vistos, sin umbral ni límite, por urgencia desc', () => {
  const rows = [
    row('dominado', 1, NOW), // urgencia 0
    row('flojo', 0, NOW), // 0.6
    row('viejo', 1, NOW - 3 * DAY), // 0.4
    row('medio', 0.5, NOW - DAY), // 0.433
  ]
  it('orden desc y entran todos (quirk 10: lo dominado también, al final)', () => {
    expect(dueTargets(rows, NOW).map((d) => d.target)).toEqual(['flojo', 'medio', 'viejo', 'dominado'])
  })
  it('scope acota; minUrgency/limit existen pero el recall no los usa', () => {
    expect(dueTargets(rows, NOW, { scope: ['viejo', 'dominado', 'no-jugado'] }).map((d) => d.target)).toEqual(['viejo', 'dominado'])
    expect(dueTargets(rows, NOW, { minUrgency: 0.42 }).map((d) => d.target)).toEqual(['flojo', 'medio'])
    expect(dueTargets(rows, NOW, { limit: 1 }).map((d) => d.target)).toEqual(['flojo'])
  })
})

describe('recallableTargets — solo los que tienen Definición HOJA (no multi)', () => {
  it('filtra multi y desconocidos, respeta el orden por urgencia y el scope', () => {
    const rows = [
      row('suma-0-10', 1, NOW), // hoja (dominó) dominada → al final
      row('repaso-mixto', 0, NOW), // su única Definición es un multi → afuera
      row('no-existe', 0, NOW), // sin Definición → afuera
      row('geo-repaso', 0.5, NOW - DAY), // hoja (quiz)
    ]
    expect(recallableTargets(rows, NOW)).toEqual(['geo-repaso', 'suma-0-10'])
    expect(recallableTargets(rows, NOW, { scope: ['suma-0-10'] })).toEqual(['suma-0-10'])
    expect(recallableTargets([], NOW)).toEqual([])
  })
})
