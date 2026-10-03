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

export type SearchResponse<T> = { query: string; items: Moderated<T>[]; related?: RelatedChip[] };

export type Article = {
  id: string;
  /** Tema para "Generar curso" */ topic: string;
  title: string;
  hatnote?: string;
  /** range y caption son HTML. taxonomy: [etiqueta, valor, estilo] → 'a' = link azul, 'b' = negrita */
  infobox: { title: string; range: string; img: string; caption: string; taxonomy: [string, string, ('a' | 'b')?][] };
  /** HTML del cuerpo. Los links internos usan <span class="a" data-article="id"> */
  html: string;
};
export type ArticleResponse = { status: 'ok'; article: Article } | { status: 'blocked'; reason: string };

export type Video = VideoResult & {
  durationSec: number; reviewed: boolean;
  /** Datos del canal y del video como los muestra YouTube */ subscribers: string; verified: boolean; likes: string;
};

export type Course = {
  id: string; name: string; units: number; progress: number;
  img: string; bg: [string, string]; isNew?: boolean;
};
export type ResourceKind = 'video' | 'lect' | 'imgr' | 'act';
export type CourseDetail = Course & {
  chapters: number;
  unitList: { title: string; chapters: { title: string; resources: { kind: ResourceKind; label: string }[] }[] }[];
};

export type ExType = 'open' | 'mc' | 'vf';
export type NodeType = ExType | 'trophy' | 'skip';
export type JourneyItem = { kind: 'div'; title: string } | { kind: 'node'; n: number; type: NodeType };
export type Journey = { courseId: string; courseName: string; unitLabel: string; title: string; items: JourneyItem[]; done: number };

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

export type SharedCard = { title: string; meta: string; img: string; videoId?: string };
export type ChatEvent =
  | { type: 'token'; text: string }
  | { type: 'share-checking' }
  | { type: 'share'; card: SharedCard }
  | { type: 'done' };
