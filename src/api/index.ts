// Cliente de API. Todo va al backend real (server/): búsqueda, artículos, imágenes, videos, chat,
// Mi espacio, Learn (rutas + resultados), progreso/Energy Coin, Tienda, y ligas/feed/amigos como
// FAKES de servidor (amigos: NPCs con moderación real). Cada llamada se loguea en la consola (→ / ←).
import type {
  ActivityResultInput, ActivityResultRow,
  AfterDayTrack, ArticleResponse, AuditFact, AuditResult, AvatarLook, CalendarEvent, ChatReply, ChatTurn, CloseWeekResult, ConnectResult, ContractResult, DriveFolder, DriveItem, DriveView,
  DefinitionRecipeData, EcTx, FamilyLeague, FeatureSchedule, FeedMotion, FeedReaction, FeedResponse, FolderNode, FriendThread, Friend, FriendRequest, GiftResult, Identity, ImportBundleResult, LearnRouteData, LearnRouteListItem,
  MentorPlan, MentorsResponse, MtAdminChannel, MtAdminState, MtChannelCard, MtChannelDetail, MtIngestResult, MtVideo, NewMarketItem, PeopleSearchResponse, RouteBundle, SendMessageResult,
  ParentActivity, ParentAlert, ParentConfig, ParentFeatures, ParentItemPatch, ParentPreset, ParentTopics, ParentVolume, ParentWords,
  AssignedLeague, GeoRanking, GeoScope, ImageResult, LeagueStanding, MarketItem, PageResult, Playlist, PlaylistDetail,
  ProgressSummary, Redemption, SavePayload, ScheduleResult, SearchResponse, SchedulesResponse, SectionKey, SimulateNpcsResult, Tab, TeacherSlot, TrashView, User, UserInfo, Video, VideoResult,
} from './types';

export type { FriendThread } from './types';
export type SearchMap = { pages: PageResult; images: ImageResult; videos: VideoResult };
/** Hilo con un amigo (o lo nuevo del polling) + si está escribiendo (hay una respuesta en camino).
 *  ADITIVO de server/src/friendsFake.ts: pendiente de formalizar en types.ts. */


/** Una respuesta de error del backend. `status` es el código HTTP (lo que hay que mirar para decidir: 401/403/404…;
 *  NUNCA el texto). `reason` es el motivo que el server escribió en el cuerpo (`{ error: "…" }`), o null si no vino
 *  (cuerpo vacío o que no es JSON: p. ej. el proxy de Vite con el server caído o reiniciando). `message` = `reason` si
 *  vino; si no, "HTTP <status>". */
export class ApiError extends Error {
  constructor(public status: number, message: string, public reason: string | null = null) { super(message); }
}

/** El motivo de un error tal como lo mandó el server: el campo `error` del cuerpo JSON, si es un texto no vacío. */
async function errorReason(r: Response): Promise<string | null> {
  try {
    const j: unknown = await r.json();
    const e = j && typeof j === 'object' ? (j as { error?: unknown }).error : undefined;
    return typeof e === 'string' && e.trim() ? e.trim() : null;
  } catch {
    return null; // sin cuerpo o no es JSON
  }
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

/* ---------- Usuario ACTIVO (línea 14-oct, docs/USUARIOS.md §2) ----------
   DEMO: el switch de la barra superior guarda el id en localStorage['innerith.user'] (ÚNICO dueño de la clave: este
   archivo) y TODA llamada a la API lo manda como cabecera X-Innerith-User; el server lo valida contra su seed
   (server/src/users.ts; desconocido o ausente → ian). Sin dato, o sin localStorage (modo privado, tests): 'ian', la app de
   siempre. Cambiar de usuario recarga la app SIN resetear la demo (U4, docs/USUARIOS.md §10: el reset de cada carga es del
   usuario activo y la carga que sigue al switch no lo hace; la marca de un solo uso vive en
   sessionStorage['innerith.keepDemo'], también con dueño único: este archivo). La SESIÓN de Familia (la ex Zona de
   padres) es la del adulto activo: implícita en el server, sin portón ni token en el cliente. */
const USER_KEY = 'innerith.user';
const DEFAULT_USER = 'ian';
/** sessionStorage: sobrevive al location.assign de la MISMA pestaña y muere con ella (una pestaña nueva o un F5 sin
 *  switch no la tienen: resetean al activo, como siempre). */
const KEEP_KEY = 'innerith.keepDemo';
/** El id del usuario activo (el que viaja en X-Innerith-User). */
export function actingUserId(): string {
  try { return localStorage.getItem(USER_KEY) || DEFAULT_USER; } catch { return DEFAULT_USER; }
}
/** Cambia el usuario activo y recarga la app desde el Feed (el switch de demo de la barra superior). U4: marca que la carga
 *  que sigue viene del switch, así NO resetea a nadie (la demo de la familia sigue donde estaba). */
export function setActingUser(id: string) {
  try { localStorage.setItem(USER_KEY, id); } catch { /* sin almacenamiento: la recarga vuelve al de siempre */ }
  try { sessionStorage.setItem(KEEP_KEY, '1'); } catch { /* sin almacenamiento: la recarga resetea al activo, como antes */ }
  location.assign('/');
}
/** U4: ¿esta carga viene del switch de usuario? La CONSUME (vale una sola carga: el F5 siguiente ya resetea al activo).
 *  Sin almacenamiento → false (se resetea, como antes de U4). */
export function consumeKeepDemo(): boolean {
  try {
    const keep = sessionStorage.getItem(KEEP_KEY) === '1';
    sessionStorage.removeItem(KEEP_KEY);
    return keep;
  } catch {
    return false;
  }
}

/** Llamada al backend real (server/). Los errores de red se tratan como fallas (fail-closed en la UI). */
async function http<T>(path: string, body?: unknown): Promise<T> {
  const method = body === undefined ? 'GET' : 'POST';
  console.debug(`%c[api] → ${method} ${path} (backend)`, 'color:#C24B1F;font-weight:bold', body ?? '');
  const headers: Record<string, string> = { 'X-Innerith-User': actingUserId() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const r = await fetch(path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!r.ok) {
    const reason = await errorReason(r);
    console.debug(`%c[api] ✗ ${method} ${path} → ${r.status}`, 'color:#B32D33;font-weight:bold', reason ?? '');
    throw new ApiError(r.status, reason ?? `HTTP ${r.status}`, reason);
  }
  const data = (await r.json()) as T;
  console.debug(`%c[api] ← ${method} ${path}`, 'color:#3A5BD9', data);
  return data;
}

/** U3 (docs/USUARIOS.md §9): los pedidos de Familia POR INTEGRANTE llevan `?member=<id>` (el dependiente que el adulto
 *  eligió en el selector). Sin member el server usa el PRIMER integrante del adulto activo (así los llamados viejos siguen
 *  andando); uno que no es de la familia → 400. */
const withMember = (path: string, member?: string) =>
  member ? `${path}${path.includes('?') ? '&' : '?'}member=${encodeURIComponent(member)}` : path;

/* ---------- endpoints ---------- */
export const api = {
  /** El usuario ACTIVO (el de la cabecera X-Innerith-User). */
  me: () => http<User>('/api/me'),
  /** Los usuarios del demo (para el switch de la barra superior y los dependientes del adulto en Familia). */
  users: () => http<{ users: UserInfo[] }>('/api/users'),

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

  /* ---- Zona del padre (v1). CONTRATO CONGELADO; server/src/parent.ts lo implementa la tanda 4.
         U3: `member` (último parámetro, opcional) = el integrante que se configura (ver withMember). ---- */
  /** PÚBLICO: los on-off que rigen para el usuario ACTIVO (lo lee la UI del chico; sin member). */
  features: () => http<ParentFeatures>('/api/parent/features'),
  setFeature: (key: keyof ParentFeatures, on: boolean, member?: string) => http<ParentFeatures>(withMember('/api/parent/features', member), { key, on }),
  /** TODO del integrante (U4): items, canjes y protecciones, y también xp/⚡/racha/continue y lo guardado en SU Mi espacio. */
  parentActivity: (member?: string) => http<ParentActivity>(withMember('/api/parent/activity', member)),
  parentItemAdd: (item: NewMarketItem, member?: string) => http<MarketItem>(withMember('/api/parent/items', member), item),
  parentItemUpdate: (id: number, patch: ParentItemPatch, member?: string) => http<{ ok: boolean }>(withMember('/api/parent/items/update', member), { id, ...patch }),
  parentItemArchive: (id: number, member?: string) => http<{ ok: boolean }>(withMember('/api/parent/items/archive', member), { id }),
  deliverRedemption: (id: number, member?: string) => http<{ ok: boolean }>(withMember('/api/parent/deliver', member), { id }),

  /* ---- Zona del padre v2 (hoy, la sección Familia del adulto): configuración viva (tanda P). CONTRATO CONGELADO;
         server/src/parent.ts. Todo esto pide la sesión del padre, que es la del ADULTO activo (implícita: viaja en
         X-Innerith-User; el portón de PIN se retiró del cliente el 14-oct); GET features y GET limits son públicos
         porque los lee la UI del chico. U3: lo que es por integrante lleva `member`; tz y música son de la FAMILIA. ---- */
  parentConfig: (member?: string) => http<ParentConfig>(withMember('/api/parent/config', member)),
  parentTopics: (patch: Partial<ParentTopics>, member?: string) => http<ParentTopics>(withMember('/api/parent/topics', member), patch),
  parentWords: (extra: string[], member?: string) => http<ParentWords>(withMember('/api/parent/words', member), { extra }),
  parentVolume: (patch: Partial<ParentVolume>, member?: string) => http<ParentVolume>(withMember('/api/parent/volume', member), patch),
  /** Zona horaria de la FAMILIA (deuda 14-oct): IANA o null = la del server. Con la sesión del adulto; sin member. */
  parentTz: (tz: string | null) => http<{ tz: string | null }>('/api/parent/tz', { tz }),
  /** Dial de animación del Feed del chico (v6): calmo / normal / vivo. Vive con la sesión del adulto. */
  parentFeedMotion: (motion: FeedMotion, member?: string) => http<{ feedMotion: FeedMotion }>(withMember('/api/parent/feed-motion', member), { motion }),
  /** SIN member: los avisos de TODA la familia (cada uno con childId/childName); con member, solo los de ese integrante. */
  parentAlerts: (member?: string) => http<{ alerts: ParentAlert[] }>(withMember('/api/parent/alerts', member)),
  parentAlertSeen: (id: number, member?: string) => http<{ ok: boolean }>(withMember('/api/parent/alerts/seen', member), { id }),
  parentPresets: (member?: string) => http<{ presets: ParentPreset[]; current: string | null }>(withMember('/api/parent/presets', member)),
  applyPreset: (id: string, member?: string) => http<{ ok: boolean; config: ParentConfig; features: ParentFeatures }>(withMember('/api/parent/presets/apply', member), { id }),
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

  /** Con `videoId`, cada lista además dice si YA contiene ese video (`has`) — para marcar en «＋ Lista». */
  playlists: (videoId?: string) => http<{ playlists: Playlist[] }>(`/api/space/playlists${videoId ? `?video=${encodeURIComponent(videoId)}` : ''}`),
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
     del server; U4: el grafo es de CADA usuario y vuelve al seed con la carga de página de ESE usuario. Lo que el chico
     escribe pasa por la moderación REAL antes de llegar (palabras bloqueadas + juez); los NPCs contestan con el modelo,
     revisados por el juez de salida. Amigos apagado: 403. Lo social es de los CHICOS (D4): con un adulto activo la UI no
     lo pide ni lo muestra (sections/friends/lib/social.ts). */
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

  /* ligas — server FAKE (server/src/leaguesFake.ts): los otros 11 de tu tabla (chicos; para el adulto, otros grandes) y los
     rankings de zona/país son demo, pero "Vos" lleva la XP REAL de la semana (el mismo número en las tres tablas) y el
     puesto sale de ordenarla. U4: cada usuario tiene SU liga. */
  /** La liga del chico (asignada por sus resultados; no hay "unirse"). */
  myLeague: () => http<AssignedLeague>('/api/leagues/mine'),
  /** Tabla completa de MI liga, con mi puesto marcado. */
  leagueStanding: (id: string) => http<LeagueStanding>(`/api/leagues/standing?id=${encodeURIComponent(id)}`),
  /** Puesto por puntaje en la zona o el país (top 10 + mi puesto). */
  geoRanking: (scope: GeoScope) => http<GeoRanking>(`/api/leagues/geo?scope=${scope}`),
  /** U4 · D2: la tabla de la SEMANA de la familia (grandes y chicos, por su XP de la semana, con su racha y su avatar
   *  elegido; `me` = quien mira). No es una liga de la escalera. Un chico con Ligas apagadas recibe 403. */
  familyLeague: () => http<FamilyLeague>('/api/leagues/family'),

  /* ---- Demo vivo (botones "Simular…" — endpoints de demo del server fake) ---- */
  /** Cierra la semana de liga YA: congela tabla, medallas, re-asigna y arranca la semana nueva (XP → 0). */
  closeWeek: () => http<CloseWeekResult>('/api/leagues/close-week', {}),
  /** Los NPCs "viven" un rato: noticias frescas de logros en el feed. */
  simulateNpcs: () => http<SimulateNpcsResult>('/api/feed/simulate-npcs', {}),

  /* ---- Mentores (línea 14-oct, docs/USUARIOS.md §3 y §6) — server FAKE teachersFake.ts. SOLO del adulto, con la sesión
         implícita (viaja en X-Innerith-User: un chico recibe 401). Los contratos PERSISTEN (config de la familia,
         server/data/teachers.json v2) y los rechazos de negocio vuelven con 200 + ok:false y el motivo. ---- */
  /** El catálogo con los contratos de la familia, las horas ocupadas por beneficiario y los nombres. */
  mentors: () => http<MentorsResponse>('/api/mentors'),
  /** Contrata (paga) un plan de 1-3 clases por semana para el adulto o un dependiente: nace `pending`, sin días. */
  mentorContract: (teacherId: string, daysPerWeek: MentorPlan, beneficiary: string) =>
    http<ContractResult>('/api/mentors/contract', { teacherId, daysPerWeek, beneficiary }),
  /** El post-compra: los días (tantos como el plan) con su hora → `active` y las clases en el calendario del beneficiario. */
  mentorSchedule: (contractId: number, slots: TeacherSlot[]) => http<ScheduleResult>('/api/mentors/schedule', { contractId, slots }),
  /** Cancela un contrato (pendiente o con días): sus clases salen del calendario. */
  mentorCancel: (contractId: number) => http<{ ok: boolean; error?: string }>('/api/mentors/cancel', { contractId }),
  /** El calendario del usuario ACTIVO: SOLO sus clases (sin precios). */
  calendar: () => http<{ events: CalendarEvent[] }>('/api/calendar'),

  /* ---- Guardarropas: regalar ropa a un amigo (gasta EC; el NPC se la pone y agradece en el hilo) ---- */
  giftToFriend: (itemId: number, friendId: string) => ecBump(http<GiftResult>('/api/market/gift', { itemId, friendId })),

  /* ---- Porte Smarty · rutas de Learn (CATÁLOGO persistido en el server) + /crear (tanda W1).
         route-lab se llama DIRECTO desde el navegador como en el POC (URL configurable en la vista,
         default http://localhost:5203): no lleva claves. La auditoría de facts sí va por NUESTRO
         server (misma lógica del factAudit del POC; claves jamás al cliente). ---- */
  /* ---- After Day (W6) + Horarios (W7): server/src/{afterday,schedule}.ts ---- */
  afterDay: () => http<{ tracks: AfterDayTrack[] }>('/api/afterday'),
  /** PÚBLICO: chico → los suyos; adulto → los del integrante `member` (sin member, el primero; lo lee el reloj de la TopBar). */
  schedules: (member?: string) => http<SchedulesResponse>(withMember('/api/schedules', member)),
  parentMusic: () => http<{ tracks: AfterDayTrack[] }>('/api/parent/music'),
  parentMusicAdd: (youtubeUrl: string, title?: string) =>
    http<{ ok: true; track: AfterDayTrack } | { ok: false; error: string }>('/api/parent/music/add', { url: youtubeUrl, title }),
  parentMusicRemove: (videoId: string) => http<{ ok: boolean }>('/api/parent/music/remove', { videoId }),
  parentSchedules: (patch: Partial<Record<SectionKey, FeatureSchedule>>, member?: string) => http<SchedulesResponse>(withMember('/api/parent/schedules', member), { patch }),

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
