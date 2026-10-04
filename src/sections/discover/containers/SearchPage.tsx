import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, type SearchMap } from '../../../api';
import type { SearchResponse, Tab } from '../../../api/types';
import { lastSearch } from '../../../hooks/user';
import { UnderlineTabs } from '../../../shared/components/UnderlineTabs';
import { ImageItem } from '../cards/ImageCard';
import { PageItem } from '../cards/PageCard';
import { VideoItem } from '../cards/VideoCard';
import { ModeratedResults } from '../components/ModeratedResults';
import { RelatedChips } from '../components/RelatedChips';
import { SEARCH_TABS, SearchBar } from '../components/SearchBar';
import { WhitelistNote } from '../components/WhitelistNote';

type TabState<T> = { res: SearchResponse<T> | null; animate: boolean };
type Results = { [K in Tab]: TabState<SearchMap[K]> };
/** Caché por consulta: volver a una búsqueda ya hecha no re-anima. */
const cache = new Map<string, { [K in Tab]?: SearchResponse<SearchMap[K]> }>();
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const tab = (params.get('tab') as Tab) || 'pages';
  const [input, setInput] = useState(q);
  const [results, setResults] = useState<Results | null>(null);
  const go = useNavigate();
  const loc = useLocation();
  const tabAtSearch = useRef(tab);

  useEffect(() => { lastSearch.url = loc.pathname + loc.search; }, [loc]);
  useEffect(() => setInput(q), [q]);

  // Una búsqueda pide las 3 solapas en paralelo. Solo la solapa activa muestra la animación de moderación.
  useEffect(() => {
    if (!q) { setResults(null); return; }
    let alive = true;
    const hit = cache.get(q) ?? {};
    cache.set(q, hit);
    const active = tabAtSearch.current;
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
  }, [q]);

  const submit = (text = input) => {
    const v = text.trim(); if (!v) return;
    tabAtSearch.current = tab;
    setParams({ q: v, tab });
  };
  const setTab = (t: Tab) => {
    // al cambiar de solapa los resultados ya están listos: sin animación
    setResults((r) => r && { pages: { ...r.pages, animate: false }, images: { ...r.images, animate: false }, videos: { ...r.videos, animate: false } });
    setParams(q ? { q, tab: t } : { tab: t }, { replace: true });
  };

  const cur = results?.[tab];
  const empty = cur?.res && cur.res.items.length === 0;

  return (
    <section className="view" id="v-search">
      <SearchBar value={input} onChange={setInput} onSubmit={() => submit()} />
      <UnderlineTabs tabs={SEARCH_TABS} value={tab} onChange={setTab} className="tabs" tabClass="tab" inkClass="ink" />
      {tab === 'pages' && <WhitelistNote />}
      {tab === 'images' && results?.images.res?.related && <RelatedChips chips={results.images.res.related} onPick={(l) => { setInput(l); submit(l); }} />}
      {q && results && (empty
        ? <p className="sempty">{cur?.res?.error
          ? 'No pude buscar ahora mismo. Probemos de nuevo en un ratito.'
          : tab === 'pages'
            ? `No encontré nada sobre “${q}” en tus sitios aprobados.`
            : `No encontramos resultados aptos para chicos sobre “${q}”. Probá con dinosaurios, volcanes o planetas.`}</p>
        : <>
          {tab === 'pages' && <ModeratedResults key={`p-${q}`} kind="page" items={results.pages.res?.items ?? null} animate={results.pages.animate}
            render={(p) => <PageItem p={p} onOpen={() => go(`/descubrir/articulo/${encodeURIComponent(p.articleId)}`)} />} />}
          {tab === 'images' && <ModeratedResults key={`i-${q}`} kind="img" items={results.images.res?.items ?? null} animate={results.images.animate}
            render={(m) => <ImageItem m={m} />} />}
          {tab === 'videos' && <ModeratedResults key={`v-${q}`} kind="vid" items={results.videos.res?.items ?? null} animate={results.videos.animate}
            render={(v) => <VideoItem v={v} onOpen={() => go(`/descubrir/video/${v.id}`)} />} />}
        </>)}
    </section>
  );
}
