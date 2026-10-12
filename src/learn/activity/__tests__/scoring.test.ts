import { describe, expect, it } from 'vitest'
import { DEFAULT_SCORE, perfectScore, pointsForCorrect, timeBonus, type ScoreConfig } from '../index'

describe('scoring', () => {
  it('pointsForCorrect = base + streakBonus*(streak-1)', () => {
    expect(pointsForCorrect(DEFAULT_SCORE, 1)).toBe(10)
    expect(pointsForCorrect(DEFAULT_SCORE, 3)).toBe(10 + 2 * 2)
  })

  it('perfectScore = corrida de racha creciente + pozo de tiempo', () => {
    const cfg: ScoreConfig = { base: 10, streakBonus: 2, hintPenalty: 5, timeBonusMax: 50 }
    // moves=3 → 10 + 12 + 14 = 36, + 50 = 86
    expect(perfectScore(cfg, 3)).toBe(86)
  })

  it('timeBonus es proporcional al tiempo restante y está clampeado', () => {
    const cfg: ScoreConfig = { ...DEFAULT_SCORE, timeBonusMax: 100 }
    expect(timeBonus(cfg, 30000, 60000)).toBe(50)
    expect(timeBonus(cfg, 0, 60000)).toBe(0)
    expect(timeBonus(cfg, 999999, 60000)).toBe(100)
    // sin pozo de tiempo (modo precisión) → siempre 0
    expect(timeBonus(DEFAULT_SCORE, 30000, 60000)).toBe(0)
  })
})
