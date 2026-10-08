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
};

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
};

export type Friend = { id: string; nick: string; color: string; status: string; xp: string; streak: string; league: string; since: string; commonCourses: string[] };
export type FriendMessage = { id: string; from: 'me' | 'them'; text: string };

export type MyLeague = { id: string; name: string; desc: string; color: string; tag: 'assigned' | 'joined'; pos: number; total: number };
/** Ranking completo de una liga (vista de detalle). */
export type LeagueStanding = {
  league: { id: string; name: string; color: string; total: number; pos: number };
  rows: { pos: number; nick: string; color: string; xp: number; me?: boolean }[];
};
export type GeoScope = 'zona' | 'prov' | 'pais';
export type GeoRanking = { scope: GeoScope; top: { nick: string; color: string; xp: number }[]; me: { nick: string; pos: number; xp: number } };
export type LeagueResult = { id: string; name: string; desc: string; color: string; joined: boolean };

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
