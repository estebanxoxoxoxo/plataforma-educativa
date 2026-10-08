import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import type { FeedItem, FeedReaction, FeedSidebar } from '../../../api/types';
import { useUser } from '../../../hooks/user';
import { useFeatures } from '../../parent/lib/features';
import { FeedArticleCard } from '../cards/FeedArticleCard';
import { FeedRouteCard } from '../cards/FeedRouteCard';
import { FeedVideoCard } from '../cards/FeedVideoCard';
import { FriendEventCard } from '../cards/FriendEventCard';
import { LeagueInviteCard } from '../cards/LeagueInviteCard';
import { FeedAside } from '../components/FeedAside';
import { FeedSkeleton } from '../components/FeedSkeleton';
import { MIN_VISIBLE, feedItemVisible } from '../lib/visibility';

/** Páginas que el feed pide solo, seguidas, para llenar lo que ocultaron los flags (tope anti-bucle). */
const AUTO_MAX = 4;

/** Home = Feed: recomendaciones de contenido + noticias sociales (VISION §3).
 *  Contenedor puro: todos los datos salen de api.feed / api.feedReact (hoy, server fake).
 *  Respeta los on-off del padre (useFeatures): con Ligas apagadas no hay noticias de ligas ni "Tu liga";
 *  con Amigos apagados no hay noticias de amigos. Si una página queda con menos de MIN_VISIBLE tarjetas
 *  visibles, se pide la siguiente sola (el feed nunca queda vacío por los flags). */
export function FeedPage() {
  const user = useUser();
  const go = useNavigate();
  const features = useFeatures();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [sidebar, setSidebar] = useState<FeedSidebar | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [more, setMore] = useState(false);
  /** Índice donde arranca la última página cargada (para contar cuánto aportó). */
  const [pageStart, setPageStart] = useState(0);
  const autoRun = useRef(0);

  const load = () => {
    setError(false);
    autoRun.current = 0;
    api.feed().then(
      (r) => { setItems(r.items); setPageStart(0); setSidebar(r.sidebar ?? null); setNext(r.next); },
      () => setError(true),
    );
  };
  useEffect(load, []);

  const loadMore = async (auto = false) => {
    if (!next || more) return;
    if (!auto) autoRun.current = 0;
    const start = items?.length ?? 0;
    setMore(true);
    try {
      const r = await api.feed(next);
      setItems((cur) => [...(cur ?? []), ...r.items]);
      setPageStart(start);
      setNext(r.next);
    } catch { /* el botón queda para reintentar */ }
    setMore(false);
  };

  // Lo que dejan ver los flags (visual: el server sigue mandando todo). Si la última página aportó menos de
  // MIN_VISIBLE tarjetas, se pide la siguiente sola; también cuando un flag cambia en vivo.
  const shown = items ? items.filter((it) => feedItemVisible(it, features)) : null;
  const lastPageShown = items && features ? items.slice(pageStart).filter((it) => feedItemVisible(it, features)).length : null;
  useEffect(() => {
    if (lastPageShown === null || lastPageShown >= MIN_VISIBLE || !next || more || autoRun.current >= AUTO_MAX) return;
    autoRun.current++;
    void loadMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPageShown, next, more]);

  // Reacción optimista; se reconcilia con lo que devuelva el server.
  const applyReactions = (id: string, fn: (rs: FeedReaction[]) => FeedReaction[]) =>
    setItems((cur) => cur && cur.map((it) => (it.kind === 'friend' && it.id === id ? { ...it, reactions: fn(it.reactions) } : it)));
  const react = async (id: string, emoji: string) => {
    applyReactions(id, (rs) => rs.map((r) => (r.emoji === emoji ? { ...r, mine: !r.mine, count: Math.max(0, r.count + (r.mine ? -1 : 1)) } : r)));
    try {
      const r = await api.feedReact(id, emoji);
      applyReactions(id, () => r.reactions);
    } catch { /* se mantiene lo optimista */ }
  };

  // El contenido se abre en el lector / reproductor (/buscar/…), con "volver" al feed (Descubrir).
  const back = { backTo: '/', backLabel: '‹ Descubrir' };
  const h = {
    video: (v: { id: string }) => go(`/buscar/video/${v.id}`, { state: back }),
    article: (url: string) => go(`/buscar/articulo/${encodeURIComponent(url)}`, { state: back }),
    route: (courseId: string) => go(`/aprender/${courseId}`),
    practice: (courseId: string) => go(`/practicar/${courseId}`),
    league: () => go('/ligas'),
    topic: (t: string) => go(`/buscar?q=${encodeURIComponent(t)}&tab=videos`),
  };

  return (
    <section className="view" id="v-feed">
      <div className="feed">
        <div className="fmain">
          <header className="fhead">
            <h2 className="h2">Hola, {user?.name ?? ''} 👋</h2>
            <p className="lede">Novedades y recomendaciones para vos.</p>
          </header>
          {error && <div className="fempty"><p>No pude cargar las novedades ahora mismo.</p><button className="hbtn" onClick={load}>Reintentar</button></div>}
          {!items && !error && <FeedSkeleton />}
          {shown && (
            <div className="fitems">
              {shown.length === 0 && (more || next) ? <FeedSkeleton /> : shown.map((it) => {
                switch (it.kind) {
                  case 'video': return <FeedVideoCard key={it.id} it={it} onOpen={h.video} />;
                  case 'article': return <FeedArticleCard key={it.id} it={it} onOpen={h.article} />;
                  case 'route': return <FeedRouteCard key={it.id} it={it} onOpen={h.route} />;
                  case 'friend': return <FriendEventCard key={it.id} it={it} onReact={react} />;
                  case 'league': return <LeagueInviteCard key={it.id} it={it} onOpen={h.league} />;
                }
              })}
              {next
                ? <button className="fmore" disabled={more} onClick={() => void loadMore()}>{more ? 'Cargando…' : 'Ver más novedades'}</button>
                : <p className="fend">Estás al día ✨</p>}
            </div>
          )}
        </div>
        {sidebar && <FeedAside s={sidebar} showLeague={features?.ligas === true} onContinue={h.practice} onLeague={h.league} onTopic={h.topic} />}
      </div>
    </section>
  );
}
