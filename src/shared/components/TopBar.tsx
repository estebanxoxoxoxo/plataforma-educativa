import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EC_CHANGED_EVT, api } from '../../api';
import type { AssignedLeague, Friend, FriendRequest } from '../../api/types';
import { chatFriendsChanged, openChat, useChatDock } from '../../sections/friends/lib/chatDock';
import { useFeatures } from '../../sections/parent/lib/features';
import { Avatar, lookFor } from './Avatar';
import { IcBell, IcNavLeagues } from './icons';

/** Barra superior persistente estilo Gran Turismo 7 (pedido 12-oct): posición de liga SIEMPRE visible
 *  (y es el link a /ligas, que salió del menú), Energy Coins, fecha y hora compactas, y la campana de
 *  notificaciones (solicitudes de amistad con Aceptar/Ahora no + conversaciones sin leer del dock).
 *  Respeta los apagados del padre: sin Ligas no hay chip de liga, sin Tienda no se nombra la moneda,
 *  sin Amigos no hay campana. Datos: carga al montar, al volver el foco y cada 60 s; escucha el evento
 *  del cierre de semana (innerith:league-week-closed) para refrescar la liga al instante. */

const CLOCK_MS = 30_000;
const POLL_MS = 60_000;
const LEAGUE_CLOSED_EVT = 'innerith:league-week-closed';

const two = (n: number) => String(n).padStart(2, '0');
function clockParts(d: Date): { hm: string; date: string } {
  const date = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\.|,/g, '');
  return { hm: `${two(d.getHours())}:${two(d.getMinutes())}`, date };
}

export function TopBar() {
  const features = useFeatures();
  const dock = useChatDock();
  const [league, setLeague] = useState<AssignedLeague | null>(null);
  const [ec, setEc] = useState<number | null>(null);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);

  const ligasOn = features?.ligas === true;
  const tiendaOn = features?.tienda === true;
  const amigosOn = features?.amigos === true;

  // Con un apagado del padre NO se pide lo apagado (antes salían 403 a consola con Amigos off).
  const load = useCallback(async () => {
    const [lg, pr, rq, fr] = await Promise.allSettled([
      ligasOn ? api.myLeague() : Promise.reject(new Error('off')),
      api.progress(),
      amigosOn ? api.requests() : Promise.reject(new Error('off')),
      amigosOn ? api.friends() : Promise.reject(new Error('off')),
    ]);
    if (!alive.current) return;
    if (lg.status === 'fulfilled') setLeague(lg.value);
    if (pr.status === 'fulfilled') setEc(pr.value.ec);
    setRequests(rq.status === 'fulfilled' ? rq.value.requests : []);
    setFriends(fr.status === 'fulfilled' ? fr.value.friends : []);
  }, [ligasOn, amigosOn]);

  useEffect(() => {
    alive.current = true;
    void load();
    const clock = setInterval(() => setNow(new Date()), CLOCK_MS);
    const poll = setInterval(() => void load(), POLL_MS);
    const wake = () => { if (document.visibilityState === 'visible') void load(); };
    const closed = () => void load();
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener(LEAGUE_CLOSED_EVT, closed);
    window.addEventListener(EC_CHANGED_EVT, closed); // compra/canje/regalo/premio: el ⚡ al instante
    return () => {
      alive.current = false;
      clearInterval(clock); clearInterval(poll);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener(LEAGUE_CLOSED_EVT, closed);
      window.removeEventListener(EC_CHANGED_EVT, closed);
    };
  }, [load]);

  // Cambió el grafo social (se aceptó/rechazó una solicitud en la zona pinneada, en Personas o acá):
  // la campana se refresca al instante en vez de esperar el poll de 60 s.
  const { friendsRev } = dock;
  useEffect(() => { void load(); }, [friendsRev, load]);

  // La campana se cierra con Esc o clickeando afuera.
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);

  const unreadWins = dock.wins.filter((w) => w.unread > 0);
  const nickOf = (id: string) => friends.find((f) => f.id === id)?.nick ?? 'Un amigo';
  const notis = (amigosOn ? requests.length : 0) + (amigosOn ? unreadWins.length : 0);
  const { hm, date } = clockParts(now);

  async function accept(r: FriendRequest) {
    try {
      await api.acceptRequest(r.id);
      chatFriendsChanged();
      setRequests((rs) => rs.filter((x) => x.id !== r.id));
      setOpen(false);
      openChat(r.id);
    } catch { void load(); /* 404 = ya respondida en otro lado: resincronizar saca el ítem */ }
  }
  async function decline(r: FriendRequest) {
    try { await api.declineRequest(r.id); setRequests((rs) => rs.filter((x) => x.id !== r.id)); } catch { void load(); }
  }

  return (
    <header className="topbar">
      {ligasOn && league && (
        <Link className="tb-seg tb-league" to="/ligas" title={`${league.name}: puesto ${league.pos} de ${league.total}. Ver las ligas`}>
          <IcNavLeagues />
          <b>{league.pos}º</b><span className="tb-dim">/{league.total}</span>
          <span className="tb-name">{league.name}</span>
        </Link>
      )}
      {tiendaOn && ec !== null && (
        /* El mismo ⚡ naranja de la billetera de la Tienda, y clickearlo lleva a la Tienda (pedido 12-oct). */
        <Link className="tb-seg tb-ec" to="/tienda" title={`Tenés ${ec.toLocaleString('es-AR')} Energy Coins. Ir a la Tienda`}>
          <span className="tb-bolt" aria-hidden="true">⚡</span><b>{ec.toLocaleString('es-AR')}</b>
        </Link>
      )}
      <span className="tb-spacer" />
      <span className="tb-clock" title={now.toLocaleString('es-AR')}>
        <b>{hm}</b><span className="tb-date">{date}</span>
      </span>
      {amigosOn && (
        <div className="tb-bellwrap" ref={popRef}>
          <button className="tb-bell" type="button" aria-expanded={open} aria-label={notis > 0 ? `Notificaciones: ${notis}` : 'Notificaciones'}
            onClick={() => setOpen((v) => !v)}>
            <IcBell />
            {notis > 0 && <span className="tb-badge" aria-hidden="true">{notis > 9 ? '9+' : notis}</span>}
          </button>
          {open && (
            <div className="tb-pop" role="dialog" aria-label="Notificaciones">
              {requests.length === 0 && unreadWins.length === 0 && <p className="tb-empty">Estás al día ✨</p>}
              {requests.map((r) => (
                <div className="tb-noti" key={r.id}>
                  <Avatar name={r.nick} color={r.color} look={lookFor(r.nick)} />
                  <div className="tb-ntx">
                    <b>{r.nick}</b> quiere contactarse con vos
                    {r.note && <small>«{r.note}»</small>}
                  </div>
                  <div className="tb-nact">
                    <button className="tb-ok" type="button" onClick={() => void accept(r)}>Aceptar</button>
                    <button className="tb-no" type="button" onClick={() => void decline(r)}>Ahora no</button>
                  </div>
                </div>
              ))}
              {unreadWins.map((w) => (
                <button className="tb-noti tb-noti--msg" key={w.id} type="button" onClick={() => { setOpen(false); openChat(w.id); }}>
                  <Avatar name={nickOf(w.id)} color="#9AA5C4" look={lookFor(nickOf(w.id))} />
                  <div className="tb-ntx"><b>{nickOf(w.id)}</b> te escribió · {w.unread} {w.unread === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
