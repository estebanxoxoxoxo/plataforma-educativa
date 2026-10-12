import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../../../api';
import type { ImportBundleResult, LearnRouteListItem } from '../../../api/types';
import { ModuleCard, type ModuleHandlers } from '../cards/ModuleCard';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { IcCrPlus, IcCrSave } from '../components/CreateIcons';
import type { InventoryHandlers, InventoryView } from '../components/InventoryPanel';
import { GenConfig, RouteIdentity, RoutePicker } from '../components/RouteSetup';
import { auditRequestFor, auditResultOf } from '../lib/audit';
import { cropToCover, mqThumb } from '../lib/routeCover';
import { postEmit, postModule, rememberRouteLabUrl, routeLabBase, savedRouteLabUrl, type EmitPostaSpec } from '../lib/routeLab';
import {
  blankCreatorState, cardsOf, flatten, isRisky, newManualProfundizacion, newModule, unflatten, uid, validateForSave, withCards,
  type ConceptInv, type CreatorBundle, type CreatorState, type DraftModule, type DraftPosta, type FactInv, type ModuleInventory,
  type RouteEditorial,
} from '../lib/routeDraft';
import { parseYtUrl } from '../lib/youtube';

/* Crear (/crear) — el creador de rutas del porte Smarty: port EXACTO de smarty-poc app/src/zones/child/RouteCreator.tsx
   (vista SÁBANA, MÓDULO-CÉNTRICA). La ruta se compone como una SECUENCIA DE MÓDULOS: cada módulo = 1 contenido (fuente) →
   lectura+comprensión (1ª posta, autogenerada, gateada por umbral) + N profundización (autogeneradas) + repaso opcional. El
   estado interno es ANIDADO y se aplana (flatten) al Guardar → POST /api/learn-routes/import.
   - route-lab se llama DIRECTO desde el navegador (lib/routeLab.ts: POST /module y /emit; URL editable en la vista,
     recordada en localStorage `innerith.routeLabUrl`).
   - Desvíos forzados (mapa §4): (a) la auditoría de facts corre en NUESTRO server (api.auditFacts; las claves jamás llegan
     acá); (b) el catálogo de rutas vive en el server (api.learnRoutes/learnRoute/importRouteBundle/deleteLearnRoute) en
     lugar de Dexie: la lista de rutas editables se relee al guardar/borrar y al volver a la pestaña (el useLiveQuery del POC).
   - Los confirm() del POC son una hoja de Innerith (ConfirmSheet) con el MISMO texto: la acción sigue solo con "sí".
   - Quirks portados tal cual (decisión 12-oct): reabrir una ruta fija types ['flashcards'] y size 'auto' (33/F1); regenerar
     borra también la profundización manual y el inventario (F2); curar manda las manuales al final (F2); tras curar,
     `selected` no ve la comprensión y el aviso de contradichos deja de verlos (F3); el borrador no persiste y "Nueva"/otra
     ruta con una guardada abierta descarta sin preguntar (F6); borrar un módulo no pide confirmación (F6); sin timeouts ni
     cancelación y "Generar" en paralelo por módulo (F8); la opción múltiple no se edita (F10). */

type Msg = { ok: boolean; text: string } | null;
/** Item del catálogo + `modules` (ADITIVO de server/src/learnRoutes.ts: cuántos módulos tiene la ruta). */
type CatalogItem = LearnRouteListItem & { modules?: number };
/** ImportBundleResult + lo ADITIVO del server (el ImportResult del POC). */
type ImportResultX = ImportBundleResult & { title?: string; postas?: number; definitions?: number };
type ConfirmReq = { text: string; label?: string; danger?: boolean; resolve: (yes: boolean) => void };

export function CreatePage() {
  // config del learner + route-lab (globales)
  const [edad, setEdad] = useState(10);
  const [nivel, setNivel] = useState('medio');
  const [url, setUrl] = useState(savedRouteLabUrl);
  const [msg, setMsg] = useState<Msg>(null);

  // estado ANIDADO del creador; routeId inmutable (nuevo por sesión, o el de la ruta cargada)
  const [state, setState] = useState<CreatorState>(blankCreatorState);
  // módulos con el panel de inventario abierto + curaduría (checks sobre el inventario)
  const [openInv, setOpenInv] = useState<Set<string>>(new Set());
  const toggleInv = (mid: string) =>
    setOpenInv((s) => {
      const n = new Set(s);
      if (n.has(mid)) n.delete(mid);
      else n.add(mid);
      return n;
    });
  // override de curaduría: `${mid}:c:${cid}` / `${mid}:f:${fid}` → tildado. Ausente = valor del inventario.
  const [curOverride, setCurOverride] = useState<Record<string, boolean>>({});
  const [applying, setApplying] = useState<string | null>(null);
  const conceptChecked = (mid: string, c: ConceptInv) => curOverride[`${mid}:c:${c.id}`] ?? c.proposedAsPosta;
  const factChecked = (mid: string, f: FactInv) => curOverride[`${mid}:f:${f.id}`] ?? f.selected;
  const setOverride = (key: string, val: boolean) => setCurOverride((o) => ({ ...o, [key]: val }));
  // auditoría de veracidad: fact en curso + paneles de veredicto abiertos
  const [auditingFact, setAuditingFact] = useState<string | null>(null);
  const [openAudit, setOpenAudit] = useState<Set<string>>(new Set());
  const toggleAudit = (fid: string) =>
    setOpenAudit((s) => {
      const n = new Set(s);
      if (n.has(fid)) n.delete(fid);
      else n.add(fid);
      return n;
    });
  // auditoría en lote (los riesgosos del módulo): progreso done/total
  const [batchAudit, setBatchAudit] = useState<{ mid: string; done: number; total: number } | null>(null);

  // confirmación (el confirm() del POC): el texto + a quién avisarle la respuesta
  const [confirmReq, setConfirmReq] = useState<ConfirmReq | null>(null);
  const askConfirm = (text: string, opts?: { label?: string; danger?: boolean }) =>
    new Promise<boolean>((resolve) => setConfirmReq({ text, ...opts, resolve }));

  // rutas editables = las del catálogo que tienen módulos (creadas con este creador)
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const alive = useRef(true);
  const seq = useRef(0);
  const refreshCatalog = useCallback(async () => {
    const my = ++seq.current;
    try {
      const r = await api.learnRoutes();
      if (alive.current && my === seq.current) setCatalog(r.routes as CatalogItem[]);
    } catch { /* sin catálogo: queda la lista que había */ }
  }, []);
  useEffect(() => {
    alive.current = true;
    void refreshCatalog();
    const wake = () => { if (document.visibilityState === 'visible') void refreshCatalog(); };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      alive.current = false;
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [refreshCatalog]);
  const editable = catalog
    .filter((r) => (r.modules ?? 0) > 0)
    .map((r) => ({ id: r.id, title: r.title, emoji: r.emoji }));
  const isEditing = editable.some((r) => r.id === state.routeId);

  const hasDraftContent = () =>
    state.modules.some((m) => m.source.url.trim() || m.source.title.trim() || m.comprehension || m.profundizacion.length > 0);

  async function newRoute() {
    if (hasDraftContent() && !isEditing && !(await askConfirm('Vas a descartar lo que tenés sin guardar. ¿Empezar una ruta nueva?'))) return;
    setState(blankCreatorState());
    setMsg(null);
  }
  async function loadRoute(routeId: string) {
    if (routeId === state.routeId) return;
    if (hasDraftContent() && !isEditing && !(await askConfirm('Vas a descartar lo que tenés sin guardar. ¿Cargar la otra ruta?'))) return;
    let row: Awaited<ReturnType<typeof api.learnRoute>>;
    try {
      row = await api.learnRoute(routeId);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError && e.status === 404 ? 'No encontré esa ruta.' : `No pude abrir la ruta: ${(e as Error).message}` });
      return;
    }
    // editorial viaja opaco por el contrato; acá es la forma del creador (RouteEditorial)
    setState(unflatten(row.route, row.definitions, row.editorial as RouteEditorial | undefined));
    setMsg(null);
  }
  async function deleteRoute() {
    if (!isEditing) return;
    const routeId = state.routeId;
    const name = editable.find((r) => r.id === routeId)?.title || 'esta ruta';
    if (!(await askConfirm(`Vas a eliminar "${name}" y sus actividades. No se puede deshacer. ¿Borrar?`, { label: 'Borrar', danger: true }))) return;
    try {
      await api.deleteLearnRoute(routeId); // borra ruta + definiciones (los resultados quedan)
    } catch (e) {
      setMsg({ ok: false, text: `No pude borrar la ruta: ${(e as Error).message}` });
      return;
    }
    setState(blankCreatorState());
    setMsg({ ok: true, text: `Ruta "${name}" eliminada.` });
    void refreshCatalog();
  }

  // ---------- helpers de estado ----------
  const patchModule = (mid: string, p: Partial<DraftModule>) =>
    setState((s) => ({ ...s, modules: s.modules.map((m) => (m.id === mid ? { ...m, ...p } : m)) }));
  const updateModule = (mid: string, fn: (m: DraftModule) => DraftModule) =>
    setState((s) => ({ ...s, modules: s.modules.map((m) => (m.id === mid ? fn(m) : m)) }));

  const addModule = () => setState((s) => ({ ...s, modules: [...s.modules, newModule()] }));
  const deleteModule = (mid: string) => setState((s) => ({ ...s, modules: s.modules.filter((m) => m.id !== mid) }));
  const moveModule = (mid: string, dir: number) =>
    setState((s) => {
      const i = s.modules.findIndex((m) => m.id === mid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.modules.length) return s;
      const a = [...s.modules];
      [a[i], a[j]] = [a[j], a[i]];
      return { ...s, modules: a };
    });
  const setSource = (mid: string, field: 'url' | 'title', val: string) =>
    updateModule(mid, (m) => ({ ...m, source: { ...m.source, [field]: val } }));
  const toggleRecall = (mid: string) => updateModule(mid, (m) => ({ ...m, recall: !m.recall }));
  const setThreshold = (mid: string, pct: string) =>
    patchModule(mid, { passThreshold: Math.max(0, Math.min(100, Number(pct) || 0)) / 100 });

  // ---------- edición fina de postas (comprensión + profundización comparten helpers) ----------
  const updatePosta = (mid: string, postaId: string, fn: (p: DraftPosta) => DraftPosta) =>
    updateModule(mid, (m) => {
      if (m.comprehension?.id === postaId) return { ...m, comprehension: fn(m.comprehension) };
      return { ...m, profundizacion: m.profundizacion.map((p) => (p.id === postaId ? fn(p) : p)) };
    });
  const editPostaTitle = (mid: string, postaId: string, t: string) =>
    updatePosta(mid, postaId, (p) => ({ ...p, title: t, def: { ...p.def, title: t } }));
  const editCard = (mid: string, postaId: string, ci: number, field: 'front' | 'back', val: string) =>
    updatePosta(mid, postaId, (p) => withCards(p, cardsOf(p).map((c, j) => (j === ci ? { ...c, [field]: val } : c))));
  const addCard = (mid: string, postaId: string) =>
    updatePosta(mid, postaId, (p) => withCards(p, [...cardsOf(p), { id: `c-${uid()}`, front: '', back: '', skill: p.target }]));
  const removeCard = (mid: string, postaId: string, ci: number) =>
    updatePosta(mid, postaId, (p) => withCards(p, cardsOf(p).filter((_, j) => j !== ci)));

  // ---------- profundización manual ----------
  const addProfundizacion = (mid: string) =>
    updateModule(mid, (m) => ({ ...m, profundizacion: [...m.profundizacion, newManualProfundizacion(state.routeId)] }));
  const deleteProfundizacion = (mid: string, pid: string) =>
    updateModule(mid, (m) => ({ ...m, profundizacion: m.profundizacion.filter((p) => p.id !== pid) }));
  const moveProfundizacion = (mid: string, pid: string, dir: number) =>
    updateModule(mid, (m) => {
      const i = m.profundizacion.findIndex((p) => p.id === pid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= m.profundizacion.length) return m;
      const a = [...m.profundizacion];
      [a[i], a[j]] = [a[j], a[i]];
      return { ...m, profundizacion: a };
    });

  // ---------- generar POR módulo (route-lab POST /module, directo desde el navegador) ----------
  async function generateModule(mid: string) {
    const m = state.modules.find((x) => x.id === mid);
    if (!m) return;
    // video de YouTube → se manda la URL (route-lab baja el transcript + título); artículo → el título.
    const isVideo = parseYtUrl(m.source.url)?.type === 'video';
    const src = (isVideo ? m.source.url : m.source.title).trim();
    if (!src) {
      patchModule(mid, { error: isVideo ? 'Falta la URL del video.' : 'Agregá el contenido (URL o título) antes de generar.' });
      return;
    }
    if (m.comprehension || m.profundizacion.length) {
      const extra = isEditing ? ' y puede reiniciar el progreso de este módulo (cambian los conceptos)' : '';
      if (!(await askConfirm(`Regenerar reemplaza la comprensión y la profundización de este módulo (perdés ediciones manuales)${extra}. ¿Seguir?`))) return;
    }
    patchModule(mid, { generating: true, error: null });
    rememberRouteLabUrl(url);
    const base = routeLabBase(url);
    try {
      const data = await postModule(base, { source: src, routeId: state.routeId, moduleId: mid, edad, nivel, lang: 'es', activityTypes: m.types, size: m.size });
      const comp: DraftPosta = {
        id: data.comprehension.posta.id, title: data.comprehension.posta.title,
        target: data.comprehension.posta.target, def: data.comprehension.definition,
      };
      const prof: DraftPosta[] = (data.profundizacion ?? []).map((x) => ({
        id: x.posta.id, title: x.posta.title, target: x.posta.target, def: x.definition,
      }));
      updateModule(mid, (mm) => ({
        ...mm,
        generating: false,
        error: null,
        title: mm.title && mm.title !== 'Nuevo módulo' ? mm.title : (data.module.title || mm.title),
        emoji: mm.emoji || data.module.emoji,
        source: data.module.source ?? mm.source,
        captionKind: data.meta?.captionKind ?? null,
        jobId: data.meta?.jobId,
        inventory: data.inventory ?? null,
        comprehension: comp,
        profundizacion: prof,
      }));
    } catch (e) {
      patchModule(mid, { generating: false, error: `No pude generar: ${(e as Error).message} (¿corre route-lab en ${base}?)` });
    }
  }

  // ---------- curaduría: aplicar los checks → re-emitir profundización (route-lab /emit, NO re-extrae) ----------
  async function applyCuration(m: DraftModule) {
    const inv = m.inventory;
    if (!inv) return;
    const specs: EmitPostaSpec[] = [];
    const warnings: string[] = [];
    for (const c of inv.concepts) {
      if (!conceptChecked(m.id, c)) continue;
      const chosen = inv.facts.filter((f) => f.concept === c.id && factChecked(m.id, f));
      if (chosen.length < 2) { warnings.push(`«${c.label}» necesita ≥2 datos (tiene ${chosen.length})`); continue; }
      specs.push({
        postaId: `${m.id}.t.${c.id}`, defId: `${state.routeId}.${m.id}.d.${c.id}`, target: `${state.routeId}.t.${c.id}`,
        title: c.label, idPrefix: `${m.id}.${c.id}`, factIds: chosen.map((f) => f.id), conceptId: c.id,
      });
    }
    if (!specs.length) {
      patchModule(m.id, { error: 'No hay conceptos con ≥2 datos evaluados para armar profundización.' });
      return;
    }
    setApplying(m.id);
    patchModule(m.id, { error: null });
    const base = routeLabBase(url);
    try {
      const data = await postEmit(base, { facts: inv.facts, postas: specs, edad, nivel, lang: 'es', activityType: m.types[0] ?? 'multiplechoice', jobId: m.jobId });
      const emitted = (data.definitions ?? []).filter((d) => d.definition);
      const specById = new Map(specs.map((s) => [s.postaId, s]));
      const newProf: DraftPosta[] = emitted.map((d) => ({ id: d.postaId, title: d.title, target: d.target, def: d.definition! }));
      const emittedConcepts = new Set<string>(
        emitted.map((d) => specById.get(d.postaId)?.conceptId).filter((x): x is string => !!x),
      );
      const usedFacts = new Set<string>(emitted.flatMap((d) => specById.get(d.postaId)?.factIds ?? []));
      const newInv: ModuleInventory = {
        ...inv,
        concepts: inv.concepts.map((c) => ({ ...c, proposedAsPosta: emittedConcepts.has(c.id), dropReason: emittedConcepts.has(c.id) ? null : (c.dropReason ?? 'no seleccionado por el editor') })),
        facts: inv.facts.map((f) => ({ ...f, selected: usedFacts.has(f.id), dropReason: usedFacts.has(f.id) ? null : (f.dropReason ?? 'no evaluado por el editor') })),
      };
      updateModule(m.id, (mm) => {
        const conceptPostaIds = new Set(inv.concepts.map((c) => `${m.id}.t.${c.id}`));
        const manualKept = mm.profundizacion.filter((p) => !conceptPostaIds.has(p.id)); // preservar profundización manual
        return { ...mm, profundizacion: [...newProf, ...manualKept], inventory: newInv, error: null };
      });
      setCurOverride((o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith(`${m.id}:`))));
      const failed = (data.definitions ?? []).filter((d) => !d.definition);
      const extra = [...warnings, ...failed.map((d) => `«${d.title}» no rindió preguntas`)].join(' · ');
      setMsg({ ok: true, text: `✓ Profundización re-generada: ${newProf.length} posta(s)${extra ? ' — ' + extra : ''}` });
    } catch (e) {
      patchModule(m.id, { error: `No pude aplicar la selección: ${(e as Error).message} (¿corre route-lab en ${base}?)` });
    } finally {
      setApplying(null);
    }
  }

  // ---------- auditoría de veracidad de UN fact (en NUESTRO server: POST /api/create/audit) ----------
  async function auditOne(m: DraftModule, f: FactInv) {
    if (auditingFact) return;
    setAuditingFact(f.id);
    try {
      const result = auditResultOf(await api.auditFacts(auditRequestFor(f)));
      updateModule(m.id, (mm) =>
        mm.inventory
          ? { ...mm, inventory: { ...mm.inventory, facts: mm.inventory.facts.map((x) => (x.id === f.id ? { ...x, audit: result } : x)) } }
          : mm,
      );
      setOpenAudit((s) => new Set(s).add(f.id));
    } catch (e) {
      setMsg({ ok: false, text: `Auditoría: ${(e as Error).message}` });
    } finally {
      setAuditingFact(null);
    }
  }

  // ---------- auditar EN LOTE los facts riesgosos sin auditar de un módulo (secuencial, tolerante a fallos) ----------
  async function auditModule(m: DraftModule) {
    const inv = m.inventory;
    if (!inv || batchAudit || auditingFact) return;
    const targets = inv.facts.filter((f) => isRisky(f) && !f.audit);
    if (!targets.length) { setMsg({ ok: true, text: 'No hay datos riesgosos sin auditar en este módulo.' }); return; }
    setBatchAudit({ mid: m.id, done: 0, total: targets.length });
    let done = 0, failed = 0;
    for (const f of targets) {
      setAuditingFact(f.id);
      try {
        const result = auditResultOf(await api.auditFacts(auditRequestFor(f)));
        updateModule(m.id, (mm) =>
          mm.inventory
            ? { ...mm, inventory: { ...mm.inventory, facts: mm.inventory.facts.map((x) => (x.id === f.id ? { ...x, audit: result } : x)) } }
            : mm,
        );
      } catch { failed += 1; }
      done += 1;
      setBatchAudit({ mid: m.id, done, total: targets.length });
    }
    setAuditingFact(null);
    setBatchAudit(null);
    setMsg({ ok: failed === 0, text: `Auditoría del módulo: ${done - failed}/${targets.length} datos auditados${failed ? ` · ${failed} con error` : ''}.` });
  }

  // ---------- guardar ----------
  async function save() {
    const err = validateForSave(state);
    if (err) { setMsg({ ok: false, text: err }); return; }
    // aviso NO bloqueante: datos que la auditoría marcó CONTRADICHOS y siguen en las postas
    const contradichos = state.modules.flatMap((m) => (m.inventory?.facts ?? []).filter((f) => f.selected && f.audit?.status === 'contradicho'));
    if (contradichos.length && !(await askConfirm(`⚠ La auditoría marcó ${contradichos.length} dato(s) como CONTRADICHO(S) por las fuentes y siguen en las postas. Podés corregirlos o sacarlos antes. ¿Guardar igual?`, { label: 'Guardar igual' }))) return;
    setMsg(null);
    try {
      const flat = flatten(state);
      const bundle: CreatorBundle = { kind: 'smarty-route-bundle', schemaVersion: 1, route: flat.route, definitions: flat.definitions, editorial: flat.editorial };
      const r = (await api.importRouteBundle(bundle)) as ImportResultX;
      if (!r.ok) throw new Error(r.error || 'No se pudo guardar la ruta.');
      setMsg({ ok: true, text: `✓ Guardada «${r.title ?? flat.route.title}» — ya aparece en Aprender (${r.postas ?? flat.route.postas.length} postas).` });
      void refreshCatalog();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  // ---------- portada (override manual) ----------
  async function onCoverFile(file: File | null | undefined) {
    if (!file) return;
    try {
      const dataUrl = await cropToCover(file); // recorta 16:9 + comprime, sin backend
      setState((s) => ({ ...s, cover: dataUrl }));
    } catch (e) {
      setMsg({ ok: false, text: `No pude procesar la imagen: ${(e as Error).message}` });
    }
  }
  const clearCover = () => setState((s) => ({ ...s, cover: undefined }));
  // preview: manual > miniatura del video del 1er módulo (el artículo se resuelve en el mosaico de Learn)
  const firstSrc = state.modules[0]?.source;
  const coverPreview = state.cover ?? (firstSrc?.kind === 'video' && firstSrc.videoId ? mqThumb(firstSrc.videoId) : null);

  const handlers: ModuleHandlers & InventoryHandlers = {
    onPatch: patchModule,
    onMove: moveModule,
    onDelete: deleteModule,
    onSource: setSource,
    onThreshold: setThreshold,
    onToggleRecall: toggleRecall,
    onGenerate: (mid) => void generateModule(mid),
    onPostaTitle: editPostaTitle,
    onCard: editCard,
    onAddCard: addCard,
    onRemoveCard: removeCard,
    onAddProf: addProfundizacion,
    onDeleteProf: deleteProfundizacion,
    onMoveProf: moveProfundizacion,
    onToggleInv: toggleInv,
    onOverride: setOverride,
    onApply: (m) => void applyCuration(m),
    onAuditOne: (m, f) => void auditOne(m, f),
    onAuditModule: (m) => void auditModule(m),
    onToggleAudit: toggleAudit,
  };
  const invView = (m: DraftModule): InventoryView => ({
    open: openInv.has(m.id),
    curOverride,
    applying: applying === m.id,
    auditingFact,
    openAudit,
    batch: batchAudit?.mid === m.id ? { done: batchAudit.done, total: batchAudit.total } : null,
    batchActive: !!batchAudit,
  });

  return (
    <section className="view cr-view" id="v-create">
      <header className="cr-head">
        <h2 className="h2">{isEditing ? 'Editar ruta' : 'Crear ruta'}</h2>
        <p className="lede">Armá la ruta por módulos: cada módulo es un contenido que se vuelve la lectura inicial + sus actividades. Generá cada módulo con route-lab, editá y guardá.</p>
      </header>

      {/* la ruta: nueva o una guardada para editar + identidad, categoría y portada */}
      <div className="cr-panel">
        <RoutePicker routes={editable} value={isEditing ? state.routeId : ''} isEditing={isEditing}
          onPick={(id) => void loadRoute(id)} onNew={() => void newRoute()} onDelete={() => void deleteRoute()} />
        <RouteIdentity
          emoji={state.emoji} title={state.title} category={state.category ?? ''} cover={state.cover} coverPreview={coverPreview}
          onEmoji={(v) => setState((s) => ({ ...s, emoji: v }))}
          onTitle={(v) => setState((s) => ({ ...s, title: v }))}
          onCategory={(v) => setState((s) => ({ ...s, category: v || undefined }))}
          onCoverFile={(f) => void onCoverFile(f)}
          onClearCover={clearCover} />
      </div>

      {/* config learner + route-lab */}
      <div className="cr-panel cr-panel--slim">
        <GenConfig edad={edad} nivel={nivel} url={url} onEdad={(v) => setEdad(Number(v))} onNivel={setNivel} onUrl={setUrl} />
      </div>

      {/* módulos */}
      <div className="cr-mods">
        {state.modules.map((m, i) => (
          <ModuleCard key={m.id} m={m} index={i} total={state.modules.length} h={handlers} inv={invView(m)} />
        ))}
        <button type="button" className="cr-btn cr-btn--ghost cr-addmod" onClick={addModule}><IcCrPlus /> Módulo</button>
      </div>

      {/* guardar */}
      <div className="cr-save">
        <button type="button" className="cr-btn cr-btn--lg" onClick={() => void save()}><IcCrSave /> {isEditing ? 'Guardar cambios' : 'Guardar ruta'}</button>
        {msg && <p className={`cr-msg ${msg.ok ? 'is-ok' : 'is-err'}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      </div>

      {confirmReq && (
        <ConfirmSheet text={confirmReq.text} confirmLabel={confirmReq.label} danger={confirmReq.danger}
          onAnswer={(yes) => { confirmReq.resolve(yes); setConfirmReq(null); }} />
      )}
    </section>
  );
}
