// Cliente de API. Casi todo va al backend real (server/): búsqueda, artículos, imágenes, videos, chat,
// Mi espacio, práctica (ejercicios del contenido real), progreso/Energy Coin, Tienda, y ligas/feed como
// FAKES de servidor con XP real. Solo quedan simulados en el navegador: cursos (lista/generación) y
// amigos. Cada llamada se loguea en la consola (→ / ←).
import * as M from './mock';
import type {
  AnswerResult, Answer, ArticleResponse, ChannelDetail, Channel, ChatReply, ChatTurn, Course, DriveFolder, DriveItem, DriveView,
  EcTx, FeedReaction, FeedResponse, FolderNode, CourseDetail, Exercise, Friend, FriendMessage,
  AssignedLeague, GeoRanking, GeoScope, ImageResult, Journey, LeagueStanding, MarketItem, PageResult, Playlist, PlaylistDetail,
  ProgressSummary, Redemption, SavePayload, SearchResponse, Tab, TrashView, User, Video, VideoResult,
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

  /* ---- Progreso real (XP semanal + Energy Coin) y Tienda. CONTRATO CONGELADO (docs/AGENTS.md):
         lo ganado practicando (tanda 1) y lo gastado en la Tienda (tanda 2) viven en server/src/progress.ts ---- */
  progress: () => http<ProgressSummary>('/api/progress/summary'),
  ecTx: () => http<{ tx: EcTx[] }>('/api/progress/tx'),
  market: () => http<{ items: MarketItem[]; ec: number }>('/api/market'),
  redeem: (itemId: number) => http<{ ok: boolean; ec: number; redemption?: Redemption; error?: string }>('/api/market/redeem', { itemId }),
  redemptions: () => http<{ redemptions: Redemption[] }>('/api/market/redemptions'),
  /** Marca/desmarca un premio en la lista de deseos (toggle si no viene value). */
  wish: (itemId: number, value?: boolean) => http<{ wishlist: number[] }>('/api/market/wish', { itemId, value }),

  /* ---- Mi espacio (backend real: server/src/space.ts, persistido en server/data/space.json) ---- */
  drive: (folder = 0) => http<DriveView>(`/api/space/drive?folder=${folder}`),
  driveFolders: () => http<{ folders: FolderNode[] }>('/api/space/folders'),
  createFolder: (name: string, parentId: number) => http<DriveFolder>('/api/space/drive/folder', { name, parentId }),
  editFolder: (id: number, patch: { name?: string }) => http<{ ok: boolean }>('/api/space/drive/folder/update', { id, ...patch }),
  moveFolder: (id: number, parentId: number) => http<{ ok: boolean }>('/api/space/drive/folder/move', { id, parentId }),
  trashFolder: (id: number) => http<{ ok: boolean }>('/api/space/drive/folder/trash', { id }),
  moveItem: (id: number, folderId: number) => http<{ ok: boolean }>('/api/space/drive/item/move', { id, folderId }),
  trashItem: (id: number) => http<{ ok: boolean }>('/api/space/drive/item/trash', { id }),
  driveTrash: () => http<TrashView>('/api/space/drive/trash'),
  restore: (kind: 'folder' | 'item', id: number) => http<{ ok: boolean }>('/api/space/drive/restore', { kind, id }),
  purge: (kind: 'folder' | 'item', id: number) => http<{ ok: boolean }>('/api/space/drive/purge', { kind, id }),
  /** Guarda un video / artículo / imagen en una carpeta ("¿Dónde lo guardás?"). */
  saveItem: (p: SavePayload) => http<{ item: DriveItem; existed?: boolean }>('/api/space/save', p),

  channels: () => http<{ channels: Channel[] }>('/api/space/channels'),
  channel: (id: string) => http<ChannelDetail>(`/api/space/channel?id=${encodeURIComponent(id)}`),
  toggleFollow: (channelId: string, value?: boolean) => http<{ followed: boolean }>('/api/space/follow', { channelId, value }),

  playlists: () => http<{ playlists: Playlist[] }>('/api/space/playlists'),
  playlist: (id: number) => http<PlaylistDetail>(`/api/space/playlist?id=${id}`),
  createPlaylist: (name: string, videoId?: string) => http<Playlist>('/api/space/playlists/create', { name, videoId }),
  renamePlaylist: (id: number, name: string) => http<{ ok: boolean }>('/api/space/playlists/rename', { id, name }),
  deletePlaylist: (id: number) => http<{ ok: boolean }>('/api/space/playlists/delete', { id }),
  playlistAdd: (id: number, videoId: string) => http<{ ok: boolean; count?: number; existed?: boolean }>('/api/space/playlists/add', { id, videoId }),
  playlistRemove: (id: number, videoId: string) => http<{ ok: boolean }>('/api/space/playlists/remove', { id, videoId }),
  playlistSwap: (id: number, a: string, b: string) => http<{ ok: boolean }>('/api/space/playlists/swap', { id, a, b }),

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

  /* practicar — backend real (server/src/practice.ts): ejercicios generados del contenido aprobado de cada curso
     (regla de oro: solo datos que están en el material), corregidos en el servidor; cada acierto suma XP + Energy Coin. */
  journey: async (courseId: string): Promise<Journey> => {
    // El catálogo de cursos todavía es demo (M.COURSES + generados en memoria): de ahí salen el arte de la tarjeta
    // y el nombre que el server necesita la primera vez que arma la práctica de un curso generado.
    const c = allCourses().find((x) => x.id === courseId);
    const j = await http<Journey>(`/api/practice/journey?course=${encodeURIComponent(courseId)}${c ? `&name=${encodeURIComponent(c.name)}` : ''}`);
    return c ? { ...j, courseImg: c.img, courseBg: c.bg } : j;
  },
  exercise: (courseId: string, n: number) => http<Exercise>(`/api/practice/exercise?course=${encodeURIComponent(courseId)}&n=${n}`),
  /** Corrige en el servidor (la abierta la analiza un modelo). Si acierta el paso que toca, trae el premio (xp/xpWeek/ec). */
  submit: (courseId: string, n: number, a: Answer) => http<AnswerResult>('/api/practice/answer', { course: courseId, n, answer: a }),
  completeNode: (courseId: string, n: number) => http<{ done: number }>('/api/practice/complete', { course: courseId, n }),

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

  /* ligas — server FAKE (server/src/leaguesFake.ts): los otros 11 chicos y los rankings de zona/país son demo,
     pero "Vos" lleva la XP REAL de la semana (el mismo número en las tres tablas) y el puesto sale de ordenarla. */
  /** La liga del chico (asignada por sus resultados; no hay "unirse"). */
  myLeague: () => http<AssignedLeague>('/api/leagues/mine'),
  /** Tabla completa de MI liga, con mi puesto marcado. */
  leagueStanding: (id: string) => http<LeagueStanding>(`/api/leagues/standing?id=${encodeURIComponent(id)}`),
  /** Puesto por puntaje en la zona o el país (top 10 + mi puesto). */
  geoRanking: (scope: GeoScope) => http<GeoRanking>(`/api/leagues/geo?scope=${scope}`),
};
