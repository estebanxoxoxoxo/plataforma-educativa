// Cliente de API. Descubrir (búsqueda, artículos, imágenes, videos, chat) y el usuario van al backend
// real (server/, lógica de Smarty). Cursos, práctica, amigos y ligas siguen SIMULADOS: latencia y estado
// en memoria. Cada llamada se loguea en la consola (→ / ←).
import * as M from './mock';
import type {
  AnswerResult, Answer, ArticleResponse, ChatReply, ChatTurn, Course, FeedReaction, FeedResponse, CourseDetail, Exercise, Friend, FriendMessage,
  AssignedLeague, GeoRanking, GeoScope, ImageResult, Journey, JourneyItem, LeagueStanding, PageResult, SearchResponse,
  Tab, User, Video, VideoResult,
} from './types';

export type SearchMap = { pages: PageResult; images: ImageResult; videos: VideoResult };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const jitter = (ms: number) => ms * (0.85 + Math.random() * 0.3);
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Llamada al backend real (server/). Los errores de red se tratan como fallas (fail-closed en la UI). */
async function http<T>(path: string, body?: unknown): Promise<T> {
  const method = body === undefined ? 'GET' : 'POST';
  console.debug(`%c[api] → ${method} ${path} (backend)`, 'color:#C24B1F;font-weight:bold', body ?? '');
  const r = await fetch(path, body === undefined ? undefined : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new ApiError(r.status, `HTTP ${r.status}`);
  const data = (await r.json()) as T;
  console.debug(`%c[api] ← ${method} ${path}`, 'color:#3A5BD9', data);
  return data;
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

/* ---------- endpoints ---------- */
export const api = {
  me: () => http<User>('/api/me'),

  /** Feed de la home (server FAKE hasta que exista el algoritmo real; misma forma de respuesta). */
  feed: (after?: string) => http<FeedResponse>(`/api/feed${after ? `?after=${encodeURIComponent(after)}` : ''}`),
  feedReact: (id: string, emoji: string) => http<{ id: string; reactions: FeedReaction[] }>('/api/feed/react', { id, emoji }),

  /** Una búsqueda vale para todas las solapas (backend real):
   *  páginas = Serper sobre la lista blanca · imágenes = Pixabay + Commons moderadas · videos = catálogo aprobado. */
  search: <T extends Tab>(q: string, tab: T) => http<SearchResponse<SearchMap[T]>>(`/api/search/${tab}?q=${encodeURIComponent(q)}`),

  /** Abre un artículo (id = URL): el backend chequea la lista blanca, extrae y lo modera con el juez. */
  article: (url: string) => http<ArticleResponse>(`/api/article?url=${encodeURIComponent(url)}`),

  /** Un video del catálogo aprobado + datos reales de YouTube (canal, suscriptores, Me gusta). */
  video: (id: string) => http<Video>(`/api/video?id=${encodeURIComponent(id)}`),

  /* cursos */
  courseRequested: (topic: string) => call<boolean>('GET', `/courses/requests?topic=${topic}`, 200, () => db.generated.some((c) => c.name === topic)),
  generateCourse: (topic: string) => call<{ topic: string; etaMinutes: number }>('POST', '/courses/generate', 800, () => {
    if (!db.generated.some((c) => c.name === topic)) {
      const look = M.GEN_COURSE[topic] ?? M.GEN_COURSE.Dinosaurios;
      const id = `gen-${norm(topic).replace(/\W+/g, '-')}`;
      db.generated.unshift({ id, name: topic, units: 4, progress: 0, isNew: true, ...look });
      // El backend arma el temario (modelo) y busca un contenido aprobado por capítulo, en segundo plano.
      void http(`/api/learn/course?id=${encodeURIComponent(id)}&name=${encodeURIComponent(topic)}`).catch(() => {});
    }
    return { topic, etaMinutes: 5 };
  }),
  courses: () => call<Course[]>('GET', '/courses', 650, allCourses),
  /** Detalle de un curso: el temario y un contenido real por capítulo los resuelve el backend
   *  (videos del catálogo aprobado, lecturas de sitios aprobados ya revisadas por el juez). */
  course: async (id: string): Promise<CourseDetail> => {
    const c = await call('GET', `/courses/${id}`, 150, () => findCourse(id));
    const r = await http<{ units: CourseDetail['unitList'] }>(`/api/learn/course?id=${encodeURIComponent(id)}&name=${encodeURIComponent(c.name)}`);
    return { ...c, units: r.units.length, unitList: r.units, chapters: r.units.reduce((n, u) => n + u.chapters.length, 0) };
  },

  /* practicar */
  journey: (courseId: string) => call<Journey>('GET', `/practice/${courseId}/journey`, 600, () => {
    const c = findCourse(courseId);
    const solar = courseId === 'solar';
    const done = db.progress[courseId] ?? Math.floor((c.progress / 100) * 8);
    db.progress[courseId] = done;
    const XP = { open: 15, mc: 10, vf: 5, trophy: 30, skip: 0 } as const;
    const items = M.JOURNEY_ITEMS(solar ? 'El Sol: nuestra estrella' : `${c.name}: parte 1`, solar ? 'Los planetas' : `${c.name}: parte 2`)
      .map((it): JourneyItem => {
        if (it.kind !== 'node') return it;
        const ex = M.SOLAR_EXERCISES.find((e) => e.n === it.n);
        const prompt = ex ? (ex.type === 'vf' ? ex.statement : ex.question) : undefined;
        return { ...it, prompt, seconds: ex?.seconds, xp: XP[it.type], ...(it.type === 'trophy' ? { badge: solar ? 'Guardián del Sol' : `Experto en ${c.name}` } : {}) };
      });
    return {
      courseId, courseName: c.name, courseImg: c.img, courseBg: c.bg, unitLabel: 'Unidad 1', done,
      title: solar ? 'El Sol y los planetas' : c.name, items,
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

  /** Turno del chat: el backend corre el pipeline de moderación de Smarty (sin streaming: nada se
   *  muestra antes del juez de salida). `history` es el contexto ya "en cuarentena". */
  chat: (history: ChatTurn[], text: string) => http<ChatReply>('/api/chat', { history, text }),

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
  /** La liga del chico (asignada por sus resultados; no hay "unirse"). */
  myLeague: () => call<AssignedLeague>('GET', '/leagues/mine', 400, () => M.ASSIGNED),
  /** Tabla completa de MI liga, con mi puesto marcado. */
  leagueStanding: (id: string) => call<LeagueStanding>('GET', `/leagues/${id}/standing`, 600, () => {
    if (id !== M.ASSIGNED.id) throw new ApiError(404, 'Esa liga no es tuya');
    const info = M.ASSIGNED;
    const top = M.LEAGUE_TOP_XP[id] ?? 2600;
    const rows = Array.from({ length: info.total }, (_, i) => {
      const me = i + 1 === info.pos;
      const nick = me ? M.ME.nick : `${M.NICKS[i % M.NICKS.length]}${i >= M.NICKS.length ? Math.floor(i / M.NICKS.length) + 1 : ''}`;
      return { pos: i + 1, nick, color: me ? '#FFC23D' : M.COLS[i % M.COLS.length], xp: Math.round(top * (1 - i / (info.total * 1.2))), ...(me && { me: true }) };
    });
    return { league: { id, name: info.name, color: info.color, total: info.total, pos: info.pos }, rows };
  }),
  /** Puesto por puntaje en la zona o el país (top 10 + mi puesto). */
  geoRanking: (scope: GeoScope) => call<GeoRanking>('GET', `/leagues/geo/${scope}`, 450, () => {
    const G = M.GEO[scope];
    return {
      scope, name: G.name,
      top: Array.from({ length: 10 }, (_, i) => ({ nick: M.NICKS[(i + G.off) % M.NICKS.length], color: M.COLS[(i + G.off) % M.COLS.length], xp: Math.round(G.top * (1 - i * 0.045)) })),
      me: { nick: M.ME.nick, pos: G.me, xp: G.xp },
    };
  }),
};
