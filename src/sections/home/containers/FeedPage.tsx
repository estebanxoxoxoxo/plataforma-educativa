import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../../../api';
import type { FeedItem, FeedReaction, FeedSidebar } from '../../../api/types';
import { useUser } from '../../../hooks/user';
import { chatFriendsChanged, openChat, useChatDock } from '../../friends/lib/chatDock';
import { useFeatures } from '../../parent/lib/features';
import { FeedArticleCard } from '../cards/FeedArticleCard';
import { FeedRouteCard } from '../cards/FeedRouteCard';
import { FeedVideoCard } from '../cards/FeedVideoCard';
import { FriendEventCard } from '../cards/FriendEventCard';
import { LeagueInviteCard } from '../cards/LeagueInviteCard';
import { FeedAside } from '../components/FeedAside';
import { FeedSkeleton } from '../components/FeedSkeleton';
import { PinnedZone } from '../components/PinnedZone';
import { SimulateNpcsChip } from '../components/SimulateNpcsChip';
import { type Highlight, type PinPhase, mergeContacts } from '../lib/highlights';
import { MIN_VISIBLE, feedItemVisible } from '../lib/visibility';

/** Páginas que el feed pide solo, seguidas, para llenar lo que ocultaron los flags (tope anti-bucle). */
const AUTO_MAX = 4;
/** Cuánto queda a la vista el "+N novedades" del botón de demo. */
const NOTE_MS = 4500;
/** Zona pinneada: lo que dura el festejo de "¡Ya son amigos!" y lo que tarda en plegarse un destacado (o la zona). */
const PIN_DONE_MS = 1600;
const PIN_OUT_MS = 380;
/** Con movimiento reducido no hay animaciones: los destacados se van directo. */
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** Feed (la home, `/`; antes "Home" y "Descubrir"): recomendaciones de contenido + noticias sociales (VISION §3).
 *  Contenedor puro: todos los datos salen de api.feed / api.feedReact (hoy, server fake).
 *  Respeta los on-off del padre (useFeatures): con Ligas apagadas no hay noticias de ligas ni "Tu liga";
 *  con Amigos apagados no hay noticias de amigos. Si una página queda con menos de MIN_VISIBLE tarjetas
 *  visibles, se pide la siguiente sola (el feed nunca queda vacío por los flags).
 *  ARRIBA del stream, la zona PINNEADA de destacados (tanda F2, lib/highlights.ts): hoy, "X quiere contactarse con vos"
 *  (las solicitudes de api.requests(), con Aceptar / "Ahora no" ahí mismo). Aceptar abre su conversación en el dock; sin
 *  solicitudes (o con Amigos apagado) la zona no existe.
 *  Junto al saludo, el botón de DEMO "Simular NPCs" (regla 9 de docs/AGENTS.md; solo con Amigos prendido: lo que
 *  genera es social): el server mete una ráfaga de noticias y el feed se vuelve a pedir; lo nuevo entra arriba. */
export function FeedPage() {
  const user = useUser();
  const go = useNavigate();
  const features = useFeatures();
  const amigosOn = features?.amigos === true;
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [sidebar, setSidebar] = useState<FeedSidebar | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [more, setMore] = useState(false);
  /** Índice donde arranca la última página cargada (para contar cuánto aportó). */
  const [pageStart, setPageStart] = useState(0);
  const autoRun = useRef(0);
  /** Lo que acaba de entrar con "Simular NPCs" (entra con animación). */
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  const [npc, setNpc] = useState<{ busy: boolean; note: string | null; failed: boolean }>({ busy: false, note: null, failed: false });
  const noteTimer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(noteTimer.current), []);

  /* ---------- zona pinneada: destacados ("X quiere contactarse con vos") ---------- */
  const [pins, setPins] = useState<Highlight[]>([]);
  const pinTimers = useRef<number[]>([]);
  useEffect(() => () => pinTimers.current.forEach((t) => window.clearTimeout(t)), []);
  const pinLater = (fn: () => void, ms: number) => { pinTimers.current.push(window.setTimeout(fn, ms)); };
  // Se piden al entrar y cada vez que cambia el grafo social (se respondió una solicitud acá, en la campana o en Buscar →
  // Personas): lo que se está respondiendo o yéndose se queda hasta terminar su animación.
  const { friendsRev } = useChatDock();
  useEffect(() => {
    if (!amigosOn) { setPins([]); return; }
    let alive = true;
    api.requests().then((r) => { if (alive) setPins((cur) => mergeContacts(cur, r.requests)); }, () => { /* sin destacados: no hay zona */ });
    return () => { alive = false; };
  }, [amigosOn, friendsRev]);
  const setPin = useCallback((key: string, patch: Partial<{ phase: PinPhase; accepted: boolean }>) =>
    setPins((cur) => cur.map((h) => (h.key === key ? { ...h, ...patch } : h))), []);
  /** El destacado se pliega y después sale de la lista (con movimiento reducido, directo). */
  const dropPin = (key: string) => {
    if (reducedMotion()) { setPins((cur) => cur.filter((h) => h.key !== key)); return; }
    setPin(key, { phase: 'out' });
    pinLater(() => setPins((cur) => cur.filter((h) => h.key !== key)), PIN_OUT_MS);
  };
  // Aceptar: el destacado festeja un instante y se va; el dock suma al amigo nuevo y abre su conversación (su saludo
  // llega con "escribiendo…"). Si la solicitud ya no estaba (se respondió en otro lado), el destacado se va sin más.
  const acceptPin = async (h: Highlight) => {
    if (h.kind !== 'contact' || h.phase !== 'idle') return;
    setPin(h.key, { phase: 'busy' });
    try {
      const { friend } = await api.acceptRequest(h.req.id);
      setPin(h.key, { accepted: true });
      chatFriendsChanged();
      openChat(friend.id);
      pinLater(() => dropPin(h.key), reducedMotion() ? 900 : PIN_DONE_MS);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) { dropPin(h.key); chatFriendsChanged(); }
      else setPin(h.key, { phase: 'idle' }); // queda para reintentar
    }
  };
  // "Ahora no": se va (vuelve con la próxima carga de página: demo).
  const declinePin = async (h: Highlight) => {
    if (h.kind !== 'contact' || h.phase !== 'idle') return;
    setPin(h.key, { phase: 'busy' });
    try {
      await api.declineRequest(h.req.id);
      dropPin(h.key);
      chatFriendsChanged();
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) { dropPin(h.key); chatFriendsChanged(); }
      else setPin(h.key, { phase: 'idle' });
    }
  };

  /** Primera página (de cero): la del arranque, "Reintentar" y el refetch después de la ráfaga. */
  const firstPage = async () => {
    const r = await api.feed();
    autoRun.current = 0;
    setItems(r.items); setPageStart(0); setSidebar(r.sidebar ?? null); setNext(r.next); setError(false);
    return r.items;
  };
  const load = () => {
    setError(false);
    setFresh(new Set());
    firstPage().catch(() => setError(true));
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

  // Botón de demo: el server genera la ráfaga; acá solo se vuelve a pedir el feed y se marca lo que no estaba.
  const simulateNpcs = async () => {
    if (npc.busy) return;
    window.clearTimeout(noteTimer.current);
    setNpc({ busy: true, note: null, failed: false });
    let added: number;
    try { ({ added } = await api.simulateNpcs()); } catch { setNpc({ busy: false, note: null, failed: true }); return; }
    const before = new Set((items ?? []).map((it) => it.id));
    try {
      const now = await firstPage();
      setFresh(new Set(now.filter((it) => !before.has(it.id)).map((it) => it.id)));
    } catch { setError(true); }
    setNpc({ busy: false, note: added > 0 ? `+${added} ${added === 1 ? 'novedad nueva' : 'novedades nuevas'}` : 'Esta vez no hubo novedades', failed: false });
    noteTimer.current = window.setTimeout(() => setNpc((s) => ({ ...s, note: null })), NOTE_MS);
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

  // El contenido se abre en el lector / reproductor (/buscar/…), con "volver" al Feed.
  const back = { backTo: '/', backLabel: '‹ Feed' };
  const h = {
    video: (v: { id: string }) => go(`/buscar/video/${v.id}`, { state: back }),
    article: (url: string) => go(`/buscar/articulo/${encodeURIComponent(url)}`, { state: back }),
    route: (courseId: string) => go(`/aprender/${courseId}`),
    practice: (courseId: string) => go(`/practicar/${courseId}`),
    league: () => go('/ligas'),
    topic: (t: string) => go(`/buscar?q=${encodeURIComponent(t)}&tab=videos`),
  };
  /** La noticia es del propio chico (su medalla del cierre de liga). */
  const isMine = (nick: string) => !!user?.nick && nick === user.nick;

  return (
    <section className="view" id="v-feed">
      <div className="feed">
        <div className="fmain">
          <header className="fhead">
            <div className="fhead-txt">
              <h2 className="h2">Hola, {user?.name ?? ''} 👋</h2>
              <p className="lede">Novedades y recomendaciones para vos.</p>
            </div>
            {amigosOn && <SimulateNpcsChip busy={npc.busy} note={npc.note} failed={npc.failed} onClick={() => void simulateNpcs()} />}
          </header>
          {amigosOn && pins.length > 0 && (
            <PinnedZone items={pins} onAccept={(h) => void acceptPin(h)} onDecline={(h) => void declinePin(h)} />
          )}
          {error && <div className="fempty"><p>No pude cargar las novedades ahora mismo.</p><button className="hbtn" onClick={load}>Reintentar</button></div>}
          {!items && !error && <FeedSkeleton />}
          {shown && (
            <div className="fitems">
              {shown.length === 0 && (more || next) ? <FeedSkeleton /> : shown.map((it) => {
                const isNew = fresh.has(it.id);
                switch (it.kind) {
                  case 'video': return <FeedVideoCard key={it.id} it={it} onOpen={h.video} />;
                  case 'article': return <FeedArticleCard key={it.id} it={it} onOpen={h.article} />;
                  case 'route': return <FeedRouteCard key={it.id} it={it} onOpen={h.route} fresh={isNew} />;
                  case 'friend': return <FriendEventCard key={it.id} it={it} onReact={react} mine={isMine(it.friend.nick)} fresh={isNew} />;
                  case 'league': return <LeagueInviteCard key={it.id} it={it} onOpen={h.league} fresh={isNew} />;
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
