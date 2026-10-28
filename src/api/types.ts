// Contratos de datos entre la UI y el backend. La API fake (./index.ts) los respeta;
// el backend real solo tiene que devolver estas mismas formas.

/* ---------- Usuarios (línea 14-oct; docs/USUARIOS.md): la plataforma es para grandes y chicos ----------
   Dos usuarios demo (server/src/users.ts): Ian (9, chico) y Andrés (38, adulto, su guardián). El usuario ACTIVO viaja en
   cada llamada como cabecera X-Innerith-User (src/api/index.ts); GET /api/me lo devuelve. Los candados de la familia
   (apagados y horarios) son del chico: al adulto no lo alcanzan, y tiene su punto de menú "Familia" (la ex Zona de padres).
   ADITIVO: name/age/nick son los de siempre. */
export type User = { id: string; name: string; age: number; nick: string; kind: 'adult' | 'child' };
/** Un usuario con sus dependientes (solo adultos): GET /api/users. */
export type UserInfo = User & { dependents?: string[] };
/** U3 (27-oct): un integrante que el adulto configura en Familia: los `dependents` del adulto activo (GET /api/users), en
 *  su orden. Solo cliente. */
export type FamilyMember = Pick<User, 'id' | 'name' | 'age' | 'nick'>;

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
  /** Relacionados (deuda 14-oct, como el POC): primero del mismo canal, después similares por tema; hasta 12, ya filtrados. */
  related?: VideoResult[];
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

/* ---------- MyTube (porte Smarty W5): formas espejo del POC, servidas por server/src/mytube.ts ---------- */
/** Un video aprobado como lo dibuja MyTube (subconjunto de YtVideo del POC). */
export type MtVideo = { videoId: string; title: string; thumb: string; /** segundos */ duration?: number; /** epoch ms */ addedAt?: number; channelId?: string; channelTitle?: string };
/** Tarjeta de Canales: SOLO seguidos con contenido, orden por channelId; `videos` cuenta sin descontar palabras bloqueadas. */
export type MtChannelCard = { channelId: string; title: string; thumb?: string; videos: number };
export type MtChannel = { channelId: string; title: string; handle?: string; /** curada (o la del padre) */ desc?: string; thumb?: string };
export type MtChannelPlaylist = { playlistId: string; title: string };
/** `channel: null` = no existe (sin videos aprobados). `pending` = enriquecimiento on-demand en curso: volver a pedir. */
export type MtChannelDetail = { channel: MtChannel | null; followed: boolean; total: number; playlists: MtChannelPlaylist[]; pending: boolean };
/* panel del padre (con la sesión del padre, como /api/parent/*: la del ADULTO activo desde el 14-oct; la pantalla vive en Familia) */
export type MtEntryType = 'video' | 'playlist' | 'canal';
export type MtEntry = { id: number; type: MtEntryType; url: string; title: string; /** = videoIds.length */ videos: number; channelId?: string; createdAt: number };
export type MtAdminState = { entries: MtEntry[]; /** videos aprobados: catálogo base + familia */ total: number; /** 0 = sin tope */ videoCap: number };
export type MtAdminChannel = { channelId: string; title: string; handle?: string; thumb?: string; desc: string;
  /** U4: lo sigue ALGÚN integrante de la familia (cada uno sigue lo suyo en su MyTube). */ followed: boolean };
/** `error` = el código del POC (URL_INVALIDA, YA_EXISTE, SIN_KEY_YOUTUBE, …) o el mensaje de la falla. */
export type MtIngestResult = { ok: true; added: number; title: string } | { ok: false; error: string };

export type Playlist = { id: number; name: string; count: number; cover?: string;
  /** Solo cuando se pidió con ?video=<id>: esa lista ya contiene el video (lo marca la hoja «＋ Lista»). */ has?: boolean };
export type PlaylistDetail = { id: number; name: string; videos: VideoResult[] };

/* ---------- After Day (porte Smarty W6): la lista de audio curada por el padre; el chico la escucha
   SOLO como fondo (nunca video). Independiente del catálogo de MyTube, sin key de YouTube. ---------- */
export type AfterDayTrack = { videoId: string; url: string; title?: string; thumb: string; addedAt: number };

/* ---------- Los Horarios por sección (porte Smarty W7) fueron RETIRADOS por el Ciclo del día (F1/F2, 28-oct):
   la compat (`SchedulesResponse.schedules`, DaySchedule/FeatureSchedule) se retiró cuando el cliente dejó de leerla. ---------- */
/** Las 8 secciones que el Ciclo del día puede gatear (el Feed no está: nunca se cierra). */
export type SectionKey = 'chat' | 'buscar' | 'mytube' | 'aprender' | 'tienda' | 'calendario' | 'espacio' | 'afterday';

/* ---------- Ciclo del día (tanda F1, 28-oct; docs/USUARIOS.md §11): config del padre, POR INTEGRANTE ----------
   El padre arma RANGOS horarios del día y elige qué secciones están disponibles en cada uno. Rigen TODOS los días (sin día
   de la semana) y SOLO para un chico activo (al adulto no lo gatea nada). Regla (src/shared/lib/cycleRules.ts: el MISMO
   código en server y cliente desde F2):
   · una sección que no figura en ningún rango → siempre disponible;
   · una que figura en ≥ 1 rango → disponible solo cuando el reloj (hora del SERVER, `serverNow`, en la zona de la FAMILIA,
     `tz`) cae dentro de ALGUNO de sus rangos ([from, to); to < from cruza la medianoche; from == to = las 24 h);
   · datos inválidos → disponible (fail-open);
   · con override de demo (`demoRange`): como si el reloj estuviera dentro de ESE rango — sus secciones disponibles, las que
     figuran en otros rangos y no en ése cerradas, las que no figuran en ninguno disponibles (los solapamientos no cuentan).
   Fuera de rango, la API de la sección responde `403 {error: 'horario', section, opensAt}` (opensAt = "HH:MM" del próximo
   minuto de HOY en que abre, o null; null también con override). ---------- */
export type CycleRange = {
  /** Único en el ciclo del integrante: 1-40 de [A-Za-z0-9_-]. En el POST puede faltar: el server pone r1, r2… */ id: string;
  /** 1-30 caracteres, con alguna letra o número (se guarda limpio: espacios colapsados). */ name: string;
  /** "HH:MM" canónica (el server acepta "8:00" y guarda "08:00"). */ from: string;
  /** "HH:MM" canónica; < from cruza la medianoche; == from = las 24 h. */ to: string;
  /** Disponibles en este rango (sin repetir, en el orden del menú; puede ser vacía). */ sections: SectionKey[];
};
/** El ciclo de un integrante: hasta 8 rangos (sin rangos = todo disponible siempre). */
export type CycleConfig = { ranges: CycleRange[] };
/** GET /api/parent/cycle?member y POST /api/parent/cycle?member {ranges} (sesión del adulto). */
export type CycleResponse = { cycle: CycleConfig; member: string; /** reloj del server (ms) */ serverNow: number;
  /** zona IANA de la familia (null = la del server) */ tz: string | null;
  /** override de demo vigente de ese integrante (id de un rango suyo) o null = reloj real */ demoRange: string | null };
/** POST /api/parent/cycle?member: la lista COMPLETA reemplaza a la anterior (los rangos nuevos pueden venir sin id). */
export type CycleSaveRequest = { ranges: (Omit<CycleRange, 'id'> & { id?: string })[] };
/** POST /api/demo/cycle {rangeId} → SchedulesResponse (la misma que GET /api/schedules daría ya). Chico activo → su
 *  override (member se ignora); adulto → el del integrante de `?member=`. null = vuelve el reloj real. RAM por usuario:
 *  lo limpia POST /api/demo/reset de ese usuario. rangeId que no es de un rango del integrante → 400. */
export type DemoCycleRequest = { rangeId: string | null };

/** GET /api/schedules[?member] (público) y POST /api/demo/cycle. Chico activo → lo suyo (member ignorado); adulto → el
 *  integrante de ?member= (ausente = el primero; ajeno → 400); adulto sin integrantes → sin member, ciclo vacío. */
export type SchedulesResponse = {
  /** reloj del server (ms) */ serverNow: number;
  /** Zona horaria IANA de la familia (null = la del server); el ciclo y el daypart se evalúan en ella. */ tz?: string | null;
  /** U3: de qué integrante es (el chico activo, o el ?member= que pidió el adulto). Ausente = ninguno (adulto sin
   *  integrantes). */ member?: string;
  /** F1: el ciclo del día de ese integrante (vacío si no hay integrante). */ cycle: CycleConfig;
  /** F1: el override de demo vigente de ese integrante (id de un rango de `cycle`) o null = reloj real. */ demoRange: string | null;
};

/* ---------- Progreso real: XP semanal (el puntaje ÚNICO de liga/zona/país) + Energy Coin ---------- */
export type ProgressSummary = {
  xpWeek: number;
  /** Saldo de Energy Coin (⚡) para gastar en la Tienda */ ec: number;
  streakDays: number;
  /** Para "Seguí practicando" (null si nunca practicó) */
  /** La última RUTA de Learn jugada con postas pendientes (courseId = id de ruta desde W3). */
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
  /** Ítems de plataforma (audio 26): 'ropa' = accesorio del avatar; ausente = premio clásico del padre. */
  kind?: 'premio' | 'ropa';
  /** Solo kind 'ropa': qué accesorio del set del cliente desbloquea */ accessoryId?: AccessoryId;
  /** Solo kind 'ropa': ya está en tu guardarropas (compras en RAM: resetean por carga) */ owned?: boolean;
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
  /** U3/U4: de qué integrante es TODO lo de arriba (desde U4 también xpWeek/ec/streakDays/continue/saved: cada
   *  integrante tiene su progreso y su Mi espacio). */
  member?: string;
};

export type Friend = {
  id: string; nick: string; color: string; status: string; xp: string; streak: string; league: string; since: string; commonCourses: string[];
  /** Accesorio que lleva puesto su avatar (p.ej. uno que Ian le regaló; RAM del demo) */ accessory?: string | null;
};
export type FriendMessage = { id: string; from: 'me' | 'them'; text: string };
/** Solicitud de amistad entrante (NPCs del demo). */
export type FriendRequest = { id: string; nick: string; color: string; note?: string };
/* Buscar → Personas (tanda F2): formas espejo del server fake de amigos. */
/** friend = ya son amigos · incoming = él le pidió contacto a Ian · sent = Ian se lo pidió y espera · none = nada todavía. */
export type PersonRelation = 'friend' | 'incoming' | 'sent' | 'none';
/** Un chico encontrado por su nombre de usuario (MODERACIÓN: nada de texto libre — solo nick y estado fijo del demo). */
export type PersonResult = {
  id: string; nick: string; color: string;
  /** Su línea de estado ("Practicando: Fracciones"). */ status: string;
  /** La prenda que tiene puesta (id del set de ropa) o null. */ accessory: string | null;
  relation: PersonRelation;
};
export type PeopleSearchResponse = { query: string; people: PersonResult[] };
/** `ok:false` = rechazo de negocio con el motivo; `friend` = quedaron amigos al toque (él ya había pedido contacto). */
export type ConnectResult = { ok: boolean; relation: PersonRelation; error?: string; friend?: Friend };
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

/* ---------- Feed (home). El backend real no existe: lo sirve un server FAKE (server/src/feedFake.ts).
   Modelo v6 del POC ("un hilo, muchos estilos", docs/feed-mocks/v6-hilo-unico.html; pedido 12-oct):
   UN solo hilo con tipos intercalados — cada kind trae su presentación — y `reason` = el chip
   "por qué te muestro esto" en lenguaje de chico, SIEMPRE en el eje de su propio interés. ---------- */
export type FeedReaction = { emoji: string; count: number; mine: boolean };
/** Dial de animación del Feed: lo fija el padre (Protecciones) y viaja en FeedResponse.motion;
 *  prefers-reduced-motion fuerza 'calmo' en el cliente. */
export type FeedMotion = 'calmo' | 'normal' | 'vivo';
export type FeedItem =
  | { kind: 'video'; id: string; time: string; reason: string; video: VideoResult }
  | { kind: 'article'; id: string; time: string; reason: string; title: string; url: string; source: string; snippet?: string }
  | { kind: 'route'; id: string; time: string; reason: string; course: { id: string; name: string; /** postas */ units: number; img: string; bg: [string, string]; emoji?: string } }
  /** `icon`: 'unit' = unidad completada (ADITIVO, tanda "Feed diverso" 28-oct; antes iba como 'badge'). */
  | { kind: 'friend'; id: string; time: string; reason?: string; friend: { nick: string; color: string }; text: string; icon: 'medal' | 'streak' | 'badge' | 'unit' | 'route' | 'league'; reactions: FeedReaction[] }
  | { kind: 'league'; id: string; time: string; reason?: string; name: string; desc: string }
  /* v6 — bloques nuevos del hilo (el server arma la mezcla; el cliente solo dibuja): */
  /** "Fijado · tu siguiente paso": el hero de la edición. SIEMPRE aprendizaje, jamás comercio. */
  | { kind: 'next'; id: string; time: string; reason: string; title: string; meta: string; action: { label: string; to: string } }
  /** Grilla de videos inline (shelf): 1 lugar del hilo = N videos + "Ver todos" (`topic` arma el link al buscador). */
  | { kind: 'videos'; id: string; time: string; reason: string; title: string; total: number; videos: VideoResult[]; topic?: string }
  /** Resumen de la edición (panel propio): la mezcla de hoy y cómo cambia según la hora. */
  | { kind: 'summary'; id: string; title: string; desc: string; mix: { label: string; n: number }[]; later: string };
export type FeedResponse = { items: FeedItem[]; next: string | null; motion: FeedMotion };

/* ---------- Identidad (avatar propio; visión audios 26, 32, 41-42) ----------
   Avatar dibujado determinístico (sin assets externos). `null` = el default típico: la inicial
   sobre un color. En el demo el 80% de los usuarios se ve con avatar dibujado y el 20% con iniciales. */
/** `accessory`: ropa/accesorio del guardarropas puesto sobre el personaje (null/ausente = sin nada). */
export type AvatarLook = { variant: number; color: string; accessory?: string | null } | null;
export type Identity = { nick: string; look: AvatarLook };

/* ---------- Zona del padre v2: la configuración viva (visión audios 8, 34-35, 56, 66; POC Smarty) ----------
   U3: todo /api/parent/* que es por integrante lleva `?member=<id>` (query); sin member, el server usa el primer integrante
   del adulto activo. */
/** Temas: los blancos se promueven (sugerencias del padre), los negros se filtran en serio. */
export type ParentTopics = { white: string[]; black: string[] };
/** Palabras bloqueadas: las de la familia (editables) se SUMAN a las de fábrica de Smarty. */
export type ParentWords = { extra: string[]; builtin: number };
/** Topes de volumen (0-100) que la música y el ruido de fondo del chico no pueden superar. */
export type ParentVolume = { maxMusic: number; maxNoise: number };
export type ParentAlert = {
  id: number; ts: number;
  kind: 'crisis' | 'contacto' | 'bloqueos';
  /** Qué pasó, con el texto del chico incluido (también en crisis: decisión de Esteban, 11-oct-2026) */ text: string;
  /** De dónde salió (chat, un hilo de Amigos…) */ source: string;
  seen: boolean;
  /** U3: el chico ACTIVO que lo disparó y su nombre (para pintar "Sobre Luna"). Ausentes en un aviso sin chico. */
  childId?: string; childName?: string;
};
export type ParentPreset = {
  id: string; name: string; desc: string;
  /** Qué deja configurado al aplicarlo (la tarjeta lo muestra antes de confirmar). */
  spec: { features: ParentFeatures; topics: ParentTopics; words: string[]; volume: ParentVolume };
};
export type ParentConfig = { topics: ParentTopics; words: ParentWords; volume: ParentVolume; preset: string | null;
  /** Zona horaria IANA de la familia (null/ausente = la del server). */ tz?: string | null;
  /** Dial de animación del Feed del chico (v6; default 'normal'). */
  feedMotion: FeedMotion;
  /** U3: de qué integrante es esta config (tz es de la FAMILIA: la misma para todos). */ member?: string;
  /** U3: los on-off de ESE integrante (los paneles de Familia dejan de leer el GET público /api/parent/features). */
  features?: ParentFeatures };

/* ---------- Demo vivo (botones "Simular…"): cierre de semana de liga y ráfaga de NPCs ---------- */
/** POST /api/leagues/close-week: congela la tabla, reparte medallas, re-asigna liga y arranca la semana
 *  nueva (la XP semanal vuelve a 0: progress.startNewWeek; la EC/racha NO se tocan — audios 20-26). */
export type CloseWeekResult = {
  closed: { league: { id: string; name: string; color: string }; pos: number; total: number; medal: 'oro' | 'plata' | 'bronce' | null; xp: number };
  next: { league: { id: string; name: string; color: string }; movement: 'sube' | 'baja' | 'queda'; closesInDays: number };
  /** Noticias que el cierre metió en el feed */ feedAdded: number;
};
/** POST /api/feed/simulate-npcs: los NPCs "viven" un rato — noticias de logros frescas en el feed. */
export type SimulateNpcsResult = { added: number };

/* ---------- Mentores (línea 14-oct, docs/USUARIOS.md §3 y §6; visión audios 30 y 67) + Calendario por usuario ----------
   Reemplazan el contrato viejo de Profesores (Teacher.hired/slot y HireResult se retiraron con la tanda U2). El ADULTO los
   busca en Buscar → Mentores (contrata un plan para él o para un dependiente y, en el post-compra, elige los días) y
   administra lo contratado en Familia → Mentorías; cada usuario ve SUS clases en /calendario. */
/** weekday 0=lunes … 6=domingo · hour 0-23 (en punto, demo). */
export type TeacherSlot = { weekday: number; hour: number };
/** Un mentor del catálogo (lo contratado viaja aparte, en Mentor.contracts). */
export type Teacher = {
  id: string; name: string; emoji: string; color: string;
  subject: string; /** USD por hora (lo ve SOLO el adulto) */ pricePerHour: number;
  bio: string; rating: number;
};
export type MentorPlan = 1 | 2 | 3;                       // clases por semana; precio semanal = plan × pricePerHour
export type MentorContract = {
  id: number; teacherId: string;
  beneficiary: string;                                    // id de usuario (el adulto o un dependiente suyo)
  daysPerWeek: MentorPlan;
  slots: TeacherSlot[];                                   // los días elegidos ([] si está pendiente de agenda)
  status: 'pending' | 'active';                           // pending = pagado, falta elegir los días (post-compra)
};
export type Mentor = Teacher & { contracts: MentorContract[] };  // Teacher perdió hired/slot (quedan los datos de catálogo)
export type TakenSlot = TeacherSlot & { subject: string; mentorName: string };
export type MentorsResponse = {
  mentors: Mentor[];
  /** horas ya ocupadas POR BENEFICIARIO (para tachar en la agenda) */
  taken: Record<string, TakenSlot[]>;
  /** nombres para pintar ("para Ian"): id → nombre */
  people: Record<string, string>;
};
export type ContractResult = { ok: boolean; error?: string; contract?: MentorContract };
export type ScheduleResult = { ok: boolean; error?: string; contract?: MentorContract; eventsAdded?: number };
/** Una clase en el calendario de un usuario (el precio NUNCA viaja acá). */
export type CalendarEvent = {
  id: number; teacherId: string; title: string; subject: string; emoji: string; color: string;
  /** epoch ms del inicio */ start: number; durationMin: number;
};

/* ---------- Porte Smarty · Learn: rutas, definiciones y bundles (formas EXACTAS del POC,
   docs/porte-smarty/02 §3.1 y 01 §bundle; el server las persiste como CATÁLOGO) ---------- */
export type LearnReading = { url: string; title: string; kind?: 'article' | 'video'; videoId?: string };
export type LearnPosta = {
  id: string; title: string;
  kind?: 'activity' | 'recall';
  definitionId?: string;
  /** Clave de maestría: el progreso se DERIVA agregando resultados por target. */ target: string;
  /** Contenido que se muestra antes de la actividad (lectura o video). */ reading?: LearnReading;
  /** [0,1]; sin él, la posta se logra con jugarla. */ passThreshold?: number;
  moduleId?: string;
};
export type LearnModule = { id: string; title: string; emoji?: string; source?: LearnReading };
export type LearnRouteData = {
  id: string; title: string; description: string; emoji: string;
  postas: LearnPosta[]; modules?: LearnModule[];
  /** dataURL JPEG 640x360 (portada subida en /crear) */ cover?: string;
  category?: string;
};
export type DefinitionRecipeData = {
  id: string; typeId: string; title: string; target: string;
  generatorId: string; params: unknown; mode: 'untimed' | 'timed'; durationSec: number;
};
/** route-bundle.json: el ÚNICO contrato route-lab → app (se importa tal cual).
 *  `editorial`/`meta` (opacos) viajan con el bundle del creador: la reapertura los necesita. */
export type RouteBundle = {
  kind: 'smarty-route-bundle'; schemaVersion: 1;
  route: LearnRouteData & { version?: number };
  definitions: DefinitionRecipeData[];
  requires?: unknown; review?: unknown;
  editorial?: unknown; meta?: unknown;
};
export type LearnRouteListItem = {
  id: string; title: string; emoji: string; category?: string; cover?: string; importedAt: number; postas: number;
  /** Cuántos módulos tiene (solo las rutas con módulos se editan en /crear). */ modules?: number;
};
export type ImportBundleResult = {
  ok: boolean; error?: string; routeId?: string;
  /** El ImportResult del POC. */ title?: string; postas?: number; definitions?: number;
};
/* Resultados de Learn (W3): el `activityResults` del POC (append-only, por TARGET; el progreso se
   DERIVA de estas filas en el cliente, como el POC). Persisten en el server FUERA del reset del demo. */
export type ActivityResultRow = {
  id: number; target: string; source: string; typeId: string; definitionId?: string;
  outcome: 'completed' | 'timeout' | 'aborted'; score: number; maxScore: number; pct: number;
  finishedAt: number; skills?: Record<string, { attempts: number; correct: number }>; seed?: number;
  /** true = fila AGREGADA de un multi (sus hijos ya grabaron): la economía no la cuenta dos veces. */
  rollup?: boolean;
};
/** Lo que graba el cliente (el server asigna id y finishedAt). */
export type ActivityResultInput = Omit<ActivityResultRow, 'id' | 'finishedAt'>;

/* ---------- Auditoría de veracidad de un fact (port del factAudit del POC, corre en NUESTRO server) ---------- */
export type AuditFact = { statement?: string; front?: string; back?: string; quote?: string; kind?: string };
export type AuditSource = { title: string; url: string; snippet: string; /** 'si' | 'no' | 'parcial' (como lo marque el modelo) */ agrees: string };
export type AuditResult = {
  /** 'confirmado' | 'contradicho' | los estados intermedios del POC */ status: string;
  /** 0-100 */ confidence: number;
  summary: string; correction?: string;
  sources: AuditSource[]; model: string; auditedAt: number;
};

/* ---------- Guardarropas (ropa del avatar) + regalos (audios 26, 29, 41-42) ---------- */
/** Id de accesorio del set dibujado del cliente (Avatar.tsx). */
export type AccessoryId = string;
export type GiftResult = { ok: boolean; error?: string; /** saldo tras regalar */ ec?: number; friend?: Friend };

/* ---------- U4 (28-oct): cada uno lo suyo ----------
   Todo lo de cada usuario (XP/⚡/racha, canjes, guardarropas, wishlist, Learn, Mi espacio, MyTube seguido y listas,
   amigos e hilos, liga, feed en vivo) viaja por la MISMA cabecera X-Innerith-User: ninguna forma cambia. */
/** POST /api/demo/reset: sin cuerpo vuelve al seed SOLO al usuario activo; {scope:'all'} a todos (QA). */
export type DemoResetResult = { ok: true; scope: 'user' | 'all'; user?: string };
/** GET /api/leagues/family: la tabla de la semana de la familia (grandes y chicos). No es una liga de la escalera: no se
 *  asigna ni se cierra; vuelve a cero el lunes con la XP. */
export type FamilyLeagueRow = {
  pos: number; id: string; name: string; nick: string; kind: 'adult' | 'child';
  /** XP de la semana = los ⚡ que ganó aprendiendo esta semana (1:1); el MISMO número de su liga, zona y país. */ xp: number;
  streakDays: number;
  /** El avatar ELEGIDO (identity.json v2); null = iniciales. */ look: AvatarLook;
  me?: boolean;
};
export type FamilyLeague = { /** días al domingo de la semana del calendario */ closesInDays: number; rows: FamilyLeagueRow[] };
