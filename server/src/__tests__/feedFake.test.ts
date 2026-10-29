import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* Tanda "Feed diverso" (28-oct): el Feed fake de punta a punta — la ráfaga de "Simular NPCs" y el seed de cada franja (cards
   de muchos tipos). Tanda "Ráfaga variada" (29-oct): la ráfaga ya no es una de cada tipo sino 5 de composición SORTEADA
   (feedMix.composeBurst: hasta 2 por tipo entre racha, insignia, unidad, ruta compartida, medalla de liga y carrera).
   Se mockea TODO lo que lee o escribe server/data (parent.json, el catálogo, Learn, los NPCs de friendsFake, el ciclo de
   leaguesFake); quedan de verdad feedFake.ts, feedMix.ts, learnProgress.ts (puro), perUser/requestContext/users (solo leen
   la config, como en perUser.test.ts) y zonedClock. */

const FLAGS = vi.hoisted(() => ({ amigos: true, ligas: true, tienda: true, chat: true } as Record<string, boolean>));
/** FS-BASE-B: el catálogo aprobado del mock —su versión (familyCatalogVersion) y lo que la familia des-aprobó (sale de
 *  searchVideosStrict)—, para el caso "el Feed tras des-aprobar un video". */
const CAT = vi.hoisted(() => ({ version: 0, removed: new Set<string>() }));
/** Las filas de Learn del usuario (resultRows): para el caso "con una ruta en curso" del resumen de la noche. */
const ROWS = vi.hoisted(() => ({ list: [] as { target: string; pct: number; source?: string; finishedAt?: number }[] }));

vi.mock('../parent', () => ({
  familyBlockedTerms: () => [], familyTopics: () => ({ white: [], black: [] }), familyTz: () => null,
  featureOnNow: (k: string) => FLAGS[k] !== false, feedMotion: () => 'normal', topicHit: () => null,
}));
vi.mock('../filters', () => ({ matchBlockedWord: () => null }));
vi.mock('../learnResults', () => ({ LEARN_EC: 30, resultRows: () => ROWS.list }));
vi.mock('../learnRoutes', () => ({
  // FS-BASE-A: el Feed lee servedRoutes (lo que ve el usuario del pedido); acá, las mismas dos rutas
  servedRoutes: () => [
    { id: 'ruta.a', title: 'Ruta A', emoji: '🪐', postas: [{ target: 'a1' }, { target: 'a2' }, { target: 'a3' }] },
    { id: 'ruta.b', title: 'Ruta B', emoji: '🌋', postas: [{ target: 'b1' }, { target: 'b2' }] },
  ],
  // el catálogo CRUDO trae además una ruta que al usuario del pedido NO se le sirve (p. ej. la importó un hermano y no pasó
  // la moderación): el Feed nunca la puede mostrar (último caso de este archivo)
  catalogRoutes: () => [
    { id: 'ruta.a', title: 'Ruta A', emoji: '🪐', postas: [{ target: 'a1' }, { target: 'a2' }, { target: 'a3' }] },
    { id: 'ruta.b', title: 'Ruta B', emoji: '🌋', postas: [{ target: 'b1' }, { target: 'b2' }] },
    { id: 'ruta.cruda', title: 'Ruta Cruda', emoji: '🚫', postas: [{ target: 'c1' }] },
  ],
}));
vi.mock('../videos', () => ({
  // 6 videos por tema, cortitos (entran de día y de noche), menos lo des-aprobado
  searchVideosStrict: (q: string, lim = 24) => Array.from({ length: Math.min(lim, 6) }, (_, i) => ({
    videoId: `${q.replace(/\s+/g, '_')}-${i}`, title: `${q} ${i}`, thumb: '', channelId: 'c', channelTitle: 'Canal', source: 'Canal',
    description: '', duration: 120 + i * 30, addedAt: 0, tags: [], topics: [],
  })).filter((v) => !CAT.removed.has(v.videoId)),
  familyCatalogVersion: () => CAT.version,
  toVideoResult: (v: { videoId: string; title: string }) => ({ id: v.videoId, img: '', title: v.title, subtitle: '', duration: '2:00', channel: 'Canal', date: '' }),
}));
vi.mock('../friendsFake', async () => {
  const { currentUser } = await import('../requestContext');
  // FS-BASE-B (hallazgo feedMix.test.ts:122): quién ve a quién sale del seed REAL (npcRoster.ts, el mismo que friendsFake
  // verifica al arrancar), no de una copia a mano.
  const { GRAPH_IDS, NPC_ROSTER, visibleNicksAtStart } = await import('../npcRoster');
  const vis = () => visibleNicksAtStart(currentUser()?.id ?? 'ian');
  const requests = () => (GRAPH_IDS[currentUser()?.id ?? 'ian']?.requests ?? []).map((id) => NPC_ROSTER.find((n) => n.id === id)!.nick);
  // Un seed social como el de friendsFake.NEWS (subtipos alternados + lo de ligas que se reparte en el cierre)
  const NEWS: [string, string, string][] = [
    ['MateoDino', 'ganó la medalla de oro 🥇 en la Liga Cometa', 'medal'], ['TomiCohete', 'llegó a una racha de 12 días', 'streak'],
    ['LuliVolcan', 'se ganó la insignia «Guardiana»', 'badge'], ['MartuLuna', 'compartió la ruta «El cuerpo»', 'route'],
    ['CataEstrella', 'subió a la Liga Estrella ⭐', 'league'], ['JuanchiRayo', 'terminó la unidad 1', 'unit'],
    ['MateoDino', 'completó 40 pasos', 'streak'], ['TomiCohete', 'ganó la medalla de bronce 🥉', 'medal'],
    ['LuliVolcan', 'compartió la ruta «Volcanes»', 'route'], ['LeaTelescopio', 'llegó a 7 días', 'streak'],
    ['TriniPiano', 'se ganó la insignia «Oído»', 'badge'], ['MateoDino', 'insignia «Paleontólogo»', 'badge'],
    ['CataEstrella', 'unidad «Greetings»', 'unit'], ['JuanchiRayo', 'racha nueva', 'streak'], ['FedeAjedrez', 'insignia «Acertijos»', 'badge'],
    ['LeaTelescopio', 'unidad «El Sol»', 'unit'], ['TomiCohete', 'unidad «Gigantes»', 'unit'], ['MartuLuna', 'insignia «Exploradora»', 'badge'],
    ['TriniPiano', 'unidad «Family»', 'unit'], ['FedeAjedrez', '35 pasos', 'streak'], ['NicoRobot', 'unidad «Sumar»', 'unit'],
    ['LeaTelescopio', 'insignia «Lunar»', 'badge'], ['MartuLuna', 'unidad «Sentidos»', 'unit'], ['TriniPiano', 'no cortó su racha', 'streak'],
    ['CataEstrella', 'insignia «Estrella Fugaz»', 'badge'],
  ];
  return {
    friendNews: () => NEWS.map(([nick, text, icon]) => ({ fid: nick, friend: { nick, color: '#123456' }, text, icon })),
    isVisibleNpc: (fid?: string) => !!fid && vis().includes(fid),
    npcInfo: (nick: string) => ({ id: nick, color: '#123456', girl: NPC_ROSTER.find((n) => n.nick === nick)?.girl ?? false }),
    npcRelation: (fid?: string) => (!fid || !vis().includes(fid) ? null : requests().includes(fid) ? 'request' : 'friend'),
    friendCount: () => vis().length,
  };
});
vi.mock('../leaguesFake', () => {
  const rng = (seed: number) => {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  const hashOf = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const shuffle = <T,>(xs: readonly T[], r: () => number) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const TABLE = ['FeliTrex', 'EmiFósil', 'NachoNova', 'SofiCometa', 'BautiRayo', 'ValenLuz', 'JuliMar', 'PedroPixel', 'RoAstro', 'TatiNube', 'LoloGeo'];
  return {
    cycleWeek: () => 0, hashOf, rng, shuffle, lastClose: () => null, lastCloseLabel: () => 'el domingo',
    MEDAL_EMOJI: { oro: '🥇', plata: '🥈', bronce: '🥉' },
    myLeague: () => ({ name: 'Liga Cometa', total: 12, closes: 'el domingo', closesInDays: 4, lastWeek: { pos: 2, medal: 'plata' } }),
    // Tanda "Ráfaga variada": como el de verdad, `count` compañeros DISTINTOS (antes el mock daba siempre uno: la ráfaga
    // pedía como mucho una carrera; ahora el sorteo puede pedir dos)
    npcPractice: (r: () => number, count: number, avoid: ReadonlySet<string> = new Set()) => {
      const out: { nick: string; color: string; gain: number; from: number; to: number; passedMe: boolean; league: string }[] = [];
      for (let k = 0; k < count; k++) {
        const all = TABLE.filter((n) => !out.some((o) => o.nick === n)), fresh = all.filter((n) => !avoid.has(n));
        const free = fresh.length ? fresh : all;
        if (!free.length) break;
        out.push({ nick: free[Math.floor(r() * free.length)], color: '#3A5BD9', gain: 20 + Math.floor(r() * 30), from: 6, to: 5, passedMe: false, league: 'Liga Cometa' });
      }
      return out;
    },
    sinceLabel: () => 'recién', weeksAgoLabel: (n: number) => `hace ${n} semanas`,
  };
});

const { getFeed, resetFeed, simulateNpcs } = await import('../feedFake');
const { runAsUser } = await import('../requestContext');
type Item = ReturnType<typeof getFeed>['items'][number];

const typeOf = (it: Item) => (it.kind === 'friend' ? (it.icon === 'league' ? 'race' : it.icon) : it.kind);
const identity = (it: Item) => (it.kind === 'route' ? `${it.reason}|${it.course.id}` : it.kind === 'friend' ? `${it.friend.nick}|${it.text}` : it.id);
const protagonist = (it: Item) => (it.kind === 'route' ? it.reason.replace('La compartió ', '') : it.kind === 'friend' ? it.friend.nick : '');
/** Lo que entró en vivo del usuario del pedido, agrupado por ráfaga (los ids fx-/fs- son correlativos: 5 por ráfaga). */
function liveBursts(): Item[][] {
  const live = getFeed().items.filter((it) => /^f[xs]-\d+$/.test(it.id)).sort((a, b) => Number(a.id.slice(3)) - Number(b.id.slice(3)));
  const out: Item[][] = [];
  for (const it of live) { const k = Math.floor((Number(it.id.slice(3)) - 1) / 5); (out[k] ??= []).push(it); }
  return out.filter(Boolean);
}
/** Lo que la tanda "Ráfaga variada" exige de CADA ráfaga: 5 noticias, como mucho 2 de un tipo (→ ≥ 3 tipos) y 5
 *  protagonistas distintos (las carreras son de compañeros de tu tabla: nunca un amigo). */
function expectBurst(b: Item[], label: string) {
  expect(b, label).toHaveLength(5);
  const per = new Map<string, number>();
  for (const it of b) per.set(typeOf(it), (per.get(typeOf(it)) ?? 0) + 1);
  expect(Math.max(...per.values()), `${label}: ${b.map(typeOf).join(', ')}`).toBeLessThanOrEqual(2);
  expect(per.size, label).toBeGreaterThanOrEqual(3);
  expect(new Set(b.map(protagonist)).size, label).toBe(5);
}
const mixOf = (b: Item[]) => b.map(typeOf).sort().join(',');
const refsOf = (b: Item[]) => b.flatMap((it) => (it.kind === 'route' ? [it.course.id] : []));

beforeEach(() => { Object.assign(FLAGS, { amigos: true, ligas: true }); resetFeed(); ROWS.list = []; });
afterEach(() => { vi.useRealTimers(); });

// Tanda "Ráfaga variada" (29-oct): antes cada ráfaga era EXACTAMENTE los 5 tipos, una de cada (FIVE) y con Ligas apagado
// salían 4; ahora la composición se sortea (pedido del dueño: «tienen que ser de todo tipo y random»). Lo que sigue
// valiendo se afirma igual: 5 por toque, protagonistas distintos, nada repetido, la ruta cambia entre ráfagas seguidas.
describe('Simular NPCs: 5 por toque, de composición sorteada', () => {
  it('3 ráfagas seguidas de Ian → 15 noticias; cada una con ≤ 2 por tipo, ≥ 3 tipos, 5 protagonistas distintos y nada repetido', () => {
    runAsUser('ian', () => {
      expect([simulateNpcs(), simulateNpcs(), simulateNpcs()]).toEqual([{ added: 5 }, { added: 5 }, { added: 5 }]);
      const bursts = liveBursts();
      expect(bursts.flat()).toHaveLength(15);
      bursts.forEach((b, i) => expectBurst(b, `ráfaga ${i + 1}`));
      const ids = bursts.flat().map(identity);
      expect(new Set(ids).size).toBe(ids.length);
      // la composición no se repite dos veces seguidas
      expect(mixOf(bursts[1])).not.toBe(mixOf(bursts[0]));
      expect(mixOf(bursts[2])).not.toBe(mixOf(bursts[1]));
      // las rutas compartidas son del catálogo real (mock), distintas dentro de la ráfaga y nunca la de la ráfaga anterior
      for (let i = 0; i < bursts.length; i++) {
        const refs = refsOf(bursts[i]);
        expect(new Set(refs).size).toBe(refs.length);
        if (i > 0) for (const ref of refs) expect(refsOf(bursts[i - 1])).not.toContain(ref);
      }
    });
  });

  it('6 ráfagas de Ian: la composición VARÍA (nunca la misma dos veces seguidas), hay medallas de liga de amigos con los 3 tintes y cada ráfaga cumple las reglas', () => {
    runAsUser('ian', () => {
      for (let i = 0; i < 6; i++) expect(simulateNpcs()).toEqual({ added: 5 });
      const bursts = liveBursts();
      bursts.forEach((b, i) => expectBurst(b, `ráfaga ${i + 1}`));
      for (let i = 1; i < bursts.length; i++) expect(mixOf(bursts[i]), `ráfaga ${i + 1}`).not.toBe(mixOf(bursts[i - 1]));
      expect(new Set(bursts.map(mixOf)).size).toBeGreaterThanOrEqual(3);
      const medals = bursts.flat().filter((it): it is Extract<Item, { kind: 'friend' }> => it.kind === 'friend' && it.icon === 'medal');
      for (const tint of ['🥇', '🥈', '🥉']) expect(medals.some((it) => it.text.includes(tint)), `sin ${tint}: ${medals.map((it) => it.text).join(' | ')}`).toBe(true);
      // de quien Ian ve, con el "por qué" de su grafo
      for (const it of medals) expect(['TomiCohete', 'LuliVolcan', 'MateoDino', 'MartuLuna']).toContain(it.friend.nick);
      for (const it of medals) expect(it.reason).toMatch(/ es tu amig[oa]$/);
    });
  });

  it('aislamiento: la ráfaga de Luna es SUYA (de las amigas que ve) y no toca el feed de Ian', () => {
    runAsUser('ian', () => { simulateNpcs(); simulateNpcs(); });
    runAsUser('luna', () => {
      expect(simulateNpcs()).toEqual({ added: 5 });
      const [b] = liveBursts();
      expectBurst(b, 'Luna');
      for (const it of b.filter((x) => typeOf(x) !== 'race')) expect(['CataEstrella', 'MartuLuna', 'LeaTelescopio', 'TriniPiano', 'FedeAjedrez']).toContain(protagonist(it));
    });
    runAsUser('ian', () => expect(liveBursts().flat()).toHaveLength(10));
  });

  it('con Ligas apagado: sin carrera ni medallas, y 5 igual (alcanzan los candidatos); con Amigos apagado no entra nada', () => {
    FLAGS.ligas = false;
    runAsUser('ian', () => {
      for (let i = 0; i < 6; i++) expect(simulateNpcs()).toEqual({ added: 5 });
      const bursts = liveBursts();
      bursts.forEach((b, i) => expectBurst(b, `sin Ligas, ráfaga ${i + 1}`));
      expect(new Set(bursts.flat().map(typeOf))).toEqual(new Set(['badge', 'route', 'streak', 'unit']));
    });
    FLAGS.amigos = false;
    runAsUser('ian', () => expect(simulateNpcs()).toEqual({ added: 0 }));
  });
});

describe('el seed por defecto: cards de muchos tipos en TODAS las franjas', () => {
  const HOURS: [string, number][] = [['mañana', 9], ['tarde', 16], ['noche', 21]];
  for (const [name, hour] of HOURS) {
    it(`${name}: la edición trae ≥ 10 tipos de card, cada página completa ≥ 4 y nunca dos del mismo kind seguidos`, () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 28, hour, 30)); // miércoles, hora local del server (tz de la familia: null)
      runAsUser('ian', () => {
        const first = getFeed();
        expect(first.items.find((it) => it.kind === 'summary')).toMatchObject({ title: `Tu ${name} de miércoles` });
        const pages: Item[][] = [first.items];
        for (let next = first.next; next; ) { const r = getFeed(next); pages.push(r.items); next = r.next; }
        const all = pages.flat();
        const types = new Set(all.map(typeOf));
        for (const t of ['next', 'videos', 'summary', 'video', 'article', 'route', 'league', 'streak', 'badge', 'unit']) expect(types, `${name}: falta ${t}`).toContain(t);
        // la edición sembrada (sin hero, grilla ni resumen): página por página
        const seeded = pages.map((p) => p.filter((it) => it.kind !== 'next' && it.kind !== 'videos' && it.kind !== 'summary'));
        for (const p of seeded.filter((pg) => pg.length >= 9)) expect(new Set(p.map(typeOf)).size, p.map(typeOf).join(' > ')).toBeGreaterThanOrEqual(4);
        const kinds = seeded.flat().map((it) => it.kind);
        for (let i = 1; i < kinds.length; i++) expect(kinds[i] === kinds[i - 1] && kinds[i] !== 'friend', `${name} #${i}: ${kinds[i]}`).toBe(false);
        // lo del cierre de liga no entra en bloque: nunca dos noticias de liga pegadas
        const leagueish = seeded.flat().map((it) => it.kind === 'league' || (it.kind === 'friend' && (it.icon === 'medal' || it.icon === 'league')));
        for (let i = 1; i < leagueish.length; i++) expect(leagueish[i] && leagueish[i - 1]).toBe(false);
      });
    });
  }
});

describe('FS-BASE-A: el Feed sirve las rutas como las ve el usuario del pedido (servedRoutes), nunca el catálogo crudo', () => {
  it('una ruta que no se le sirve no aparece en ninguna página ni en las ráfagas de NPCs («La compartió …»)', () => {
    runAsUser('ian', () => {
      for (let i = 0; i < 4; i++) simulateNpcs();
      const pages = [getFeed()];
      for (let next = pages[0].next; next; ) { const r = getFeed(next); pages.push(r); next = r.next; }
      const all = JSON.stringify(pages);
      expect(all).toContain('ruta.a');
      expect(all).not.toContain('ruta.cruda');
      expect(all).not.toContain('Ruta Cruda');
    });
  });
});

/* ---------- FS-BASE-B ---------- */
/** Todas las páginas de la edición del usuario del pedido. */
function allItems(): Item[] {
  const out: Item[] = [];
  let page = getFeed();
  out.push(...page.items);
  for (let guard = 0; page.next && guard < 50; guard++) { page = getFeed(page.next); out.push(...page.items); }
  return out;
}
const videoIds = () => allItems().flatMap((it) => (it.kind === 'video' ? [it.video.id] : it.kind === 'videos' ? it.videos.map((v) => v.id) : []));

describe('FS-BASE-B: el pool del Feed sigue al catálogo aprobado (hallazgo feedFake.ts:302)', () => {
  it('el padre des-aprueba un video que el Feed servía (sube la versión del catálogo): el próximo GET ya no lo trae', () => {
    runAsUser('ian', () => {
      const before = videoIds();
      expect(before.length).toBeGreaterThan(0);
      const gone = before[0];
      CAT.removed.add(gone);
      CAT.version++; // mytube.removeYtEntry → reindex: la versión de la capa de la familia sube
      try { expect(videoIds()).not.toContain(gone); } finally { CAT.removed.clear(); CAT.version++; }
    });
  });
});

describe('FS-BASE-B: el "por qué" de un NPC según el grafo del activo (hallazgo feedFake.ts:194)', () => {
  it('a Luna, FedeAjedrez (solo una solicitud pendiente) "quiere ser tu amigo"; sus amigas, "es tu amiga"', () => {
    runAsUser('luna', () => {
      simulateNpcs(); simulateNpcs(); // también lo que entra en vivo pasa por el mismo "por qué"
      const social = allItems().filter((it): it is Extract<Item, { kind: 'friend' }> => it.kind === 'friend' && it.icon !== 'league');
      const fede = social.filter((it) => it.friend.nick === 'FedeAjedrez');
      expect(fede.length).toBeGreaterThan(0);
      for (const it of fede) expect(it.reason).toBe('FedeAjedrez quiere ser tu amigo'); // antes: «FedeAjedrez es tu amigo»
      const cata = social.find((it) => it.friend.nick === 'CataEstrella');
      expect(cata?.reason).toBe('CataEstrella es tu amiga');
    });
  });
});

describe('FS-BASE-B: el resumen dice la verdad sobre el hero (hallazgo feedFake.ts:382)', () => {
  const first = () => getFeed().items;
  const hero = (xs: Item[]) => xs.find((it): it is Extract<Item, { kind: 'next' }> => it.kind === 'next')!;
  const sum = (xs: Item[]) => xs.find((it): it is Extract<Item, { kind: 'summary' }> => it.kind === 'summary')!;
  const at = (h: number) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 29, h, 0)); }; // hora LOCAL (sin zona de la familia)
  it('de noche sin ruta en curso: el hero es "Empezá …" y el resumen NO promete "un repaso sin apuro"', () => {
    at(23);
    runAsUser('ian', () => {
      const xs = first();
      expect(hero(xs).title).toMatch(/^Empezá /);
      expect(sum(xs).desc).not.toMatch(/repaso/);
      expect(sum(xs).desc).toMatch(/tranquila/);
    });
  });
  it('de noche CON una ruta en curso: "Repasá …, sin apuro" y el resumen sí lo dice', () => {
    at(23);
    ROWS.list = [{ target: 'a1', pct: 1, source: 'ruta:ruta.a/posta:a1', finishedAt: Date.now() - 3600e3 }];
    runAsUser('ian', () => {
      const xs = first();
      expect(hero(xs).title).toMatch(/^Repasá Ruta A, sin apuro/);
      expect(sum(xs).desc).toMatch(/un repaso sin apuro/);
    });
  });
  it('a la tarde: "a la nochecita cambia a repaso tranquilo" solo si de verdad va a haber repaso', () => {
    at(16);
    runAsUser('ian', () => { expect(sum(first()).later).not.toMatch(/repaso/); });
    ROWS.list = [{ target: 'a1', pct: 1, source: 'ruta:ruta.a/posta:a1', finishedAt: Date.now() - 3600e3 }];
    runAsUser('ian', () => { expect(sum(first()).later).toMatch(/repaso tranquilo/); });
  });
});
