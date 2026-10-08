import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import type { FeedItem, FeedReaction, FeedSidebar } from '../../../api/types';
import { useUser } from '../../../hooks/user';
import { FeedArticleCard } from '../cards/FeedArticleCard';
import { FeedRouteCard } from '../cards/FeedRouteCard';
import { FeedVideoCard } from '../cards/FeedVideoCard';
import { FriendEventCard } from '../cards/FriendEventCard';
import { LeagueInviteCard } from '../cards/LeagueInviteCard';
import { FeedAside } from '../components/FeedAside';
import { FeedSkeleton } from '../components/FeedSkeleton';

/** Home = Feed: recomendaciones de contenido + noticias sociales (VISION §3).
 *  Contenedor puro: todos los datos salen de api.feed / api.feedReact (hoy, server fake). */
export function FeedPage() {
  const user = useUser();
  const go = useNavigate();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [sidebar, setSidebar] = useState<FeedSidebar | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [more, setMore] = useState(false);

  const load = () => {
    setError(false);
    api.feed().then(
      (r) => { setItems(r.items); setSidebar(r.sidebar ?? null); setNext(r.next); },
      () => setError(true),
    );
  };
  useEffect(load, []);

  const loadMore = async () => {
    if (!next || more) return;
    setMore(true);
    try {
      const r = await api.feed(next);
      setItems((cur) => [...(cur ?? []), ...r.items]);
      setNext(r.next);
    } catch { /* el botón queda para reintentar */ }
    setMore(false);
  };

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
          {items && (
            <div className="fitems">
              {items.map((it) => {
                switch (it.kind) {
                  case 'video': return <FeedVideoCard key={it.id} it={it} onOpen={h.video} />;
                  case 'article': return <FeedArticleCard key={it.id} it={it} onOpen={h.article} />;
                  case 'route': return <FeedRouteCard key={it.id} it={it} onOpen={h.route} />;
                  case 'friend': return <FriendEventCard key={it.id} it={it} onReact={react} />;
                  case 'league': return <LeagueInviteCard key={it.id} it={it} onOpen={h.league} />;
                }
              })}
              {next
                ? <button className="fmore" disabled={more} onClick={loadMore}>{more ? 'Cargando…' : 'Ver más novedades'}</button>
                : <p className="fend">Estás al día ✨</p>}
            </div>
          )}
        </div>
        {sidebar && <FeedAside s={sidebar} onContinue={h.practice} onLeague={h.league} onTopic={h.topic} />}
      </div>
    </section>
  );
}
