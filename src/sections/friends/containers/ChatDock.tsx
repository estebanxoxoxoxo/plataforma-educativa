import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../../../api';
import type { Friend } from '../../../api/types';
import { useUser } from '../../../hooks/user';
import { refreshFeatures, useFeatures } from '../../parent/lib/features';
import { ChatListBar } from '../components/ChatListBar';
import { ChatWindow, type ChatEntry } from '../components/ChatWindow';
import { FriendProfileSheet } from '../components/FriendProfileSheet';
import {
  DOCK, bumpUnread, chatArrived, closeChat, minimizeChat, openChat, resetChatDock, setChatListOpen, setDockWidth, toggleChatList,
  useChatDock, type DockWin,
} from '../lib/chatDock';

/** Cada cuánto cada ventana (abierta o minimizada) pregunta por las respuestas nuevas de su amigo. */
const POLL_MS = 1500;
/** Mientras Ian espera que acepten una solicitud suya (Buscar → Personas), cada cuánto el dock mira la lista de amigos. */
const AWAIT_POLL_MS = 2000;

/** Un 403 de /api/friends* = la familia apagó Amigos desde otro lado: se vuelve a preguntar por los on-off y el dock
 *  desaparece solo (fail-closed). Una vez cada 3 s como mucho, aunque haya varias ventanas sondeando. */
let lastAsk = 0;
function onApiError(e: unknown) {
  if (e instanceof ApiError && e.status === 403 && Date.now() - lastAsk > 3000) { lastAsk = Date.now(); void refreshFeatures(); }
}

/** Dock de mensajería estilo LinkedIn (VISION §8; pedido de Esteban): vive en el Layout, así que está en TODA la app y
 *  sobrevive al cambio de sección. Abajo a la derecha: la barra «Mensajes» (minimizada por defecto) y, a su izquierda,
 *  las ventanas de conversación —cada apertura nueva entra pegada a la barra, la fila crece hacia la izquierda—.
 *  DESDE EL 12-OCT LOS AMIGOS VIVEN ACÁ (Amigos dejó de ser sección): el perfil de cada amigo se abre desde su ventana
 *  (ⓘ o su nombre) en una hoja con racha, liga, cursos en común y "Regalale ropa"; la lista lleva a "Buscar personas";
 *  y cuando alguien acepta una solicitud que Ian mandó desde Buscar → Personas, su conversación llega sola, minimizada.
 *  Con Amigos apagado por la familia (o mientras no se sabe: patrón hide-until-known de useFeatures) NO existe; al
 *  apagarse se cierra todo (al chico: con un adulto activo, useFeatures da todo prendido). En Familia (/familia/*, la ex
 *  Zona de padres) no se muestra (las ventanas siguen vivas, ocultas). */
export function ChatDock() {
  const features = useFeatures();
  const off = features?.amigos === false;
  useEffect(() => { if (off) resetChatDock(); }, [off]);
  return features?.amigos === true ? <Dock /> : null;
}

function Dock() {
  const dock = useChatDock();
  const user = useUser();
  const go = useNavigate();
  const shopOn = useFeatures()?.tienda === true;
  const { pathname } = useLocation();
  const parentZone = pathname === '/familia' || pathname.startsWith('/familia/');
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [failed, setFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLButtonElement>(null);

  // Los amigos aceptados (el recién aceptado primero; las solicitudes van a la zona pinneada del Feed). Se vuelven a pedir
  // al desplegar la lista y cuando cambia el grafo social (friendsRev). Una lectura vieja no pisa a una más nueva.
  const seq = useRef(0);
  const load = useCallback(() => {
    const n = ++seq.current;
    api.friends().then(
      (r) => { if (n === seq.current) { setFriends(r.friends); setFailed(false); } },
      (e) => { onApiError(e); if (n === seq.current) setFailed(true); },
    );
  }, []);
  useEffect(() => { load(); }, [load, dock.friendsRev]);
  useEffect(() => { if (dock.listOpen) load(); }, [dock.listOpen, load]);

  // Solicitudes que Ian mandó (Buscar → Personas): mientras alguna espera, se mira la lista seguido; cuando el chico
  // aparece como amigo, su conversación entra sola, minimizada, y su saludo llega como no leído (chatArrived).
  const waiting = dock.awaiting.length > 0;
  useEffect(() => {
    if (!waiting) return;
    const t = window.setInterval(load, AWAIT_POLL_MS);
    return () => window.clearInterval(t);
  }, [waiting, load]);
  useEffect(() => {
    if (!friends) return;
    for (const id of dock.awaiting) if (friends.some((f) => f.id === id)) chatArrived(id);
  }, [friends, dock.awaiting]);

  /* ---------- el perfil de un amigo (hoja), desde su ventana ---------- */
  const [profileId, setProfileId] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Friend | null>(null);
  const closeProfile = useCallback(() => setProfileId(null), []);
  const openProfile = (id: string) => {
    setProfileId(id);
    setFresh(null);
    // El perfil fresco (racha, ropa puesta) llega del server; mientras tanto se ve el de la lista (son los mismos datos).
    api.friend(id).then((f) => setFresh(f), onApiError);
  };
  // Cambiar de sección (p. ej. "Regalale ropa" → la Tienda) la cierra.
  useEffect(() => { setProfileId(null); }, [pathname]);

  // Una ventana de alguien que no está en la lista (p. ej. recién aceptado): una lectura más; si con la lista nueva
  // sigue sin estar (ya no es amigo), su ventana se cierra.
  const asked = useRef(new Map<string, Friend[]>());
  useEffect(() => {
    if (!friends) return;
    for (const w of dock.wins) {
      if (friends.some((f) => f.id === w.id)) { asked.current.delete(w.id); continue; }
      const at = asked.current.get(w.id);
      if (!at) { asked.current.set(w.id, friends); load(); }
      else if (at !== friends) { asked.current.delete(w.id); closeChat(w.id); }
    }
  }, [friends, dock.wins, load]);

  // El ancho disponible (del borde del menú al borde derecho) lo reparte el store: antes de pintar y con cada cambio.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => setDockWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Cerrar una ventana que tenía el foco lo deja en la barra «Mensajes» (no se pierde en la página). */
  const close = (id: string, hadFocus: boolean) => { closeChat(id); if (hadFocus) bar.current?.focus(); };

  // Las medidas salen de DOCK (lib/chatDock.ts): el reparto y el dibujo usan los mismos números. La ventana solo se
  // angosta si ni una sola entra al lado de la barra (pantallas muy chicas).
  const win = dock.width > 0 ? Math.max(DOCK.winMin, Math.min(DOCK.win, dock.width - DOCK.bar - DOCK.gap)) : DOCK.win;
  const vars = {
    '--fdk-gap': `${DOCK.gap}px`, '--fdk-bar': `${DOCK.bar}px`, '--fdk-win': `${win}px`,
    '--fdk-minw': `${DOCK.minPref}px`, '--fdk-minmin': `${DOCK.minMin}px`,
  } as CSSProperties;
  const byId = new Map((friends ?? []).map((f) => [f.id, f]));
  // La hoja muestra el perfil fresco si ya llegó; si no, el de la lista. Si ese amigo ya no está (o su ventana se cerró),
  // no hay hoja.
  const listed = profileId ? byId.get(profileId) : undefined;
  const profile = listed && dock.wins.some((w) => w.id === profileId) ? (fresh?.id === profileId ? fresh : listed) : null;
  const findPeople = () => { setChatListOpen(false); go('/buscar?tab=people'); };

  return (
    <div ref={root} className="fdk" hidden={parentZone} style={vars}>
      {dock.wins.map((w) => {
        const f = byId.get(w.id);
        return f ? (
          <Conversation key={w.id} f={f} win={w} hidden={dock.hidden.includes(w.id)}
            focusKey={dock.focus?.id === w.id ? dock.focus.n : 0} onClose={close} onProfile={() => openProfile(w.id)} />
        ) : null;
      })}
      <ChatListBar me={user?.name ?? ''} friends={friends} failed={failed} open={dock.listOpen} wins={dock.wins} hidden={dock.hidden}
        barRef={bar} onToggle={toggleChatList} onPick={openChat} onRetry={load} onFind={findPeople} />
      {profile && (
        <FriendProfileSheet key={profile.id} f={profile} onClose={closeProfile}
          onMessage={() => { closeProfile(); openChat(profile.id); }}
          onGift={shopOn ? () => { closeProfile(); go(`/tienda?regalar=${encodeURIComponent(profile.id)}#ropa`); } : undefined} />
      )}
    </div>
  );
}

/** Una conversación del dock: trae el hilo y, mientras la ventana exista (abierta O minimizada), sondea lo nuevo; lo que
 *  llega con la ventana minimizada suma a su badge. Mandar pasa por la moderación en tiempo real del server (audio 24):
 *  si no sale, el mensaje NUNCA entra al hilo, el Moderador explica por qué y el texto queda en el campo. */
function Conversation({ f, win, hidden, focusKey, onClose, onProfile }: {
  f: Friend; win: DockWin; hidden: boolean; focusKey: number; onClose: (id: string, hadFocus: boolean) => void; onProfile: () => void;
}) {
  const id = f.id;
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  /** Lo que ya está en pantalla (para contar como no leído solo lo de verdad nuevo). */
  const shown = useRef<ChatEntry[]>([]);
  useLayoutEffect(() => { shown.current = entries; }, [entries]);
  const localSeq = useRef(0);

  useEffect(() => {
    let alive = true;
    api.thread(id).then((t) => {
      if (!alive) return;
      const ids = new Set(t.messages.map((m) => m.id));
      setEntries((cur) => [...t.messages, ...cur.filter((e) => !ids.has(e.id))]);
      setTyping(t.typing);
    }, onApiError);
    const poll = window.setInterval(() => {
      api.newMessages(id).then((r) => {
        if (!alive) return;
        setTyping(r.typing);
        const fresh = r.messages.filter((m) => !shown.current.some((x) => x.id === m.id));
        if (!fresh.length) return;
        setEntries((cur) => [...cur, ...fresh.filter((m) => !cur.some((x) => x.id === m.id))]);
        bumpUnread(id, fresh.length);
      }, onApiError);
    }, POLL_MS);
    return () => { alive = false; window.clearInterval(poll); };
  }, [id]);

  const note = (from: 'mod' | 'sys', text: string) => {
    const e: ChatEntry = { id: `${from}-${++localSeq.current}`, from, text };
    setEntries((cur) => [...cur, e]);
  };
  const send = async (text: string): Promise<boolean> => {
    setSending(true);
    try {
      const r = await api.sendMessage(id, text);
      if (!live.current) return r.status === 'ok';
      if (r.status === 'ok') { setEntries((cur) => (cur.some((x) => x.id === r.msg.id) ? cur : [...cur, r.msg])); return true; }
      note('mod', r.notice);
      return false;
    } catch (e) {
      onApiError(e);
      if (live.current) note('sys', 'No pude mandar tu mensaje. Probá de nuevo en un ratito.');
      return false;
    } finally {
      if (live.current) setSending(false);
    }
  };

  return (
    <ChatWindow f={f} entries={entries} typing={typing} sending={sending} minimized={win.min} unread={win.unread} hidden={hidden}
      focusKey={focusKey} onSend={send} onMinimize={() => minimizeChat(id)} onRestore={() => openChat(id)}
      onClose={(had) => onClose(id, had)} onProfile={onProfile} />
  );
}
