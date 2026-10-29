import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* Tanda "Cards del feed" (29-oct; spec §4): que el seed haga aparecer TODOS los tipos de card. Con feedFake.ts, medals.ts
   y —a diferencia de feedFake.test.ts, que usa una copia— friendsFake.ts DE VERDAD: su pool NEWS y el grafo de cada
   usuario son los reales (si a Luna le falta un tipo de noticia, esto lo dice). Se mockea lo que lee server/data o llama
   a un modelo (parent, el catálogo, Learn, el ciclo de leaguesFake, chat/juez/llm de los NPCs). Lo que se prueba: la
   medalla propia sembrada (la más reciente de las reales; dedupe con la viva; dominios y palabras de la familia; fechada
   por su `at`; el adulto sin medallas no la tiene), `course.done` servido y la cobertura de kinds e íconos para Ian y Luna. */

const FLAGS = vi.hoisted(() => ({ amigos: true, ligas: true, tienda: true, chat: true } as Record<string, boolean>));
const BLOCK = vi.hoisted(() => ({ word: '' }));
/** Las filas de Learn del usuario (resultRows): el avance de las rutas. */
const ROWS = vi.hoisted(() => ({ list: [] as { target: string; pct: number; source?: string; finishedAt?: number }[] }));
/** La semana del ciclo de liga (0 = la del seed; cada cierre simulado suma una). */
const WEEK = vi.hoisted(() => ({ n: 0 }));

vi.mock('../parent', () => ({
  familyBlockedTerms: () => [], familyTopics: () => ({ white: [], black: [] }), familyTz: () => null,
  featureOnNow: (k: string) => FLAGS[k] !== false, featureOn: (k: string) => FLAGS[k] !== false, feedMotion: () => 'normal', topicHit: () => null,
  // lo que friendsFake importa además (no se llama en estos casos)
  blackTopicsAll: () => [], notifyParent: () => {}, notifyUnreviewed: () => {},
}));
vi.mock('../filters', () => ({ matchBlockedWord: (text: string) => (BLOCK.word && text.includes(BLOCK.word) ? BLOCK.word : null) }));
vi.mock('../learnResults', () => ({ LEARN_EC: 30, resultRows: () => ROWS.list }));
vi.mock('../learnRoutes', () => {
  const routes = [
    { id: 'ruta.a', title: 'Ruta A', emoji: '🪐', postas: [{ target: 'a1' }, { target: 'a2' }, { target: 'a3' }] },
    { id: 'ruta.b', title: 'Ruta B', emoji: '🌋', postas: [{ target: 'b1' }, { target: 'b2' }] },
  ];
  return { servedRoutes: () => routes, catalogRoutes: () => routes };
});
vi.mock('../videos', () => ({
  searchVideosStrict: (q: string, lim = 24) => Array.from({ length: Math.min(lim, 6) }, (_, i) => ({
    videoId: `${q.replace(/\s+/g, '_')}-${i}`, title: `${q} ${i}`, thumb: '', channelId: 'c', channelTitle: 'Canal', source: 'Canal',
    description: '', duration: 120 + i * 30, addedAt: 0, tags: [], topics: [],
  })),
  familyCatalogVersion: () => 0,
  toVideoResult: (v: { videoId: string; title: string }) => ({ id: v.videoId, img: '', title: v.title, subtitle: '', duration: '2:00', channel: 'Canal', date: '' }),
}));
vi.mock('../leaguesFake', () => {
  const rng = (seed: number) => {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  const hashOf = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const shuffle = <T,>(xs: readonly T[], r: () => number) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const TABLE = ['FeliTrex', 'EmiFósil', 'NachoNova', 'SofiCometa', 'BautiRayo', 'ValenLuz', 'JuliMar', 'PedroPixel', 'RoAstro', 'TatiNube', 'LoloGeo'];
  // sinceLabel y weeksAgoLabel como los de leaguesFake (días de pared; sin zona de la familia = la hora local)
  const dayNum = (t: number) => { const d = new Date(t); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
  const sinceLabel = (at: number, now = Date.now()) => {
    const min = Math.floor((now - at) / 60000);
    if (min < 1) return 'recién';
    const days = dayNum(now) - dayNum(at);
    if (days <= 0) return min < 60 ? `hace ${min} min` : `hace ${Math.floor(min / 60)} h`;
    return days === 1 ? 'ayer' : `hace ${days} días`;
  };
  return {
    cycleWeek: () => WEEK.n, hashOf, rng, shuffle, lastClose: () => null, lastCloseLabel: () => 'el domingo',
    MEDAL_EMOJI: { oro: '🥇', plata: '🥈', bronce: '🥉' },
    myLeague: () => ({ name: 'Liga Cometa', total: 12, closes: 'el domingo', closesInDays: 4, lastWeek: { pos: 2, medal: 'plata' } }),
    // Tanda "Ráfaga variada" (29-oct): como el de verdad, `count` compañeros DISTINTOS (antes el mock daba siempre uno y la
    // ráfaga que sortea dos carreras quedaba en 4: "debajo de lo vivo" esperaba 5)
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
    sinceLabel, weeksAgoLabel: (n: number) => (n <= 1 ? 'la semana pasada' : `hace ${n} semanas`),
  };
});
// friendsFake de verdad: lo que usa para chatear (modelo, jueces, guion de crisis) no se llama acá
vi.mock('../chat', () => ({ guionCrisis: () => '', safetyLine: () => '' }));
vi.mock('../crisisNet', () => ({ crisisNetHit: () => null }));
vi.mock('../judge', () => ({ judgeOutput: async () => ({ ok: true }) }));
vi.mock('../llm', () => ({ complete: async () => ({ text: '' }), parseJudgeJson: () => ({}), spotlight: (s: string) => s }));

const { feedLess, getFeed, resetFeed, simulateNpcs } = await import('../feedFake');
const { resetFriends } = await import('../friendsFake');
const M = await import('../medals');
const { runAsUser } = await import('../requestContext');
import type { MedalFacts } from '../medalRules';

/** Los hechos de cada usuario que no son del grafo (el de amigos —«Primer amigo»— lo aporta friendsFake, el real). */
const F: Record<string, Partial<MedalFacts>> = {};
M.registerMedalFacts((uid) => F[uid] ?? {}, 'test');
// Sin candados en la pila: acá el dominio lo decide SOLO el feed (liveAllowed por featureOnNow), que es lo que se prueba.
M.registerMedalGate(() => true);

type Item = ReturnType<typeof getFeed>['items'][number];
type MedalItem = Extract<Item, { kind: 'medal' }>;
/** Todas las páginas de la edición del usuario del pedido. */
function allItems(): Item[] {
  let page = getFeed();
  const out: Item[] = [...page.items];
  for (let guard = 0; page.next && guard < 50; guard++) { page = getFeed(page.next); out.push(...page.items); }
  return out;
}
const medalsOfFeed = (uid: string): MedalItem[] => runAsUser(uid, () => allItems().filter((it): it is MedalItem => it.kind === 'medal'));
const seedIds = (uid: string) => medalsOfFeed(uid).map((it) => it.id);
/** Re-siembra las medallas de `uid` con los hechos de ahora (todas vistas: nada entra en vivo). */
const seedWith = (uid: string, facts: Partial<MedalFacts>) => { F[uid] = facts; M.resetMedals(uid); };
/** Un "ahora" fijo: jueves 29-oct-2026, 15 h local. */
const NOW = new Date(2026, 9, 29, 15, 0).getTime();
const H = 3600e3;

beforeEach(() => {
  Object.assign(FLAGS, { amigos: true, ligas: true });
  BLOCK.word = ''; WEEK.n = 0; ROWS.list = [];
  for (const k of Object.keys(F)) delete F[k];
  resetFeed(); resetFriends(); M.resetMedals();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => { vi.useRealTimers(); });

describe('la medalla propia sembrada (spec §4.1)', () => {
  it('con medallas reales, la MÁS RECIENTE entra en la primera página: debajo del hero y de lo vivo, id estable fm-seed-<medalla>, sin reacciones', () => {
    seedWith('ian', { completedTargets: 1, firstCompletedAt: NOW - 72 * H, routesCompleted: 1, firstRouteCompletedAt: NOW - 2 * H });
    runAsUser('ian', () => {
      simulateNpcs(); // 5 noticias en vivo: la sembrada va DEBAJO de ellas
      const items = getFeed().items;
      const at = items.findIndex((it) => it.id === 'fm-seed-ruta-completa');
      expect(items[0].kind).toBe('next');
      expect(items.slice(1, at).map((it) => it.id)).toHaveLength(5);
      for (const it of items.slice(1, at)) expect(it.id).toMatch(/^f[xs]-\d+$/);
      expect(items[at]).toEqual({
        kind: 'medal', id: 'fm-seed-ruta-completa', time: 'hace 2 h', reason: 'Es tu medalla más reciente',
        medal: { id: 'ruta-completa', emoji: '🗺️', title: 'Ruta completa', text: 'Completaste todas las postas de una ruta.', at: NOW - 2 * H },
      });
      // estable entre pedidos y UNA sola en toda la edición (las páginas siguientes no la traen)
      expect(getFeed().items.findIndex((it) => it.id === 'fm-seed-ruta-completa')).toBe(at);
    });
    expect(seedIds('ian')).toEqual(['fm-seed-ruta-completa']);
  });

  it('fechada por su `at`: de hoy como lo vivo, de ayer "ayer", más vieja o sin fecha "esta semana"; tras un cierre simulado, lo viejo como lo sembrado', () => {
    const timeFor = (uid: string) => medalsOfFeed(uid)[0]?.time;
    seedWith('ian', { savedEver: 1, firstSavedAt: NOW - 3 * H });
    expect(timeFor('ian')).toBe('hace 3 h');
    seedWith('ian', { savedEver: 1, firstSavedAt: new Date(2026, 9, 28, 10, 0).getTime() });
    expect(timeFor('ian')).toBe('ayer');
    seedWith('ian', { savedEver: 1, firstSavedAt: new Date(2026, 9, 25, 10, 0).getTime() });
    expect(timeFor('ian')).toBe('esta semana');
    // Luna, solo con lo del grafo: «Primer amigo» no trae fecha (at null)
    expect(medalsOfFeed('luna').map((it) => [it.id, it.time, it.medal.at])).toEqual([['fm-seed-primer-amigo', 'esta semana', null]]);
    WEEK.n = 1;
    expect(timeFor('ian')).toBe('la semana pasada');
    expect(timeFor('luna')).toBe('la semana pasada');
    seedWith('ian', { savedEver: 1, firstSavedAt: NOW - 3 * H });
    expect(timeFor('ian')).toBe('hace 3 h');
  });

  it('dedupe: si la acaba de ganar (entró en vivo), sale SOLO la viva; con el reset del feed vuelve la sembrada', () => {
    expect(seedIds('ian')).toEqual(['fm-seed-primer-amigo']); // la del grafo real de Ian
    F.ian = { savedEver: 1, firstSavedAt: NOW };
    runAsUser('ian', () => M.syncMedals('ian'));
    const ms = medalsOfFeed('ian');
    expect(ms.map((it) => [it.id.replace(/\d+$/, 'N'), it.medal.id])).toEqual([['fm-N', 'primer-guardado']]);
    resetFeed('ian');
    expect(seedIds('ian')).toEqual(['fm-seed-primer-guardado']);
  });

  it('dominio apagado: sin Amigos no sale «Primer amigo», sin Ligas no sale la copa — sale la más reciente que SÍ ve, o ninguna', () => {
    seedWith('luna', { crowns: 1 }); // Luna: 🤝 (del grafo) y 🏆, las dos sin fecha → en el orden del catálogo
    expect(seedIds('luna')).toEqual(['fm-seed-primer-amigo']);
    FLAGS.amigos = false;
    expect(seedIds('luna')).toEqual(['fm-seed-semana-familia']);
    FLAGS.ligas = false;
    expect(seedIds('luna')).toEqual([]);
    FLAGS.amigos = true;
    expect(seedIds('luna')).toEqual(['fm-seed-primer-amigo']);
    seedWith('luna', { crowns: 1, bestStreak: 9 });
    FLAGS.amigos = false;
    expect(seedIds('luna')).toEqual(['fm-seed-tres-dias']); // sin dominio: siempre
  });

  it('las palabras de la familia la esconden como a toda noticia (sale la que le sigue); "ver menos" con su id la saca y NO trae otra', () => {
    seedWith('ian', { savedEver: 1, firstSavedAt: NOW - H });
    expect(seedIds('ian')).toEqual(['fm-seed-primer-guardado']);
    BLOCK.word = 'guardado';
    expect(seedIds('ian')).toEqual(['fm-seed-primer-amigo']);
    BLOCK.word = '';
    runAsUser('ian', () => expect(feedLess('fm-seed-primer-guardado')).toEqual({ ok: true })); // el id cumple FEED_ID
    expect(seedIds('ian')).toEqual([]);
    runAsUser('ian', () => feedLess('fm-seed-primer-guardado', true));
    expect(seedIds('ian')).toEqual(['fm-seed-primer-guardado']);
  });

  it('el adulto del seed (sin medallas) no la tiene en ninguna página', () => {
    expect(M.medalsOf('andres')).toEqual([]);
    expect(medalsOfFeed('andres')).toEqual([]);
  });
});

describe('course.done servido (spec §4.2)', () => {
  const courses = () => runAsUser('ian', () => allItems().flatMap((it) => (it.kind === 'route' ? [[it.id, it.course.done, it.course.units]] : [])));
  it('cada card de ruta (sembrada o compartida en vivo) trae las postas hechas: 0, a medias o completa', () => {
    expect(courses()).toEqual(expect.arrayContaining([['fr-ruta.a', 0, 3], ['fr-ruta.b', 0, 2]]));
    ROWS.list = [
      { target: 'a1', pct: 1, source: 'ruta:ruta.a/posta:a1', finishedAt: NOW - 5 * H },
      { target: 'b1', pct: 1, source: 'ruta:ruta.b/posta:b1', finishedAt: NOW - 4 * H },
      { target: 'b2', pct: 0.8, source: 'ruta:ruta.b/posta:b2', finishedAt: NOW - 3 * H },
    ];
    expect(courses()).toEqual(expect.arrayContaining([['fr-ruta.a', 1, 3], ['fr-ruta.b', 2, 2]]));
    runAsUser('ian', () => {
      // La composición de cada ráfaga se sortea (y la semilla lleva al usuario): se simula hasta que una comparta una ruta.
      let shared: Extract<Item, { kind: 'route' }> | undefined;
      for (let i = 0; i < 8 && !shared; i++) {
        simulateNpcs();
        shared = getFeed().items.find((it): it is Extract<Item, { kind: 'route' }> => it.kind === 'route' && it.id.startsWith('fs-'));
      }
      expect(shared, 'ninguna de 8 ráfagas compartió una ruta').toBeDefined();
      expect(shared!.course.done).toBe(shared!.course.id === 'ruta.a' ? 1 : 2);
    });
  });
});

describe('cobertura de tipos con el seed REAL de friendsFake (spec §4.3-§4.4)', () => {
  const KINDS = ['next', 'video', 'article', 'route', 'friend', 'league', 'videos', 'summary', 'medal'];
  const ICONS = ['streak', 'badge', 'unit', 'route', 'medal', 'league'];
  const HOURS: [string, number][] = [['mañana', 9], ['tarde', 16], ['noche', 21]];
  for (const user of ['ian', 'luna']) {
    for (const [name, hour] of HOURS) {
      it(`${user} · ${name}: solo con el seed (sin tocar nada) salen los 9 kinds y lo social trae racha, insignia, unidad, ruta, liga y medallas de oro y bronce`, () => {
        vi.setSystemTime(new Date(2026, 9, 29, hour, 30));
        runAsUser(user, () => {
          const all = allItems();
          const kinds = new Set(all.map((it) => it.kind));
          for (const k of KINDS) expect(kinds, `${user} · ${name}: falta el kind ${k}`).toContain(k);
          const social = all.filter((it): it is Extract<Item, { kind: 'friend' }> => it.kind === 'friend');
          const icons = new Set(social.map((it) => it.icon));
          for (const i of ICONS) expect(icons, `${user} · ${name}: falta la noticia ${i}`).toContain(i);
          const medals = social.filter((it) => it.icon === 'medal').map((it) => it.text);
          expect(medals.some((t) => t.includes('🥇')), `${user}: sin medalla de oro (tinte)`).toBe(true);
          expect(medals.some((t) => t.includes('🥉')), `${user}: sin medalla de bronce (tinte)`).toBe(true);
          // lo del cierre sigue espaciado aunque haya más noticias de liga: nunca dos pegadas
          const seeded = all.filter((it) => it.kind !== 'next' && it.kind !== 'videos' && it.kind !== 'summary' && it.kind !== 'medal');
          const leagueish = seeded.map((it) => it.kind === 'league' || (it.kind === 'friend' && (it.icon === 'medal' || it.icon === 'league')));
          for (let i = 1; i < leagueish.length; i++) expect(leagueish[i] && leagueish[i - 1], `${user} · ${name} #${i}`).toBe(false);
        });
      });
    }
  }
});
