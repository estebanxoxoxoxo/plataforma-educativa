import { describe, expect, it } from 'vitest';
import type { ActivityResultRow } from '../../../../api/types';
import type { ActivityResult } from '../../../../learn/activity';
import { progressByTarget, resolveRoute, resultRowOf, routeProgress, starsForPct, type LearnRoute } from '../learn';

/* PORTE INNERITH (W3) — resolveRoute EXACTO (informe 02 §4.4) y sus quirks fieles: rendirse = lograda (no mira outcome),
   umbral = bestPct ≥ passThreshold, bloqueo lineal GLOBAL (una lograda después de una bloqueada sigue lograda y destraba
   la siguiente), el repaso nunca se logra ni bloquea, estrellas por bestPct. Más el armado de la fila de recordResult. */

let id = 1;
const row = (target: string, pct: number, outcome: ActivityResultRow['outcome'] = 'completed'): ActivityResultRow =>
  ({ id: id++, target, source: 's', typeId: 'flashcards', outcome, score: pct * 10, maxScore: 10, pct, finishedAt: id });

const route: LearnRoute = {
  id: 'r', title: 'R', description: '', emoji: '🧭',
  postas: [
    { id: 'p1', title: 'Comprensión', target: 't1', definitionId: 'd1', passThreshold: 0.7 },
    { id: 'p2', title: 'Concepto A', target: 't2', definitionId: 'd2' },
    { id: 'r1', title: 'Repaso', kind: 'recall', target: 'r.recall' },
    { id: 'p3', title: 'Concepto B', target: 't3', definitionId: 'd3' },
  ],
};
const states = (rows: ActivityResultRow[]) => resolveRoute(route, progressByTarget(rows)).map((v) => `${v.posta.id}:${v.state}:${v.stars}`);

describe('resolveRoute', () => {
  it('sin jugar: la 1ª disponible, el resto bloqueado (el repaso también, si lo previo no está logrado)', () => {
    expect(states([])).toEqual(['p1:available:0', 'p2:locked:0', 'r1:locked:0', 'p3:locked:0']);
  });

  it('umbral: por debajo sigue disponible ("¡Lo lograste!" no alcanza, trampa 3); con bestPct ≥ umbral queda lograda', () => {
    expect(states([row('t1', 0.615)])).toEqual(['p1:available:1', 'p2:locked:0', 'r1:locked:0', 'p3:locked:0']);
    expect(states([row('t1', 0.615), row('t1', 0.7)])).toEqual(['p1:done:2', 'p2:available:0', 'r1:locked:0', 'p3:locked:0']);
  });

  it('rendirse = lograda sin umbral (quirk 1: una abortada con 0% la marca, 0 estrellas); el repaso queda disponible y no bloquea', () => {
    expect(states([row('t1', 1), row('t2', 0, 'aborted')])).toEqual(['p1:done:3', 'p2:done:0', 'r1:available:0', 'p3:available:0']);
  });

  it('bloqueo lineal GLOBAL por target (quirk 5): una lograda tras una bloqueada sigue lograda y destraba la siguiente', () => {
    expect(states([row('t3', 0.95)])).toEqual(['p1:available:0', 'p2:locked:0', 'r1:locked:0', 'p3:done:3']);
  });

  it('routeProgress cuenta solo las postas que no son de repaso', () => {
    expect(routeProgress(route, progressByTarget([row('t1', 0.8), row('t2', 0.1)]))).toEqual({ done: 2, total: 3 });
  });

  it('estrellas: ≥0.9 → 3 · ≥0.7 → 2 · >0 → 1 · 0 → 0', () => {
    expect([0.9, 0.89, 0.7, 0.69, 0.01, 0].map(starsForPct)).toEqual([3, 2, 2, 1, 1, 0]);
  });
});

describe('resultRowOf (la fila de recordResult del POC)', () => {
  const result: ActivityResult = {
    activityId: 'quiz-relampago', version: 1, startedAt: 1, finishedAt: 2, durationMs: 1, outcome: 'completed',
    score: 36, maxScore: 48, stats: { correct: 3, wrong: 1, hintsUsed: 0, bestStreak: 2 }, config: {}, definitionId: 'def-del-result', seed: 7,
    skills: { k: { attempts: 4, correct: 3 } },
  };
  it('pct = score/maxScore, typeId = id del MÓDULO (trampa 17), definitionId cae al del result, rollup tal cual', () => {
    expect(resultRowOf({ target: 't', source: 'ruta:r/posta:p', result })).toEqual({
      target: 't', source: 'ruta:r/posta:p', typeId: 'quiz-relampago', definitionId: 'def-del-result', seed: 7,
      outcome: 'completed', score: 36, maxScore: 48, pct: 0.75, skills: { k: { attempts: 4, correct: 3 } }, rollup: undefined,
    });
    expect(resultRowOf({ target: 't', source: 's', definitionId: 'd', result: { ...result, maxScore: 0 }, rollup: true })).toMatchObject({ definitionId: 'd', pct: 0, rollup: true });
  });
});
