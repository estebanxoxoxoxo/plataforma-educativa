// API FAKE. Simula latencia de red y estado de servidor en memoria.
// Cada llamada se loguea en la consola como una request real (→ / ←).
// Para conectar el backend real: reemplazá el cuerpo de cada método por un fetch()
// que devuelva el mismo tipo; la UI no necesita cambios.
import * as M from './mock';
import type {
  AnswerResult, Answer, ArticleResponse, ChatEvent, Course, CourseDetail, Exercise, Friend, FriendMessage,
  GeoRanking, GeoScope, ImageResult, Journey, LeagueResult, LeagueStanding, Moderated, MyLeague, PageResult, SearchResponse,
  Tab, User, Video, VideoResult,
} from './types';

export type SearchMap = { pages: PageResult; images: ImageResult; videos: VideoResult };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const jitter = (ms: number) => ms * (0.85 + Math.random() * 0.3);
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function call<T>(method: string, path: string, latency: number, fn: () => T): Promise<T> {
  console.debug(`%c[api] → ${method} ${path}`, 'color:#13A39A;font-weight:bold');
  await sleep(jitter(latency));
  const res = fn();
  console.debug(`%c[api] ← ${method} ${path}`, 'color:#3A5BD9', res);
  return structuredClone(res);
}

/* ---------- "base de datos" en memoria ---------- */
const db = {
  generated: [] as Course[],
  progress: { solar: 2 } as Record<string, number>,
  joined: [] as string[],
  threads: structuredClone(M.THREADS) as Record<string, FriendMessage[]>,
  pending: {} as Record<string, { text: string; at: number }[]>,
  seq: 100,
};
const allCourses = () => [...db.generated, ...M.COURSES];
const findCourse = (id: string) => {
  const c = allCourses().find((x) => x.id === id);
  if (!c) throw new ApiError(404, `Curso ${id} no existe`);
  return c;
};

function withBlocked<T extends { id: string }>(ok: T[], at: number[]): Moderated<T>[] {
  const out: Moderated<T>[] = [];
  for (let i = 0, k = 0; k < ok.length; i++) out.push(at.includes(i) ? { id: `blk-${i}`, blocked: true } : ok[k++]);
  return out;
}

/* ---------- endpoints ---------- */
export const api = {
  me: () => call<User>('GET', '/me', 250, () => M.ME),

  /** Una búsqueda vale para todas las solapas. Imágenes y videos vuelven con lo que la moderación filtró. */
  search: <T extends Tab>(q: string, tab: T) =>
    call<SearchResponse<SearchMap[T]>>('GET', `/search?q=${encodeURIComponent(q)}&tab=${tab}`, tab === 'pages' ? 1400 : 1100, () => {
      const t = M.topicOf(q);
      let res: SearchResponse<PageResult | ImageResult | VideoResult> = { query: q, items: [] };
      if (t && tab === 'pages') res = { query: q, items: M.PAGES[t] };
      else if (t && tab === 'images') res = { query: q, items: withBlocked(M.IMAGES[t], M.BLOCKED_AT.images), related: M.RELATED[t] };
      else if (t) res = { query: q, items: withBlocked(M.VIDEOS[t], M.BLOCKED_AT.videos) };
      return res as SearchResponse<SearchMap[T]>;
    }),

  /** Abre un artículo: el servidor lo modera completo antes de devolverlo. */
  article: (id: string) => call<ArticleResponse>('GET', `/articles/${id}`, 1900, () => {
    if (M.BLOCKED_ARTICLES.has(id)) return { status: 'blocked', reason: 'Revisamos la página y su contenido no es apropiado para tu edad.' };
    return { status: 'ok', article: M.ARTICLES[id] ?? M.stubArticle(id) };
  }),

  video: (id: string) => call<Video>('GET', `/videos/${id}`, 500, () => {
    const v = Object.values(M.VIDEOS).flat().find((x) => x.id === id);
    if (!v) throw new ApiError(404, 'Video no encontrado');
    const ch = M.CHANNELS[v.channel] ?? { subscribers: '12 k de suscriptores', verified: false };
    return { ...v, durationSec: M.videoSeconds(v.duration), reviewed: true, ...ch, likes: M.likesFor(v.id) };
  }),

  /* cursos */
  courseRequested: (topic: string) => call<boolean>('GET', `/courses/requests?topic=${topic}`, 200, () => db.generated.some((c) => c.name === topic)),
  generateCourse: (topic: string) => call<{ topic: string; etaMinutes: number }>('POST', '/courses/generate', 800, () => {
    if (!db.generated.some((c) => c.name === topic)) {
      const look = M.GEN_COURSE[topic] ?? M.GEN_COURSE.Dinosaurios;
      db.generated.unshift({ id: `gen-${norm(topic).replace(/\W+/g, '-')}`, name: topic, units: 4, progress: 0, isNew: true, ...look });
    }
    return { topic, etaMinutes: 5 };
  }),
  courses: () => call<Course[]>('GET', '/courses', 650, allCourses),
  course: (id: string) => call<CourseDetail>('GET', `/courses/${id}`, 600, () => {
    const c = findCourse(id);
    const unitList = id === 'solar' ? M.SOLAR_UNITS : M.genericUnits(c.name, c.units);
    return { ...c, units: unitList.length, unitList, chapters: unitList.reduce((n, u) => n + u.chapters.length, 0) };
  }),

  /* practicar */
  journey: (courseId: string) => call<Journey>('GET', `/practice/${courseId}/journey`, 600, () => {
    const c = findCourse(courseId);
    const solar = courseId === 'solar';
    const done = db.progress[courseId] ?? Math.floor((c.progress / 100) * 8);
    db.progress[courseId] = done;
    return {
      courseId, courseName: c.name, unitLabel: 'Unidad 1 · Sección 1', done,
      title: solar ? 'El Sol: nuestra estrella' : `${c.name}: parte 1`,
      items: M.JOURNEY_ITEMS(solar ? 'El Sol: nuestra estrella' : `${c.name}: parte 1`, solar ? 'Los planetas' : `${c.name}: parte 2`),
    };
  }),
  exercise: (courseId: string, n: number) => call<Exercise>('GET', `/practice/${courseId}/exercises/${n}`, 450, () => {
    const ex = M.SOLAR_EXERCISES.find((e) => e.n === n);
    if (!ex) throw new ApiError(404, 'Ejercicio no encontrado');
    return ex;
  }),
  /** Corrige. La pregunta abierta la "analiza la IA" (más latencia). */
  submit: (courseId: string, n: number, a: Answer) => call<AnswerResult>('POST', `/practice/${courseId}/exercises/${n}/answer`, a.kind === 'open' ? 1900 : 350, () => {
    const k = M.KEYS[n];
    if (a.kind === 'timeout') return { correct: false, title: 'Se terminó el tiempo', detail: k.badText, correctOptions: k.mc ? (k.mc.length ? k.mc : ['__none__']) : k.vf !== undefined ? [String(k.vf)] : undefined };
    if (a.kind === 'open') {
      const ok = a.text.trim().length >= 12 && !!k.open?.test(norm(a.text));
      return { correct: ok, title: ok ? '¡Correcto!' : 'Casi…', detail: 'La IA analizó tu respuesta.', ai: { verdict: ok ? 'Correcta' : 'Incorrecta', feedback: ok ? k.okText : k.badText } };
    }
    if (a.kind === 'mc') {
      const key = k.mc ?? [];
      const sel = a.selected.filter((s) => s !== '__none__');
      const ok = key.length ? sel.length === key.length && key.every((x) => sel.includes(x)) : a.selected.includes('__none__');
      return { correct: ok, title: ok ? '¡Correcto!' : 'Incorrecto', detail: ok ? k.okText : k.badText, correctOptions: key.length ? key : ['__none__'] };
    }
    const ok = a.value === k.vf;
    return { correct: ok, title: ok ? '¡Correcto!' : 'Incorrecto', detail: ok ? k.okText : k.badText, correctOptions: [String(k.vf)] };
  }),
  completeNode: (courseId: string, n: number) => call<{ done: number }>('POST', `/practice/${courseId}/nodes/${n}/complete`, 300, () => {
    if ((db.progress[courseId] ?? 0) === n) db.progress[courseId] = n + 1;
    return { done: db.progress[courseId] };
  }),

  /* chat con IA (streaming) */
  async *chat(text: string): AsyncGenerator<ChatEvent> {
    console.debug(`%c[api] → POST /chat (stream)`, 'color:#13A39A;font-weight:bold', { text });
    await sleep(jitter(1300));
    const t = norm(text);
    let answer: string;
    let share: { title: string; meta: string; img: string; videoId?: string } | undefined;
    if (/sangr|miedo|matar|arma|muert|terror|violen|pelea/.test(t)) {
      answer = 'No puedo ayudarte con eso. ¿Querés que te cuente cómo algunos dinosaurios usaban crestas y colores para asustar a otros?';
    } else if (/extin/.test(t) && /dino/.test(t)) {
      answer = 'Hace unos 66 millones de años cayó un asteroide enorme. El polvo tapó el Sol, hizo mucho frío y muchas plantas se murieron. Sin comida, los dinosaurios grandes no sobrevivieron. ¡Pero las aves son sus parientes y siguen vivas!';
      share = { title: 'El día que cayó el asteroide', meta: 'Video · 3:40', img: 'chat_asteroid', videoId: 'vd-chat_asteroid' };
    } else if (M.topicOf(t) === 'volcanes') {
      answer = 'Un volcán es como una chimenea de la Tierra: por ahí sale roca derretida, que se llama magma. Cuando sale afuera la llamamos lava, y al enfriarse se convierte en roca.';
      share = { title: '¿Cómo nace un volcán?', meta: 'Video · 4:20', img: 'vv_kilauea', videoId: 'vd-vv_kilauea' };
    } else if (M.topicOf(t) === 'planetas') {
      answer = 'En el sistema solar hay ocho planetas que giran alrededor del Sol: Mercurio, Venus, la Tierra, Marte, Júpiter, Saturno, Urano y Neptuno. ¡Júpiter es el más grande!';
      share = { title: 'Los 8 planetas en orden', meta: 'Video · 5:20', img: 'p_planets', videoId: 'vd-p_planets' };
    } else if (M.topicOf(t) === 'dinosaurios') {
      answer = 'Los dinosaurios vivieron durante más de 160 millones de años. Algunos eran gigantes como el Argentinosaurus, que vivió en Neuquén, ¡y otros eran del tamaño de una gallina!';
    } else {
      // DEMO: todo lo que no es de los 3 temas habilitados se trata como no apto.
      // En producción la IA propondría algo apropiado relacionado con lo que preguntó.
      answer = 'No puedo ayudarte con eso. ¿Querés que hablemos de dinosaurios, volcanes o planetas?';
    }
    for (const w of answer.split(' ')) { await sleep(55); yield { type: 'token', text: w }; }
    if (share) {
      await sleep(500);
      yield { type: 'share-checking' };
      await sleep(1500);
      yield { type: 'share', card: share };
    }
    console.debug(`%c[api] ← POST /chat (fin)`, 'color:#3A5BD9');
    yield { type: 'done' };
  },

  /* amigos */
  friends: () => call<Friend[]>('GET', '/friends', 500, () => M.FRIENDS),
  friend: (id: string) => call<Friend>('GET', `/friends/${id}`, 350, () => {
    const f = M.FRIENDS.find((x) => x.id === id);
    if (!f) throw new ApiError(404, 'Amigo no encontrado');
    return f;
  }),
  thread: (id: string) => call<FriendMessage[]>('GET', `/friends/${id}/messages`, 400, () => db.threads[id] ?? []),
  sendMessage: (id: string, text: string) => call<FriendMessage>('POST', `/friends/${id}/messages`, 300, () => {
    const msg: FriendMessage = { id: `m${db.seq++}`, from: 'me', text };
    (db.threads[id] ??= []).push(msg);
    (db.pending[id] ??= []).push({ text: M.REPLIES[Math.floor(Math.random() * M.REPLIES.length)], at: Date.now() + 2200 });
    return msg;
  }),
  /** Polling de mensajes nuevos del amigo. */
  newMessages: (id: string) => call<FriendMessage[]>('GET', `/friends/${id}/messages?new=1`, 200, () => {
    const ready = (db.pending[id] ?? []).filter((p) => p.at <= Date.now());
    db.pending[id] = (db.pending[id] ?? []).filter((p) => p.at > Date.now());
    const msgs = ready.map((p): FriendMessage => ({ id: `m${db.seq++}`, from: 'them', text: p.text }));
    (db.threads[id] ??= []).push(...msgs);
    return msgs;
  }),

  /* ligas */
  myLeagues: () => call<MyLeague[]>('GET', '/leagues/mine', 500, () => [
    M.ASSIGNED,
    ...db.joined.map((id): MyLeague => {
      const l = M.ALL_LEAGUES.find((x) => x.id === id)!;
      return { id, name: l.name, desc: l.desc, color: l.color, tag: 'joined', pos: Math.round(l.size / 2), total: l.size };
    }),
  ]),
  /** Ranking completo de una de mis ligas, con mi puesto marcado. */
  leagueStanding: (id: string) => call<LeagueStanding>('GET', `/leagues/${id}/standing`, 600, () => {
    let info: { name: string; color: string; total: number; pos: number };
    if (id === M.ASSIGNED.id) info = M.ASSIGNED;
    else {
      const l = M.ALL_LEAGUES.find((x) => x.id === id);
      if (!l || !db.joined.includes(id)) throw new ApiError(404, 'No sos parte de esta liga');
      info = { name: l.name, color: l.color, total: l.size, pos: Math.round(l.size / 2) };
    }
    const top = M.LEAGUE_TOP_XP[id] ?? 2600;
    const rows = Array.from({ length: info.total }, (_, i) => {
      const me = i + 1 === info.pos;
      const nick = me ? M.ME.nick : `${M.NICKS[i % M.NICKS.length]}${i >= M.NICKS.length ? Math.floor(i / M.NICKS.length) + 1 : ''}`;
      return { pos: i + 1, nick, color: me ? '#FFC23D' : M.COLS[i % M.COLS.length], xp: Math.round(top * (1 - i / (info.total * 1.2))), ...(me && { me: true }) };
    });
    return { league: { id, name: info.name, color: info.color, total: info.total, pos: info.pos }, rows };
  }),
  geoRanking: (scope: GeoScope) => call<GeoRanking>('GET', `/leagues/geo/${scope}`, 450, () => {
    const G = M.GEO[scope];
    return {
      scope,
      top: Array.from({ length: 10 }, (_, i) => ({ nick: M.NICKS[(i + G.off) % M.NICKS.length], color: M.COLS[(i + G.off) % M.COLS.length], xp: Math.round(G.top * (1 - i * 0.045)) })),
      me: { nick: M.ME.nick, pos: G.me, xp: G.xp },
    };
  }),
  searchLeagues: (q: string) => call<LeagueResult[]>('GET', `/leagues?q=${encodeURIComponent(q)}`, 500, () => {
    const s = norm(q.trim());
    if (!s) return [];
    const list = M.topicOf(s) === 'dinosaurios' ? M.ALL_LEAGUES.slice(0, 4) : M.ALL_LEAGUES.filter((l) => norm(l.name + ' ' + l.desc).includes(s.slice(0, 5)));
    return list.map(({ size: _size, ...l }) => ({ ...l, joined: db.joined.includes(l.id) }));
  }),
  joinLeague: (id: string) => call<{ ok: true }>('POST', `/leagues/${id}/join`, 500, () => {
    if (!db.joined.includes(id)) db.joined.push(id);
    return { ok: true };
  }),
};
