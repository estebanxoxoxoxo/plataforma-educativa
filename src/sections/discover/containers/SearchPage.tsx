import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, type SearchMap } from '../../../api';
import type { ImageResult, SearchResponse, Tab } from '../../../api/types';
import { lastSearch } from '../../../hooks/user';
import { FolderSheet } from '../../../shared/components/FolderSheet';
import { UnderlineTabs } from '../../../shared/components/UnderlineTabs';
import { useFeatures } from '../../parent/lib/features';
import { ImageItem } from '../cards/ImageCard';
import { PageItem } from '../cards/PageCard';
import { VideoItem } from '../cards/VideoCard';
import { ModeratedResults } from '../components/ModeratedResults';
import { PeopleNote } from '../components/PeopleNote';
import { RelatedChips } from '../components/RelatedChips';
import { PEOPLE_TAB, SEARCH_TABS, SearchBar, type SearchTab } from '../components/SearchBar';
import { WhitelistNote } from '../components/WhitelistNote';
import { PeopleResults } from './PeopleResults';

type TabState<T> = { res: SearchResponse<T> | null; animate: boolean };
type Results = { [K in Tab]: TabState<SearchMap[K]> };
/** Caché por consulta: volver a una búsqueda ya hecha no re-anima. */
const cache = new Map<string, { [K in Tab]?: SearchResponse<SearchMap[K]> }>();
/** Buscar: Páginas, Imágenes y Videos (contenido moderado) + Personas (tanda F2: chicos de Innerith por su nombre de
 *  usuario; solo con Amigos prendido por la familia — apagado, la solapa no existe y ?tab=people cae en Páginas).
 *  Una búsqueda de contenido pide las 3 solapas en paralelo; en Personas NO se gastan búsquedas de contenido: se piden
 *  recién al volver a una solapa de contenido (y esa muestra la animación de moderación). */
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const features = useFeatures();
  const peopleOn = features?.amigos === true;
  const asked = (params.get('tab') as SearchTab) || 'pages';
  // Personas: mientras no se sabe si Amigos está prendido, se espera (sin buscar contenido); apagado, Páginas.
  const tab: SearchTab = asked === 'people' && features && !peopleOn ? 'pages' : asked;
  const isPeople = tab === 'people';
  const tabs = peopleOn ? [...SEARCH_TABS, PEOPLE_TAB] : SEARCH_TABS;
  const [input, setInput] = useState(q);
  const [results, setResults] = useState<Results | null>(null);
  const [savingImg, setSavingImg] = useState<ImageResult | null>(null);
  const go = useNavigate();
  const loc = useLocation();
  const tabAtSearch = useRef<SearchTab>(tab);
  /** La solapa que se ve ahora (para la búsqueda de contenido que arranca al salir de Personas). */
  const shownTab = useRef<SearchTab>(tab);
  useLayoutEffect(() => { shownTab.current = tab; });

  useEffect(() => { lastSearch.url = loc.pathname + loc.search; }, [loc]);
  useEffect(() => setInput(q), [q]);

  // Una búsqueda pide las 3 solapas de contenido en paralelo. Solo la solapa activa muestra la animación de moderación.
  useEffect(() => {
    if (!q) { setResults(null); return; }
    if (isPeople) return;
    let alive = true;
    const hit = cache.get(q) ?? {};
    cache.set(q, hit);
    const active = tabAtSearch.current === 'people' ? shownTab.current : tabAtSearch.current;
    const init = (t: Tab) => ({ res: hit[t] ?? null, animate: !hit[t] && t === active });
    setResults({ pages: init('pages'), images: init('images'), videos: init('videos') } as Results);
    (['pages', 'images', 'videos'] as Tab[]).forEach((t) => {
      if (hit[t]) return;
      api.search(q, t).then(
        (res) => {
          (hit as Record<Tab, unknown>)[t] = res;
          if (alive) setResults((r) => r && { ...r, [t]: { res, animate: t === active } });
        },
        // backend caído: se muestra el aviso (sin cachear, para reintentar en la próxima búsqueda)
        () => { if (alive) setResults((r) => r && { ...r, [t]: { res: { query: q, items: [], error: 'unavailable' }, animate: false } }); },
      );
    });
    return () => { alive = false; };
  }, [q, isPeople]);

  const submit = (text = input) => {
    const v = text.trim(); if (!v) return;
    tabAtSearch.current = tab;
    setParams({ q: v, tab });
  };
  const setTab = (t: SearchTab) => {
    // Volviendo de Personas a una solapa de contenido, esa búsqueda puede no estar hecha: se anima la solapa nueva.
    if (isPeople && t !== 'people') tabAtSearch.current = t;
    // al cambiar entre solapas de contenido los resultados ya están listos: sin animación
    setResults((r) => r && { pages: { ...r.pages, animate: false }, images: { ...r.images, animate: false }, videos: { ...r.videos, animate: false } });
    setParams(q ? { q, tab: t } : { tab: t }, { replace: true });
  };

  const cur = isPeople ? undefined : results?.[tab as Tab];
  const empty = cur?.res && cur.res.items.length === 0;

  return (
    <section className="view" id="v-search">
      <SearchBar value={input} onChange={setInput} onSubmit={() => submit()}
        placeholder={isPeople ? 'Buscá a alguien por su nombre de usuario' : undefined} />
      {/* key: cuando aparece Personas (se supo que Amigos está prendido) la tinta se vuelve a medir */}
      <UnderlineTabs key={tabs.length} tabs={tabs} value={tab} onChange={setTab} className="tabs" tabClass="tab" inkClass="ink" />
      {tab === 'pages' && <WhitelistNote />}
      {isPeople && peopleOn && <PeopleNote />}
      {isPeople && peopleOn && <PeopleResults q={q} />}
      {tab === 'images' && results?.images.res?.related && <RelatedChips chips={results.images.res.related} onPick={(l) => { setInput(l); submit(l); }} />}
      {!isPeople && q && results && (empty
        ? <p className="sempty">{cur?.res?.error
          ? 'No pude buscar ahora mismo. Probemos de nuevo en un ratito.'
          : tab === 'pages'
            ? `No encontré nada sobre “${q}” en tus sitios aprobados.`
            : `No encontramos resultados aptos para chicos sobre “${q}”. Probá con dinosaurios, volcanes o planetas.`}</p>
        : <>
          {tab === 'pages' && <ModeratedResults key={`p-${q}`} kind="page" items={results.pages.res?.items ?? null} animate={results.pages.animate}
            render={(p) => <PageItem p={p} onOpen={() => go(`/buscar/articulo/${encodeURIComponent(p.articleId)}`)} />} />}
          {tab === 'images' && <ModeratedResults key={`i-${q}`} kind="img" items={results.images.res?.items ?? null} animate={results.images.animate}
            render={(m) => <ImageItem m={m} onSave={() => setSavingImg(m)} />} />}
          {tab === 'videos' && <ModeratedResults key={`v-${q}`} kind="vid" items={results.videos.res?.items ?? null} animate={results.videos.animate}
            render={(v) => <VideoItem v={v} onOpen={() => go(`/buscar/video/${v.id}`)} />} />}
        </>)}
      {savingImg && <FolderSheet open title="¿Dónde la guardás?" cta="Guardar acá"
        onPick={async (folderId, folderName) => {
          const r = await api.saveItem({ folderId, image: { url: savingImg.img, caption: savingImg.caption, source: savingImg.source.name } }).catch(() => null);
          if (!r) return { error: 'No se pudo guardar ahora.' };
          return { done: r.existed ? `Ya estaba en ${folderName}` : `Guardada en ${folderName}` };
        }} onClose={() => setSavingImg(null)} />}
    </section>
  );
}
