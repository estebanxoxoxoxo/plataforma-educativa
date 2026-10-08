import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../../api';
import type { EcTx, MarketItem, Redemption } from '../../../api/types';
import { RewardCard } from '../cards/RewardCard';
import { HeartInline } from '../components/Heart';
import { MovesPanel } from '../components/MovesPanel';
import { RedeemSheet, type SheetState } from '../components/RedeemSheet';
import { RedemptionsPanel } from '../components/RedemptionsPanel';
import { StoreSkeleton } from '../components/StoreSkeleton';
import { WalletHero } from '../components/WalletHero';
import { WishlistView } from '../components/WishlistView';
import { byPrice, wishedItems } from '../lib/format';

type StoreData = {
  items: MarketItem[];
  /** Saldo: SIEMPRE el último valor que dio el server (GET /api/market o la respuesta del canje). */
  ec: number;
  /** null = esa parte no se pudo cargar (la Tienda igual funciona). */
  redemptions: Redemption[] | null;
  tx: EcTx[] | null;
  /** Lista de deseos, del más reciente al más viejo (persiste en el server; el toggle es optimista). */
  wishOrder: number[];
};

/** Deseados según el server, en su orden (el server los manda primero, del más reciente al más viejo). */
const wishedOf = (items: MarketItem[]) => items.filter((i) => i.wished).map((i) => i.id);

/** Tienda: la billetera de Energy Coin, los premios que publica el padre, los canjes y los movimientos;
 *  y, en /tienda?vista=deseos, "Tu lista de deseos" (mismo patrón de searchParams que las solapas de
 *  Videos). Contenedor puro: todo sale de api.market / redeem / redemptions / wish / ecTx. El canje es
 *  una transacción: nada optimista — saldo, stock y canjes que se muestran son los que devolvió el
 *  server. El deseo sí es optimista (no mueve plata) y se reconcilia con el server. */
export function StorePage() {
  const go = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get('vista') === 'deseos' ? 'deseos' : 'tienda';
  const [data, setData] = useState<StoreData | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [fresh, setFresh] = useState<number | null>(null);
  const [wishError, setWishError] = useState(false);
  const alive = useRef(true);
  const busy = useRef(false);
  const loadSeq = useRef(0);
  const wishSeq = useRef(0);
  const opener = useRef<HTMLElement | null>(null);
  const canjes = useRef<HTMLElement>(null);
  const viewEl = useRef<HTMLElement>(null);
  const wishErrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    };
  }, [load]);

  // Cada vista arranca arriba (la vista scrollea por dentro de .view).
  useEffect(() => { if (viewEl.current) viewEl.current.scrollTop = 0; }, [view]);

  const openRedeem = (item: MarketItem, btn: HTMLElement) => {
    opener.current = btn;
    setSheet({ item, phase: 'confirm' });
  };

  const closeSheet = () => {
    if (busy.current) return;
    setSheet(null);
    const btn = opener.current;
    opener.current = null;
    // El foco vuelve a la tarjeta del premio (a su botón, o a la tarjeta si quedó deshabilitado).
    requestAnimationFrame(() => {
      if (!btn?.isConnected) return;
      if (!(btn as HTMLButtonElement).disabled) btn.focus();
      else btn.closest<HTMLElement>('.st-card')?.focus();
    });
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

  const toCanjes = () => {
    const el = canjes.current;
    if (!el) return;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    el.focus({ preventScroll: true });
  };

  const pending = data?.redemptions?.filter((r) => r.status === 'pendiente').length ?? 0;
  const wished = new Set(data?.wishOrder ?? []);

  return (
    <section className="view" id="v-store" ref={viewEl} data-vista={view}>
      <div className="st-page">
        {view === 'tienda' && (
          <header className="st-head">
            <h2 className="h2">Tienda</h2>
            <p className="lede">Canjeá tus Energy Coins por los premios que te preparan papá y mamá.</p>
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
          <WishlistView items={wishedItems(data.items, data.wishOrder)} ec={data.ec} onBack={() => setParams({})}
            onRedeem={openRedeem} onWish={(it) => void toggleWish(it)} />
        )}

        {data && view === 'tienda' && (
          <>
            <WalletHero ec={data.ec} wishCount={data.wishOrder.length} pending={pending}
              onPractice={() => go('/practicar')} onWishes={() => setParams({ vista: 'deseos' })} onPending={toCanjes} />

            <section className="st-sec" aria-labelledby="st-premios-h">
              <div className="st-sec-head">
                <h3 id="st-premios-h">Premios</h3>
                <p>Los publican papá y mamá. Canjeá uno y avisales para que te lo den.</p>
                <span className="st-sec-hint">Tocá el <HeartInline /> para guardar los que más querés</span>
              </div>
              {data.items.length > 0 ? (
                <div className="st-grid">
                  {byPrice(data.items).map((it) => (
                    <RewardCard key={it.id} item={it} ec={data.ec} wished={wished.has(it.id)}
                      onRedeem={(btn) => openRedeem(it, btn)} onWish={() => void toggleWish(it)} />
                  ))}
                </div>
              ) : (
                <p className="st-empty">Papá y mamá todavía no publicaron premios. ¡Seguí juntando ⚡ mientras tanto!</p>
              )}
            </section>

            <div className="st-cols">
              <RedemptionsPanel ref={canjes} list={data.redemptions} fresh={fresh} />
              <MovesPanel tx={data.tx} />
            </div>
          </>
        )}
      </div>

      {wishError && <div className="st-toast" role="status">No pude guardar tu lista de deseos. Probá de nuevo.</div>}
      {sheet && <RedeemSheet s={sheet} ec={data?.ec ?? 0} onConfirm={() => void confirm()} onClose={closeSheet} />}
    </section>
  );
}
