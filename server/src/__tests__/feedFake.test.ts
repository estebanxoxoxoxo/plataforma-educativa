import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* Tanda "Feed diverso" (28-oct): el Feed fake de punta a punta — la ráfaga de "Simular NPCs" (EXACTAMENTE 5, una de cada
   tipo: racha, insignia, unidad, ruta compartida y la carrera de la liga) y el seed de cada franja (cards de muchos tipos).
   Se mockea TODO lo que lee o escribe server/data (parent.json, el catálogo, Learn, los NPCs de friendsFake, el ciclo de
   leaguesFake); quedan de verdad feedFake.ts, feedMix.ts, learnProgress.ts (puro), perUser/requestContext/users (solo leen
   la config, como en perUser.test.ts) y zonedClock. */

const FLAGS = vi.hoisted(() => ({ amigos: true, ligas: true, tienda: true, chat: true } as Record<string, boolean>));

vi.mock('../parent', () => ({
  familyBlockedTerms: () => [], familyTopics: () => ({ white: [], black: [] }), familyTz: () => null,
  featureOnNow: (k: string) => FLAGS[k] !== false, feedMotion: () => 'normal', topicHit: () => null,
}));
vi.mock('../filters', () => ({ matchBlockedWord: () => null }));
vi.mock('../learnResults', () => ({ LEARN_EC: 30, resultRows: () => [] }));
vi.mock('../learnRoutes', () => ({
  catalogRoutes: () => [
    { id: 'ruta.a', title: 'Ruta A', emoji: '🪐', postas: [{ target: 'a1' }, { target: 'a2' }, { target: 'a3' }] },
    { id: 'ruta.b', title: 'Ruta B', emoji: '🌋', postas: [{ target: 'b1' }, { target: 'b2' }] },
  ],
}));
vi.mock('../videos', () => ({
  // 6 videos por tema, cortitos (entran de día y de noche)
  searchVideosStrict: (q: string, lim = 24) => Array.from({ length: Math.min(lim, 6) }, (_, i) => ({
    videoId: `${q.replace(/\s+/g, '_')}-${i}`, title: `${q} ${i}`, thumb: '', channelId: 'c', channelTitle: 'Canal', source: 'Canal',
    description: '', duration: 120 + i * 30, addedAt: 0, tags: [], topics: [],
  })),
  toVideoResult: (v: { videoId: string; title: string }) => ({ id: v.videoId, img: '', title: v.title, subtitle: '', duration: '2:00', channel: 'Canal', date: '' }),
}));
vi.mock('../friendsFake', async () => {
  const { currentUser } = await import('../requestContext');
  const VIS: Record<string, string[]> = {
    ian: ['TomiCohete', 'LuliVolcan', 'MateoDino', 'CataEstrella', 'JuanchiRayo', 'MartuLuna', 'NicoRobot'],
    luna: ['CataEstrella', 'MartuLuna', 'LeaTelescopio', 'TriniPiano', 'FedeAjedrez'],
  };
  const vis = () => VIS[currentUser()?.id ?? 'ian'] ?? [];
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
    npcInfo: (nick: string) => ({ id: nick, color: '#123456', girl: false }),
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
    npcPractice: (r: () => number, count: number, avoid: ReadonlySet<string> = new Set()) => {
      const free = TABLE.filter((n) => !avoid.has(n));
      return count > 0 ? [{ nick: free[Math.floor(r() * free.length)], color: '#3A5BD9', gain: 20 + Math.floor(r() * 30), from: 6, to: 5, passedMe: false, league: 'Liga Cometa' }] : [];
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
const FIVE = ['badge', 'race', 'route', 'streak', 'unit'];

beforeEach(() => { Object.assign(FLAGS, { amigos: true, ligas: true }); resetFeed(); });
afterEach(() => { vi.useRealTimers(); });

describe('Simular NPCs: 5 por toque, una de cada tipo', () => {
  it('3 ráfagas seguidas de Ian → 15 noticias; cada ráfaga con los 5 tipos, 5 protagonistas distintos y nada repetido', () => {
    runAsUser('ian', () => {
      expect([simulateNpcs(), simulateNpcs(), simulateNpcs()]).toEqual([{ added: 5 }, { added: 5 }, { added: 5 }]);
      const bursts = liveBursts();
      expect(bursts.flat()).toHaveLength(15);
      for (const b of bursts) {
        expect(b.map(typeOf).sort()).toEqual(FIVE);
        expect(new Set(b.map(protagonist)).size).toBe(5);
      }
      const ids = bursts.flat().map(identity);
      expect(new Set(ids).size).toBe(ids.length);
      // la ruta compartida es del catálogo real (mock) y cambia de ruta entre ráfagas seguidas
      const routes = bursts.map((b) => (b.find((it) => it.kind === 'route') as Extract<Item, { kind: 'route' }>).course.id);
      expect(routes[0]).not.toBe(routes[1]);
      expect(routes[1]).not.toBe(routes[2]);
    });
  });

  it('aislamiento: la ráfaga de Luna es SUYA (de las amigas que ve) y no toca el feed de Ian', () => {
    runAsUser('ian', () => { simulateNpcs(); simulateNpcs(); });
    runAsUser('luna', () => {
      expect(simulateNpcs()).toEqual({ added: 5 });
      const [b] = liveBursts();
      expect(b.map(typeOf).sort()).toEqual(FIVE);
      for (const it of b.filter((x) => typeOf(x) !== 'race')) expect(['CataEstrella', 'MartuLuna', 'LeaTelescopio', 'TriniPiano', 'FedeAjedrez']).toContain(protagonist(it));
    });
    runAsUser('ian', () => expect(liveBursts().flat()).toHaveLength(10));
  });

  it('con Ligas apagado salen 4 (sin la carrera, sin repetir tipo); con Amigos apagado no entra nada', () => {
    FLAGS.ligas = false;
    runAsUser('ian', () => {
      expect(simulateNpcs()).toEqual({ added: 4 });
      expect(liveBursts().flat().map(typeOf).sort()).toEqual(['badge', 'route', 'streak', 'unit']);
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
