import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, type SearchMap } from '../../../api';
import type { ImageResult, Moderated, PageResult, SearchResponse, Tab, VideoResult } from '../../../api/types';
import { lastSearch, useUser } from '../../../hooks/user';
import { FolderSheet } from '../../../shared/components/FolderSheet';
import { UnderlineTabs } from '../../../shared/components/UnderlineTabs';
import { useSocial } from '../../friends/lib/social';
import { ImageItem } from '../cards/ImageCard';
import { PageItem } from '../cards/PageCard';
import { ShareCard } from '../cards/ShareCard';
import { VideoItem } from '../cards/VideoCard';
import { LnSearch } from '../components/icons';
import { MediaGroup, type MediaKind } from '../components/MediaGroup';
import { MentorsNote } from '../components/MentorsNote';
import { ModeratedResults } from '../components/ModeratedResults';
import { PeopleNote } from '../components/PeopleNote';
import { RelatedChips } from '../components/RelatedChips';
import {
  ALL_TAB, KNOWN_TABS, MENTORS_TAB, PEOPLE_TAB, SEARCH_TABS, SearchBar, isContentTab, type SearchTab,
} from '../components/SearchBar';
import { SearchState } from '../components/SearchState';
import { WhitelistNote } from '../components/WhitelistNote';
import { SUGGESTED_TOPICS } from '../lib/suggestions';
import { MentorResults } from './MentorResults';
import { PeopleResults } from './PeopleResults';

type TabState<T> = { res: SearchResponse<T> | null; animate: boolean };
type Results = { [K in Tab]: TabState<SearchMap[K]> };
/** Caché por consulta: volver a una búsqueda ya hecha no re-anima. */
const cache = new Map<string, { [K in Tab]?: SearchResponse<SearchMap[K]> }>();
/** Cómo se nombra cada tipo en lo visible (el vacío y los grupos de Todo). */
const NOUN: Record<Tab, string> = { videos: 'videos', images: 'imágenes', pages: 'artículos' };
const MEDIA: Record<Tab, MediaKind> = { videos: 'videos', images: 'images', pages: 'articles' };
/** El orden de los grupos de Todo (el del POC). */
const ALL_ORDER: Tab[] = ['videos', 'images', 'pages'];
const BLOCK_RANK = { crisis: 0, tema: 1, falla: 2 } as const;

/** Los ítems de la previa de un grupo de Todo: hasta el 3.º apto INCLUSIVE (con los filtrados que haya en el medio, así la
 *  animación de moderación también se ve en la previa). */
function previewOf<T>(items: Moderated<T>[]): Moderated<T>[] {
  let ok = 0;
  for (let i = 0; i < items.length; i++) if (!items[i].blocked && ++ok === 3) return items.slice(0, i + 1);
  return items;
}

/** Buscar (tanda BUSCARCHAT, 30-oct: al nivel del POC — smarty-poc Search.tsx).
 *  · SIN búsqueda: la home centrada estilo Google (lupa fina, «Buscar», una línea con qué se puede buscar, la caja píldora
 *    y 4 ideas que buscan al tocarlas). SIN solapas (como el POC: aparecen recién con la búsqueda). Personas y Mentores,
 *    que antes se veían como solapas en la home, quedan como un link discreto debajo de las ideas.
 *  · CON búsqueda: la caja sube a una cabecera pegada arriba (fondo con blur) con las solapas subrayadas debajo, y el cuerpo
 *    en una columna angosta centrada (Imágenes, más ancha). «Todo» (la de entrada) arma un grupo por tipo con los 3 primeros
 *    aptos y «Ver los N …», que lleva a la solapa del tipo (POC: onMore → goTab). La solapa que se ve como «Artículos» es
 *    `pages` en la URL (compat de links: ver SearchBar.tsx).
 *  · Los vacíos, los bloqueos del server y el error, AL MEDIO (SearchState).
 *  Lo que NO cambió: las 3 búsquedas de contenido en paralelo, la caché por consulta, la animación de moderación
 *  (ModeratedResults), la nota de lista blanca, las sugerencias de Imágenes, Personas (tanda F2: chicos por su nombre de
 *  usuario; solo con Amigos prendido y un chico activo — si no, ?tab=people cae en Todo) y Mentores (tanda U2: solo el
 *  ADULTO — con un chico ?tab=mentors cae en Todo); en Personas y en Mentores NO se gastan búsquedas de contenido: se piden
 *  recién al volver a una solapa de contenido (y esa muestra la animación). `?agendar=<contrato>` (Familia → Mentorías:
 *  "Elegir los días") abre la agenda de ese contrato en Mentores y se limpia de la URL al usarse. */
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const agendar = params.get('agendar');
  // Personas = lo social, que es de los chicos (lib/social.ts: Amigos prendido Y un chico activo; undefined mientras no se
  // sabe si Amigos está prendido). El usuario activo ya está resuelto al montar (UserProvider no pinta nada hasta saberlo);
  // sin usuario (falló /api/me) se trata como chico: sin Mentores (fail-closed) y Personas según Amigos.
  const social = useSocial();
  const peopleOn = social === true;
  const adult = useUser()?.kind === 'adult';
  const raw = params.get('tab') || 'all';
  const asked = (KNOWN_TABS.has(raw) ? raw : 'all') as SearchTab;
  // Personas: mientras no se sabe si Amigos está prendido, se espera (sin buscar contenido); apagado o con un adulto, Todo.
  // Mentores: solo el adulto; con un chico, Todo.
  const tab: SearchTab = (asked === 'people' && social === false) || (asked === 'mentors' && !adult) ? 'all' : asked;
  const isPeople = tab === 'people';
  const isMentors = tab === 'mentors';
  const noContent = !isContentTab(tab);
  const tabs = [ALL_TAB, ...SEARCH_TABS, ...(peopleOn ? [PEOPLE_TAB] : []), ...(adult ? [MENTORS_TAB] : [])];
  /** La home: sin consulta y en una solapa de contenido (Personas y Mentores se abren por link, p. ej. desde Familia). */
  const home = !q && !noContent;
  const [input, setInput] = useState(q);
  const [results, setResults] = useState<Results | null>(null);
  const [savingImg, setSavingImg] = useState<ImageResult | null>(null);
  const go = useNavigate();
  const loc = useLocation();
  const view = useRef<HTMLElement>(null);
  const tabAtSearch = useRef<SearchTab>(tab);
  /** La solapa que se ve ahora (para la búsqueda de contenido que arranca al salir de Personas o Mentores). */
  const shownTab = useRef<SearchTab>(tab);
  useLayoutEffect(() => { shownTab.current = tab; });

  useEffect(() => { lastSearch.url = loc.pathname + loc.search; }, [loc]);
  useEffect(() => setInput(q), [q]);

  // Una búsqueda pide las 3 solapas de contenido en paralelo. Muestra la animación de moderación solo lo que se ve: la
  // solapa activa o, en Todo, los tres grupos.
  useEffect(() => {
    if (!q) { setResults(null); return; }
    if (noContent) return;
    let alive = true;
    const hit = cache.get(q) ?? {};
    cache.set(q, hit);
    const active = isContentTab(tabAtSearch.current) ? tabAtSearch.current : shownTab.current;
    const shows = (t: Tab) => t === active || active === 'all';
    const init = (t: Tab) => ({ res: hit[t] ?? null, animate: !hit[t] && shows(t) });
    setResults({ pages: init('pages'), images: init('images'), videos: init('videos') } as Results);
    (['pages', 'images', 'videos'] as Tab[]).forEach((t) => {
      if (hit[t]) return;
      api.search(q, t).then(
        (res) => {
          // block 'falla' (no se pudo revisar: fail-closed del server) NO se cachea: la próxima búsqueda vuelve a probar.
          if (res.block?.kind !== 'falla') (hit as Record<Tab, unknown>)[t] = res;
          if (alive) setResults((r) => r && { ...r, [t]: { res, animate: shows(t) } });
        },
        // backend caído: se muestra el aviso (sin cachear, para reintentar en la próxima búsqueda)
        () => { if (alive) setResults((r) => r && { ...r, [t]: { res: { query: q, items: [], error: 'unavailable' }, animate: false } }); },
      );
    });
    return () => { alive = false; };
  }, [q, noContent]);

  const submit = (text = input) => {
    const v = text.trim();
    // En Mentores la búsqueda vacía vale: vuelve al catálogo entero.
    if (!v) { if (isMentors && q) setParams({ tab }); return; }
    tabAtSearch.current = tab;
    setParams(tab === 'all' ? { q: v } : { q: v, tab });
  };
  const pickTopic = (t: string) => { setInput(t); submit(t); };
  const setTab = (t: SearchTab) => {
    // Volviendo de Personas o Mentores a una solapa de contenido, esa búsqueda puede no estar hecha: se anima la nueva.
    if (noContent && isContentTab(t)) tabAtSearch.current = t;
    // al cambiar entre solapas de contenido los resultados ya están listos: sin animación
    setResults((r) => r && { pages: { ...r.pages, animate: false }, images: { ...r.images, animate: false }, videos: { ...r.videos, animate: false } });
    setParams(q ? { q, tab: t } : { tab: t }, { replace: true });
    view.current?.scrollTo({ top: 0 });
  };
  /** La agenda pedida por Familia → Mentorías ya se abrió (o no aplicaba): sale de la URL sin dejar historial. */
  const agendarUsed = () => setParams((p) => { const n = new URLSearchParams(p); n.delete('agendar'); return n; }, { replace: true });

  const openPage = (p: PageResult) => go(`/buscar/articulo/${encodeURIComponent(p.articleId)}`);
  const openVideo = (v: VideoResult) => go(`/buscar/video/${v.id}`);

  /** Una solapa de un solo tipo: el bloqueo del server, el vacío o los resultados (con su animación). */
  function single(t: Tab): ReactNode {
    const cur = results?.[t];
    const res = cur?.res;
    /** Con un chico activo el server puede no haber buscado (SearchResponse.block: crisis = el guion de contención, tema =
     *  palabra o tema bloqueado, falla = no se pudo revisar): ese texto se muestra TAL CUAL en lugar de resultados o del vacío. */
    if (res?.block) return <SearchState kind="block" text={res.block.text} />;
    // (como antes: vacío = el server no trajo nada; si trajo y la moderación filtró todo, se ve esa animación)
    if (res && res.items.length === 0) {
      return res.error
        ? <SearchState kind="error" text="No pude buscar ahora mismo. Probemos de nuevo en un ratito." />
        : <SearchState kind="empty" text={`No encontré ${NOUN[t]} de «${q}».`} q={q} onPick={pickTopic} />;
    }
    const items = res?.items ?? null;
    const animate = !!cur?.animate;
    if (t === 'pages') return <ModeratedResults key={`p-${q}`} kind="page" items={items as Moderated<PageResult>[] | null} animate={animate} render={(p) => <PageItem p={p} onOpen={() => openPage(p)} />} />;
    if (t === 'images') return <ModeratedResults key={`i-${q}`} kind="img" items={items as Moderated<ImageResult>[] | null} animate={animate} render={(m) => <ImageItem m={m} onSave={() => setSavingImg(m)} />} />;
    return <ModeratedResults key={`v-${q}`} kind="vid" items={items as Moderated<VideoResult>[] | null} animate={animate} render={(v) => <VideoItem v={v} onOpen={() => openVideo(v)} />} />;
  }

  /** Todo: un grupo por tipo (los 3 primeros aptos + «Ver los N …» → su solapa). El que todavía carga muestra su esqueleto;
   *  el que terminó vacío (o falló) no se muestra, como el POC. Un bloqueo del server (crisis o tema) es de TODA la consulta:
   *  va solo, al medio. «Nada» recién cuando los tres terminaron sin nada. */
  function all(): ReactNode {
    if (!results) return null;
    const resps = ALL_ORDER.map((t) => results[t].res);
    const blocks = resps.flatMap((r) => (r?.block ? [r.block] : [])).sort((a, b) => BLOCK_RANK[a.kind] - BLOCK_RANK[b.kind]);
    if (blocks[0] && blocks[0].kind !== 'falla') return <SearchState kind="block" text={blocks[0].text} />;
    const state = (t: Tab) => {
      const r = results[t].res;
      return !r ? 'loading' : r.block || r.error ? 'fail' : r.items.some((i) => !i.blocked) ? 'ok' : 'empty';
    };
    const shown = ALL_ORDER.filter((t) => state(t) === 'ok' || state(t) === 'loading');
    if (!shown.length) {
      if (blocks[0]) return <SearchState kind="block" text={blocks[0].text} />;
      if (ALL_ORDER.every((t) => state(t) === 'fail')) return <SearchState kind="error" text="No pude buscar ahora mismo. Probemos de nuevo en un ratito." />;
      return <SearchState kind="empty" text={`No encontré nada de «${q}».`} q={q} onPick={pickTopic} />;
    }
    return (
      <div className="sx-all">
        {shown.map((t) => <AllGroup key={`${t}-${q}`} t={t} st={results[t]} onMore={() => setTab(t)} render={(it) =>
          t === 'videos' ? <ShareCard v={it as VideoResult} onOpen={openVideo} />
            : t === 'images' ? <ImageItem m={it as ImageResult} onSave={() => setSavingImg(it as ImageResult)} />
              : <PageItem p={it as PageResult} onOpen={() => openPage(it as PageResult)} />} />)}
      </div>
    );
  }

  const homeSub = peopleOn ? 'Videos, imágenes, artículos y personas.'
    : adult ? 'Videos, imágenes, artículos y mentores.'
      : 'Videos, imágenes y artículos de lo que te interese.';

  return (
    <section className={`view${home ? ' sx-is-home' : ''}`} id="v-search" ref={view}>
      {home ? (
        <div className="sx-home">
          <div className="sx-home-in">
            <LnSearch className="sx-home-ic" />
            <h2 className="sx-home-t">Buscar</h2>
            <p className="sx-home-sub">{homeSub}</p>
            <SearchBar value={input} onChange={setInput} onSubmit={() => submit()} autoFocus />
            <div className="sx-chips">
              {SUGGESTED_TOPICS.map((t) => <button key={t} type="button" className="sx-chip" onClick={() => pickTopic(t)}>{t}</button>)}
            </div>
            {peopleOn && <button type="button" className="sx-also" onClick={() => setTab('people')}>Buscar a otros chicos de Innerith</button>}
            {adult && <button type="button" className="sx-also" onClick={() => setTab('mentors')}>Ver los mentores</button>}
          </div>
        </div>
      ) : (
        <>
          <div className="sx-head">
            <div className="sx-col">
              <SearchBar value={input} onChange={setInput} onSubmit={() => submit()}
                placeholder={isPeople ? 'Buscá a alguien por su nombre de usuario' : isMentors ? 'Buscá un mentor por nombre o materia' : undefined} />
              {/* key: cuando aparecen Personas o Mentores la tinta se vuelve a medir */}
              <UnderlineTabs key={tabs.length} tabs={tabs} value={tab} onChange={setTab} className="tabs sx-tabs" tabClass="tab" inkClass="ink" />
            </div>
          </div>
          <div className={`sx-col sx-body${tab === 'images' ? ' sx-wide' : ''}`}>
            {tab === 'pages' && <WhitelistNote />}
            {isPeople && peopleOn && <PeopleNote />}
            {isPeople && peopleOn && <PeopleResults q={q} />}
            {isMentors && adult && <MentorsNote />}
            {isMentors && adult && <MentorResults q={q} agendar={agendar} onAgendarUsed={agendarUsed} />}
            {tab === 'images' && !results?.images.res?.block && results?.images.res?.related && <RelatedChips chips={results.images.res.related} onPick={pickTopic} />}
            {!noContent && q && results && (tab === 'all' ? all() : single(tab as Tab))}
          </div>
        </>
      )}
      {savingImg && <FolderSheet open title="¿Dónde la guardás?" cta="Guardar acá"
        onPick={async (folderId, folderName) => {
          const r = await api.saveItem({ folderId, image: { url: savingImg.img, caption: savingImg.caption, source: savingImg.source.name } }).catch(() => null);
          if (!r) return { error: 'No se pudo guardar ahora.' };
          return { done: r.existed ? `Ya estaba en ${folderName}` : `Guardada en ${folderName}` };
        }} onClose={() => setSavingImg(null)} />}
    </section>
  );
}

/** Un grupo de Buscar → Todo. Memoriza la previa (ModeratedResults re-anima si cambia la identidad de sus ítems). */
function AllGroup({ t, st, onMore, render }: {
  t: Tab; st: TabState<SearchMap[Tab]>; onMore: () => void; render: (item: SearchMap[Tab]) => ReactNode;
}) {
  const items = st.res?.items ?? null;
  const preview = useMemo(() => (items ? previewOf(items as Moderated<SearchMap[Tab]>[]) : null), [items]);
  const ok = items ? items.filter((i) => !i.blocked).length : 0;
  const kind = t === 'videos' ? 'vid' : t === 'images' ? 'img' : 'page';
  return (
    <MediaGroup kind={MEDIA[t]} more={ok} onMore={onMore}>
      <ModeratedResults kind={kind} items={preview} animate={st.animate} skel={3} variant="grp" render={render} />
    </MediaGroup>
  );
}
