import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../api';
import type { Friend, FriendRequest } from '../../../api/types';
import { FriendRow } from '../cards/FriendCard';
import { RequestCard } from '../cards/RequestCard';
import { FriendProfile } from '../components/FriendProfile';
import { chatFriendsChanged, openChat, useChatDock } from '../lib/chatDock';

/** El panel de detalle se va (fade/slide) ANTES de que la lista vuelva a expandirse. */
const PANEL_OUT_MS = 200;
/** Lo que tarda en plegarse una solicitud aceptada o rechazada. */
const REQ_OUT_MS = 300;
/** Con movimiento reducido no hay animaciones: los cambios son directos (sin esperar salidas). */
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
const plural = (n: number) => `${n} ${n === 1 ? 'amigo' : 'amigos'}`;

/** Amigos (VISION §8): la lista a ancho completo, las solicitudes de amistad arriba y el detalle de un amigo en un panel
 *  que entra con transición. La mensajería NO vive acá: el globo de cada fila (y "Mandar mensaje" del detalle) abre la
 *  conversación en el dock de mensajes del Layout (containers/ChatDock, estilo LinkedIn), que sigue abierto entre
 *  secciones. Los amigos son NPCs del server (friendsFake): lo que Ian escribe pasa por la moderación en tiempo real. */
export function FriendsPage() {
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [reqBusy, setReqBusy] = useState<string | null>(null);
  const [reqOut, setReqOut] = useState<string[]>([]);
  /** Amigo recién aceptado: su fila entra con una animación suave. */
  const [fresh, setFresh] = useState<string | null>(null);

  /** Detalle (ⓘ): con `closing` el panel se está yendo y la lista todavía no se expandió. */
  const [detail, setDetail] = useState<{ id: string; closing: boolean } | null>(null);
  const [profile, setProfile] = useState<Friend | null>(null);

  /** Las conversaciones con ventana en el dock (el globo de su fila queda marcado). */
  const { wins } = useChatDock();
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const load = useCallback(() => {
    setLoadErr(false);
    Promise.all([api.friends(), api.requests()]).then(
      ([f, r]) => { setFriends(f.friends); setRequests(r.requests); },
      () => setLoadErr(true),
    );
  }, []);
  useEffect(load, [load]);

  /* ---------- solicitudes ---------- */
  const dropRequest = (id: string) => {
    if (reducedMotion()) { setRequests((cur) => cur.filter((x) => x.id !== id)); return; }
    setReqOut((cur) => [...cur, id]);
    later(() => {
      setRequests((cur) => cur.filter((x) => x.id !== id));
      setReqOut((cur) => cur.filter((x) => x !== id));
    }, REQ_OUT_MS);
  };
  const accept = async (r: FriendRequest) => {
    setReqBusy(r.id);
    try {
      const { friend } = await api.acceptRequest(r.id);
      setFriends((cur) => [friend, ...(cur ?? []).filter((f) => f.id !== friend.id)]);
      setFresh(friend.id);
      dropRequest(r.id);
      chatFriendsChanged(); // el dock suma al amigo nuevo a su lista de conversaciones
    } catch { /* la tarjeta queda para reintentar */ }
    setReqBusy(null);
  };
  const decline = async (r: FriendRequest) => {
    setReqBusy(r.id);
    try { await api.declineRequest(r.id); dropRequest(r.id); } catch { /* queda para reintentar */ }
    setReqBusy(null);
  };
  const allOut = requests.length > 0 && requests.every((r) => reqOut.includes(r.id));

  /* ---------- detalle (ⓘ) ---------- */
  useEffect(() => {
    if (!detail) return;
    let alive = true;
    api.friend(detail.id).then((f) => { if (alive) setProfile(f); }, () => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id]);
  const closeDetail = () => {
    if (!detail || detail.closing) return;
    if (reducedMotion()) { setDetail(null); return; }
    setDetail({ id: detail.id, closing: true });
    later(() => setDetail((d) => (d?.closing ? null : d)), PANEL_OUT_MS);
  };
  const toggleDetail = (id: string) => {
    if (detail?.id === id && !detail.closing) closeDetail();
    else setDetail({ id, closing: false });
  };
  // Mientras llega el perfil fresco del server, el panel muestra el de la lista (son los mismos datos).
  const shown = detail ? (profile?.id === detail.id ? profile : friends?.find((f) => f.id === detail.id) ?? null) : null;

  return (
    <section className="view" id="v-friends">
      <h2 className="h2">Amigos</h2>
      <p className="lede">{loadErr ? 'No pude cargar a tus amigos ahora mismo.' : friends ? plural(friends.length) : ' '}</p>
      {loadErr && <button className="fretry" type="button" onClick={load}>Reintentar</button>}

      {requests.length > 0 && (
        <section className={`freqs${allOut ? ' out' : ''}`} aria-label="Solicitudes de amistad">
          <div className="freqs-clip">
            <h3 className="lbl">Solicitudes de amistad</h3>
            {requests.map((r) => (
              <RequestCard key={r.id} r={r} busy={reqBusy === r.id} leaving={reqOut.includes(r.id) && !allOut}
                onAccept={() => void accept(r)} onDecline={() => void decline(r)} />
            ))}
          </div>
        </section>
      )}

      <div className={`fwrap${detail ? ' split' : ''}`}>
        <div className="flist">
          {friends?.map((f) => (
            <FriendRow key={f.id} f={f} fresh={fresh === f.id} infoOpen={detail?.id === f.id && !detail.closing} chatOpen={wins.some((w) => w.id === f.id)}
              onInfo={() => toggleDetail(f.id)} onMsg={() => openChat(f.id)} />
          ))}
        </div>
        {detail && shown && (
          <aside className={`fpanel${detail.closing ? ' out' : ''}`} aria-label={`Información de ${shown.nick}`}>
            <FriendProfile key={shown.id} f={shown} onClose={closeDetail} onMessage={() => openChat(shown.id)} />
          </aside>
        )}
      </div>
    </section>
  );
}
