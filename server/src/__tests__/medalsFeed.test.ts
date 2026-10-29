import { beforeEach, describe, expect, it, vi } from 'vitest';

/* U5-B (docs/U5-LIGA-FAMILIAR-Y-MEDALLAS.md §5.5c): la noticia de medalla en el Feed, con feedFake.ts y medals.ts DE VERDAD
   (feedFake registra su sumidero al cargar). Mocks como feedFake.test.ts para lo que lee server/data o el grafo social. Los
   hechos y el gate se registran acá. Lo que se prueba: la noticia cae en el feed del DUEÑO (aunque el sync corra con el
   contexto del adulto) y no en el del hermano; su forma (kind 'medal', id fm-<n>, 'recién', 'Es tu medalla nueva', sin
   reacciones); los filtros al servir (la copa solo con Ligas, el primer amigo solo con Amigos, las palabras de la familia);
   el resumen de la edición no la cuenta; re-sincronizar no la duplica; el reset del feed la saca. */

const FLAGS = vi.hoisted(() => ({ amigos: true, ligas: true, tienda: true, chat: true } as Record<string, boolean>));
const BLOCK = vi.hoisted(() => ({ word: '' }));

vi.mock('../parent', () => ({
  familyBlockedTerms: () => [], familyTopics: () => ({ white: [], black: [] }), familyTz: () => null,
  featureOnNow: (k: string) => FLAGS[k] !== false, feedMotion: () => 'normal', topicHit: () => null,
}));
vi.mock('../filters', () => ({ matchBlockedWord: (text: string) => (BLOCK.word && text.includes(BLOCK.word) ? BLOCK.word : null) }));
vi.mock('../learnResults', () => ({ LEARN_EC: 30, resultRows: () => [] }));
// FS-BASE-A: el Feed lee servedRoutes (lo que ve el usuario del pedido); la economía y las medallas, catalogRoutes
vi.mock('../learnRoutes', () => ({
  catalogRoutes: () => [{ id: 'ruta.a', title: 'Ruta A', emoji: '🪐', postas: [{ target: 'a1' }] }],
  servedRoutes: () => [{ id: 'ruta.a', title: 'Ruta A', emoji: '🪐', postas: [{ target: 'a1' }] }],
}));
vi.mock('../videos', () => ({
  searchVideosStrict: (q: string) => Array.from({ length: 3 }, (_, i) => ({
    videoId: `${q.replace(/\s+/g, '_')}-${i}`, title: `${q} ${i}`, thumb: '', channelId: 'c', channelTitle: 'Canal', source: 'Canal',
    description: '', duration: 120, addedAt: 0, tags: [], topics: [],
  })),
  toVideoResult: (v: { videoId: string; title: string }) => ({ id: v.videoId, img: '', title: v.title, subtitle: '', duration: '2:00', channel: 'Canal', date: '' }),
  familyCatalogVersion: () => 0, // FS-BASE-B: la versión del catálogo aprobado (clave del pool del Feed)
}));
vi.mock('../friendsFake', () => ({
  npcRelation: () => 'friend', // FS-BASE-B: el "por qué" según el grafo del activo
  friendNews: () => [{ fid: 'TomiCohete', friend: { nick: 'TomiCohete', color: '#123456' }, text: 'llegó a una racha de 12 días', icon: 'streak' }],
  isVisibleNpc: () => true,
  npcInfo: (nick: string) => ({ id: nick, color: '#123456', girl: false }),
  friendCount: () => 1,
}));
vi.mock('../leaguesFake', () => ({
  cycleWeek: () => 0, hashOf: (s: string) => s.length, rng: () => () => 0.5, shuffle: <T,>(xs: readonly T[]) => [...xs],
  lastClose: () => null, lastCloseLabel: () => 'el domingo', MEDAL_EMOJI: { oro: '🥇', plata: '🥈', bronce: '🥉' },
  myLeague: () => ({ name: 'Liga Cometa', total: 12, closes: 'el domingo', closesInDays: 4, lastWeek: { pos: 2, medal: 'plata' } }),
  npcPractice: () => [], sinceLabel: () => 'recién', weeksAgoLabel: (n: number) => `hace ${n} semanas`,
}));

const { getFeed, resetFeed } = await import('../feedFake');
const M = await import('../medals');
const { runAsUser } = await import('../requestContext');
import type { MedalFacts } from '../medalRules';

const F: Record<string, Partial<MedalFacts>> = {};
M.registerMedalFacts((uid) => F[uid] ?? {}, 'test');
M.registerMedalGate(() => true);

type Item = ReturnType<typeof getFeed>['items'][number];
const medalsIn = (uid: string) => runAsUser(uid, () => getFeed().items.filter((it): it is Extract<Item, { kind: 'medal' }> => it.kind === 'medal'));
const summaryIn = (uid: string) => runAsUser(uid, () => getFeed().items.find(it => it.kind === 'summary'));

beforeEach(() => {
  Object.assign(FLAGS, { amigos: true, ligas: true });
  BLOCK.word = '';
  F.ian = {}; F.luna = {}; F.andres = {};
  resetFeed(); M.resetMedals();
});

describe('la noticia de una medalla nueva, en el feed de SU dueño', () => {
  it('el sync de Luna corre con el contexto del adulto → la noticia está en el feed de Luna y en el de nadie más', () => {
    F.luna = { completedTargets: 1, firstCompletedAt: 1000 };
    runAsUser('andres', () => M.syncMedals('luna'));
    const [n] = medalsIn('luna');
    expect(n).toMatchObject({ kind: 'medal', time: 'recién', reason: 'Es tu medalla nueva' });
    expect(n.id).toMatch(/^fm-\d+$/);
    expect(n.medal).toEqual({ id: 'primera-posta', emoji: '🎯', title: 'Primera posta', text: 'Completaste tu primera posta en Aprender.', at: 1000 });
    expect(n).not.toHaveProperty('reactions');
    expect(medalsIn('ian')).toEqual([]);
    expect(medalsIn('andres')).toEqual([]);
  });
  it('re-sincronizar no la duplica; dos medallas nuevas → dos noticias; el reset del feed las saca', () => {
    F.ian = { comebacks: 1, savedEver: 1, firstSavedAt: 2000 };
    runAsUser('ian', () => { M.syncMedals('ian'); M.syncMedals('ian'); });
    expect(medalsIn('ian').map(n => n.medal.id).sort()).toEqual(['de-vuelta', 'primer-guardado']);
    resetFeed('ian');
    // Tanda "Cards del feed" (29-oct): las VIVAS se van con el reset del feed, pero las medallas siguen ganadas y la
    // primera página siembra la más reciente (feedFake.seedMedal; mientras estaba viva, el dedupe la escondía). Antes
    // esperaba [] porque no había medalla sembrada.
    expect(medalsIn('ian').map(n => n.id)).toEqual(['fm-seed-de-vuelta']);
  });
  it('el resumen de la edición NO la cuenta (no es contenido recomendado)', () => {
    const before = summaryIn('andres');
    F.andres = { pbWeeks: 1 };
    runAsUser('andres', () => M.syncMedals('andres'));
    expect(medalsIn('andres')).toHaveLength(1);
    expect(summaryIn('andres')).toEqual(before);
  });
});

describe('los filtros al servir (se esconde, no se borra)', () => {
  it('la copa de la familia solo con Ligas prendido; el resto, siempre', () => {
    F.luna = { crowns: 0 };
    M.resetMedals('luna');
    F.luna = { crowns: 1, comebacks: 1 };
    runAsUser('luna', () => M.syncMedals('luna'));
    FLAGS.ligas = false;
    expect(medalsIn('luna').map(n => n.medal.id)).toEqual(['de-vuelta']);
    FLAGS.ligas = true;
    expect(medalsIn('luna').map(n => n.medal.id).sort()).toEqual(['de-vuelta', 'semana-familia']);
  });
  it('el primer amigo solo con Amigos prendido', () => {
    F.ian = { friends: 1 };
    runAsUser('ian', () => M.syncMedals('ian'));
    FLAGS.amigos = false;
    expect(medalsIn('ian')).toEqual([]);
    FLAGS.amigos = true;
    expect(medalsIn('ian').map(n => n.medal.id)).toEqual(['primer-amigo']);
  });
  it('una palabra de la familia en el título o el texto la esconde, como a toda noticia en vivo', () => {
    F.ian = { routesCompleted: 1 };
    runAsUser('ian', () => M.syncMedals('ian'));
    BLOCK.word = 'postas';
    expect(medalsIn('ian')).toEqual([]);
    BLOCK.word = '';
    expect(medalsIn('ian')).toHaveLength(1);
  });
});
