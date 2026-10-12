// Cliente de API. Todo va al backend real (server/): búsqueda, artículos, imágenes, videos, chat,
// Mi espacio, Learn (rutas + resultados), progreso/Energy Coin, Tienda, y ligas/feed/amigos como
// FAKES de servidor (amigos: NPCs con moderación real). Cada llamada se loguea en la consola (→ / ←).
import type {
  ActivityResultInput, ActivityResultRow,
  AfterDayTrack, ArticleResponse, AuditFact, AuditResult, AvatarLook, CalendarEvent, ChatReply, ChatTurn, CloseWeekResult, ConnectResult, DriveFolder, DriveItem, DriveView,
  DefinitionRecipeData, EcTx, FeatureSchedule, FeedMotion, FeedReaction, FeedResponse, FolderNode, FriendThread, Friend, FriendRequest, GiftResult, HireResult, Identity, ImportBundleResult, LearnRouteData, LearnRouteListItem,
  MtAdminChannel, MtAdminState, MtChannelCard, MtChannelDetail, MtIngestResult, MtVideo, NewMarketItem, PeopleSearchResponse, RouteBundle, SendMessageResult,
  ParentActivity, ParentAlert, ParentConfig, ParentFeatures, ParentItemPatch, ParentPreset, ParentTopics, ParentVolume, ParentWords,
  AssignedLeague, GeoRanking, GeoScope, ImageResult, LeagueStanding, MarketItem, PageResult, Playlist, PlaylistDetail,
  ProgressSummary, Redemption, SavePayload, SearchResponse, SchedulesResponse, SectionKey, SimulateNpcsResult, Tab, Teacher, TeacherSlot, TrashView, User, Video, VideoResult,
} from './types';

export type { FriendThread } from './types';
export type SearchMap = { pages: PageResult; images: ImageResult; videos: VideoResult };
/** Hilo con un amigo (o lo nuevo del polling) + si está escribiendo (hay una respuesta en camino).
 *  ADITIVO de server/src/friendsFake.ts: pendiente de formalizar en types.ts. */


export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Evento global: la Energy Coin se movió (compra, canje, regalo, premio de Learn). Lo escucha la
 *  barra superior para refrescar el ⚡ al instante (pedido tras la tanda F2). */
export const EC_CHANGED_EVT = 'innerith:ec-changed';
function ecBump<T>(p: Promise<T>): Promise<T> {
  return p.then((r) => {
    try { window.dispatchEvent(new Event(EC_CHANGED_EVT)); } catch { /* fuera del navegador: nada */ }
    return r;
  });
}

/** Sesión de la Zona de padres: el token lo da POST /api/parent/unlock (va por fetch directo en
 *  sections/parent/lib/adultGate.ts: http() loguea los cuerpos y el PIN no debe pasar por acá).
 *  Vive solo en memoria: recargar la página vuelve a pedir el PIN. */
let parentToken: string | null = null;
export const setParentToken = (t: string | null) => { parentToken = t; };

/** Llamada al backend real (server/). Los errores de red se tratan como fallas (fail-closed en la UI). */
async function http<T>(path: string, body?: unknown): Promise<T> {
  const method = body === undefined ? 'GET' : 'POST';
  console.debug(`%c[api] → ${method} ${path} (backend)`, 'color:#C24B1F;font-weight:bold', body ?? '');
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  // Las rutas del padre van con la sesión abierta por el PIN (menos las dos públicas que lee el chico).
  if (parentToken && path.startsWith('/api/parent/')) headers['X-Parent-Token'] = parentToken;
  const r = await fetch(path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!r.ok) throw new ApiError(r.status, `HTTP ${r.status}`);
  const data = (await r.json()) as T;
  console.debug(`%c[api] ← ${method} ${path}`, 'color:#3A5BD9', data);
  return data;
}

/* ---------- endpoints ---------- */
export const api = {
  me: () => http<User>('/api/me'),

  /* ---- Identidad (avatar propio; server/src/identity.ts, persiste en server/data/identity.json) ---- */
  identity: () => http<Identity>('/api/identity'),
  setIdentity: (look: AvatarLook) => http<Identity>('/api/identity', { look }),

  /** Feed de la home (server FAKE hasta que exista el algoritmo real; misma forma de respuesta). */
  feed: (after?: string) => http<FeedResponse>(`/api/feed${after ? `?after=${encodeURIComponent(after)}` : ''}`),
  feedReact: (id: string, emoji: string) => http<{ id: string; reactions: FeedReaction[] }>('/api/feed/react', { id, emoji }),
  /** "Ver menos de esto" (v6): oculta ese ítem en las próximas respuestas (RAM del demo); undo lo deshace. */
  feedLess: (id: string, undo = false) => http<{ ok: boolean }>('/api/feed/less', { id, undo }),

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
  /** Canjea un premio. OJO: para los ítems de ROPA (kind 'ropa') la entrega es instantánea al
   *  guardarropas y la respuesta NO trae `redemption` (los canjes pendientes son solo de premios del padre). */
  redeem: (itemId: number) => ecBump(http<{ ok: boolean; ec: number; redemption?: Redemption; error?: string }>('/api/market/redeem', { itemId })),
  redemptions: () => http<{ redemptions: Redemption[] }>('/api/market/redemptions'),
  /** Marca/desmarca un premio en la lista de deseos (toggle si no viene value). */
  wish: (itemId: number, value?: boolean) => http<{ wishlist: number[] }>('/api/market/wish', { itemId, value }),

  /* ---- Zona del padre (v1). CONTRATO CONGELADO; server/src/parent.ts lo implementa la tanda 4 ---- */
  features: () => http<ParentFeatures>('/api/parent/features'),
  setFeature: (key: keyof ParentFeatures, on: boolean) => http<ParentFeatures>('/api/parent/features', { key, on }),
  parentActivity: () => http<ParentActivity>('/api/parent/activity'),
  parentItemAdd: (item: NewMarketItem) => http<MarketItem>('/api/parent/items', item),
  parentItemUpdate: (id: number, patch: ParentItemPatch) => http<{ ok: boolean }>('/api/parent/items/update', { id, ...patch }),
  parentItemArchive: (id: number) => http<{ ok: boolean }>('/api/parent/items/archive', { id }),
  deliverRedemption: (id: number) => http<{ ok: boolean }>('/api/parent/deliver', { id }),

  /* ---- Zona del padre v2: configuración viva (tanda P). CONTRATO CONGELADO; server/src/parent.ts.
         Todo esto viaja con X-Parent-Token (setParentToken tras el unlock); GET features y GET limits
         son públicos porque los lee la UI del chico. ---- */
  parentConfig: () => http<ParentConfig>('/api/parent/config'),
  parentTopics: (patch: Partial<ParentTopics>) => http<ParentTopics>('/api/parent/topics', patch),
  parentWords: (extra: string[]) => http<ParentWords>('/api/parent/words', { extra }),
  parentVolume: (patch: Partial<ParentVolume>) => http<ParentVolume>('/api/parent/volume', patch),
  /** Dial de animación del Feed del chico (v6): calmo / normal / vivo. Vive con la sesión del portón. */
  parentFeedMotion: (motion: FeedMotion) => http<{ feedMotion: FeedMotion }>('/api/parent/feed-motion', { motion }),
  parentAlerts: () => http<{ alerts: ParentAlert[] }>('/api/parent/alerts'),
  parentAlertSeen: (id: number) => http<{ ok: boolean }>('/api/parent/alerts/seen', { id }),
  parentPresets: () => http<{ presets: ParentPreset[]; current: string | null }>('/api/parent/presets'),
  /** Cierra la sesión del padre en el server ("Cerrar zona de padres"); el portón vuelve a pedir PIN. */
  parentLock: () => http<{ ok: boolean }>('/api/parent/lock', {}),
  applyPreset: (id: string) => http<{ ok: boolean; config: ParentConfig; features: ParentFeatures }>('/api/parent/presets/apply', { id }),
  /** Lo que la UI del chico necesita saber de la config del padre (público): topes de volumen. */
  limits: () => http<ParentVolume>('/api/parent/limits'),

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

  /* ---- MyTube (porte Smarty W5): server/src/mytube.ts; Mis listas y Seguir usan el CRUD existente ---- */
  mtChannels: () => http<{ channels: MtChannelCard[] }>('/api/mytube/channels'),
  mtChannel: (id: string) => http<MtChannelDetail>(`/api/mytube/channel?id=${encodeURIComponent(id)}`),
  mtChannelVideos: (id: string, offset: number, limit: number) =>
    http<{ videos: MtVideo[]; total: number }>(`/api/mytube/channel/videos?id=${encodeURIComponent(id)}&offset=${offset}&limit=${limit}`),
  mtChannelPlaylist: (playlistId: string) => http<{ videos: MtVideo[] }>(`/api/mytube/channel/playlist?id=${encodeURIComponent(playlistId)}`),
  mtAdminState: () => http<MtAdminState>('/api/mytube/admin/state'),
  mtAdminChannels: () => http<{ channels: MtAdminChannel[] }>('/api/mytube/admin/channels'),
  mtAdd: (youtubeUrl: string) => http<MtIngestResult>('/api/mytube/admin/add', { url: youtubeUrl }),
  mtReingest: (id: number) => http<MtIngestResult>('/api/mytube/admin/reingest', { id }),
  mtRemove: (id: number) => http<{ ok: boolean }>('/api/mytube/admin/remove', { id }),
  mtBackfill: () => http<{ ok: true; completados: number; canales: number } | { ok: false; error: string }>('/api/mytube/admin/backfill', {}),
  mtDedup: () => http<{ ok: true; removed: number } | { ok: false; error: string }>('/api/mytube/admin/dedup', {}),
  mtSetCap: (cap: string) => http<{ ok: boolean; videoCap: number }>('/api/mytube/admin/cap', { cap }),
  mtSetChannelDesc: (channelId: string, desc: string) => http<{ ok: boolean }>('/api/mytube/admin/channel-desc', { channelId, desc }),
  toggleFollow: (channelId: string, value?: boolean) => http<{ followed: boolean }>('/api/space/follow', { channelId, value }),

  playlists: () => http<{ playlists: Playlist[] }>('/api/space/playlists'),
  playlist: (id: number) => http<PlaylistDetail>(`/api/space/playlist?id=${id}`),
  createPlaylist: (name: string, videoId?: string) => http<Playlist>('/api/space/playlists/create', { name, videoId }),
  renamePlaylist: (id: number, name: string) => http<{ ok: boolean }>('/api/space/playlists/rename', { id, name }),
  deletePlaylist: (id: number) => http<{ ok: boolean }>('/api/space/playlists/delete', { id }),
  playlistAdd: (id: number, videoId: string) => http<{ ok: boolean; count?: number; existed?: boolean }>('/api/space/playlists/add', { id, videoId }),
  playlistRemove: (id: number, videoId: string) => http<{ ok: boolean }>('/api/space/playlists/remove', { id, videoId }),
  playlistSwap: (id: number, a: string, b: string) => http<{ ok: boolean }>('/api/space/playlists/swap', { id, a, b }),

  /** Turno del chat: el backend corre el pipeline de moderación de Smarty (sin streaming: nada se
   *  muestra antes del juez de salida). `history` es el contexto ya "en cuarentena". */
  chat: (history: ChatTurn[], text: string) => http<ChatReply>('/api/chat', { history, text }),

  /* amigos — server FAKE (server/src/friendsFake.ts): los NPCs del demo (lista, solicitud de amistad, hilos) viven en RAM
     del server y vuelven al seed con cada carga de página. Lo que Ian escribe pasa por la moderación REAL antes de llegar
     (palabras bloqueadas + juez); los NPCs contestan con el modelo, revisados por el juez de salida. Amigos apagado: 403. */
  friends: () => http<{ friends: Friend[] }>('/api/friends'),
  friend: (id: string) => http<Friend>(`/api/friends/one?id=${encodeURIComponent(id)}`),
  /** Solicitudes de amistad pendientes (las mandan los NPCs). */
  requests: () => http<{ requests: FriendRequest[] }>('/api/friends/requests'),
  /** Aceptar: el NPC pasa a la lista (primero) y devuelve su perfil completo. */
  acceptRequest: (id: string) => http<{ friend: Friend }>('/api/friends/requests/accept', { id }),
  /** "Ahora no": la solicitud desaparece (vuelve con la próxima carga de página: demo). */
  declineRequest: (id: string) => http<{ ok: boolean }>('/api/friends/requests/decline', { id }),
  /* Buscar → Personas (tanda F2): búsqueda por nick y solicitud saliente ("Quiero contactarlo"). */
  searchPeople: (q: string) => http<PeopleSearchResponse>(`/api/friends/search?q=${encodeURIComponent(q)}`),
  askToConnect: (id: string) => http<ConnectResult>('/api/friends/requests/send', { id }),
  thread: (id: string) => http<FriendThread>(`/api/friends/thread?id=${encodeURIComponent(id)}`),
  /** Moderación en tiempo real: `blocked` = el mensaje NO llegó y `notice` le explica al chico cómo decirlo mejor. */
  sendMessage: (id: string, text: string) => http<SendMessageResult>('/api/friends/send', { id, text }),
  /** Polling: las respuestas del amigo que ya están listas + si sigue escribiendo. */
  newMessages: (id: string) => http<FriendThread>(`/api/friends/new?id=${encodeURIComponent(id)}`),

  /* ligas — server FAKE (server/src/leaguesFake.ts): los otros 11 chicos y los rankings de zona/país son demo,
     pero "Vos" lleva la XP REAL de la semana (el mismo número en las tres tablas) y el puesto sale de ordenarla. */
  /** La liga del chico (asignada por sus resultados; no hay "unirse"). */
  myLeague: () => http<AssignedLeague>('/api/leagues/mine'),
  /** Tabla completa de MI liga, con mi puesto marcado. */
  leagueStanding: (id: string) => http<LeagueStanding>(`/api/leagues/standing?id=${encodeURIComponent(id)}`),
  /** Puesto por puntaje en la zona o el país (top 10 + mi puesto). */
  geoRanking: (scope: GeoScope) => http<GeoRanking>(`/api/leagues/geo?scope=${scope}`),

  /* ---- Demo vivo (botones "Simular…" — endpoints de demo del server fake) ---- */
  /** Cierra la semana de liga YA: congela tabla, medallas, re-asigna y arranca la semana nueva (XP → 0). */
  closeWeek: () => http<CloseWeekResult>('/api/leagues/close-week', {}),
  /** Los NPCs "viven" un rato: noticias frescas de logros en el feed. */
  simulateNpcs: () => http<SimulateNpcsResult>('/api/feed/simulate-npcs', {}),

  /* ---- Profesores (marketplace del padre) + Calendario del chico — server FAKE teachersFake.ts;
         las contrataciones PERSISTEN (config del padre, server/data/teachers.json) ---- */
  teachers: () => http<{ teachers: Teacher[] }>('/api/teachers'),
  hireTeacher: (id: string, slot: TeacherSlot) => http<HireResult>('/api/teachers/hire', { id, slot }),
  cancelTeacher: (id: string) => http<{ ok: boolean; error?: string }>('/api/teachers/cancel', { id }),
  /** El calendario del chico: SOLO las clases (sin precios). */
  calendar: () => http<{ events: CalendarEvent[] }>('/api/calendar'),

  /* ---- Guardarropas: regalar ropa a un amigo (gasta EC; el NPC se la pone y agradece en el hilo) ---- */
  giftToFriend: (itemId: number, friendId: string) => ecBump(http<GiftResult>('/api/market/gift', { itemId, friendId })),

  /* ---- Porte Smarty · rutas de Learn (CATÁLOGO persistido en el server) + /crear (tanda W1).
         route-lab se llama DIRECTO desde el navegador como en el POC (URL configurable en la vista,
         default http://localhost:5203): no lleva claves. La auditoría de facts sí va por NUESTRO
         server (misma lógica del factAudit del POC; claves jamás al cliente). ---- */
  /* ---- After Day (W6) + Horarios (W7): server/src/{afterday,schedule}.ts ---- */
  afterDay: () => http<{ tracks: AfterDayTrack[] }>('/api/afterday'),
  schedules: () => http<SchedulesResponse>('/api/schedules'),
  parentMusic: () => http<{ tracks: AfterDayTrack[] }>('/api/parent/music'),
  parentMusicAdd: (youtubeUrl: string, title?: string) =>
    http<{ ok: true; track: AfterDayTrack } | { ok: false; error: string }>('/api/parent/music/add', { url: youtubeUrl, title }),
  parentMusicRemove: (videoId: string) => http<{ ok: boolean }>('/api/parent/music/remove', { videoId }),
  parentSchedules: (patch: Partial<Record<SectionKey, FeatureSchedule>>) => http<SchedulesResponse>('/api/parent/schedules', { patch }),

  /** Resultados de Learn (W3): todas las filas (el cliente deriva progreso/urgencia por target, como el POC). */
  learnResults: () => http<{ rows: ActivityResultRow[] }>('/api/learn/results'),
  /** Graba una partida terminada (el recordResult del POC; fire-and-forget en el overlay).
   *  `awarded` = ⚡/XP acreditados SOLO la primera vez que ese target queda logrado (economía Innerith). */
  recordLearnResult: (input: ActivityResultInput) => ecBump(http<{ row: ActivityResultRow; awarded?: { ec: number; xp: number } }>('/api/learn/results', input)),
  /** TODAS las definiciones del catálogo en un viaje (hidratación del motor al entrar a Learn). */
  learnDefinitions: () => http<{ definitions: DefinitionRecipeData[] }>('/api/learn-routes/definitions'),
  learnRoutes: () => http<{ routes: LearnRouteListItem[] }>('/api/learn-routes'),
  learnRoute: (id: string) => http<{ route: LearnRouteData; definitions: DefinitionRecipeData[]; /** opaco: lo necesita la reapertura en /crear */ editorial?: unknown }>(`/api/learn-routes/one?id=${encodeURIComponent(id)}`),
  importRouteBundle: (bundle: RouteBundle) => http<ImportBundleResult>('/api/learn-routes/import', { bundle }),
  deleteLearnRoute: (id: string) => http<{ ok: boolean }>('/api/learn-routes/delete', { id }),
  /** Audita UN fact contra fuentes (el factAudit del POC corrido en nuestro server; errores de negocio con 200 + ok:false). */
  auditFacts: (payload: { fact: AuditFact; lang?: string }) => http<{ ok: true; result: AuditResult } | { ok: false; error: string }>('/api/create/audit', { payload }),
};
