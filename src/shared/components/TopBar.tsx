import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { EC_CHANGED_EVT, api, setActingUser } from '../../api';
import type { AssignedLeague, Friend, FriendRequest, UserInfo } from '../../api/types';
import { useUser } from '../../hooks/user';
import { chatFriendsChanged, openChat, useChatDock } from '../../sections/friends/lib/chatDock';
import { useFeatures } from '../../sections/parent/lib/features';
import { useSchedules } from '../../sections/parent/lib/schedules';
import { wallClock } from '../lib/zonedClock';
import { Avatar, lookFor } from './Avatar';
import { IcBell, IcCheck, IcNavLeagues, IcSwap } from './icons';
import { MyAvatar } from './ProfileCard';

/** Barra superior persistente estilo Gran Turismo 7 (pedido 12-oct): posición de liga SIEMPRE visible
 *  (y es el link a /ligas, que salió del menú), Energy Coins, fecha y hora compactas, el SWITCH DE USUARIO (línea
 *  14-oct, demo: chip con el usuario activo → popover con los usuarios; elegir otro recarga la app) y la campana de
 *  notificaciones (solicitudes de amistad con Aceptar/Ahora no + conversaciones sin leer del dock).
 *  Respeta los apagados del padre: sin Ligas no hay chip de liga, sin Tienda no se nombra la moneda,
 *  sin Amigos no hay campana — al CHICO: con un adulto activo, useFeatures() ya da todo prendido (los candados son del
 *  dependiente, docs/USUARIOS.md §4). Datos: carga al montar, al volver el foco y cada 60 s; escucha el evento
 *  del cierre de semana (innerith:league-week-closed) para refrescar la liga al instante. */

const CLOCK_MS = 30_000;
const POLL_MS = 60_000;
const LEAGUE_CLOSED_EVT = 'innerith:league-week-closed';

const two = (n: number) => String(n).padStart(2, '0');
/** Fecha y hora EN LA ZONA DE LA FAMILIA (la misma que rige franjas y Feed); sin tz —o zona que este
 *  navegador no conoce—, la local, igual que wallClock (así hm y fecha nunca se contradicen). */
function clockParts(d: Date, tz?: string | null): { hm: string; date: string; full: string } {
  const w = wallClock(d, tz);
  const opts = { weekday: 'short', day: 'numeric', month: 'short' } as const;
  let date: string, full: string;
  try {
    date = d.toLocaleDateString('es-AR', { ...opts, timeZone: tz || undefined }).replace(/\.|,/g, '');
    full = d.toLocaleString('es-AR', { timeZone: tz || undefined });
  } catch {
    date = d.toLocaleDateString('es-AR', opts).replace(/\.|,/g, '');
    full = d.toLocaleString('es-AR');
  }
  return { hm: `${two(w.hour)}:${two(w.minute)}`, date, full };
}

/** Los popovers de la barra (campana y usuarios) se cierran con Esc o con un click afuera de su envoltorio. */
function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, setOpen: (v: boolean) => void) {
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open, ref, setOpen]);
}

export function TopBar() {
  const user = useUser();
  const features = useFeatures();
  const sched = useSchedules(); // tz de la familia + delta con el server, para el reloj
  const dock = useChatDock();
  const [league, setLeague] = useState<AssignedLeague | null>(null);
  const [ec, setEc] = useState<number | null>(null);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  // Switch de usuario (demo): los usuarios se piden recién al abrir el popover por primera vez y quedan en estado.
  const [usersOpen, setUsersOpen] = useState(false);
  const [users, setUsers] = useState<UserInfo[] | null>(null);
  const [usersFailed, setUsersFailed] = useState(false);
  const usersRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);

  // Con un adulto activo, useFeatures() ya devuelve todo prendido (los candados son del chico).
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

  // La campana y el popover de usuarios se cierran con Esc o clickeando afuera.
  useDismiss(open, popRef, setOpen);
  useDismiss(usersOpen, usersRef, setUsersOpen);

  // Los usuarios del demo: al abrir el popover si todavía no están (si falló, el próximo open reintenta).
  useEffect(() => {
    if (!usersOpen || users) return;
    let on = true;
    setUsersFailed(false);
    api.users().then((r) => { if (on) setUsers(r.users); }, () => { if (on) setUsersFailed(true); });
    return () => { on = false; };
  }, [usersOpen, users]);

  const unreadWins = dock.wins.filter((w) => w.unread > 0);
  const nickOf = (id: string) => friends.find((f) => f.id === id)?.nick ?? 'Un amigo';
  const notis = (amigosOn ? requests.length : 0) + (amigosOn ? unreadWins.length : 0);
  const { hm, date, full } = clockParts(new Date(now.getTime() + sched.offset), sched.tz);

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
      <span className="tb-clock" title={full}>
        <b>{hm}</b><span className="tb-date">{date}</span>
      </span>
      {user && (
        /* Switch de usuario (DEMO, docs/USUARIOS.md §2): elegir a otro guarda su id y recarga la app desde el Feed. */
        <div className="tb-userwrap" ref={usersRef}>
          <button className="tb-user" type="button" aria-expanded={usersOpen} aria-haspopup="dialog" aria-label="Cambiar de usuario"
            title={`${user.name}: cambiar de usuario`} onClick={() => setUsersOpen((v) => !v)}>
            <MyAvatar name={user.name} size={24} />
            <span className="tb-uname">{user.name}</span>
            <IcSwap className="tb-uswap" />
          </button>
          {usersOpen && (
            <div className="tb-pop tb-upop" role="dialog" aria-label="Usuarios">
              {!users && !usersFailed && <p className="tb-empty">Cargando…</p>}
              {!users && usersFailed && <p className="tb-empty">No pude traer los usuarios. Probá de nuevo en un ratito.</p>}
              {users?.map((u) => {
                const me = u.id === user.id;
                const tag = u.kind === 'child' ? `${u.age} años` : 'Adulto';
                return (
                  <button key={u.id} className={`tb-urow${me ? ' is-on' : ''}`} type="button" aria-current={me ? 'true' : undefined}
                    aria-label={me ? `${u.name}, ${tag} (usuario activo)` : `Cambiar a ${u.name}, ${tag}`}
                    onClick={() => (me ? setUsersOpen(false) : setActingUser(u.id))}>
                    {me ? <MyAvatar name={u.name} size={34} /> : <Avatar name={u.name} color="#9AA5C4" look={lookFor(u.nick)} size={34} />}
                    <span className="tb-utx"><b>{u.name}</b><small>{tag}</small></span>
                    {me && <IcCheck className="tb-ucheck" aria-hidden="true" />}
                  </button>
                );
              })}
              <p className="tb-unote">Cambiar de usuario (demo)</p>
            </div>
          )}
        </div>
      )}
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
