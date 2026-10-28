import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../../api';
import type { EcTx, Friend, MarketItem, Redemption } from '../../../api/types';
import { useUser } from '../../../hooks/user';
import { openAvatarPicker, saveMyLook, useMyIdentity } from '../../../shared/components/ProfileCard';
import { chatFriendsChanged, openChat } from '../../friends/lib/chatDock';
import { useSocial } from '../../friends/lib/social';
import { RewardCard } from '../cards/RewardCard';
import type { WearState } from '../cards/WardrobeCard';
import { BuySheet, type BuyState } from '../components/BuySheet';
import { GiftSheet, type GiftState } from '../components/GiftSheet';
import { HeartInline } from '../components/Heart';
import { MovesView } from '../components/MovesView';
import { RedeemSheet, type SheetState } from '../components/RedeemSheet';
import { RedemptionsView } from '../components/RedemptionsView';
import { StoreSkeleton } from '../components/StoreSkeleton';
import { WalletHero } from '../components/WalletHero';
import { WardrobeSection } from '../components/WardrobeSection';
import { WishlistView } from '../components/WishlistView';
import { byPrice, wishedItems } from '../lib/format';

type StoreData = {
  items: MarketItem[];
  /** Saldo: SIEMPRE el último valor que dio el server (GET /api/market o la respuesta del canje/compra/regalo). */
  ec: number;
  /** null = esa parte no se pudo cargar (la Tienda igual funciona). */
  redemptions: Redemption[] | null;
  tx: EcTx[] | null;
  /** Lista de deseos, del más reciente al más viejo (persiste en el server; el toggle es optimista). */
  wishOrder: number[];
};

/** Deseados según el server, en su orden (el server los manda primero, del más reciente al más viejo). */
const wishedOf = (items: MarketItem[]) => items.filter((i) => i.wished).map((i) => i.id);
const isRopa = (i: MarketItem) => i.kind === 'ropa';

/** Tienda: la billetera de Energy Coin, los premios que publica el padre y la ROPA PARA TU AVATAR (ítems de plataforma:
 *  comprar → ponérsela, o regalársela a un amigo). Las listas largas viven en PÁGINAS propias por searchParams (pedido
 *  12-oct, mismo patrón que las solapas de Videos): /tienda?vista=deseos ("Tu lista de deseos"), ?vista=canjes ("Tus
 *  canjes") y ?vista=movimientos ("Tus movimientos") — en la vista principal ya no hay tablas, solo los accesos de la
 *  billetera. Contenedor puro: todo sale de api.market /
 *  redeem / redemptions / wish / ecTx / giftToFriend / friends, y el look de Ian del store de identidad (ProfileCard).
 *  Canjear, comprar y regalar son transacciones: nada optimista — saldo, stock, guardarropas y canjes que se muestran
 *  son los que devolvió el server. El deseo sí es optimista (no mueve plata) y se reconcilia con el server.
 *  /tienda#ropa lleva directo a la ropa; /tienda?regalar=<amigo>#ropa llega desde el perfil de un amigo. */
export function StorePage() {
  const go = useNavigate();
  const { hash } = useLocation();
  const [params, setParams] = useSearchParams();
  const vistas = ['deseos', 'canjes', 'movimientos'] as const;
  const view = (vistas as readonly string[]).includes(params.get('vista') ?? '')
    ? (params.get('vista') as (typeof vistas)[number])
    : 'tienda';
  const giftTo = params.get('regalar');
  const user = useUser();
  const { id: me } = useMyIdentity();
  // Regalar ropa a un amigo es SOCIAL: de los chicos con Amigos prendido (U4 · D4, friends/lib/social.ts; el adulto no tiene
  // amigos chicos, así que ni el botón ni la hoja existen para él).
  const giftOn = useSocial() === true;
  const [data, setData] = useState<StoreData | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [buy, setBuy] = useState<BuyState | null>(null);
  const [gift, setGift] = useState<GiftState | null>(null);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [friendsFailed, setFriendsFailed] = useState(false);
  const [wearing, setWearing] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fresh, setFresh] = useState<number | null>(null);
  const [wishError, setWishError] = useState(false);
  const alive = useRef(true);
  const busy = useRef(false);
  const loadSeq = useRef(0);
  const wishSeq = useRef(0);
  const opener = useRef<HTMLElement | null>(null);
  const ropaEl = useRef<HTMLElement>(null);
  const viewEl = useRef<HTMLElement>(null);
  const wishErrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrolledTo = useRef<string | null>(null);

  /** Trae todo del server. `first` muestra error si falla; las recargas silenciosas no tapan lo que ya hay. */
  const load = useCallback(async (first: boolean) => {
    const seq = ++loadSeq.current;
    const wishAtStart = wishSeq.current;
    if (first) setFailed(false);
    const [m, r, t] = await Promise.allSettled([api.market(), api.redemptions(), api.ecTx()]);
    if (!alive.current || seq !== loadSeq.current) return; // una recarga más nueva (o un canje) manda
    if (m.status === 'rejected') { if (first) setFailed(true); return; }
    setData((prev) => ({
      items: m.value.items,
      ec: m.value.ec,
      redemptions: r.status === 'fulfilled' ? r.value.redemptions : prev?.redemptions ?? null,
      tx: t.status === 'fulfilled' ? t.value.tx : prev?.tx ?? null,
      // Si el chico tocó un corazón mientras esto viajaba, manda su toggle (más nuevo que esta lectura).
      wishOrder: prev && wishSeq.current !== wishAtStart ? prev.wishOrder : wishedOf(m.value.items),
    }));
  }, []);

  useEffect(() => {
    alive.current = true;
    void load(true);
    return () => {
      alive.current = false;
      if (wishErrTimer.current) clearTimeout(wishErrTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [load]);

  // Cada vista arranca arriba (la vista scrollea por dentro de .view).
  useEffect(() => { if (viewEl.current) viewEl.current.scrollTop = 0; }, [view]);

  // /tienda#ropa (el candado de "Tu ropa", el perfil de un amigo): con los datos ya pintados, directo a la ropa.
  useEffect(() => {
    if (hash !== '#ropa' || !data || view !== 'tienda') { if (hash !== '#ropa') scrolledTo.current = null; return; }
    const key = `${hash}|${giftTo ?? ''}`;
    if (scrolledTo.current === key) return;
    scrolledTo.current = key;
    requestAnimationFrame(() => {
      const el = ropaEl.current;
      if (!el) return;
      const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      el.focus({ preventScroll: true });
    });
  }, [hash, data, view, giftTo]);

  /* ---------- amigos (para regalar): solo si Amigos está prendido; se piden al abrir la hoja o al llegar con ?regalar ---------- */
  const friendsSeq = useRef(0);
  const loadFriends = useCallback(() => {
    const n = ++friendsSeq.current;
    setFriendsFailed(false);
    api.friends().then(
      (r) => { if (alive.current && n === friendsSeq.current) setFriends(r.friends); },
      () => { if (alive.current && n === friendsSeq.current) setFriendsFailed(true); },
    );
  }, []);
  useEffect(() => { if (giftOn && giftTo) loadFriends(); }, [giftOn, giftTo, loadFriends]);
  const giftFor = giftTo ? friends?.find((f) => f.id === giftTo) ?? null : null;

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  };
  /** El foco vuelve a la tarjeta (a su botón, o a la tarjeta si el botón cambió o quedó deshabilitado). */
  const refocus = () => {
    const btn = opener.current;
    opener.current = null;
    requestAnimationFrame(() => {
      if (!btn?.isConnected || (btn as HTMLButtonElement).disabled) {
        const item = btn?.closest<HTMLElement>('.st-card')?.dataset.item;
        document.querySelector<HTMLElement>(`.st-card[data-item="${item}"]`)?.focus();
        return;
      }
      btn.focus();
    });
  };

  /* ---------- premios del padre: canje ---------- */
  const openRedeem = (item: MarketItem, btn: HTMLElement) => {
    opener.current = btn;
    setSheet({ item, phase: 'confirm' });
  };

  const closeSheet = () => {
    if (busy.current) return;
    setSheet(null);
    refocus();
  };

  const confirm = async () => {
    if (!sheet || sheet.phase !== 'confirm' || busy.current) return;
    const { item } = sheet;
    busy.current = true;
    loadSeq.current++; // descarta cualquier recarga en vuelo: traería el saldo de antes del canje
    setSheet({ item, phase: 'busy' });
    try {
      const r = await api.redeem(item.id);
      if (!alive.current) return;
      setData((d) => (d ? { ...d, ec: r.ec } : d));
      if (r.ok && r.redemption) {
        setFresh(r.redemption.id);
        setSheet({ item, phase: 'done', ec: r.ec });
      } else {
        setSheet({ item, phase: 'error', message: r.error || 'No se pudo canjear. Probá de nuevo en un ratito.' });
      }
    } catch (e) {
      if (!alive.current) return;
      const gone = e instanceof ApiError && e.status === 404;
      setSheet({ item, phase: 'error', message: gone ? 'Ese premio ya no está en la Tienda.' : 'No pude canjear ahora. Fijate en “Tus canjes” y probá de nuevo en un ratito.' });
    } finally {
      busy.current = false;
    }
    void load(false); // stock, canjes y movimientos: los trae el server
  };

  /* ---------- ropa: comprar (el mismo POST /redeem: entrega instantánea, sin canje), ponérsela y regalar ---------- */
  const look = me?.look ?? null;
  const stateOf = (it: MarketItem): WearState => (look?.accessory === it.accessoryId ? 'puesta' : it.owned ? 'poner' : 'comprar');

  const openBuy = (item: MarketItem, btn: HTMLElement) => { opener.current = btn; setBuy({ item, phase: 'confirm' }); };
  const closeBuy = () => { if (busy.current) return; setBuy(null); refocus(); };
  const confirmBuy = async () => {
    if (!buy || buy.phase !== 'confirm' || busy.current) return;
    const { item } = buy;
    busy.current = true;
    loadSeq.current++;
    setBuy({ item, phase: 'busy' });
    try {
      const r = await api.redeem(item.id);
      if (!alive.current) return;
      setData((d) => (d ? { ...d, ec: r.ec, items: r.ok ? d.items.map((i) => (i.id === item.id ? { ...i, owned: true } : i)) : d.items } : d));
      setBuy(r.ok ? { item, phase: 'done', ec: r.ec } : { item, phase: 'error', message: r.error || 'No se pudo comprar. Probá de nuevo en un ratito.' });
    } catch (e) {
      if (!alive.current) return;
      const gone = e instanceof ApiError && e.status === 404;
      setBuy({ item, phase: 'error', message: gone ? 'Esa prenda ya no está en la Tienda.' : 'No pude comprar ahora. Fijate en “Movimientos” y probá de nuevo en un ratito.' });
    } finally {
      busy.current = false;
    }
    void load(false); // guardarropas y movimientos: los trae el server
  };

  /** Ponérsela: va en el look de Ian (persiste). Con iniciales primero hay que elegir un personaje. */
  const wear = async (item: MarketItem) => {
    if (!item.accessoryId || wearing) return;
    if (!look) { openAvatarPicker(item.accessoryId); return; }
    setWearing(item.accessoryId);
    try { await saveMyLook({ ...look, accessory: item.accessoryId }); }
    catch { if (alive.current) showToast('No pude ponértela ahora. Probá de nuevo en un ratito.'); }
    finally { if (alive.current) setWearing(null); }
  };
  const wearFromSheet = () => {
    if (!buy) return;
    const { item } = buy;
    setBuy(null);
    opener.current = null;
    void wear(item);
  };

  const openGift = (item: MarketItem, btn: HTMLElement) => {
    opener.current = btn;
    const pre = giftTo && friends?.some((f) => f.id === giftTo && f.accessory !== item.accessoryId) ? giftTo : null;
    setGift({ item, phase: 'pick', friendId: pre });
    loadFriends(); // siempre fresco: qué tiene puesto cada uno
  };
  const closeGift = () => { if (busy.current) return; setGift(null); refocus(); };
  const confirmGift = async () => {
    if (!gift || gift.phase !== 'pick' || !gift.friendId || busy.current) return;
    const { item, friendId } = gift;
    busy.current = true;
    loadSeq.current++;
    setGift({ item, phase: 'busy', friendId });
    try {
      const r = await api.giftToFriend(item.id, friendId);
      if (!alive.current) return;
      if (typeof r.ec === 'number') { const ec = r.ec; setData((d) => (d ? { ...d, ec } : d)); }
      if (r.ok && r.friend) {
        const f = r.friend;
        setFriends((cur) => cur?.map((x) => (x.id === f.id ? f : x)) ?? cur);
        setGift({ item, phase: 'done', friend: f, ec: r.ec ?? data?.ec ?? 0 });
        chatFriendsChanged(); // el dock (lista y ventana) pinta la prenda nueva del amigo
      } else {
        // Elegir otro amigo sirve si ESTE ya la tenía; si no alcanza el saldo, no (ningún amigo lo arregla).
        const short = typeof r.ec === 'number' && r.ec < item.price;
        setGift({ item, phase: 'error', message: r.error || 'No se pudo regalar. Probá de nuevo en un ratito.', friendId, retry: !short });
      }
    } catch (e) {
      if (!alive.current) return;
      const st = e instanceof ApiError ? e.status : 0;
      const message = st === 404 ? 'Ese amigo ya no está en tu lista.' : st === 403 ? 'Ahora no se pueden hacer regalos.' : 'No pude regalarlo ahora. Fijate en “Movimientos” y probá de nuevo en un ratito.';
      setGift({ item, phase: 'error', message, friendId, retry: st === 404 });
      if (st === 404) loadFriends();
    } finally {
      busy.current = false;
    }
    void load(false);
  };
  const giftChat = (friendId: string) => { setGift(null); opener.current = null; openChat(friendId); };

  /** ❤: optimista (no mueve plata). Se manda el valor EXPLÍCITO (idempotente) y solo cuenta la
   *  respuesta del último toque; si falla, vuelve atrás, avisa y se resincroniza con el server. */
  const toggleWish = async (item: MarketItem) => {
    if (!data) return;
    const before = data.wishOrder;
    const want = !before.includes(item.id);
    const seq = ++wishSeq.current;
    setWishError(false);
    setData((d) => (d ? { ...d, wishOrder: want ? [item.id, ...d.wishOrder.filter((id) => id !== item.id)] : d.wishOrder.filter((id) => id !== item.id) } : d));
    try {
      const r = await api.wish(item.id, want);
      if (!alive.current || seq !== wishSeq.current) return;
      setData((d) => (d ? { ...d, wishOrder: r.wishlist.filter((id) => d.items.some((i) => i.id === id)) } : d));
    } catch {
      if (!alive.current || seq !== wishSeq.current) return;
      setData((d) => (d ? { ...d, wishOrder: before } : d));
      setWishError(true);
      if (wishErrTimer.current) clearTimeout(wishErrTimer.current);
      wishErrTimer.current = setTimeout(() => setWishError(false), 5000);
      void load(false);
    }
  };

  const premios = data?.items.filter((i) => !isRopa(i)) ?? [];
  const ropa = data?.items.filter(isRopa) ?? [];
  const pending = data?.redemptions?.filter((r) => r.status === 'pendiente').length ?? 0;
  const wished = new Set(data?.wishOrder ?? []);
  const myName = user?.name ?? me?.nick ?? '';

  return (
    <section className="view" id="v-store" ref={viewEl} data-vista={view}>
      <div className="st-page">
        {view === 'tienda' && (
          <header className="st-head">
            <h2 className="h2">Tienda</h2>
            <p className="lede">{user?.kind === 'adult'
              ? 'La ropa del avatar se canjea con Energy Coins; los premios viven en la cuenta de cada integrante.'
              : 'Canjeá tus Energy Coins por los premios que te preparan papá y mamá, o vestí a tu avatar.'}</p>
          </header>
        )}

        {failed && (
          <div className="st-fail" role="alert">
            <p>No pude cargar la Tienda ahora. Probemos de nuevo en un ratito.</p>
            <button type="button" className="st-btn st-btn--ghost" onClick={() => void load(true)}>Reintentar</button>
          </div>
        )}
        {!data && !failed && <StoreSkeleton />}

        {data && view === 'deseos' && (
          <WishlistView items={wishedItems(premios, data.wishOrder)} ec={data.ec} onBack={() => setParams({})}
            onRedeem={openRedeem} onWish={(it) => void toggleWish(it)} />
        )}
        {data && view === 'canjes' && <RedemptionsView list={data.redemptions} fresh={fresh} onBack={() => setParams({})} />}
        {data && view === 'movimientos' && <MovesView tx={data.tx} onBack={() => setParams({})} />}

        {data && view === 'tienda' && (
          <>
            <WalletHero ec={data.ec} wishCount={data.wishOrder.length} pending={pending}
              onPractice={() => go('/aprender')} onWishes={() => setParams({ vista: 'deseos' })}
              onRedemptions={() => setParams({ vista: 'canjes' })} onMoves={() => setParams({ vista: 'movimientos' })} />

            <section className="st-sec" aria-labelledby="st-premios-h">
              <div className="st-sec-head">
                <h3 id="st-premios-h">Premios</h3>
                {user?.kind === 'adult' ? (
                  <p>Cada integrante canjea los suyos; vos los administrás en Familia → Premios.</p>
                ) : (
                  <>
                    <p>Los publican papá y mamá. Canjeá uno y avisales para que te lo den.</p>
                    <span className="st-sec-hint">Tocá el <HeartInline /> para guardar los que más querés</span>
                  </>
                )}
              </div>
              {premios.length > 0 ? (
                <div className="st-grid">
                  {byPrice(premios).map((it) => (
                    <RewardCard key={it.id} item={it} ec={data.ec} wished={wished.has(it.id)}
                      onRedeem={(btn) => openRedeem(it, btn)} onWish={() => void toggleWish(it)} />
                  ))}
                </div>
              ) : user?.kind === 'adult' ? (
                /* U3-D1: el adulto no ve premios de los chicos; los suyos no existen. */
                <p className="st-empty">Los premios viven en la cuenta de cada integrante: publicalos en Familia → Premios.</p>
              ) : (
                <p className="st-empty">Papá y mamá todavía no publicaron premios. ¡Seguí juntando ⚡ mientras tanto!</p>
              )}
            </section>

            {ropa.length > 0 && (
              <WardrobeSection ref={ropaEl} items={ropa} ec={data.ec} me={myName} stateOf={stateOf} wearing={wearing}
                giftOn={giftOn} giftFor={giftFor} onBuy={openBuy} onWear={(it) => void wear(it)} onGift={openGift}
                onClearGiftFor={() => setParams({})} />
            )}
          </>
        )}
      </div>

      {wishError && <div className="st-toast" role="status">No pude guardar tu lista de deseos. Probá de nuevo.</div>}
      {toast && <div className="st-toast" role="status">{toast}</div>}
      {sheet && <RedeemSheet s={sheet} ec={data?.ec ?? 0} onConfirm={() => void confirm()} onClose={closeSheet} />}
      {buy && <BuySheet s={buy} ec={data?.ec ?? 0} me={myName} canWear={!!look} onConfirm={() => void confirmBuy()} onWear={wearFromSheet} onClose={closeBuy} />}
      {gift && (
        <GiftSheet s={gift} ec={data?.ec ?? 0} friends={friends} failed={friendsFailed}
          onPick={(fid) => setGift((g) => (g && g.phase === 'pick' ? { ...g, friendId: fid } : g))}
          onConfirm={() => void confirmGift()}
          onBack={() => setGift((g) => (g && g.phase === 'error' ? { item: g.item, phase: 'pick', friendId: null } : g))}
          onChat={giftChat} onRetry={loadFriends} onClose={closeGift} />
      )}
    </section>
  );
}
