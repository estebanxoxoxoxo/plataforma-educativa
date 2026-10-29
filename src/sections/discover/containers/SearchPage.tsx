import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, type SearchMap } from '../../../api';
import type { ImageResult, SearchResponse, Tab } from '../../../api/types';
import { lastSearch, useUser } from '../../../hooks/user';
import { FolderSheet } from '../../../shared/components/FolderSheet';
import { UnderlineTabs } from '../../../shared/components/UnderlineTabs';
import { useSocial } from '../../friends/lib/social';
import { ImageItem } from '../cards/ImageCard';
import { PageItem } from '../cards/PageCard';
import { VideoItem } from '../cards/VideoCard';
import { MentorsNote } from '../components/MentorsNote';
import { ModeratedResults } from '../components/ModeratedResults';
import { PeopleNote } from '../components/PeopleNote';
import { RelatedChips } from '../components/RelatedChips';
import { MENTORS_TAB, PEOPLE_TAB, SEARCH_TABS, SearchBar, isContentTab, type SearchTab } from '../components/SearchBar';
import { WhitelistNote } from '../components/WhitelistNote';
import { MentorResults } from './MentorResults';
import { PeopleResults } from './PeopleResults';

type TabState<T> = { res: SearchResponse<T> | null; animate: boolean };
type Results = { [K in Tab]: TabState<SearchMap[K]> };
/** Caché por consulta: volver a una búsqueda ya hecha no re-anima. */
const cache = new Map<string, { [K in Tab]?: SearchResponse<SearchMap[K]> }>();
/** Buscar: Páginas, Imágenes y Videos (contenido moderado) + Personas (tanda F2: chicos de Innerith por su nombre de
 *  usuario; solo con Amigos prendido por la familia — apagado, la solapa no existe y ?tab=people cae en Páginas —; U4 · D4:
 *  es de los CHICOS: con un ADULTO activo tampoco existe y ?tab=people cae en Páginas, como Mentores con un chico) +
 *  Mentores (tanda U2, docs/USUARIOS.md §6: clases particulares que contrata el ADULTO, para él o para un dependiente;
 *  con un chico como usuario activo la solapa no existe y ?tab=mentors cae en Páginas). Una búsqueda de contenido pide
 *  las 3 solapas en paralelo; en Personas y en Mentores NO se gastan búsquedas de contenido: se piden recién al volver a
 *  una solapa de contenido (y esa muestra la animación de moderación). `?agendar=<contrato>` (lo manda Familia →
 *  Mentorías: "Elegir los días") abre la agenda de ese contrato en Mentores y se limpia de la URL al usarse. */
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
  const asked = (params.get('tab') as SearchTab) || 'pages';
  // Personas: mientras no se sabe si Amigos está prendido, se espera (sin buscar contenido); apagado o con un adulto, Páginas.
  // Mentores: solo el adulto; con un chico, Páginas.
  const tab: SearchTab = (asked === 'people' && social === false) || (asked === 'mentors' && !adult) ? 'pages' : asked;
  const isPeople = tab === 'people';
  const isMentors = tab === 'mentors';
  const noContent = !isContentTab(tab);
  const tabs = [...SEARCH_TABS, ...(peopleOn ? [PEOPLE_TAB] : []), ...(adult ? [MENTORS_TAB] : [])];
  const [input, setInput] = useState(q);
  const [results, setResults] = useState<Results | null>(null);
  const [savingImg, setSavingImg] = useState<ImageResult | null>(null);
  const go = useNavigate();
  const loc = useLocation();
  const tabAtSearch = useRef<SearchTab>(tab);
  /** La solapa que se ve ahora (para la búsqueda de contenido que arranca al salir de Personas o Mentores). */
  const shownTab = useRef<SearchTab>(tab);
  useLayoutEffect(() => { shownTab.current = tab; });

  useEffect(() => { lastSearch.url = loc.pathname + loc.search; }, [loc]);
  useEffect(() => setInput(q), [q]);

  // Una búsqueda pide las 3 solapas de contenido en paralelo. Solo la solapa activa muestra la animación de moderación.
  useEffect(() => {
    if (!q) { setResults(null); return; }
    if (noContent) return;
    let alive = true;
    const hit = cache.get(q) ?? {};
    cache.set(q, hit);
    const active = isContentTab(tabAtSearch.current) ? tabAtSearch.current : shownTab.current;
    const init = (t: Tab) => ({ res: hit[t] ?? null, animate: !hit[t] && t === active });
    setResults({ pages: init('pages'), images: init('images'), videos: init('videos') } as Results);
    (['pages', 'images', 'videos'] as Tab[]).forEach((t) => {
      if (hit[t]) return;
      api.search(q, t).then(
        (res) => {
          // block 'falla' (no se pudo revisar: fail-closed del server) NO se cachea: la próxima búsqueda vuelve a probar.
          if (res.block?.kind !== 'falla') (hit as Record<Tab, unknown>)[t] = res;
          if (alive) setResults((r) => r && { ...r, [t]: { res, animate: t === active } });
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
    setParams({ q: v, tab });
  };
  const setTab = (t: SearchTab) => {
    // Volviendo de Personas o Mentores a una solapa de contenido, esa búsqueda puede no estar hecha: se anima la nueva.
    if (noContent && isContentTab(t)) tabAtSearch.current = t;
    // al cambiar entre solapas de contenido los resultados ya están listos: sin animación
    setResults((r) => r && { pages: { ...r.pages, animate: false }, images: { ...r.images, animate: false }, videos: { ...r.videos, animate: false } });
    setParams(q ? { q, tab: t } : { tab: t }, { replace: true });
  };
  /** La agenda pedida por Familia → Mentorías ya se abrió (o no aplicaba): sale de la URL sin dejar historial. */
  const agendarUsed = () => setParams((p) => { const n = new URLSearchParams(p); n.delete('agendar'); return n; }, { replace: true });

  const cur = noContent ? undefined : results?.[tab as Tab];
  /** Con un chico activo el server puede no haber buscado (SearchResponse.block: crisis = el guion de contención, tema =
   *  palabra o tema bloqueado, falla = no se pudo revisar): ese texto se muestra TAL CUAL en lugar de resultados o del vacío. */
  const block = cur?.res?.block;
  const empty = cur?.res && cur.res.items.length === 0;

  return (
    <section className="view" id="v-search">
      <SearchBar value={input} onChange={setInput} onSubmit={() => submit()}
        placeholder={isPeople ? 'Buscá a alguien por su nombre de usuario' : isMentors ? 'Buscá un mentor por nombre o materia' : undefined} />
      {/* key: cuando aparecen Personas o Mentores la tinta se vuelve a medir */}
      <UnderlineTabs key={tabs.length} tabs={tabs} value={tab} onChange={setTab} className="tabs" tabClass="tab" inkClass="ink" />
      {tab === 'pages' && <WhitelistNote />}
      {isPeople && peopleOn && <PeopleNote />}
      {isPeople && peopleOn && <PeopleResults q={q} />}
      {isMentors && adult && <MentorsNote />}
      {isMentors && adult && <MentorResults q={q} agendar={agendar} onAgendarUsed={agendarUsed} />}
      {tab === 'images' && !results?.images.res?.block && results?.images.res?.related && <RelatedChips chips={results.images.res.related} onPick={(l) => { setInput(l); submit(l); }} />}
      {!noContent && q && results && (block
        ? <p className="sblock">{block.text}</p>
        : empty
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
