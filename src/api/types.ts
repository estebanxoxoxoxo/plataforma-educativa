// Contratos de datos entre la UI y el backend. La API fake (./index.ts) los respeta;
// el backend real solo tiene que devolver estas mismas formas.

export type User = { name: string; age: number; nick: string };

export type Tab = 'pages' | 'images' | 'videos';

/** Todo resultado de búsqueda pasa por moderación: `blocked` = filtrado. */
export type Moderated<T> = (T & { blocked?: false }) | { id: string; blocked: true };

export type PageResult = {
  id: string; site: string; url: string; title: string; date?: string;
  /** HTML seguro (solo <b>) */ snippet: string; color: string; articleId: string;
};
export type ImageResult = { id: string; img: string; caption: string; source: { name: string; color: string } };
export type VideoResult = { id: string; img: string; title: string; subtitle: string; duration: string; channel: string; date: string };
export type RelatedChip = { label: string; img: string };

export type SearchResponse<T> = { query: string; items: Moderated<T>[]; related?: RelatedChip[]; /** solo en la UI: la búsqueda falló */ error?: string };

/** Artículo real extraído y moderado por el backend (Wikipedia REST o Jina → Readability → DOMPurify → juez). */
export type Article = {
  /** = URL de origen */ id: string;
  url: string;
  /** Tema para "Generar curso" */ topic: string;
  title: string;
  siteName?: string;
  hero?: string;
  /** HTML saneado. Los <a href> apuntan a URLs absolutas: se moderan al tocarlos. */
  html: string;
};
export type ArticleResponse =
  | { status: 'ok'; article: Article }
  /** reason: 'site' = fuera de la lista blanca · 'content' = el juez lo rechazó */
  | { status: 'blocked'; reason: string; motivo?: string }
  /** No se pudo leer o revisar (muro anti-bot, falla del extractor o del juez). Fail-closed. */
  | { status: 'error'; reason: string };

export type Video = VideoResult & {
  durationSec: number; reviewed: boolean;
  /** Datos del canal y del video como los muestra YouTube */ subscribers: string; verified: boolean; likes: string;
  channelThumb?: string;
  /** Para seguir el canal (MyTube) */ channelId: string; followed: boolean;
};

/* ---------- Mi espacio: Drive (carpetas), canales seguidos y listas (backend real: server/src/space.ts) ---------- */
/** Todas las carpetas se ven iguales (ícono único estilo Windows); sin color/emoji por carpeta. */
export type DriveFolder = { id: number; name: string; parentId: number; count: number };
export type FolderNode = { id: number; name: string; parentId: number };
export type DriveTarget = { type: 'video'; id: string } | { type: 'article'; url: string } | { type: 'image'; url: string };
export type DriveItem = { id: number; type: 'video' | 'articulo' | 'imagen'; title: string; img?: string; subtitle?: string; target: DriveTarget; createdAt: number };
export type DriveView = { path: { id: number; name: string }[]; folders: DriveFolder[]; items: DriveItem[] };
export type TrashView = { folders: { id: number; name: string }[]; items: DriveItem[] };
export type SavePayload = {
  folderId?: number;
  video?: { id: string };
  article?: { url: string; title: string; source?: string };
  image?: { url: string; caption?: string; source?: string };
};

export type Channel = { id: string; name: string; videos: number; cover: string; followed: boolean };
export type ChannelDetail = { channel: Channel & { thumb?: string; subscribers?: string }; total: number; videos: VideoResult[] };

export type Playlist = { id: number; name: string; count: number; cover?: string };
export type PlaylistDetail = { id: number; name: string; videos: VideoResult[] };

export type Course = {
  id: string; name: string; units: number; progress: number;
  img: string; bg: [string, string]; isNew?: boolean;
};
/** Un capítulo de Aprender = UN contenido real y aprobado (video del catálogo o lectura de un sitio aprobado). */
export type Chapter = {
  title: string;
  kind: 'video' | 'lectura';
  /** Texto del tag: "Video · 4:13" / "Lectura" */ label: string;
  /** Canal o sitio de origen */ source: string;
  target: { type: 'video'; id: string } | { type: 'article'; url: string };
};
export type CourseDetail = Course & {
  chapters: number;
  unitList: { title: string; chapters: Chapter[] }[];
};

export type ExType = 'open' | 'mc' | 'vf';
export type NodeType = ExType | 'trophy' | 'skip';
export type JourneyItem =
  | { kind: 'div'; title: string }
  | { kind: 'node'; n: number; type: NodeType;
      /** De qué trata (pregunta / afirmación) */ prompt?: string;
      seconds?: number; xp: number;
      /** Solo hitos: nombre de la insignia */ badge?: string };
export type Journey = {
  courseId: string; courseName: string; courseImg: string; courseBg: [string, string];
  unitLabel: string; title: string; items: JourneyItem[]; done: number;
};

export type Exercise =
  | { n: number; type: 'open'; progress: number; seconds: number; question: string; placeholder: string }
  | { n: number; type: 'mc'; progress: number; seconds: number; question: string; hint: string; options: string[] }
  | { n: number; type: 'vf'; progress: number; seconds: number; statement: string };

export type Answer = { kind: 'open'; text: string } | { kind: 'mc'; selected: string[] } | { kind: 'vf'; value: boolean } | { kind: 'timeout' };
export type AnswerResult = {
  correct: boolean; title: string; detail: string;
  /** Solo pregunta abierta */ ai?: { verdict: string; feedback: string };
  /** Solo multiple choice / VF: opciones correctas para pintar */ correctOptions?: string[];
  /** Premio REAL al acertar (contrato con server/src/progress.ts): puntos de este ejercicio,
   *  XP acumulada en la semana y saldo de Energy Coin resultante. */
  xp?: number; xpWeek?: number; ec?: number;
};

/* ---------- Progreso real: XP semanal (el puntaje ÚNICO de liga/zona/país) + Energy Coin ---------- */
export type ProgressSummary = {
  xpWeek: number;
  /** Saldo de Energy Coin (⚡) para gastar en la Tienda */ ec: number;
  streakDays: number;
  /** Para "Seguí practicando" (null si nunca practicó) */
  continue: { courseId: string; title: string; done: number; total: number } | null;
};
export type EcTx = { id: number; ts: number; kind: 'earn' | 'spend'; amount: number; label: string };

/* ---------- Tienda (marketplace: las recompensas las publica el padre) ---------- */
export type MarketItem = {
  id: number; title: string; desc?: string;
  /** Precio en Energy Coin */ price: number;
  /** Emoji grande de la recompensa */ emoji: string;
  /** Quién la publicó */ source: 'padre' | 'plataforma';
  /** Canjes disponibles (null = sin límite) */ stock: number | null;
  /** Está en la lista de deseos del chico (la wishlist persiste; no la toca el reset del demo) */ wished: boolean;
};
export type Redemption = { id: number; itemId: number; title: string; emoji: string; price: number; ts: number; status: 'pendiente' | 'entregado' };

/* ---------- Zona del padre (v1): grandes on-off, premios propios, actividad del chico ---------- */
/** Funcionalidades que el padre prende/apaga (audio 22: "si no quiere que exista, no existe"). */
export type ParentFeatures = { tienda: boolean; ligas: boolean; amigos: boolean; chat: boolean };
export type NewMarketItem = { title: string; desc?: string; price: number; emoji: string; stock: number | null };
export type ParentSavedRow = { title: string; type: 'video' | 'articulo' | 'imagen'; folder: string; createdAt: number };
/** Premio del padre como lo ve el panel: con lo que queda (`left`) y los canjes de esta demo. */
export type ParentItemView = {
  id: number; emoji: string; title: string; desc?: string; price: number;
  /** Stock configurado por el padre (null = sin límite) */ stock: number | null;
  /** Lo que queda para canjear (null = sin límite) */ left: number | null;
  /** Canjes de esta demo (la economía vive en RAM) */ redeemed: number;
  archived: boolean; createdAt: number;
};
/** Lo que ya filtra el backend real (solo lectura en la v1 del panel). */
export type ParentProtections = {
  sites: number; videos: number; blockedWords: number; blockedTopics: number;
  domainMode: 'blanca' | 'negra' | 'hibrido'; policyVersion: number;
};
/** Edición de un premio: NewMarketItem parcial + `archived` (false = reactivar). */
export type ParentItemPatch = Partial<NewMarketItem> & { archived?: boolean };
export type ParentActivity = {
  xpWeek: number; ec: number; streakDays: number;
  continue: ProgressSummary['continue'];
  saved: ParentSavedRow[];
  redemptions: Redemption[];
  /** Aditivos de la v1 del panel (los sirve /api/parent/activity) */
  items?: ParentItemView[];
  protections?: ParentProtections;
};

export type Friend = { id: string; nick: string; color: string; status: string; xp: string; streak: string; league: string; since: string; commonCourses: string[] };
export type FriendMessage = { id: string; from: 'me' | 'them'; text: string };
/** Solicitud de amistad entrante (NPCs del demo). */
export type FriendRequest = { id: string; nick: string; color: string; note?: string };
/** Un hilo con un amigo: mensajes + si el amigo está "escribiendo…" (respuesta del NPC en camino). */
export type FriendThread = { messages: FriendMessage[]; typing: boolean };
/** Enviar un mensaje pasa por moderación en tiempo real (visión, audio 24): si no corresponde,
 *  el mensaje NUNCA llega al amigo y el moderador le explica al chico cómo decirlo mejor. */
export type SendMessageResult =
  | { status: 'ok'; msg: FriendMessage }
  | { status: 'blocked'; notice: string };

/** La liga del chico: ASIGNADA según sus resultados (no se elige).
 *  `xp` es el puntaje de la semana — el MISMO que aparece en la zona y el país.
 *  `closesInDays` y `lastWeek` (cierre semanal + medalla) son del ciclo de liga. */
export type AssignedLeague = {
  id: string; name: string; color: string; pos: number; total: number; closes: string; xp: number;
  closesInDays?: number;
  lastWeek?: { pos: number; medal: 'oro' | 'plata' | 'bronce' | null } | null;
};
/** Tabla completa de una liga (todas las posiciones; `me` marca la propia). */
export type LeagueStanding = {
  league: { id: string; name: string; color: string; total: number; pos: number };
  rows: { pos: number; nick: string; color: string; xp: number; me?: boolean }[];
};
export type GeoScope = 'zona' | 'pais';
export type GeoRanking = { scope: GeoScope; /** Palermo / Argentina */ name: string; top: { nick: string; color: string; xp: number }[]; me: { nick: string; pos: number; xp: number } };

/** Lo que el chat muestra además del texto (ya resuelto y moderado por el backend). */
export type ChatMedia = {
  videos?: VideoResult[];
  images?: { id: string; thumb: string; full: string; title: string; source: string; pageUrl: string }[];
  articles?: { title: string; url: string; snippet?: string }[];
};
export type ChatTurn = { role: 'user' | 'assistant'; content: string };
export type ChatReply = {
  kind: 'normal' | 'redireccion' | 'crisis' | 'failclosed' | 'interceptado';
  text: string;
  /** Cómo entra este turno al contexto de los próximos (texto + marcadores). */
  contextText: string;
  /** Si viene, reemplaza el mensaje del niño en el contexto (cuarentena: crisis / lista negra). */
  childContextText?: string;
  media?: ChatMedia;
  /** Resumen de la decisión de moderación (DecisionTrace) */ trace: string;
};

/* ---------- Feed (home). El backend real no existe: lo sirve un server FAKE (server/src/feedFake.ts). ---------- */
export type FeedReaction = { emoji: string; count: number; mine: boolean };
export type FeedItem =
  | { kind: 'video'; id: string; time: string; reason: string; video: VideoResult }
  | { kind: 'article'; id: string; time: string; reason: string; title: string; url: string; source: string; snippet?: string }
  | { kind: 'route'; id: string; time: string; reason: string; course: { id: string; name: string; units: number; img: string; bg: [string, string] } }
  | { kind: 'friend'; id: string; time: string; friend: { nick: string; color: string }; text: string; icon: 'medal' | 'streak' | 'badge' | 'route' | 'league'; reactions: FeedReaction[] }
  | { kind: 'league'; id: string; time: string; name: string; desc: string };
export type FeedSidebar = {
  /** Liga asignada por resultados + puestos por puntaje (zona y país). `medal` = cierre pasado. */
  league: { name: string; pos: number; total: number; zone: { name: string; pos: number }; country: { name: string; pos: number }; medal?: 'oro' | 'plata' | 'bronce' | null };
  continue: { courseId: string; title: string; done: number; total: number };
  topics: string[];
};
export type FeedResponse = { items: FeedItem[]; next: string | null; sidebar?: FeedSidebar };

/* ---------- Repasar (nombre interno: Active Recall; visión audio 17) ----------
   El server contabiliza la fuerza de cada FACT (lo que el chico sabe de cada dato puntual que practicó)
   y arma una sesión diaria de cartas con lo que tiene flojo, mezclando cursos. El ledger del demo vive
   en RAM (seed rico + resultados reales de Practicar en vivo) y vuelve al seed con cada carga. */
export type RecallLevel = 'floja' | 'mejorando' | 'firme';
export type RecallCourseState = {
  courseId: string; name: string;
  /** Facts por reforzar (flojas + mejorando) / total del curso */ weak: number; total: number;
  /** Fuerza media 0-100 */ avg: number;
};
export type RecallSummary = {
  /** La sesión de hoy: pendiente | hecha (ya la completó) | sin-material (nunca practicó nada) */
  today: { state: 'pendiente' | 'hecha' | 'sin-material'; cards: number; courses: string[] };
  weak: number; improving: number; firm: number; total: number;
  perCourse: RecallCourseState[];
  /** Días seguidos repasando (seed demo) */ streakDays: number;
};
/** Una carta de la sesión: un ejercicio (misma forma que Practicar) + de qué curso y fact viene. */
export type RecallCard = {
  id: number; factId: number;
  course: { id: string; name: string };
  ex: Exercise;
};
export type RecallSession = { id: number; cards: RecallCard[]; total: number };
/** Resultado de una carta: la corrección de siempre + cómo quedó la fuerza del fact (y la cita
 *  textual del material de donde sale, regla de oro). */
export type RecallAnswerResult = AnswerResult & {
  cite: string;
  fact: { id: number; level: RecallLevel; strength: number; delta: number };
};
export type RecallFinish = {
  correct: number; total: number;
  /** Facts que subieron de nivel en esta sesión */ improved: number;
  xpSession: number;
  facts: { id: number; statement: string; course: string; level: RecallLevel }[];
};

/* ---------- Identidad (avatar propio; visión audios 26, 32, 41-42) ----------
   Avatar dibujado determinístico (sin assets externos). `null` = el default típico: la inicial
   sobre un color. En el demo el 80% de los usuarios se ve con avatar dibujado y el 20% con iniciales. */
export type AvatarLook = { variant: number; color: string } | null;
export type Identity = { nick: string; look: AvatarLook };

/* ---------- Zona del padre v2: la configuración viva (visión audios 8, 34-35, 56, 66; POC Smarty) ---------- */
/** Temas: los blancos se promueven (sugerencias del padre), los negros se filtran en serio. */
export type ParentTopics = { white: string[]; black: string[] };
/** Palabras bloqueadas: las de la familia (editables) se SUMAN a las de fábrica de Smarty. */
export type ParentWords = { extra: string[]; builtin: number };
/** Topes de volumen (0-100) que la música y el ruido de fondo del chico no pueden superar. */
export type ParentVolume = { maxMusic: number; maxNoise: number };
export type ParentAlert = {
  id: number; ts: number;
  kind: 'crisis' | 'contacto' | 'bloqueos';
  /** Qué pasó, SIN el texto del chico si es crisis (cuarentena) */ text: string;
  /** De dónde salió (chat, un hilo de Amigos…) */ source: string;
  seen: boolean;
};
export type ParentPreset = { id: string; name: string; desc: string };
export type ParentConfig = { topics: ParentTopics; words: ParentWords; volume: ParentVolume; preset: string | null };
