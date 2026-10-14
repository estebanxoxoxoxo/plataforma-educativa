import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../../../api';
import type { FeedItem, FeedMotion, FeedReaction, VideoResult } from '../../../api/types';
import { useUser } from '../../../hooks/user';
import { chatFriendsChanged, openChat, useChatDock } from '../../friends/lib/chatDock';
import { LEAGUE_WEEK_CLOSED } from '../../leagues/lib/cycle';
import { useFeatures } from '../../parent/lib/features';
import { FeedArticleCard } from '../cards/FeedArticleCard';
import { FeedNewsCard } from '../cards/FeedNewsCard';
import { FeedNextCard } from '../cards/FeedNextCard';
import { FeedRouteCard } from '../cards/FeedRouteCard';
import { FeedSummaryCard } from '../cards/FeedSummaryCard';
import { FeedVideoCard } from '../cards/FeedVideoCard';
import { FeedVideoShelf } from '../cards/FeedVideoShelf';
import { FriendEventCard } from '../cards/FriendEventCard';
import { FeedEndCap } from '../components/FeedEndCap';
import { FeedHead } from '../components/FeedHead';
import { FeedLessCard } from '../components/FeedLessCard';
import { FeedSkeleton } from '../components/FeedSkeleton';
import { NewsPill } from '../components/NewsPill';
import { PinnedZone } from '../components/PinnedZone';
import { SimulateNpcsChip } from '../components/SimulateNpcsChip';
import { serverDate, useSchedules } from '../../parent/lib/schedules';
import { daypartLine } from '../lib/daypart';
import { shelfAllUrl } from '../lib/extras';
import { type Highlight, type PinPhase, mergeContacts } from '../lib/highlights';
import { mergeFresh } from '../lib/merge';
import { effectiveMotion, useReducedMotion } from '../lib/motion';
import { isNews } from '../lib/news';
import { MIN_VISIBLE, feedItemVisible } from '../lib/visibility';

/** Páginas que la PRIMERA carga pide sola, seguidas, si los flags dejaron menos de MIN_VISIBLE (tope anti-bucle). */
const AUTO_MAX = 4;
/** Cuánto queda a la vista la nota del botón de demo. */
const NOTE_MS = 4500;
/** Zona pinneada: lo que dura el festejo de "¡Ya son amigos!" y lo que tarda en plegarse un destacado (o la zona). */
const PIN_DONE_MS = 1600;
const PIN_OUT_MS = 380;
/** "Ver menos": lo que tarda la card en plegarse antes de que aparezca el "Listo…" (mock v6: 200 ms). */
const LEAVE_MS = 200;
/** Entrada escalonada (ms entre cards, con tope de 8 escalones): primera página, "Ver más de antes" y lo de la píldora. */
const STAGGER = { first: 30, more: 40, fresh: 40 } as const;
const STAGGER_CAP = 8;
/** Con movimiento reducido no hay animaciones: los destacados se van directo. */
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** Cómo entra cada bloque (se asigna UNA vez: cambiarlo reiniciaría su animación). */
type Entry = { mode: 'rise' | 'slide'; delay: number };
/** "Ver menos" de un ítem: plegándose · reemplazado por el "Listo…" · deshaciendo · no se pudo deshacer. */
type LessState = 'leaving' | 'gone' | 'undoing' | 'failed';

/** Feed (la home, `/`) — MODELO v6 del POC ("un hilo, muchos estilos"; mock smarty-poc/docs/feed-mocks/v6-hilo-unico.html):
 *  UN solo hilo central donde los tipos se intercalan con estilos distintos, lo más nuevo primero. La MEZCLA la arma el
 *  server (api.feed; hoy server/src/feedFake.ts): el primer lugar es SIEMPRE la siguiente mejor acción de aprendizaje
 *  (hero 'next'), las noticias de ligas atraviesan el hilo, los videos van en grilla, el resumen confiesa la mezcla. El
 *  feed es FINITO: "Ver más de antes" lo pide el chico (nada de scroll infinito) y termina en "Estás al día". Lo fresco
 *  entra POR ARRIBA solo cuando el chico toca la píldora "N novedades ↑". "Ver menos" es reversible (api.feedLess).
 *  El dial de animación (calmo/normal/vivo) lo fija el padre y llega en cada respuesta (data-motion en la raíz).
 *  Contenedor puro: los bloques son componentes por props. Respeta los on-off del padre (el server ya no manda lo apagado;
 *  lib/visibility es la red de seguridad visual). ARRIBA del hilo, la zona PINNEADA de destacados (tanda F2,
 *  lib/highlights.ts): hoy, "X quiere contactarse con vos" (api.requests(), Aceptar / "Ahora no" ahí mismo). Junto al
 *  saludo, el botón de DEMO "Simular NPCs" (regla 9; solo con Amigos prendido): el server prepara una ráfaga de noticias
 *  y aparece la píldora. */
export function FeedPage() {
  const user = useUser();
  const go = useNavigate();
  const features = useFeatures();
  const amigosOn = features?.amigos === true;
  const reduced = useReducedMotion();
  const sched = useSchedules(); // hora del server + zona de la familia: el subtítulo dice lo mismo que la edición
  const view = useRef<HTMLElement>(null);

  const [items, setItems] = useState<FeedItem[] | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [next, setNext] = useState<string | null>(null);
  /** Páginas cargadas (la píldora solo toca el cursor si el chico no pidió más que la primera). */
  const pagesRef = useRef(0);
  /** Los ids de la última PRIMERA página que mandó el server (la píldora suelta lo que de ahí ya no viene). */
  const page1Ids = useRef<ReadonlySet<string>>(new Set());
  const [motion, setMotion] = useState<FeedMotion>('normal');
  const eff = effectiveMotion(motion, reduced);
  const [error, setError] = useState(false);
  const [more, setMore] = useState<'idle' | 'busy' | 'failed'>('idle');
  const autoRun = useRef(0);
  /** El auto-relleno anti-flags es solo de la primera página: cuando el chico pide "Ver más de antes", se apaga. */
  const autoArmed = useRef(true);
  const [streak, setStreak] = useState<number | null>(null);

  /** Cómo entra cada bloque y la "generación" de su lugar (sube al deshacer un "ver menos": la card vuelve a entrar). */
  const entries = useRef(new Map<string, Entry>());
  const gens = useRef(new Map<string, number>());
  const stamp = (list: readonly FeedItem[], mode: Entry['mode'], step: number) =>
    list.forEach((it, i) => entries.current.set(it.id, { mode, delay: Math.min(i, STAGGER_CAP) * step }));
  /** Noticias recién entradas por la píldora (variante "fresh": anillo suave). */
  const [freshNews, setFreshNews] = useState<ReadonlySet<string>>(() => new Set());

  /* ---------- píldora "N novedades ↑" ---------- */
  /** `count` null = genérica (el cierre de liga). */
  const [pill, setPill] = useState<{ count: number | null } | null>(null);
  const [pillBusy, setPillBusy] = useState(false);

  /* ---------- "ver menos" ---------- */
  const [less, setLess] = useState<ReadonlyMap<string, LessState>>(() => new Map());
  const lessRef = useRef(less);
  lessRef.current = less;
  const lessTimers = useRef<number[]>([]);

  /* ---------- botón de demo ---------- */
  const [npc, setNpc] = useState<{ busy: boolean; note: string | null; failed: boolean }>({ busy: false, note: null, failed: false });
  const noteTimer = useRef<number>(undefined);
  useEffect(() => () => {
    window.clearTimeout(noteTimer.current);
    lessTimers.current.forEach((t) => window.clearTimeout(t));
  }, []);

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

  /* ---------- el hilo ---------- */
  /** Primera página (de cero): la del arranque y "Reintentar". */
  const load = () => {
    setError(false);
    api.feed().then((r) => {
      entries.current = new Map();
      gens.current = new Map();
      stamp(r.items, 'rise', STAGGER.first);
      autoRun.current = 0;
      autoArmed.current = true;
      pagesRef.current = 1;
      page1Ids.current = new Set(r.items.map((it) => it.id));
      setItems(r.items); setNext(r.next); setMotion(r.motion ?? 'normal');
      setFreshNews(new Set()); setLess(new Map()); setMore('idle');
    }, () => setError(true));
  };
  useEffect(load, []);

  // La racha, sin presión (chip junto al saludo).
  useEffect(() => {
    let alive = true;
    api.progress().then((p) => { if (alive) setStreak(p.streakDays); }, () => { /* sin dato: sin chip */ });
    return () => { alive = false; };
  }, []);

  /** "Ver más de antes" (lo pide el chico) o el auto-relleno de la primera página. */
  const loadMore = async (auto = false) => {
    const cursor = next;
    if (!cursor || more === 'busy') return;
    if (!auto) autoArmed.current = false;
    setMore('busy');
    try {
      const r = await api.feed(cursor);
      const have = new Set((itemsRef.current ?? []).map((it) => it.id));
      const add = r.items.filter((it) => !have.has(it.id));
      stamp(add, 'rise', STAGGER.more);
      pagesRef.current++;
      setItems((cur) => [...(cur ?? []), ...add]);
      setNext(r.next); setMotion(r.motion ?? 'normal'); setMore('idle');
    } catch { setMore('failed'); }
  };

  // Lo que dejan ver los flags (red de seguridad visual). Si la PRIMERA página aporta menos de MIN_VISIBLE, se pide la
  // siguiente sola; las demás las pide el chico.
  const visible = items ? items.filter((it) => feedItemVisible(it, features)) : null;
  // El hero 'next' sale del hilo y entra a la zona Destacado (pedido 14-oct); lo vivo queda arriba del hilo,
  // o sea DEBAJO de la zona.
  const heroIt = visible?.find((it) => it.kind === 'next');
  const shown = visible ? visible.filter((it) => it.kind !== 'next') : null;
  const shownCount = shown?.length ?? null;
  useEffect(() => {
    if (shownCount === null || !autoArmed.current || shownCount >= MIN_VISIBLE || !next || more === 'busy' || autoRun.current >= AUTO_MAX) return;
    autoRun.current++;
    void loadMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownCount, next, more]);

  /* ---------- lo fresco entra cuando el chico toca la píldora ---------- */
  const takePill = async () => {
    if (!pill || pillBusy) return;
    const was = pill;
    setPillBusy(true);
    setPill(null);
    view.current?.scrollTo({ top: 0, behavior: eff === 'calmo' ? 'auto' : 'smooth' });
    try {
      const r = await api.feed();
      const { items: merged, added } = mergeFresh(itemsRef.current ?? [], r.items, page1Ids.current, new Set(lessRef.current.keys()));
      page1Ids.current = new Set(r.items.map((it) => it.id));
      stamp(added, 'slide', STAGGER.fresh);
      setFreshNews((s) => new Set([...s, ...added.filter(isNews).map((it) => it.id)]));
      setItems(merged);
      if (pagesRef.current <= 1) setNext(r.next);
      setMotion(r.motion ?? 'normal');
    } catch { setPill(was); } // queda para reintentar
    setPillBusy(false);
  };
  // El cierre de liga (Ligas dispara el evento) mete noticias en el feed: píldora genérica, no entran solas.
  useEffect(() => {
    const closed = () => setPill({ count: null });
    window.addEventListener(LEAGUE_WEEK_CLOSED, closed);
    return () => window.removeEventListener(LEAGUE_WEEK_CLOSED, closed);
  }, []);

  // Botón de demo: el server prepara la ráfaga; acá NO se refetchea el hilo: aparece la píldora con cuántas esperan.
  const simulateNpcs = async () => {
    if (npc.busy) return;
    window.clearTimeout(noteTimer.current);
    setNpc({ busy: true, note: null, failed: false });
    let added: number;
    try { ({ added } = await api.simulateNpcs()); } catch { setNpc({ busy: false, note: null, failed: true }); return; }
    if (added > 0) setPill((p) => ({ count: p && p.count === null ? null : (p?.count ?? 0) + added }));
    setNpc({ busy: false, note: added > 0 ? `+${added} ${added === 1 ? 'novedad espera' : 'novedades esperan'} arriba` : 'Esta vez no hubo novedades', failed: false });
    noteTimer.current = window.setTimeout(() => setNpc((s) => ({ ...s, note: null })), NOTE_MS);
  };

  /* ---------- "ver menos" (reversible) ---------- */
  const setLessOf = (id: string, st: LessState | null) =>
    setLess((m) => { const n = new Map(m); if (st) n.set(id, st); else n.delete(id); return n; });
  // La card se pliega y la reemplaza el "Listo… Deshacer". Si el server no lo pudo guardar, la card vuelve.
  const hide = (id: string) => {
    if (lessRef.current.has(id)) return;
    setLessOf(id, 'leaving');
    const t = window.setTimeout(() => setLess((m) => (m.get(id) === 'leaving' ? new Map(m).set(id, 'gone') : m)), LEAVE_MS);
    lessTimers.current.push(t);
    api.feedLess(id).then((r) => { if (!r.ok) throw new Error('no se guardó'); }).catch(() => {
      window.clearTimeout(t);
      setLessOf(id, null);
    });
  };
  const undo = async (id: string) => {
    if (lessRef.current.get(id) === 'undoing') return;
    setLessOf(id, 'undoing');
    try {
      const r = await api.feedLess(id, true);
      if (!r.ok) throw new Error('no se deshizo');
      entries.current.set(id, { mode: 'rise', delay: 0 });
      gens.current.set(id, (gens.current.get(id) ?? 0) + 1);
      setLessOf(id, null);
    } catch { setLessOf(id, 'failed'); }
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

  // El contenido se abre en el lector / reproductor (/buscar/…), con "volver" al Feed.
  const back = { backTo: '/', backLabel: '‹ Feed' };
  const h = {
    video: (v: VideoResult) => go(`/buscar/video/${v.id}`, { state: back }),
    article: (url: string) => go(`/buscar/articulo/${encodeURIComponent(url)}`, { state: back }),
    route: (courseId: string) => go(`/aprender?ruta=${encodeURIComponent(courseId)}`), // W3: abre la ruta en Learn
    league: () => go('/ligas'),
  };
  /** La noticia es del propio chico (su medalla del cierre de liga). */
  const isMine = (nick: string) => !!user?.nick && nick === user.nick;

  /** Cada kind con su estilo de bloque (mock v6): next → B · videos → D · summary → E · lo de ligas → C (noticia) ·
   *  el resto → A (card estándar). */
  const block = (it: FeedItem): ReactNode => {
    const off = () => hide(it.id);
    switch (it.kind) {
      // El hero vive DENTRO de la zona Destacado (pedido 14-oct): este case queda solo por exhaustividad.
      case 'next': return <FeedNextCard it={it} onGo={(to) => go(to)} />;
      case 'videos': return <FeedVideoShelf it={it} onOpen={h.video} onAll={() => go(shelfAllUrl(it))} />;
      case 'summary': return <FeedSummaryCard it={it} />;
      case 'video': return <FeedVideoCard it={it} onOpen={h.video} onLess={off} />;
      case 'article': return <FeedArticleCard it={it} onOpen={h.article} onLess={off} />;
      case 'route': return <FeedRouteCard it={it} onOpen={h.route} onLess={off} />;
      case 'league': return <FeedNewsCard it={it} fresh={freshNews.has(it.id)} onReact={react} onLeague={h.league} onLess={off} />;
      case 'friend':
        return isNews(it)
          ? <FeedNewsCard it={it} mine={isMine(it.friend.nick)} fresh={freshNews.has(it.id)} onReact={react} onLeague={h.league} onLess={off} />
          : <FriendEventCard it={it} onReact={react} onLess={off} />;
    }
  };

  return (
    <section className="view" id="v-feed" ref={view} data-motion={eff}>
      <div className="hf-col">
        <FeedHead name={user?.name ?? ''} day={daypartLine(serverDate(sched), sched.tz)} streak={streak}
          demo={amigosOn ? <SimulateNpcsChip busy={npc.busy} note={npc.note} failed={npc.failed} onClick={() => void simulateNpcs()} /> : undefined} />
        {/* La zona Destacado (pedido 14-oct): el hero "tu siguiente paso" + las solicitudes. La píldora y lo que
            entra con Simular NPCs van DEBAJO de esta zona (el hero ya no está en el hilo). */}
        {(heroIt || (amigosOn && pins.length > 0)) && (
          <PinnedZone hero={heroIt && <FeedNextCard it={heroIt} onGo={(to) => go(to)} />}
            items={amigosOn ? pins : []} onAccept={(p) => void acceptPin(p)} onDecline={(p) => void declinePin(p)} />
        )}
        {/* la píldora: pegada arriba del hilo mientras se scrollea; región viva (anuncia que hay novedades) */}
        <div className="hf-pillbar" aria-live="polite">
          {pill && <NewsPill count={pill.count} busy={pillBusy} onClick={() => void takePill()} />}
        </div>
        {error && (
          <div className="hf-empty">
            <p>No pude cargar las novedades ahora mismo.</p>
            <button type="button" className="hf-cta" onClick={load}>Reintentar</button>
          </div>
        )}
        {!items && !error && <FeedSkeleton />}
        {shown && (
          <div className="hf-thread">
            {shown.length === 0 && (more === 'busy' || next) ? <FeedSkeleton /> : shown.map((it) => {
              const e = entries.current.get(it.id);
              const st = less.get(it.id);
              return (
                <div key={`${it.id}:${gens.current.get(it.id) ?? 0}`} data-id={it.id} data-kind={it.kind}
                  className={`hf-slot ${e?.mode === 'slide' ? 'hf-in' : 'hf-anim'}${st === 'leaving' ? ' is-leaving' : ''}`}
                  style={e?.delay ? { animationDelay: `${e.delay}ms` } : undefined}>
                  {st && st !== 'leaving' ? <FeedLessCard state={st} onUndo={() => void undo(it.id)} /> : block(it)}
                </div>
              );
            })}
          </div>
        )}
        {shown && <FeedEndCap more={!!next} state={more} onMore={() => void loadMore()} />}
      </div>
    </section>
  );
}
