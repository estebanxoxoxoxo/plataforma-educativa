import { describe, expect, it } from 'vitest';
import {
  BURST_MAX_PER_TYPE, BURST_SIZE, EDITIONS, NPC_MEDALS, NPC_NEWS, SHARERS, SLOTS, composeBurst, interleave, mixKey, newBurstMemory,
  planBurst, roundRobinBy, spaceOut,
  type BurstCand, type BurstMemory, type Daypart, type Slot,
} from '../feedMix';
import { visibleNicksAtStart } from '../npcRoster';

/* Tanda "Feed diverso" (28-oct; pedido del dueño: «el botón de lanzar NPC que sean 5 por vez y de diversos tipos; y que los
   que vienen por default sean más diversos»). Las reglas PURAS de server/src/feedMix.ts: la edición sembrada (cabeza con la
   plantilla de la franja + resto balanceado), lo del cierre de liga espaciado y el plan de la ráfaga (una por tipo social,
   sin repetir hasta agotar). Tanda "Ráfaga variada" (29-oct): la ráfaga del server pasa a composeBurst (composición
   sorteada, hasta 2 por tipo, con medallas de liga): los casos de planBurst SIN cupo siguen fijando las reglas finas en el
   modo de una por tipo (el mismo código, con cupo 1: da exactamente lo mismo que antes) y los de composeBurst, abajo, las
   fijan con el sorteo. Puro: no toca server/data. */

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
/** Los NPCs que ve cada chico en el seed de friendsFake (amigos + quien le pidió contacto). FS-BASE-B (hallazgo
 *  feedMix.test.ts:122): del seed REAL —npcRoster.ts, que friendsFake verifica al arrancar—, no de una copia a mano. */
const VISIBLE: Record<string, string[]> = { ian: visibleNicksAtStart('ian'), luna: visibleNicksAtStart('luna') };
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
  // Tanda "Ráfaga variada": las medallas de liga de los amigos ahora SÍ salen en la ráfaga, pero desde su pool (NPC_MEDALS,
  // abajo); NPC_NEWS sigue sin "va 2º en su liga" ni podios.
  it('ya no trae "va 2º en su liga" (las medallas de liga van en su pool aparte, NPC_MEDALS)', () => {
    expect(NPC_NEWS.filter((e) => /\bva \d+º en su Liga|podio/i.test(e.text))).toEqual([]);
  });
});

/* ---------- FS-BASE-B (hallazgo feedMix.ts:141) ---------- */
describe('la ráfaga no repite protagonista si hay alternativa, con las semillas REALES del server', () => {
  /** FNV-1a de leaguesFake (copia: leaguesFake arrastra parent.ts). Con rng: la semilla de feedFake.simulateNpcs. */
  const hashOf = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const run = (user: string, week: number, n: number) => {
    const mem = newBurstMemory(), cands = candsFor(user);
    return Array.from({ length: n }, (_, i) => planBurst(cands, mem, rng(hashOf(`npcs:${i + 1}:${week}`))));
  };
  it('el caso del hallazgo: la 7.ª ráfaga de Luna (antes: CataEstrella en insignia Y en unidad) trae 4 protagonistas distintos', () => {
    const b7 = run('luna', 0, 7)[6];
    expect(b7.map((c) => c.type)).toEqual(SOCIAL);
    expect(new Set(b7.map((c) => c.nick)).size).toBe(4);
  });
  for (const user of ['ian', 'luna']) {
    for (const week of [0, 1, 2]) {
      it(`${user}, semana ${week}: 300 ráfagas → nunca un protagonista dos veces, nunca un tipo dos veces, nunca lo de la ráfaga anterior`, () => {
        let prev = new Set<string>();
        for (const [i, b] of run(user, week, 300).entries()) {
          expect(b.map((c) => c.type), `ráfaga ${i + 1}`).toEqual(SOCIAL);
          expect(new Set(b.map((c) => c.nick)).size, `ráfaga ${i + 1}: ${b.map((c) => c.nick).join(', ')}`).toBe(4);
          for (const c of b) expect(prev.has(c.key), `ráfaga ${i + 1}: ${c.key}`).toBe(false);
          prev = new Set(b.map((c) => c.key));
        }
      });
    }
  }
});

/* ---------- tanda "Ráfaga variada" (29-oct): la composición sorteada ---------- */
// Pedido del dueño: «Simular npc siempre indica medallas de amigos supuestos. tienen que ser de todo tipo y random». Antes
// cada ráfaga era la misma plantilla (una racha, una insignia, una unidad, una ruta y la carrera). Ahora composeBurst sortea
// la composición entre seis tipos (con la MEDALLA DE LIGA de un amigo, nueva) con todas las reglas finas de planBurst.
describe('composeBurst: la ráfaga sorteada, con las semillas REALES del server', () => {
  /** FNV-1a de leaguesFake (copia: leaguesFake arrastra parent.ts). Con rng: la semilla de feedFake.simulateNpcs. */
  const hashOf = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  /** Los candidatos como los arma feedFake.simulateNpcs: lo de candsFor + (con Ligas) las medallas de quien ve. */
  const candsOf = (user: string, ligas = true, routes = ROUTES): BurstCand[] => [
    ...candsFor(user, routes),
    ...(ligas ? NPC_MEDALS.filter((m) => VISIBLE[user].includes(m.nick)).map((m): BurstCand => ({ key: m.key, type: 'medal', nick: m.nick })) : []),
  ];
  const run = (user: string, week: number, n: number, ligas = true, routes = ROUTES, mem: BurstMemory = newBurstMemory()) => {
    const cands = candsOf(user, ligas, routes);
    return Array.from({ length: n }, (_, i) => composeBurst(cands, mem, rng(hashOf(`npcs:${i + 1}:${week}`)), ligas ? BURST_MAX_PER_TYPE : 0));
  };
  type Plan = ReturnType<typeof run>[number];
  const typesOf = (p: Plan) => [...p.picks.map((c) => c.type as string), ...Array.from({ length: p.race }, () => 'race')];

  it('es determinística: mismo usuario, número de ráfaga y semana → misma ráfaga', () => {
    const keys = (ps: Plan[]) => ps.map((p) => [mixKey(p.mix), p.picks.map((c) => c.key).join()]);
    expect(keys(run('ian', 0, 8))).toEqual(keys(run('ian', 0, 8)));
    expect(keys(run('ian', 0, 8))).not.toEqual(keys(run('ian', 1, 8))); // otra semana, otras ráfagas
  });

  for (const user of ['ian', 'luna']) {
    it(`${user}: 6 ráfagas seguidas → 5 cada una, nunca > 2 del mismo tipo, ≥ 3 tipos, protagonistas distintos y la composición VARÍA`, () => {
      const ps = run(user, 0, 6);
      for (const [i, p] of ps.entries()) {
        const ts = typesOf(p);
        expect(ts, `ráfaga ${i + 1}`).toHaveLength(BURST_SIZE);
        expect(Math.max(...[...new Set(ts)].map((t) => ts.filter((x) => x === t).length)), `ráfaga ${i + 1}: ${ts}`).toBeLessThanOrEqual(2);
        expect(new Set(ts).size, `ráfaga ${i + 1}`).toBeGreaterThanOrEqual(3);
        expect(new Set(p.picks.map((c) => c.nick)).size, `ráfaga ${i + 1}`).toBe(p.picks.length);
        for (const c of p.picks) expect(VISIBLE[user]).toContain(c.nick);
        if (i > 0) expect(mixKey(p.mix), `ráfaga ${i + 1}`).not.toBe(mixKey(ps[i - 1].mix));
      }
      expect(new Set(ps.map((p) => mixKey(p.mix))).size).toBeGreaterThanOrEqual(2);
    });
  }

  it('las medallas de liga salen con los TRES tintes a lo largo de las ráfagas (Ian y Luna)', () => {
    const tint = new Map(NPC_MEDALS.map((m) => [m.key, m.medal]));
    for (const user of ['ian', 'luna']) {
      const got = new Set(run(user, 0, 12).flatMap((p) => p.picks.filter((c) => c.type === 'medal').map((c) => tint.get(c.key))));
      expect(got, user).toEqual(new Set(['oro', 'plata', 'bronce']));
    }
  });

  for (const user of ['ian', 'luna']) {
    for (const week of [0, 1, 2]) {
      it(`${user}, semana ${week}: 300 ráfagas → todas las reglas finas, en cada una y entre seguidas`, () => {
        let prev: Plan | null = null;
        let early = 0;
        const seen: Record<string, Set<string>> = {};
        const all = (t: string) => candsOf(user).filter((c) => c.type === t).map((c) => c.key);
        for (const [i, p] of run(user, week, 300).entries()) {
          const at = `ráfaga ${i + 1}`, ts = typesOf(p);
          expect(ts, at).toHaveLength(5);
          expect(Math.max(...[...new Set(ts)].map((t) => ts.filter((x) => x === t).length)), at).toBeLessThanOrEqual(2);
          // protagonistas distintos, siempre (con la carrera: compañeros de la tabla, nunca un amigo)
          expect(new Set(p.picks.map((c) => c.nick)).size, `${at}: ${p.picks.map((c) => c.nick)}`).toBe(p.picks.length);
          // dos rutas de la misma ráfaga, rutas distintas; y nunca la ruta de la ráfaga anterior (con 2 rutas en el catálogo)
          const refs = p.picks.flatMap((c) => (c.ref ? [c.ref] : []));
          expect(new Set(refs).size, at).toBe(refs.length);
          if (prev) {
            const before = prev.picks.flatMap((c) => (c.ref ? [c.ref] : []));
            for (const ref of refs) expect(before, `${at}: ruta ${ref}`).not.toContain(ref);
            // nunca lo de la ráfaga anterior, y nunca la misma composición dos veces seguidas
            for (const c of p.picks) expect(prev.picks.map((x) => x.key), `${at}: ${c.key}`).not.toContain(c.key);
            expect(mixKey(p.mix), at).not.toBe(mixKey(prev.mix));
          }
          // no repetir hasta agotar el tipo: una noticia que vuelve encuentra su tipo agotado (salvo el reciclado mínimo de
          // FS-BASE-B, cuando no hay otra forma de tener protagonistas distintos)
          for (const t of new Set(p.picks.map((c) => c.type))) {
            const ks = p.picks.filter((c) => c.type === t).map((c) => c.key), s = (seen[t] ??= new Set());
            if (ks.some((k) => s.has(k))) {
              const after = new Set([...s, ...ks]);
              if (!all(t).every((k) => after.has(k) || prev!.picks.some((x) => x.key === k))) early++;
              seen[t] = new Set(ks);
            } else for (const k of ks) s.add(k);
          }
          prev = p;
        }
        // medido el 29-oct: Ian 0 en las tres semanas; Luna 0-3 de cada 300 (FS-BASE-B, con la ráfaga de antes: 16-30)
        expect(early).toBeLessThanOrEqual(user === 'ian' ? 0 : 5);
      });
    }
  }

  it('con Ligas apagado: ni carrera ni medallas, y 5 igual si alcanzan los candidatos (Ian y Luna)', () => {
    for (const user of ['ian', 'luna']) {
      for (const p of run(user, 0, 20, false)) {
        expect(p.race).toBe(0);
        expect(p.picks.filter((c) => c.type === 'medal')).toEqual([]);
        expect(p.picks).toHaveLength(5);
        expect(new Set(p.picks.map((c) => c.nick)).size).toBe(5);
      }
    }
  });

  it('si no alcanzan los candidatos, una ráfaga más CORTA (honestidad antes que relleno), nunca con repetidos de más', () => {
    const few: BurstCand[] = [{ key: 'b1', type: 'badge', nick: 'A' }, { key: 's1', type: 'streak', nick: 'B' }, { key: 's2', type: 'streak', nick: 'C' }];
    const p = composeBurst(few, newBurstMemory(), rng(1), 0);
    expect(p.picks.map((c) => c.key).sort()).toEqual(['b1', 's1', 's2']);
    expect(p.race).toBe(0);
    expect(composeBurst([], newBurstMemory(), rng(1), 0)).toMatchObject({ picks: [], race: 0 });
    // solo carreras posibles (sin amigos con noticias): como mucho 2
    expect(composeBurst([], newBurstMemory(), rng(1), 2)).toMatchObject({ picks: [], race: 2 });
  });

  it('dos de un mismo tipo y le quedaba UNA sin publicar: sale esa sí o sí y la otra recicla (nunca lo de la ráfaga anterior)', () => {
    const cands: BurstCand[] = [
      { key: 'u1', type: 'unit', nick: 'A' }, { key: 'u2', type: 'unit', nick: 'B' }, { key: 'u3', type: 'unit', nick: 'C' },
    ];
    const mem = newBurstMemory();
    mem.used = new Set(['u1', 'u2']); mem.lastKeys = ['u2']; mem.lastNicks = ['B'];
    const picks = planBurst(cands, mem, rng(4), { unit: 2 });
    expect(picks.map((c) => c.key).sort()).toEqual(['u1', 'u3']); // u3 (la que quedaba) + u1 (recicla; u2 fue la anterior)
    expect([...mem.used].sort()).toEqual(['u1', 'u3']); // el tipo vuelve a empezar con lo de ahora
  });
});

describe('el pool de medallas de liga (NPC_MEDALS)', () => {
  const EMOJI = { oro: '🥇', plata: '🥈', bronce: '🥉' } as const;
  it('claves únicas y que no chocan con NPC_NEWS; textos únicos; UNA medalla por NPC', () => {
    const keys = NPC_MEDALS.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(NPC_NEWS.map((e) => e.key)).not.toContain(k);
    expect(new Set(NPC_MEDALS.map((m) => m.text)).size).toBe(NPC_MEDALS.length);
    expect(new Set(NPC_MEDALS.map((m) => m.nick)).size).toBe(NPC_MEDALS.length);
  });
  it('cada texto lleva el emoji de SU medalla y ningún otro (el cliente pinta el tinte por el emoji)', () => {
    for (const m of NPC_MEDALS) {
      expect(m.text, m.key).toContain(EMOJI[m.medal]);
      for (const other of Object.values(EMOJI).filter((e) => e !== EMOJI[m.medal])) expect(m.text, m.key).not.toContain(other);
    }
  });
  it('nombra la liga de hoy del NPC y, si nombra otra, es la de abajo en la escalera (podio → sube)', () => {
    // la escalera de leaguesFake.LADDER (copia: leaguesFake arrastra parent.ts)
    const LADDER = ['Liga Chispa', 'Liga Cometa', 'Liga Estrella', 'Liga Supernova', 'Liga Galaxia'];
    for (const m of NPC_MEDALS) {
      expect(m.text, m.key).toContain(m.league);
      const named = LADDER.filter((l) => m.text.includes(l));
      const below = LADDER[LADDER.indexOf(m.league) - 1];
      for (const l of named) expect([m.league, below], `${m.key}: ${l}`).toContain(l);
    }
  });
  it('Ian y Luna ven, cada uno, medallas de los TRES metales', () => {
    for (const user of ['ian', 'luna']) {
      expect(new Set(NPC_MEDALS.filter((m) => VISIBLE[user].includes(m.nick)).map((m) => m.medal)), user).toEqual(new Set(['oro', 'plata', 'bronce']));
    }
  });
});
