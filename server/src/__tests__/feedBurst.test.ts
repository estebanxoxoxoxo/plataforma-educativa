import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* Tanda "Ráfaga variada" (29-oct), pedido del dueño: «Simular npc siempre indica medallas de amigos supuestos. tienen que ser
   de todo tipo y random. En el inicial también tiene que tener alguno que otro de liga cerrada de un amigo.» Con feedFake.ts,
   feedMix.ts y friendsFake.ts DE VERDAD (su pool NEWS, sus ligas y el grafo de cada usuario son los reales), como
   feedCards.test.ts; se mockea lo que lee server/data o llama a un modelo. Lo que se prueba:
   - B: la PRIMERA página trae 1-2 noticias de liga cerrada de amigos (fechadas en el cierre: se adelanta el lugar, no se
     miente la fecha), para Ian y para Luna, en todas las franjas; ninguna con Ligas o Amigos apagado; tras un cierre
     simulado no se duplica; lo vivo no corre las páginas.
   - A: las medallas de la ráfaga (feedMix.NPC_MEDALS) cuadran con la liga REAL de cada NPC y con su medalla del seed, y la
     ráfaga real sortea la composición con los tres tintes. */

const FLAGS = vi.hoisted(() => ({ amigos: true, ligas: true, tienda: true, chat: true } as Record<string, boolean>));
/** La semana del ciclo de liga (0 = la del seed; cada cierre simulado suma una). */
const WEEK = vi.hoisted(() => ({ n: 0 }));
/** Una palabra bloqueada de la familia (filters.matchBlockedWord): lo de la ráfaga se filtra en vivo. */
const BLOCK = vi.hoisted(() => ({ word: '' }));

vi.mock('../parent', () => ({
  familyBlockedTerms: () => [], familyTopics: () => ({ white: [], black: [] }), familyTz: () => null,
  featureOnNow: (k: string) => FLAGS[k] !== false, featureOn: (k: string) => FLAGS[k] !== false, feedMotion: () => 'normal', topicHit: () => null,
  // lo que friendsFake importa además (no se llama en estos casos)
  blackTopicsAll: () => [], notifyParent: () => {}, notifyUnreviewed: () => {},
}));
vi.mock('../filters', () => ({ matchBlockedWord: (text: string) => (BLOCK.word && text.includes(BLOCK.word) ? BLOCK.word : null) }));
vi.mock('../learnResults', () => ({ LEARN_EC: 30, resultRows: () => [] }));
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
  return {
    cycleWeek: () => WEEK.n, hashOf, rng, shuffle, lastClose: () => null, lastCloseLabel: () => (WEEK.n > 0 ? 'recién' : 'el domingo'),
    MEDAL_EMOJI: { oro: '🥇', plata: '🥈', bronce: '🥉' },
    myLeague: () => ({ name: 'Liga Cometa', total: 12, closes: 'el domingo', closesInDays: 4, lastWeek: { pos: 2, medal: 'plata' } }),
    // como el de verdad: `count` compañeros DISTINTOS de la tabla, otros que los de `avoid` si se puede
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
    sinceLabel: () => 'recién', weeksAgoLabel: (n: number) => (n <= 1 ? 'la semana pasada' : `hace ${n} semanas`),
  };
});
// friendsFake de verdad: lo que usa para chatear (modelo, jueces, guion de crisis) no se llama acá
vi.mock('../chat', () => ({ guionCrisis: () => '', safetyLine: () => '' }));
vi.mock('../crisisNet', () => ({ crisisNetHit: () => null }));
vi.mock('../judge', () => ({ judgeOutput: async () => ({ ok: true }) }));
vi.mock('../llm', () => ({ complete: async () => ({ text: '' }), parseJudgeJson: () => ({}), spotlight: (s: string) => s }));

const { getFeed, injectLeagueClose, resetFeed, simulateNpcs } = await import('../feedFake');
const { friendNews, npcInfo, resetFriends } = await import('../friendsFake');
const { NPC_MEDALS } = await import('../feedMix');
const { visibleNicksAtStart } = await import('../npcRoster');
const { runAsUser } = await import('../requestContext');

type Item = ReturnType<typeof getFeed>['items'][number];
type Friend = Extract<Item, { kind: 'friend' }>;
const isFriendLeague = (it: Item): it is Friend => it.kind === 'friend' && (it.icon === 'medal' || it.icon === 'league');
const isLeagueish = (it: Item) => it.kind === 'league' || isFriendLeague(it);
/** Lo de la edición SEMBRADA (no lo vivo: fx-/fs-) */
const seeded = (it: Item) => !/^f[xs]-\d+$/.test(it.id);
function pagesOf(): Item[][] {
  let page = getFeed();
  const out: Item[][] = [page.items];
  for (let guard = 0; page.next && guard < 50; guard++) { page = getFeed(page.next); out.push(page.items); }
  return out;
}
const at = (d: Date) => vi.setSystemTime(d);
const THURSDAY = (h: number) => new Date(2026, 9, 29, h, 30); // jueves 29-oct-2026, hora local (sin zona de la familia)
const MONDAY = (h: number) => new Date(2026, 9, 26, h, 0); // el lunes de esa semana

beforeEach(() => {
  Object.assign(FLAGS, { amigos: true, ligas: true });
  WEEK.n = 0; BLOCK.word = '';
  resetFeed(); resetFriends();
  vi.useFakeTimers({ toFake: ['Date'] });
  at(THURSDAY(16));
});
afterEach(() => { vi.useRealTimers(); });

describe('B · la primera página trae liga cerrada de un amigo', () => {
  /** Lo que cada uno tiene en el seed real de friendsFake: medallas primero (Ian: MateoDino 🥇 y TomiCohete 🥉; Luna:
   *  FedeAjedrez 🥇 y LeaTelescopio 🥉), y el ascenso de CataEstrella, que sigue por antigüedad. */
  const LEAD: Record<string, string[]> = { ian: ['MateoDino', 'TomiCohete'], luna: ['FedeAjedrez', 'LeaTelescopio'] };
  for (const user of ['ian', 'luna']) {
    for (const [name, d] of [['mañana', THURSDAY(9)], ['tarde', THURSDAY(16)], ['noche', THURSDAY(21)], ['lunes al mediodía', MONDAY(12)]] as const) {
      it(`${user} · ${name}: 2 en la primera página (medallas: oro y bronce), fechadas en el cierre, y ninguna duplicada en la edición`, () => {
        at(d);
        runAsUser(user, () => {
          const pages = pagesOf();
          const first = pages[0].filter(isFriendLeague);
          expect(first.map((it) => it.friend.nick), `${user} · ${name}`).toEqual(LEAD[user]);
          for (const it of first) {
            expect(it.id).toMatch(/^ff-\d+$/); // del seed (no inventadas)
            expect(it.time).toBe('el domingo'); // la fecha del cierre: se adelanta el lugar, no se miente la fecha
            expect(it.icon).toBe('medal');
          }
          expect(first.some((it) => it.text.includes('🥇'))).toBe(true);
          expect(first.some((it) => it.text.includes('🥉'))).toBe(true);
          // "alguno que otro": no más de 2
          expect(first.length).toBeLessThanOrEqual(2);
          // y en un lugar tranquilo: ni pegadas a otra noticia de amigos (la plantilla nunca pone dos sociales seguidas)
          const head = pages[0].filter((it) => it.kind !== 'next' && it.kind !== 'videos' && it.kind !== 'summary' && it.kind !== 'medal');
          for (const it of first) {
            const i = head.indexOf(it);
            expect(i, `${it.friend.nick}: lugar ${i}`).toBeGreaterThanOrEqual(2);
            expect([head[i - 1]?.kind, head[i + 1]?.kind], `${user} · ${name}: ${head.map((x) => x.kind).join(' > ')}`).not.toContain('friend');
          }
          // en toda la edición, cada una UNA vez (y la del ascenso sigue estando, más abajo), nada repetido
          const all = pages.flat();
          const ids = all.map((it) => it.id);
          expect(new Set(ids).size).toBe(ids.length);
          const theirs = friendNews().filter((e) => visibleNicksAtStart(user).includes(e.friend.nick) && (e.icon === 'medal' || e.icon === 'league'));
          expect(all.filter(isFriendLeague).map((it) => it.text).sort()).toEqual(theirs.map((e) => e.text).sort());
          // lo de liga sigue sin quedar pegado (la regla de spaceOut), página por página
          const seq = all.filter((it) => it.kind !== 'next' && it.kind !== 'videos' && it.kind !== 'summary' && it.kind !== 'medal');
          for (let i = 1; i < seq.length; i++) expect(isLeagueish(seq[i]) && isLeagueish(seq[i - 1]), `${user} · ${name} #${i}`).toBe(false);
        });
      });
    }
  }

  it('el lunes de madrugada (la antigüedad ya las pone arriba) no se adelanta nada: salen donde les toca', () => {
    at(MONDAY(2));
    runAsUser('ian', () => {
      const first = getFeed().items;
      // el cierre fue "anoche": la tarjeta de la liga y las dos primeras de amigos ya están en la primera página, en el orden
      // del cierre (MateoDino 🥇 y el ascenso de CataEstrella); TomiCohete 🥉 sigue más abajo
      expect(first.filter(isFriendLeague).map((it) => it.friend.nick)).toEqual(['MateoDino', 'CataEstrella']);
      expect(first.some((it) => it.kind === 'league')).toBe(true);
    });
  });

  it('con Ligas apagado ninguna (ni en la primera página ni en el resto); con Amigos apagado, nada social', () => {
    for (const user of ['ian', 'luna']) {
      FLAGS.ligas = false;
      runAsUser(user, () => {
        const all = pagesOf().flat();
        expect(all.filter(isLeagueish), user).toEqual([]);
      });
      FLAGS.ligas = true; FLAGS.amigos = false;
      runAsUser(user, () => {
        const all = pagesOf().flat();
        expect(all.filter((it) => it.kind === 'friend'), user).toEqual([]);
        expect(all.filter((it) => it.kind === 'league')).toHaveLength(1); // la tarjeta de TU liga sí (es tuya)
      });
      FLAGS.amigos = true;
    }
  });

  it('el adulto (sin amigos) no tiene ninguna', () => {
    runAsUser('andres', () => expect(pagesOf().flat().filter(isFriendLeague)).toEqual([]));
  });

  it('tras un cierre simulado no se duplica: arriba van las del cierre (en vivo) y las del seed quedan donde les toca', () => {
    runAsUser('ian', () => {
      const before = pagesOf()[0].filter(isFriendLeague).map((it) => it.id);
      expect(before).toHaveLength(2);
      WEEK.n = 1;
      injectLeagueClose({
        week: 1, me: { nick: 'Ian', color: '#FFC23D', pos: 2, medal: 'plata' }, from: { name: 'Liga Cometa', emoji: '☄️' },
        to: { name: 'Liga Estrella', emoji: '⭐' }, movement: 'sube',
        podium: [
          { nick: 'FeliTrex', color: '#3A5BD9', pos: 1, medal: 'oro', up: { name: 'Liga Estrella', emoji: '⭐' }, withMe: true },
          { nick: 'EmiFósil', color: '#13A39A', pos: 3, medal: 'bronce', up: { name: 'Liga Estrella', emoji: '⭐' }, withMe: true },
        ],
      });
      const pages = pagesOf();
      const first = pages[0].filter(isFriendLeague);
      // las del cierre (la tuya y el podio), en vivo; ninguna del seed adelantada
      expect(first.length).toBeGreaterThanOrEqual(1);
      for (const it of first) expect(it.id, it.text).toMatch(/^fx-\d+$/);
      for (const id of before) expect(pages[0].map((it) => it.id)).not.toContain(id);
      // y lo del seed sigue en la edición, una vez, como "de la semana pasada"
      const ids = pages.flat().map((it) => it.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of before) expect(pages.flat().filter(isFriendLeague).find((it) => it.id === id)?.time).toBe('la semana pasada');
    });
  });

  it('lo que entra en vivo (ráfagas, con medallas) NO corre las páginas de la edición: el adelanto depende solo del seed', () => {
    runAsUser('ian', () => {
      const ids = () => pagesOf().map((p) => p.filter(seeded).map((it) => it.id));
      const before = ids();
      for (let i = 0; i < 4; i++) simulateNpcs();
      expect(ids()).toEqual(before);
    });
  });
});

describe('A · las medallas de la ráfaga cuadran con el mundo REAL de friendsFake', () => {
  const EMOJI = { oro: '🥇', plata: '🥈', bronce: '🥉' } as const;
  it('cada medalla nombra la liga de HOY del NPC (la de su perfil) y, si el seed ya le contaba una medalla, es ESA misma', () => {
    for (const m of NPC_MEDALS) {
      expect(npcInfo(m.nick)?.league, m.key).toBe(m.league);
      const seedMedals = friendNews().filter((e) => e.friend.nick === m.nick && e.icon === 'medal');
      for (const e of seedMedals) expect(e.text, `${m.key} vs. el seed`).toContain(EMOJI[m.medal]);
      // ninguna repite una noticia del seed
      expect(friendNews().map((e) => e.text)).not.toContain(m.text);
    }
  });
  it('nadie de la Liga Chispa (la de abajo de todo: no pudo subir a ella) tiene medalla en la ráfaga', () => {
    for (const m of NPC_MEDALS) expect(npcInfo(m.nick)?.league, m.key).not.toBe('Liga Chispa');
  });

  for (const user of ['ian', 'luna']) {
    it(`${user}: 12 ráfagas reales → la composición varía, hay medallas de los 3 tintes, de quien ve y con el "por qué" de su grafo`, () => {
      runAsUser(user, () => {
        for (let i = 0; i < 12; i++) expect(simulateNpcs()).toEqual({ added: 5 });
        const live = getFeed().items.filter((it) => !seeded(it));
        expect(live).toHaveLength(60);
        const medals = live.filter((it): it is Friend => it.kind === 'friend' && it.icon === 'medal');
        for (const tint of Object.values(EMOJI)) expect(medals.some((it) => it.text.includes(tint)), `${user}: sin ${tint}`).toBe(true);
        for (const it of medals) {
          expect(visibleNicksAtStart(user)).toContain(it.friend.nick);
          expect(it.time).toBe('recién');
          expect(it.reason).toBe(it.friend.nick === 'FedeAjedrez' ? 'FedeAjedrez quiere ser tu amigo' : `${it.friend.nick} es tu ${npcInfo(it.friend.nick)!.girl ? 'amiga' : 'amigo'}`);
        }
        // de a 5 (los ids fx-/fs- son correlativos): composiciones distintas entre ráfagas seguidas
        const byBurst = [...live].sort((a, b) => Number(a.id.slice(3)) - Number(b.id.slice(3)));
        const typeOf = (it: Item) => (it.kind === 'friend' ? (it.icon === 'league' ? 'race' : it.icon) : it.kind);
        const mixes = Array.from({ length: 12 }, (_, k) => byBurst.slice(k * 5, k * 5 + 5).map(typeOf).sort().join(','));
        for (let k = 1; k < 12; k++) expect(mixes[k], `ráfaga ${k + 1}`).not.toBe(mixes[k - 1]);
      });
    });
  }

  it('las palabras de la familia filtran las medallas de la ráfaga como a todo lo demás (y la ráfaga sigue siendo de 5)', () => {
    BLOCK.word = 'medalla';
    runAsUser('ian', () => {
      for (let i = 0; i < 8; i++) expect(simulateNpcs()).toEqual({ added: 5 });
      const live = getFeed().items.filter((it) => !seeded(it));
      // las 40 se VEN: la medalla bloqueada ni entra en el sorteo (no se cuela una que después se esconde al servir)
      expect(live).toHaveLength(40);
      expect(live.filter((it) => it.kind === 'friend' && it.icon === 'medal')).toEqual([]);
      expect(live.filter((it) => it.kind === 'friend' && it.text.includes('medalla'))).toEqual([]);
    });
  });

  it('con Ligas apagado la ráfaga real no trae medallas ni carrera (y son 5 igual)', () => {
    FLAGS.ligas = false;
    runAsUser('ian', () => {
      for (let i = 0; i < 6; i++) expect(simulateNpcs()).toEqual({ added: 5 });
      const live = getFeed().items.filter((it) => !seeded(it));
      expect(live.filter((it) => it.kind === 'friend' && (it.icon === 'medal' || it.icon === 'league'))).toEqual([]);
    });
  });
});
