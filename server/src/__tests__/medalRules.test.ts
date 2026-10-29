import { describe, expect, it } from 'vitest';
import {
  MEDALS, MEDAL_IDS, earnedFrom, emptyFacts, learnFactsFrom, sortMedals, type LearnRowLike, type MedalFacts, type MedalId,
} from '../medalRules';

/* U5-B (docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §5.1-§5.3): las reglas PURAS de las 13 medallas — cada una con su borde (9 vs 10
   objetivos, `rollup` no cuenta, pct 0,99 vs 1, racha 2 vs 3…), `times` solo en las repetibles, las fechas de los hechos y
   el orden de la pila. Sin estado ni I/O. */

const facts = (p: Partial<MedalFacts> = {}): MedalFacts => ({ ...emptyFacts(), ...p });
const ids = (f: MedalFacts) => earnedFrom(f).map(h => h.id);
const hit = (f: MedalFacts, id: MedalId) => earnedFrom(f).find(h => h.id === id);
let t0 = Date.parse('2026-10-20T12:00:00Z');
const row = (p: Partial<LearnRowLike> = {}): LearnRowLike => ({ target: 't1', source: 'ruta:r/posta:p1', outcome: 'completed', pct: 0.5, finishedAt: (t0 += 60_000), ...p });

describe('el catálogo (§5.2)', () => {
  it('13 medallas con los textos LITERALES de la spec, sin euforia ni género', () => {
    expect(MEDAL_IDS).toHaveLength(13);
    expect(MEDALS['primera-posta']).toMatchObject({ emoji: '🎯', title: 'Primera posta', text: 'Completaste tu primera posta en Aprender.' });
    expect(MEDALS['mejor-semana']).toMatchObject({ emoji: '📈', title: 'Superaste tu semana', text: 'Sumaste más XP que la semana anterior.' });
    expect(MEDALS['semana-familia']).toMatchObject({ emoji: '🏆', title: 'Copa de la familia', text: 'Ganaste una semana de la liga de tu familia.' });
    expect(MEDALS['ruta-creada']).toMatchObject({ emoji: '✏️', title: 'Tu primera ruta', text: 'Armaste tu primera ruta en Crear.' });
    for (const id of MEDAL_IDS) {
      const m = MEDALS[id];
      expect(m.text).not.toMatch(/!|genio|crack|campe[oó]n|campeona/i); // eje P: informativo, sin signos de euforia
      expect(m.text.endsWith('.')).toBe(true);
    }
  });
  it('solo la copa (Ligas) y el primer amigo (Amigos) dependen de un candado; repetibles: ruta, semanas y copa', () => {
    expect(MEDAL_IDS.filter(id => MEDALS[id].domain)).toEqual(['primer-amigo', 'semana-familia']);
    expect(MEDALS['primer-amigo'].domain).toBe('amigos');
    expect(MEDALS['semana-familia'].domain).toBe('ligas');
    expect(MEDAL_IDS.filter(id => MEDALS[id].repeatable)).toEqual(['ruta-completa', 'semana-completa', 'mejor-semana', 'semana-familia']);
  });
  it('sin hechos no hay nada (un usuario nuevo no ve NADA)', () => {
    expect(earnedFrom(emptyFacts())).toEqual([]);
  });
});

describe('cada regla con su borde', () => {
  it('primera-posta: ≥ 1 objetivo completado, con la fecha de la primera fila', () => {
    expect(ids(facts({ completedTargets: 0 }))).not.toContain('primera-posta');
    expect(hit(facts({ completedTargets: 1, firstCompletedAt: 123 }), 'primera-posta')).toEqual({ id: 'primera-posta', at: 123 });
  });
  it('diez-objetivos: 9 no, 10 sí', () => {
    expect(ids(facts({ completedTargets: 9 }))).not.toContain('diez-objetivos');
    expect(hit(facts({ completedTargets: 10, tenthTargetAt: 99 }), 'diez-objetivos')).toEqual({ id: 'diez-objetivos', at: 99 });
  });
  it('ruta-completa: repetible, times = rutas completas, con la fecha de la primera que se completó', () => {
    expect(ids(facts({ routesCompleted: 0 }))).not.toContain('ruta-completa');
    expect(hit(facts({ routesCompleted: 1 }), 'ruta-completa')).toEqual({ id: 'ruta-completa', times: 1 });
    expect(hit(facts({ routesCompleted: 3, firstRouteCompletedAt: 77 }), 'ruta-completa')).toEqual({ id: 'ruta-completa', times: 3, at: 77 });
  });
  it('posta-perfecta, primer-repaso, primer-guardado, ruta-creada: una vez alcanza, con su fecha', () => {
    expect(hit(facts({ perfect: true, perfectAt: 5 }), 'posta-perfecta')).toEqual({ id: 'posta-perfecta', at: 5 });
    expect(hit(facts({ recall: true, recallAt: 6 }), 'primer-repaso')).toEqual({ id: 'primer-repaso', at: 6 });
    expect(hit(facts({ savedEver: 1, firstSavedAt: 7 }), 'primer-guardado')).toEqual({ id: 'primer-guardado', at: 7 });
    expect(hit(facts({ routesCreated: 2, firstRouteCreatedAt: 8 }), 'ruta-creada')).toEqual({ id: 'ruta-creada', at: 8 });
    expect(ids(facts({ savedEver: 0, routesCreated: 0 }))).toEqual([]);
  });
  it('primer-amigo: ≥ 1 amigo, sin fecha (es de RAM)', () => {
    expect(ids(facts({ friends: 0 }))).toEqual([]);
    expect(hit(facts({ friends: 6 }), 'primer-amigo')).toEqual({ id: 'primer-amigo' });
  });
  it('tres-dias: el MÁXIMO histórico de la racha, 2 no, 3 sí (no la racha de hoy)', () => {
    expect(ids(facts({ bestStreak: 2 }))).not.toContain('tres-dias');
    expect(ids(facts({ bestStreak: 3 }))).toContain('tres-dias');
  });
  it('de-vuelta: un regreso alcanza', () => {
    expect(ids(facts({ comebacks: 0 }))).toEqual([]);
    expect(ids(facts({ comebacks: 1 }))).toEqual(['de-vuelta']);
  });
  it('semana-completa, mejor-semana y semana-familia: repetibles con su contador', () => {
    const f = facts({ fullWeeks: 1, pbWeeks: 2, crowns: 3 });
    expect(hit(f, 'semana-completa')).toEqual({ id: 'semana-completa', times: 1 });
    expect(hit(f, 'mejor-semana')).toEqual({ id: 'mejor-semana', times: 2 });
    expect(hit(f, 'semana-familia')).toEqual({ id: 'semana-familia', times: 3 });
    expect(ids(facts({ pbWeeks: 0, fullWeeks: 0, crowns: 0 }))).toEqual([]);
  });
  it('las pilas del seed de la spec (§5.4): Ian 5 · Luna 4 · Andrés 0 con los hechos del 28-oct', () => {
    const ian = facts({ completedTargets: 1, firstCompletedAt: 1, perfect: true, perfectAt: 1, savedEver: 1, firstSavedAt: 2, friends: 6, bestStreak: 5 });
    const luna = facts({ friends: 4, bestStreak: 9, fullWeeks: 1, crowns: 1 });
    const andres = facts({ bestStreak: 2 });
    expect(ids(ian)).toEqual(['primera-posta', 'posta-perfecta', 'primer-guardado', 'primer-amigo', 'tres-dias']);
    expect(ids(luna)).toEqual(['primer-amigo', 'tres-dias', 'semana-completa', 'semana-familia']);
    expect(ids(andres)).toEqual([]);
    // y el primer cierre le da "Superaste tu semana" a Andrés: su primera medalla
    expect(ids({ ...andres, pbWeeks: 1 })).toEqual(['mejor-semana']);
  });
});

describe('learnFactsFrom (los hechos de Learn, puro)', () => {
  const routes = [
    { id: 'r', postas: [{ target: 't1' }, { target: 't2' }, { kind: 'recall' }] },
    { id: 'vacia', postas: [] },
    { id: 'umbral', postas: [{ target: 'u1', passThreshold: 0.8 }] },
  ];
  it('rollup no cuenta como objetivo, ni como primera posta, ni como perfecta', () => {
    const f = learnFactsFrom([row({ target: 'm', rollup: true, pct: 1 })], routes);
    expect(f).toMatchObject({ completedTargets: 0, firstCompletedAt: null, perfect: false });
  });
  it('abortadas y timeout no cuentan; la primera completada fija la fecha', () => {
    const a = row({ outcome: 'aborted' }), b = row({ outcome: 'timeout' }), c = row({ target: 't2' });
    const f = learnFactsFrom([a, b, c], routes);
    expect(f.completedTargets).toBe(1);
    expect(f.firstCompletedAt).toBe(c.finishedAt);
  });
  it('perfecta: pct 0,99 no, 1 sí (la primera fija la fecha)', () => {
    expect(learnFactsFrom([row({ pct: 0.99 })], routes).perfect).toBe(false);
    const p = row({ pct: 1 });
    expect(learnFactsFrom([row({ pct: 0.99 }), p, row({ pct: 1 })], routes)).toMatchObject({ perfect: true, perfectAt: p.finishedAt });
  });
  it('repaso: una fila completed con source active-recall (aunque sea rollup)', () => {
    const r = row({ source: 'active-recall', rollup: true });
    expect(learnFactsFrom([r], routes)).toMatchObject({ recall: true, recallAt: r.finishedAt });
    expect(learnFactsFrom([row({ source: 'active-recall', outcome: 'aborted' })], routes).recall).toBe(false);
  });
  it('10 objetivos DISTINTOS: el mismo objetivo repetido cuenta una vez; la décima distinta fija la fecha', () => {
    const rows: LearnRowLike[] = [];
    for (let i = 0; i < 9; i++) rows.push(row({ target: `x${i}` }), row({ target: `x${i}` }));
    expect(learnFactsFrom(rows, routes).completedTargets).toBe(9);
    const tenth = row({ target: 'x9' });
    expect(learnFactsFrom([...rows, tenth], routes)).toMatchObject({ completedTargets: 10, tenthTargetAt: tenth.finishedAt });
  });
  it('ruta completa: todas sus postas logradas con partidas COMPLETADAS (routeRuns sobre esas filas); una ruta vacía no cuenta; umbral', () => {
    expect(learnFactsFrom([row({ target: 't1' })], routes).routesCompleted).toBe(0);
    expect(learnFactsFrom([row({ target: 't1' }), row({ target: 't2' })], routes).routesCompleted).toBe(1);
    expect(learnFactsFrom([row({ target: 'u1', pct: 0.7 })], routes).routesCompleted).toBe(0);
    expect(learnFactsFrom([row({ target: 'u1', pct: 0.8 })], routes).routesCompleted).toBe(1);
  });
  it('rendirse o quedarse sin tiempo NO completa una posta para la medalla (el camino sí la marca: quirk 1 del POC, que queda en el camino)', () => {
    // «Completaste todas las postas de una ruta»: con postas abandonadas no es lo que hiciste (regla 4 de §5.1)
    expect(learnFactsFrom([row({ target: 't1' }), row({ target: 't2', outcome: 'aborted' })], routes).routesCompleted).toBe(0);
    expect(learnFactsFrom([row({ target: 't1', outcome: 'timeout' }), row({ target: 't2', outcome: 'aborted' })], routes).routesCompleted).toBe(0);
    // un abandono con % alto tampoco cruza el umbral
    expect(learnFactsFrom([row({ target: 'u1', outcome: 'aborted', pct: 0.9 })], routes).routesCompleted).toBe(0);
  });
  it('la fecha de «Ruta completa»: la de la fila con la que la PRIMERA ruta quedó completa (no la de una partida posterior)', () => {
    const a = row({ target: 't1' }), give = row({ target: 't2', outcome: 'aborted' }), b = row({ target: 't2' }), later = row({ target: 't1', pct: 1 });
    expect(learnFactsFrom([a, give, b, later], routes)).toMatchObject({ routesCompleted: 1, firstRouteCompletedAt: b.finishedAt });
    // con umbral: la fila que lo cruza, no la primera que lo intentó
    const low = row({ target: 'u1', pct: 0.5 }), high = row({ target: 'u1', pct: 0.85 });
    expect(learnFactsFrom([low, high], routes)).toMatchObject({ routesCompleted: 1, firstRouteCompletedAt: high.finishedAt });
    // dos rutas: la que se completó PRIMERO fija la fecha; el orden de las filas no importa (se ordenan por fecha)
    const u = row({ target: 'u1', pct: 0.9 }), t1 = row({ target: 't1' }), t2 = row({ target: 't2' });
    expect(learnFactsFrom([t2, t1, u], routes)).toMatchObject({ routesCompleted: 2, firstRouteCompletedAt: u.finishedAt });
    expect(learnFactsFrom([a], routes).firstRouteCompletedAt).toBeNull();
  });
  it('el orden de las filas no importa (se ordenan por fecha)', () => {
    const late = row({ target: 'a' }), early = { ...row({ target: 'b' }), finishedAt: 1 };
    expect(learnFactsFrom([late, early], routes).firstCompletedAt).toBe(1);
  });
});

describe('el orden de la pila (§5.5b)', () => {
  it('las más nuevas primero; las sin fecha al final en el orden del catálogo; empate de fecha → catálogo', () => {
    const xs = [
      { id: 'tres-dias' as MedalId, at: null }, { id: 'primer-guardado' as MedalId, at: 200 }, { id: 'primer-amigo' as MedalId, at: null },
      { id: 'posta-perfecta' as MedalId, at: 100 }, { id: 'primera-posta' as MedalId, at: 100 }, { id: 'mejor-semana' as MedalId, at: 300 },
    ];
    expect(sortMedals(xs).map(x => x.id)).toEqual(['mejor-semana', 'primer-guardado', 'primera-posta', 'posta-perfecta', 'primer-amigo', 'tres-dias']);
  });
});
