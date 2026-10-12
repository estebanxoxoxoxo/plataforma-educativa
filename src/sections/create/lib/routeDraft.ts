import type { DefinitionRecipeData, LearnModule, LearnPosta, LearnRouteData, RouteBundle } from '../../../api/types';

/* Port EXACTO de smarty-poc app/src/learn/routeDraft.ts: estado INTERNO del creador de rutas módulo-céntrico + aplanado al
   modelo persistido. El creador trabaja ANIDADO (un módulo = contenido→comprensión + profundización + repaso) por
   ergonomía de edición; `flatten` lo baja al modelo PLANO que consume la app (postas contiguas por módulo + modules[]
   rótulos + definitions[]). Nada de esto se persiste: se aplana sólo al Guardar.
   Formas de la ruta/definición: las de src/api/types.ts (espejo del POC). El Card de flashcards va acá como espejo del
   Tipo del POC (activities/flashcards/types.ts) para no depender del motor que porta la tanda W2. */

export const uid = () => Math.random().toString(36).slice(2, 8);

export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Tarjeta del Tipo flashcards (espejo de activities/flashcards/types.ts del POC). */
export interface Card {
  id: string;
  /** Lo que se pregunta / el término (cara visible antes de dar vuelta). */
  front: string;
  /** La respuesta a recordar (cara oculta hasta revelar). */
  back: string;
  /** Skill/objetivo fino (lo fija el generador: = target). */
  skill: string;
  /** Pista opcional (route-lab no la emite). */
  hint?: string;
}
/** Pregunta de opción múltiple (lo que muestra la vista previa; espejo de activities/multiplechoice/types.ts). */
export interface MCQuestion { id: string; prompt: string; mode?: 'single' | 'multi'; skill?: string; options: { id: string; text: string; correct: boolean }[] }

/* ---- INVENTARIO de facts (metadata EDITORIAL) ----
   Todo lo que route-lab extrajo de un contenido + por qué entró o no a las postas. NO lo juega el chico: se persiste aparte
   del `route` jugable para que el editor vea/cure y NADA se pierda en silencio. */

/** Veredicto de la auditoría de veracidad de un fact. El auditor es SOPORTE DE DECISIÓN: siempre trae las fuentes que
 *  consultó para que el humano verifique. (Misma forma que devuelve POST /api/create/audit.) */
export interface AuditSource {
  title: string;
  url: string;
  snippet: string;
  agrees: 'si' | 'parcial' | 'no' | 'irrelevante';
}
export interface AuditResult {
  status: 'confirmado' | 'parcial' | 'contradicho' | 'sin-datos';
  confidence: number; // 0-1 (del auditor; NO es palabra final)
  summary: string; // qué encontró / la discrepancia (incluye statement↔quote)
  correction?: string; // valor que sostienen las fuentes, si contradicho/parcial
  sources: AuditSource[]; // las que consultó (link + snippet)
  model: string;
  auditedAt: number;
}

/** Un fact extraído: lo que se evaluó y lo que NO, con la razón. */
export interface FactInv {
  id: string;
  concept: string;
  conceptLabel: string;
  kind: string; // definition | property | numeric | relation
  statement: string;
  front: string;
  back: string;
  quote: string; // cita literal de la fuente
  quoteScore: number; // fidelidad literal a la fuente [0.85,1] — NO mide verdad
  corroborated: boolean; // apareció en >1 fuente/chunk
  selected: boolean; // entró en la selección automática (= es posta/pregunta)
  dropReason: string | null; // por qué NO entró (null ⇔ selected)
  /** Auditoría de veracidad a demanda. Ausente = sin auditar. Persiste con el inventario. */
  audit?: AuditResult;
}
export interface ConceptInv {
  id: string;
  label: string;
  factCount: number;
  corroborated: boolean; // multi_source (≥2 fuentes)
  proposedAsPosta: boolean; // la heurística lo hizo posta de profundización
  dropReason: string | null; // por qué NO es posta (null ⇔ proposedAsPosta)
}
export interface ModuleInventory {
  concepts: ConceptInv[];
  facts: FactInv[];
  /** Facts cuyo quote NO verificó en la fuente (anti-alucinación): se muestran, no se rescatan. */
  integrityDropped: { id: string; reason: string; quote: string }[];
}
/** Metadata editorial POR MÓDULO (no la juega el chico): marca de confianza del transcript (manual/asr) + inventario de
 *  facts. Se persiste en la fila, aparte del `route` jugable. */
export interface ModuleEditorial {
  /** 'manual' | 'asr' — confianza de los subtítulos (solo video). */
  captionKind?: string | null;
  /** Job de route-lab que extrajo los facts (para re-emitir sin re-extraer). */
  jobId?: string;
  inventory?: ModuleInventory;
}
export interface RouteEditorial {
  modules: Record<string, ModuleEditorial>; // moduleId → metadata editorial
}

/** Una posta de actividad + su definición viajan siempre como par. */
export interface DraftPosta {
  id: string;
  title: string;
  target: string;
  def: DefinitionRecipeData;
}

export interface DraftModule {
  id: string;
  title: string;
  emoji: string;
  /** El contenido del módulo (1 fuente): artículo (default) o video de YouTube (kind:'video' + videoId). url/title vacíos =
   *  módulo sin contenido aún. */
  source: { url: string; title: string; kind?: 'article' | 'video'; videoId?: string };
  /** Umbral de aprobado de la comprensión en [0,1]. */
  passThreshold: number;
  /** Marca de confianza del transcript (solo video): 'manual' | 'asr'. Se persiste en `editorial`. */
  captionKind?: string | null;
  /** Job de route-lab que extrajo los facts (para re-emitir sin re-extraer al curar). */
  jobId?: string;
  /** Inventario de facts extraídos por route-lab. null hasta generar. Metadata editorial. */
  inventory?: ModuleInventory | null;
  /** 1ª posta del módulo: lectura zen + preguntas de comprensión. null hasta generar. */
  comprehension: DraftPosta | null;
  /** N postas de profundización (generadas + manuales). */
  profundizacion: DraftPosta[];
  /** Toggle "repaso de módulo" (se materializa como posta recall en flatten). */
  recall: boolean;
  /** Config de generación por módulo. */
  types: string[];
  size: string;
  /** Estado de UI por módulo (no viaja al bundle). */
  generating: boolean;
  error: string | null;
}

export interface CreatorState {
  /** ESTABLE e inmutable: los targets generados lo llevan incrustado. */
  routeId: string;
  title: string;
  emoji: string;
  description: string;
  version: number;
  modules: DraftModule[];
  /** Portada MANUAL (data URL 16:9). Ausente = el mosaico deriva la portada del 1er contenido. */
  cover?: string;
  /** Categoría/materia de la ruta (para agrupar el mosaico). */
  category?: string;
}

export interface FlatBundle {
  route: LearnRouteData & { version: number };
  definitions: DefinitionRecipeData[];
  /** Metadata editorial (inventario de facts por módulo). Se persiste aparte del `route` jugable. */
  editorial?: RouteEditorial;
}

/** Lo que /crear manda a POST /api/learn-routes/import: el RouteBundle de types.ts + `editorial` (ADITIVO, opaco para el
 *  server; como el `editorial?: unknown` del RouteBundle del POC). */
export type CreatorBundle = RouteBundle & { editorial?: RouteEditorial; meta?: unknown };

/** Estado en blanco (ruta nueva): routeId fresco + un módulo vacío. */
export function blankCreatorState(): CreatorState {
  return { routeId: `ruta.${uid()}${uid()}`, title: '', emoji: '🧭', description: '', version: 1, modules: [newModule()] };
}

/** Inverso de flatten: carga una ruta PLANA guardada (route + sus definiciones) al estado anidado del creador, conservando
 *  el routeId (inmutable). Sólo rutas con modules[].
 *  FIEL AL POC (quirk 33, decisión 12-oct): cada módulo reabre con types ['flashcards'] y size 'auto' — el tipo y el tamaño
 *  con que se generó no se persisten; regenerar o "Aplicar selección" sobre un módulo de opción múltiple reabierto emite
 *  flashcards salvo que se vuelva a elegir el tipo. Edad y nivel tampoco se persisten. */
export function unflatten(route: LearnRouteData & { version?: number }, definitions: DefinitionRecipeData[], editorial?: RouteEditorial): CreatorState {
  const defById = new Map(definitions.map((d) => [d.id, d]));
  const toDraft = (p: LearnPosta): DraftPosta | null => {
    const def = p.definitionId ? defById.get(p.definitionId) : undefined;
    return def ? { id: p.id, title: p.title, target: p.target, def } : null;
  };

  const modules: DraftModule[] = (route.modules ?? []).map((mod: LearnModule) => {
    const postas = route.postas.filter((p) => p.moduleId === mod.id);
    const comprehensionPosta = postas.find((p) => p.kind === 'activity' && p.reading) ?? null;
    const recall = postas.some((p) => p.kind === 'recall');
    const profPostas = postas.filter((p) => p.kind === 'activity' && p !== comprehensionPosta);
    const src = comprehensionPosta?.reading ?? mod.source ?? { url: '', title: '' };
    return {
      id: mod.id,
      title: mod.title,
      emoji: mod.emoji ?? '📖',
      source: { url: src.url, title: src.title, kind: src.kind, videoId: src.videoId },
      passThreshold: comprehensionPosta?.passThreshold ?? 0.7,
      captionKind: editorial?.modules?.[mod.id]?.captionKind ?? null,
      jobId: editorial?.modules?.[mod.id]?.jobId,
      inventory: editorial?.modules?.[mod.id]?.inventory ?? null,
      comprehension: comprehensionPosta ? toDraft(comprehensionPosta) : null,
      profundizacion: profPostas.map(toDraft).filter((x): x is DraftPosta => x != null),
      recall,
      types: ['flashcards'],
      size: 'auto',
      generating: false,
      error: null,
    };
  });

  return {
    routeId: route.id,
    title: route.title,
    emoji: route.emoji,
    description: route.description ?? '',
    version: route.version ?? 1,
    modules,
    cover: route.cover,
    category: route.category,
  };
}

/** Módulo vacío nuevo. */
export function newModule(): DraftModule {
  return {
    id: `m-${uid()}`,
    title: 'Nuevo módulo',
    emoji: '📖',
    source: { url: '', title: '' },
    passThreshold: 0.7,
    inventory: null,
    comprehension: null,
    profundizacion: [],
    recall: false,
    types: ['flashcards'],
    size: 'auto',
    generating: false,
    error: null,
  };
}

/** Posta de profundización manual (flashcards con una card vacía para completar a mano). */
export function newManualProfundizacion(routeId: string): DraftPosta {
  const target = `${routeId}.t.manual-${uid()}`;
  const defId = `${routeId}.d.manual-${uid()}`;
  const card: Card = { id: `c-${uid()}`, front: '', back: '', skill: target };
  return {
    id: `p-${uid()}`,
    title: 'Nueva actividad',
    target,
    def: {
      id: defId,
      typeId: 'flashcards',
      title: 'Nueva actividad',
      target,
      generatorId: 'static',
      params: { cards: [card] },
      mode: 'untimed',
      durationSec: 90,
    },
  };
}

function assertUnique(ids: string[], label: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Hay un id de ${label} duplicado: "${id}" (bug del generador). Regenerá ese módulo.`);
    seen.add(id);
  }
}

/** Baja el estado anidado al modelo PLANO. Garantiza por construcción: postas contiguas por módulo, orden de modules[] =
 *  orden de postas, integridad referencial def↔posta. */
export function flatten(s: CreatorState): FlatBundle {
  const postas: LearnPosta[] = [];
  const definitions: DefinitionRecipeData[] = [];
  const modules: LearnModule[] = [];
  const editorialByMod: Record<string, ModuleEditorial> = {};

  for (const m of s.modules) {
    const ed: ModuleEditorial = {};
    if (m.inventory) ed.inventory = m.inventory;
    if (m.captionKind != null) ed.captionKind = m.captionKind;
    if (m.jobId) ed.jobId = m.jobId;
    if (Object.keys(ed).length) editorialByMod[m.id] = ed;
    const hasSource = !!(m.source.url.trim() || m.source.title.trim());
    modules.push({ id: m.id, title: m.title, emoji: m.emoji, source: hasSource ? m.source : undefined });

    // COMPRENSIÓN = 1ª posta del módulo (lectura zen + umbral + moduleId)
    if (m.comprehension) {
      const c = m.comprehension;
      postas.push({
        id: c.id,
        title: c.title,
        kind: 'activity',
        definitionId: c.def.id,
        target: c.def.target,
        reading: m.source,
        passThreshold: m.passThreshold,
        moduleId: m.id,
      });
      definitions.push(c.def);
    }

    // PROFUNDIZACIÓN — N postas contiguas tras la comprensión
    for (const p of m.profundizacion) {
      postas.push({ id: p.id, title: p.title, kind: 'activity', definitionId: p.def.id, target: p.def.target, moduleId: m.id });
      definitions.push(p.def);
    }

    // REPASO de módulo (opcional) — recall sin definición, acotado a su módulo en la ruta
    if (m.recall) {
      postas.push({ id: `r-${m.id}`, title: `Repaso — ${m.title}`, kind: 'recall', target: `${s.routeId}.m.${m.id}.recall`, moduleId: m.id });
    }
  }

  assertUnique(postas.map((p) => p.id), 'posta');
  assertUnique(definitions.map((d) => d.id), 'definición');

  return {
    route: { id: s.routeId, title: s.title, description: s.description, emoji: s.emoji, version: s.version, postas, modules, cover: s.cover, category: s.category },
    definitions,
    editorial: Object.keys(editorialByMod).length ? { modules: editorialByMod } : undefined,
  };
}

/** Valida el estado antes de guardar. Devuelve el mensaje de error, o null si está OK. */
export function validateForSave(s: CreatorState): string | null {
  if (!s.modules.length) return 'Agregá al menos un módulo.';
  if (!s.title.trim()) return 'Poné un título a la ruta.';
  for (const m of s.modules) {
    if (!m.source.url.trim() || !m.source.title.trim())
      return `El módulo «${m.title}» no tiene contenido (URL + título). Agregalo o quitá el módulo.`;
    if (!m.comprehension)
      return `Generá el módulo «${m.title}» (o quitalo) antes de guardar.`;
  }
  return null;
}

/* ---- helpers de la vista (RouteCreator.tsx del POC) ---- */
export function cardsOf(p: DraftPosta): Card[] {
  return ((p.def.params as { cards?: Card[] })?.cards) ?? [];
}
export function questionsOf(p: DraftPosta): MCQuestion[] {
  return ((p.def.params as { questions?: MCQuestion[] })?.questions) ?? [];
}
export function withCards(p: DraftPosta, cards: Card[]): DraftPosta {
  return { ...p, def: { ...p.def, params: { ...(p.def.params as object), cards } } };
}
/** Riesgoso = numérico (magnitudes que se corrompen) o baja fidelidad a la fuente → conviene auditar. */
export const isRisky = (f: FactInv) => f.kind === 'numeric' || f.quoteScore < 0.9;

/** Sugerencias de categoría (LEARN_CATEGORIES del POC, lib/learn.ts): datalist, se elige una o se escribe otra. */
export const LEARN_CATEGORIES = [
  'Ciencias Naturales',
  'Ciencias Sociales',
  'Filosofía',
  'Matemática',
  'Lengua y Literatura',
  'Historia',
  'Geografía',
  'Arte',
  'Música',
  'Tecnología',
  'Idiomas',
  'Educación Física',
  'Valores y Ciudadanía',
];

/** Tipos de actividad que se pueden generar (GEN_TYPES del POC): quiz y dominó, "próximamente" (deshabilitados). */
export const GEN_TYPES = [
  { id: 'flashcards', label: 'flashcards', on: true },
  { id: 'multiplechoice', label: 'opción múltiple', on: true },
  { id: 'quiz', label: 'quiz', on: false },
  { id: 'domino', label: 'dominó', on: false },
];
