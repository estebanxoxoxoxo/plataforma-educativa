import { describe, expect, it } from 'vitest';
import {
  EDITIONS, NPC_NEWS, SHARERS, SLOTS, interleave, newBurstMemory, planBurst, roundRobinBy, spaceOut,
  type BurstCand, type Daypart, type Slot,
} from '../feedMix';

/* Tanda "Feed diverso" (28-oct; pedido del dueño: «el botón de lanzar NPC que sean 5 por vez y de diversos tipos; y que los
   que vienen por default sean más diversos»). Las reglas PURAS de server/src/feedMix.ts: la edición sembrada (cabeza con la
   plantilla de la franja + resto balanceado), lo del cierre de liga espaciado y el plan de la ráfaga (una por tipo social,
   sin repetir hasta agotar). Puro: no toca server/data. */

/** El rng de leaguesFake (mulberry32), para ráfagas determinísticas como las del server. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const PAGE = 9; // los ítems de la edición sembrada por página (feedFake.PAGE)
const DAYPARTS: Daypart[] = ['manana', 'tarde', 'noche'];

/** Colas con el tamaño de la edición real de Ian (28-oct: 14 sociales no-liga, 15 lecturas, 2 rutas, 14 videos); lo social
 *  con los subtipos alternados como en friendsFake.NEWS. Cada ítem dice su tipo de card. */
const SOCIAL_SUBTYPES = ['streak', 'badge', 'route', 'unit'];
function ianQueues(sizes: Partial<Record<Slot, number>> = {}): Record<Slot, string[]> {
  const n = { friend: 14, article: 15, route: 2, video: 14, ...sizes };
  return {
    friend: Array.from({ length: n.friend }, (_, i) => `social:${SOCIAL_SUBTYPES[i % SOCIAL_SUBTYPES.length]}#${i}`),
    article: Array.from({ length: n.article }, (_, i) => `article#${i}`),
    route: Array.from({ length: n.route }, (_, i) => `route#${i}`),
    video: Array.from({ length: n.video }, (_, i) => `video#${i}`),
  };
}
const cardType = (it: string) => it.split('#')[0];
const kindOf = (it: string) => cardType(it).split(':')[0];
const pages = <T,>(xs: readonly T[]) => Array.from({ length: Math.ceil(xs.length / PAGE) }, (_, i) => xs.slice(i * PAGE, (i + 1) * PAGE));

describe('interleave: la edición sembrada por franja', () => {
  it('la CABEZA sigue la plantilla de la franja tal cual (lo que el resumen confiesa)', () => {
    for (const dp of DAYPARTS) {
      const out = interleave(ianQueues(), EDITIONS[dp].pattern);
      expect(out.slice(0, EDITIONS[dp].pattern.length).map(kindOf)).toEqual(EDITIONS[dp].pattern.map((s) => (s === 'friend' ? 'social' : s)));
    }
  });

  it('no pierde ni duplica nada y respeta el orden dentro de cada tipo', () => {
    const q = ianQueues();
    for (const dp of DAYPARTS) {
      const out = interleave(q, EDITIONS[dp].pattern);
      expect([...out].sort()).toEqual(SLOTS.flatMap((s) => q[s]).sort());
      for (const s of SLOTS) expect(out.filter((it) => q[s].includes(it))).toEqual(q[s]);
    }
  });

  it('en TODAS las franjas: nunca dos del mismo tipo seguidos y cada página completa con ≥ 4 tipos de card distintos', () => {
    for (const dp of DAYPARTS) {
      const out = interleave(ianQueues(), EDITIONS[dp].pattern);
      for (let i = 1; i < out.length; i++) expect(kindOf(out[i]), `${dp} #${i}`).not.toBe(kindOf(out[i - 1]));
      for (const p of pages(out).filter((pg) => pg.length === PAGE)) {
        expect(new Set(p.map(cardType)).size, `${dp}: ${p.join(' > ')}`).toBeGreaterThanOrEqual(4);
        expect(new Set(p.map(kindOf)).size).toBeGreaterThanOrEqual(3);
      }
    }
  });

  // Con la plantilla vieja (ciclar hasta agotar) la cola era de un solo tipo: con el contenido de antes, 4-9 videos seguidos;
  // con el contenido nuevo, 6-7 lecturas seguidas a la tarde y a la noche (simulado el 28-oct). Hacían falta las dos cosas.
  it('regresión de la cola: la última página completa ya no es de un solo tipo', () => {
    for (const dp of DAYPARTS) {
      const full = pages(interleave(ianQueues(), EDITIONS[dp].pattern)).filter((pg) => pg.length === PAGE);
      const last = full[full.length - 1];
      expect(new Set(last.map(kindOf)).size).toBeGreaterThanOrEqual(3);
      expect(last.filter((it) => kindOf(it) === 'video').length).toBeLessThanOrEqual(4);
    }
  });

  it('con un tipo vacío (la familia bloqueó las rutas) la cabeza no pone dos sociales seguidos por el salto', () => {
    for (const dp of DAYPARTS) {
      const out = interleave(ianQueues({ route: 0 }), EDITIONS[dp].pattern);
      for (let i = 1; i < out.length; i++) expect(kindOf(out[i])).not.toBe(kindOf(out[i - 1]));
    }
  });

  it('sin videos ni rutas (todo filtrado) sigue intercalando lo que hay; colas vacías → edición vacía', () => {
    const out = interleave(ianQueues({ video: 0, route: 0 }), EDITIONS.tarde.pattern);
    expect(out).toHaveLength(29);
    expect(interleave({ friend: [], article: [], route: [], video: [] }, EDITIONS.manana.pattern)).toEqual([]);
  });
});

describe('spaceOut: lo del cierre de liga entra espaciado', () => {
  const stream = Array.from({ length: 30 }, (_, i) => `x${i}`);
  it('desde su lugar por antigüedad, con `gap` ítems entre una noticia de liga y la siguiente', () => {
    const out = spaceOut(stream, ['L', 'M1', 'M2', 'A'], 19);
    expect(out).toHaveLength(34);
    expect(out.indexOf('L')).toBe(19);
    expect([out.indexOf('M1'), out.indexOf('M2'), out.indexOf('A')]).toEqual([22, 25, 28]);
    expect(out.filter((x) => x.startsWith('x'))).toEqual(stream); // la edición no se reordena
  });
  it('cerca del final arranca antes, así no quedan pegadas al fondo; sin nada del cierre, igual', () => {
    const out = spaceOut(stream, ['L', 'M1', 'M2'], 30);
    const at = ['L', 'M1', 'M2'].map((x) => out.indexOf(x));
    expect(at[1] - at[0]).toBe(3);
    expect(at[2] - at[1]).toBe(3);
    expect(spaceOut(stream, [], 5)).toEqual(stream);
  });
});

describe('roundRobinBy: las lecturas intercaladas por tema', () => {
  it('a1 b1 c1 a2 b2 a3…, respetando el orden de cada tema', () => {
    const xs = ['e1', 'e2', 'e3', 'd1', 'v1', 'd2'];
    expect(roundRobinBy(xs, (x) => x[0])).toEqual(['e1', 'd1', 'v1', 'e2', 'd2', 'e3']);
  });
});

/* ---------- la ráfaga ---------- */
/** Los NPCs que ve cada chico en el seed de friendsFake (GRAPH_SEEDS: amigos + quien le pidió contacto). */
const VISIBLE: Record<string, string[]> = {
  ian: ['TomiCohete', 'LuliVolcan', 'MateoDino', 'CataEstrella', 'JuanchiRayo', 'MartuLuna', 'NicoRobot'],
  luna: ['CataEstrella', 'MartuLuna', 'LeaTelescopio', 'TriniPiano', 'FedeAjedrez'],
};
const ROUTES = ['ruta.a', 'ruta.b'];
/** Los candidatos como los arma feedFake.simulateNpcs: el pool de quien ve + cada compartidor visible × cada ruta. */
function candsFor(user: string, routes = ROUTES): BurstCand[] {
  const vis = new Set(VISIBLE[user]);
  return [
    ...NPC_NEWS.filter((e) => vis.has(e.nick)).map((e): BurstCand => ({ key: e.key, type: e.type, nick: e.nick })),
    ...SHARERS.filter((n) => vis.has(n)).flatMap((nick) => routes.map((ref): BurstCand => ({ key: `share:${nick}:${ref}`, type: 'route', nick, ref }))),
  ];
}
const SOCIAL = ['streak', 'badge', 'unit', 'route'];

describe('planBurst: una de cada tipo, sin repetir', () => {
  for (const user of ['ian', 'luna']) {
    it(`${user}: cada ráfaga trae los 4 tipos sociales una vez, con protagonistas distintos y de quien ve`, () => {
      const mem = newBurstMemory(), r = rng(7), cands = candsFor(user);
      for (let n = 0; n < 6; n++) {
        const b = planBurst(cands, mem, r);
        expect(b.map((c) => c.type)).toEqual(SOCIAL);
        expect(new Set(b.map((c) => c.nick)).size).toBe(4);
        for (const c of b) expect(VISIBLE[user]).toContain(c.nick);
      }
    });
  }

  it('no repite NINGUNA noticia hasta agotar su tipo (Ian: 13 por tipo social) y al reciclar nunca la de la ráfaga anterior', () => {
    const cands = candsFor('ian');
    const perType = Math.min(...SOCIAL.map((t) => cands.filter((c) => c.type === t).length));
    expect(perType).toBeGreaterThanOrEqual(13);
    const mem = newBurstMemory(), r = rng(42), seen = new Set<string>();
    for (let n = 0; n < perType; n++) {
      for (const c of planBurst(cands, mem, r)) { expect(seen.has(c.key), `ráfaga ${n + 1}: ${c.key}`).toBe(false); seen.add(c.key); }
    }
    let prev = new Set(mem.lastKeys);
    for (let n = 0; n < 10; n++) { // ya recicla: nunca lo de la ráfaga inmediatamente anterior
      const b = planBurst(cands, mem, r);
      expect(b.map((c) => c.type)).toEqual(SOCIAL);
      for (const c of b) expect(prev.has(c.key)).toBe(false);
      prev = new Set(b.map((c) => c.key));
    }
  });

  it('entre ráfagas seguidas varía la ruta compartida y, cuando se puede, los protagonistas', () => {
    const mem = newBurstMemory(), r = rng(3), cands = candsFor('ian');
    let prev = planBurst(cands, mem, r);
    for (let n = 0; n < 8; n++) {
      const b = planBurst(cands, mem, r);
      expect(b.find((c) => c.type === 'route')!.ref).not.toBe(prev.find((c) => c.type === 'route')!.ref);
      // 7 NPCs visibles y 4 lugares: como mucho 1 protagonista repetido de la ráfaga anterior (el óptimo)
      const again = b.filter((c) => prev.some((p) => p.nick === c.nick)).length;
      expect(again).toBeLessThanOrEqual(1);
      prev = b;
    }
  });

  it('un tipo sin candidatos no sale (honestidad antes que relleno), y uno de UN solo candidato no se repite seguido', () => {
    const noShare = candsFor('ian').filter((c) => c.type !== 'route');
    expect(planBurst(noShare, newBurstMemory(), rng(1)).map((c) => c.type)).toEqual(['streak', 'badge', 'unit']);
    const one: BurstCand[] = [{ key: 'solo', type: 'badge', nick: 'A' }, { key: 's1', type: 'streak', nick: 'B' }, { key: 's2', type: 'streak', nick: 'C' }];
    const mem = newBurstMemory(), r = rng(1);
    expect(planBurst(one, mem, r).map((c) => c.key)).toContain('solo');
    expect(planBurst(one, mem, r).map((c) => c.key)).not.toContain('solo'); // la ráfaga anterior la tuvo
    expect(planBurst(one, mem, r).map((c) => c.key)).toContain('solo'); // y vuelve después
  });

  it('con pocos protagonistas igual sale uno de cada tipo (se permite repetir quién, nunca el tipo)', () => {
    const cands: BurstCand[] = SOCIAL.map((t, i) => ({ key: `k${i}`, type: t as BurstCand['type'], nick: 'Unico', ref: t === 'route' ? 'r' : undefined }));
    expect(planBurst(cands, newBurstMemory(), rng(5)).map((c) => c.type)).toEqual(SOCIAL);
  });

  it('es determinística con el mismo rng (mismas ráfagas para el mismo usuario y semana)', () => {
    const run = () => { const mem = newBurstMemory(), r = rng(99); return [0, 1, 2].map(() => planBurst(candsFor('luna'), mem, r).map((c) => c.key)); };
    expect(run()).toEqual(run());
  });
});

describe('el pool de la ráfaga (NPC_NEWS)', () => {
  it('claves y textos únicos, y cada chico ve al menos 3 de cada tipo social (Luna incluida)', () => {
    expect(new Set(NPC_NEWS.map((e) => e.key)).size).toBe(NPC_NEWS.length);
    expect(new Set(NPC_NEWS.map((e) => `${e.nick}|${e.text}`)).size).toBe(NPC_NEWS.length);
    for (const user of ['ian', 'luna']) {
      const cands = candsFor(user);
      for (const t of SOCIAL) expect(cands.filter((c) => c.type === t).length, `${user} · ${t}`).toBeGreaterThanOrEqual(3);
    }
  });
  it('ya no trae "va 2º en su liga" (las medallas de liga son solo del cierre de la semana)', () => {
    expect(NPC_NEWS.filter((e) => /\bva \d+º en su Liga|podio/i.test(e.text))).toEqual([]);
  });
});
