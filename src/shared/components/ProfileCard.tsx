import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../../api';
import type { AvatarLook, EarnedMedal, Identity, MedalsResponse, User } from '../../api/types';
import { useUser } from '../../hooks/user';
import { LEAGUE_WEEK_CLOSED, MEDAL_INFO, lastWeekLabel, type Medal } from '../../sections/leagues/lib/cycle';
import { refreshFeatures, useFeatures } from '../../sections/parent/lib/features';
import { isSectionOpen, refreshCycle, useCycle } from '../../sections/parent/lib/cycle';
import { sheetOpener, useReturnFocus, useVeil } from '../../sections/store/lib/sheet';
import { MEDALS_CHANGED, chipLabel } from '../lib/medals';
import { ACCESSORIES, AVATAR_COLORS, AVATAR_VARIANT_COUNT, Avatar, accessoryById, avatarVariantName } from './Avatar';
import { MedalsSheet } from './MedalsSheet';
import { IcClose } from './icons';

/* Identidad de Ian (visión §9: el avatar es un activo del chico). Su look lo ELIGE él y vive en el server
   (GET/POST /api/identity → server/data/identity.json, no se resetea con la demo); el de los demás usuarios se
   deriva del nick en el cliente (lookFor, en Avatar.tsx). El look trae la ROPA puesta (accessory, tanda W): la que
   compró en la Tienda la elige acá ("Tu ropa") o desde la misma Tienda ("Ponérsela"). Estilos: avatar.css (idav-).
   POR USUARIO (línea 14-oct, docs/USUARIOS.md): "Ian" acá es el usuario ACTIVO —el server lee y guarda el look del de la
   cabecera X-Innerith-User—, así que el adulto del demo tiene su tarjeta y su avatar propios con el mismo código. */

/* ---------- store: singleton de módulo + useSyncExternalStore (patrón de sections/parent/lib/features.ts) ----------
   Lo leen la tarjeta de la barra, la fila "Vos" de Ligas, la barra del dock y la Tienda: al guardar, cambian AL INSTANTE. */
type Snap = { id: Identity | null; failed: boolean };
let snap: Snap = { id: null, failed: false };
const listeners = new Set<() => void>();
const emit = (next: Snap) => { snap = next; listeners.forEach((l) => l()); };
let inflight: Promise<void> | null = null;
/** Sube con cada guardado: una lectura que salió antes no pisa lo recién guardado cuando vuelve. */
let version = 0;
function refresh(): Promise<void> {
  if (inflight) return inflight;
  const v = version;
  inflight = api.identity().then(
    (id) => { if (v === version) emit({ id, failed: false }); },
    () => { if (v === version) emit({ ...snap, failed: true }); },
  ).finally(() => { inflight = null; });
  return inflight;
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  if (!snap.id && !inflight) void refresh();
  return () => { listeners.delete(l); };
};
const useIdentity = () => useSyncExternalStore(subscribe, () => snap);
async function saveLook(look: AvatarLook): Promise<void> {
  version++;
  emit({ id: await api.setIdentity(look), failed: false });
}
/** La identidad de Ian (y si falló su lectura): la Tienda la usa para previsualizar la ropa y saber cuál tiene puesta. */
export const useMyIdentity = useIdentity;
/** Guarda el look de Ian (el picker y el "Ponérsela" de la Tienda): todos los que lo muestran cambian al instante. */
export const saveMyLook = saveLook;

/* ---------- abrir "Tu avatar" desde otra pantalla (la Tienda, cuando Ian tiene iniciales y quiere ponerse ropa:
   la ropa va sobre un personaje, así que primero elige uno). Cada pedido sube `n`; la tarjeta lo atiende una vez. ---------- */
let pickerAsk: { n: number; accessory: string | null } = { n: 0, accessory: null };
const pickerListeners = new Set<() => void>();
const subscribePicker = (l: () => void) => { pickerListeners.add(l); return () => { pickerListeners.delete(l); }; };
/** Abre la hoja "Tu avatar" (con esa prenda ya elegida, si viene). */
export function openAvatarPicker(accessory: string | null = null) {
  pickerAsk = { n: pickerAsk.n + 1, accessory };
  pickerListeners.forEach((l) => l());
}

/* ---------- abrir "Tus medallas" desde otra pantalla (U5-D: el "Ver tus medallas" de la noticia de una medalla nueva en el
   Feed). Mismo patrón que openAvatarPicker: cada pedido sube el contador; la tarjeta lo atiende una vez. ---------- */
let medalsAsk = 0;
const medalsAskListeners = new Set<() => void>();
const subscribeMedalsAsk = (l: () => void) => { medalsAskListeners.add(l); return () => { medalsAskListeners.delete(l); }; };
/** Abre la hoja "Tus medallas" (la pila del usuario activo; al abrirla se marcan vistas). */
export function openMedalsSheet() {
  medalsAsk += 1;
  medalsAskListeners.forEach((l) => l());
}

/** ¿Se le puede devolver el foco? (sigue en la página, se ve —en el teléfono el cajón cerrado está oculto— y no es el body) */
const focusable = (el: HTMLElement | null): el is HTMLElement =>
  !!el && el !== document.body && el.isConnected && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

/** Dónde se montan las dos hojas del perfil ("Tu avatar" y "Tus medallas"): con un portal en la capa del shell (.app), FUERA
 *  de la barra lateral (tanda SHELL-FIX; docs/RESPONSIVE.md §5, R-shell, opción A). En Safari/WebKit el container-type de
 *  .side (la densidad por alto, shell.css) es bloque contenedor y contexto de apilamiento de los position:fixed de adentro
 *  (en Chrome no): ahí las hojas quedaban presas del cajón cerrado del teléfono (x = −300, invisibles: la Tienda y el Feed
 *  las abren con el cajón cerrado), de los 80 px del rail y, en escritorio, detrás del contenido. En .app y no en <body>
 *  (los overlays de Learn sí van a <body>): así siguen dentro del contenedor app —valen las @container app de space.css y
 *  medals.css para el teléfono— y, con ?stage, dentro del escenario escalado, como antes. Con el cajón abierto, shell.css
 *  las sube arriba del cajón y de su velo. */
const sheetLayer = (from: HTMLElement | null): HTMLElement => from?.closest<HTMLElement>('.app') ?? document.body;

/** Las iniciales de Ian son las de siempre: amarillo con letra marrón (barra y fila "Vos" de Ligas). */
const ME_COLOR = '#FFC23D';
const ME_INK = '#5A3D00';

/** El avatar de Ian donde aparezca (barra, filas "Vos" de Ligas, dock), con la ropa que tiene puesta. Mientras no se
 *  sabe su look: un círculo neutro (sin parpadeo de iniciales → personaje); si el server no responde, sus iniciales.
 *  `accessory` muestra OTRA prenda en vez de la puesta (la vista previa de la Tienda: "así te quedaría"). */
export function MyAvatar({ name, size, accessory }: { name: string; size?: number; accessory?: string | null }) {
  const { id, failed } = useIdentity();
  if (!id && !failed) return <span className="av3 idav-ph" style={size ? { width: size, height: size } : undefined} aria-hidden="true" />;
  return <Avatar name={name} color={ME_COLOR} look={id?.look} accessory={accessory} size={size} style={{ color: ME_INK }} />;
}

const COLOR_NAMES: Record<string, string> = {
  '#3A5BD9': 'Azul', '#13A39A': 'Verde agua', '#F26B3A': 'Naranja', '#8A5CF5': 'Violeta',
  '#E5487A': 'Rosa', '#F2A81D': 'Amarillo', '#1C9BD6': 'Celeste', '#18A957': 'Verde',
};
const IcPencil = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.2-4.6L15.8 4.8a2 2 0 012.8 0l.6.6a2 2 0 010 2.8L8.6 18.8z" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinejoin="round" /></svg>
);

/** La medalla de la semana pasada (visión §7 capa 6, audio 26: "tu prestigio se nota"), del ciclo de liga que vive en
 *  leaguesFake (/api/leagues/mine → lastWeek.medal; acá no se calcula nada). Con Ligas apagadas no se pide ni se
 *  muestra. Se vuelve a preguntar al entrar y al salir de Ligas (ahí vive "Simular cierre de semana") y al volver el foco. */
function useLastMedal(): Medal | null {
  const ligas = useFeatures()?.ligas === true;
  const inLeagues = useLocation().pathname.startsWith('/ligas');
  const [medal, setMedal] = useState<Medal | null>(null);
  const [wake, setWake] = useState(0);
  useEffect(() => {
    // Al volver el foco, PRIMERO los candados (el padre pudo haber apagado Ligas mientras tanto) y recién después la liga:
    // si no, salía un GET /api/leagues/mine con el candado viejo y volvía 403 (ruido en la consola). refreshFeatures está
    // deduplicado (la lectura del foco de features.ts es la misma) y su render llega antes que este bump.
    let alive = true;
    const onFocus = () => { void refreshFeatures().finally(() => { if (alive) setWake((n) => n + 1); }); };
    window.addEventListener('focus', onFocus);
    return () => { alive = false; window.removeEventListener('focus', onFocus); };
  }, []);
  useEffect(() => {
    if (!ligas) { setMedal(null); return; }
    let alive = true;
    api.myLeague().then((l) => { if (alive) setMedal(l.lastWeek?.medal ?? null); }, () => { if (alive) setMedal(null); });
    return () => { alive = false; };
  }, [ligas, inLeagues, wake]);
  return medal;
}

/** Las medallas de la plataforma del usuario ACTIVO (U5-D; GET /api/medals de U5-B: solo las GANADAS que él ve —sin las de
 *  un candado apagado— y `unseen`, las que todavía no vio en la hoja). Patrón de useLastMedal, un poco más ancho: se vuelve
 *  a pedir al montar, en CADA cambio de pantalla (entrar y salir de Ligas incluidos, y volver de donde se ganó una: Mi
 *  espacio, Aprender, Buscar), al volver el foco, cuando cambian los candados que esconden medallas (Ligas, Amigos), tras
 *  cada cierre de liga (LEAGUE_WEEK_CLOSED, que Ligas dispara también con el cierre de la familia) y cuando el Feed avisa
 *  que le llegó una noticia de medalla (MEDALS_CHANGED). Una respuesta vieja no pisa una más nueva (`seq`); si una lectura
 *  falla, queda lo último que se supo (si nunca llegó nada, no hay chip). `apply` = una respuesta que llegó por la hoja. */
function useMedals(): { data: MedalsResponse | null; apply: (r: MedalsResponse) => void } {
  const path = useLocation().pathname;
  const f = useFeatures();
  const locks = f ? `${f.ligas}:${f.amigos}` : '';
  const [data, setData] = useState<MedalsResponse | null>(null);
  const [wake, setWake] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    const bump = () => setWake((n) => n + 1);
    window.addEventListener('focus', bump);
    window.addEventListener(LEAGUE_WEEK_CLOSED, bump);
    window.addEventListener(MEDALS_CHANGED, bump);
    return () => {
      window.removeEventListener('focus', bump);
      window.removeEventListener(LEAGUE_WEEK_CLOSED, bump);
      window.removeEventListener(MEDALS_CHANGED, bump);
    };
  }, []);
  useEffect(() => {
    const my = ++seq.current;
    api.medals().then((r) => { if (my === seq.current) setData(r); }, () => { /* queda lo último que se supo */ });
  }, [path, locks, wake]);
  const apply = useCallback((r: MedalsResponse) => { seq.current++; setData(r); }, []);
  return { data, apply };
}

/** Tarjeta de perfil del pie de la barra: la .profile de shell.css, que desde U5 es un DIV con dos botones hermanos (un
 *  botón no puede llevar otro adentro). (1) El de siempre: avatar de Ian + nombre y edad → abre "Tu avatar"; al guardar, el
 *  avatar nuevo aparece al instante (con un saltito). Sobre el avatar: la medallita de la semana pasada (abajo a la
 *  izquierda; la lapicera de editar vive abajo a la derecha). (2) A la derecha, el chip de MEDALLAS "🏅 N" (U5-D, spec §5.5a)
 *  con un puntito si hay alguna sin ver → abre la pila "Tus medallas" (MedalsSheet; también la abre openMedalsSheet desde el
 *  Feed). Sin medallas el chip NO existe (ni un "0"). Estilos: avatar.css (idav-) y medals.css (mdl-).
 *  Las dos hojas no se dibujan dentro de la barra: van con un portal a la capa del shell (sheetLayer). */
export function ProfileCard({ user }: { user?: User }) {
  const { id } = useIdentity();
  const [open, setOpen] = useState<{ accessory?: string | null } | null>(null);
  const [saves, setSaves] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const chip = useRef<HTMLButtonElement>(null);
  const prof = useRef<HTMLDivElement>(null);
  /** La capa de las hojas (sheetLayer): se resuelve al montar la tarjeta, antes de que nada pueda abrirlas. */
  const [layer, setLayer] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => { setLayer(sheetLayer(prof.current)); }, []);
  const name = user?.name ?? id?.nick ?? '';
  const medal = useLastMedal();
  const info = medal ? MEDAL_INFO[medal] : null;
  const medalText = info ? lastWeekLabel(info.pos) : '';
  // Pedidos de abrir la hoja desde otra pantalla (openAvatarPicker): cada uno se atiende una sola vez.
  const ask = useSyncExternalStore(subscribePicker, () => pickerAsk);
  const handled = useRef(pickerAsk.n);
  useEffect(() => {
    if (ask.n === handled.current) return;
    handled.current = ask.n;
    setOpen({ accessory: ask.accessory });
  }, [ask]);
  /** Al cerrar, el foco vuelve a quien la abrió (el avatar, o el "Ponérsela" de la Tienda) y si ese ya no se ve, al avatar
   *  (si se ve): lo hace la hoja al irse (useReturnFocus). Antes iba siempre al avatar, que con el cajón del teléfono
   *  CERRADO está oculto → el foco caía en <body>. */
  const close = (saved: boolean) => {
    setOpen(null);
    if (saved) setSaves((n) => n + 1);
  };
  const label = user ? `${user.name}, ${user.age} años${info ? `, ${info.name}: ${medalText}` : ''}. Cambiar tu avatar` : 'Cambiar tu avatar';

  /* ---- las medallas: el chip y la hoja "Tus medallas" ---- */
  const medals = useMedals();
  const count = medals.data?.medals.length ?? 0;
  const unseen = medals.data?.unseen ?? 0;
  /** La pila que muestra ESTA apertura (con sus "Nueva": el "ya las vio" del server las borra recién para la próxima). */
  const [sheet, setSheet] = useState<{ list: EarnedMedal[] | null; failed: boolean } | null>(null);
  /** A quién devolverle el foco al cerrar: el que la abrió (el chip, o el botón de la noticia del Feed). */
  const opener = useRef<HTMLElement | null>(null);
  const sheetRun = useRef(0);
  // Al abrir: la pila fresca (GET, con `fresh`) y DESPUÉS el "ya las vio" (POST /api/medals/seen: el puntito se va).
  const loadSheet = async () => {
    const run = ++sheetRun.current;
    setSheet((s) => s && { list: s.list, failed: false });
    try {
      const r = await api.medals();
      if (run !== sheetRun.current) return; // la cerraron mientras tanto: no se marca nada como visto
      medals.apply(r);
      setSheet((s) => s && { list: r.medals, failed: false });
      medals.apply(await api.medalsSeen());
    } catch {
      if (run === sheetRun.current) setSheet((s) => s && (s.list ? s : { list: null, failed: true }));
    }
  };
  const openSheet = () => {
    // sheetOpener y no document.activeElement (QA-U5-E): Safari no enfoca el botón al clickearlo o tocarlo, así que el
    // foco seguía en <body> y al cerrar iba al chip, o —en el teléfono, con el chip en el cajón cerrado— a la nada.
    opener.current = sheetOpener();
    setSheet({ list: medals.data?.medals ?? null, failed: false }); // lo último que se sabía, mientras llega lo fresco
    void loadSheet();
  };
  const closeSheet = () => {
    sheetRun.current++;
    setSheet(null);
    const back = opener.current;
    opener.current = null;
    (focusable(back) ? back : chip.current)?.focus();
  };
  // Pedidos de abrir la pila desde otra pantalla (openMedalsSheet): cada uno se atiende una sola vez.
  const askMedals = useSyncExternalStore(subscribeMedalsAsk, () => medalsAsk);
  const handledMedals = useRef(medalsAsk);
  useEffect(() => {
    if (askMedals === handledMedals.current) return;
    handledMedals.current = askMedals;
    openSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askMedals]);

  return (
    <>
      <div ref={prof} className="profile mdl-prof">
        <button ref={btn} type="button" className="idav-prof mdl-me" onClick={() => setOpen({})} aria-haspopup="dialog"
          title="Cambiar tu avatar" aria-label={label}>
          <span className="idav-pav" key={saves} data-pop={saves > 0 || undefined}>
            <MyAvatar name={name} />
            {info && <span className="idav-medal" data-medal={medal} role="img" aria-label={`${info.name}: ${medalText}`} title={`${info.emoji} ${medalText}`}>{info.emoji}</span>}
            <span className="idav-pen"><IcPencil /></span>
          </span>
          <div><b>{user?.name ?? '…'}</b><small>{user ? `${user.age} años` : ''}</small></div>
        </button>
        {count > 0 && (
          <button ref={chip} type="button" className="mdl-chip" onClick={openSheet} aria-haspopup="dialog"
            aria-label={chipLabel(count, unseen)} title="Tus medallas" data-unseen={unseen > 0 ? unseen : undefined}>
            <span className="mdl-chip-em" aria-hidden="true">🏅</span>
            <span className="mdl-chip-n" aria-hidden="true">{count}</span>
            {unseen > 0 && <span className="mdl-dot" aria-hidden="true" />}
          </button>
        )}
      </div>
      {open && createPortal(<AvatarPicker name={name} current={id?.look ?? null} preset={open.accessory} onClose={close} backTo={() => btn.current} />, layer ?? document.body)}
      {sheet && createPortal(<MedalsSheet medals={sheet.list} failed={sheet.failed} onRetry={() => void loadSheet()} onClose={closeSheet} />, layer ?? document.body)}
    </>
  );
}

/* ---------- el guardarropas de Ian (qué ropa compró), para la fila "Tu ropa" ----------
   Lo sabe la Tienda (GET /api/market: ítems kind 'ropa' con `owned`; compras en RAM, regla 9). Se pide al abrir la hoja,
   así está siempre fresco. Con la Tienda apagada por la familia no se pide (no existe): solo queda "Nada" y, si tenía una
   prenda puesta, esa (para poder sacársela).
   Con la Tienda FUERA DE SU FRANJA (horarios por sección, deuda 14-oct): /api/market responde 403 {error:'horario'}, así que
   tampoco se pide (lo dice el store de horarios, con la hora del server) y la hoja muestra lo mismo que apagada + un aviso
   suave, sin reintento. Si igual llega un 403 (el store todavía no sabía que cerró), se confirma con el server: cerrada por
   horario → ese aviso; si no, es otro 403 (p. ej. la apagaron recién: eso lo resuelve useFeatures) → el error de siempre. */
type Wardrobe = { state: 'loading' | 'ok' | 'off' | 'closed' | 'error'; owned: string[] };
function useWardrobe(): Wardrobe {
  const tienda = useFeatures()?.tienda; // con un adulto activo, siempre prendida (useFeatures: los candados son del chico)
  const sched = useCycle();
  // Los horarios también son del chico: al adulto la Tienda nunca le cierra (docs/USUARIOS.md §4; el server no le da 403).
  const closed = useUser()?.kind !== 'adult' && !isSectionOpen('tienda', sched);
  const [w, setW] = useState<Wardrobe>({ state: 'loading', owned: [] });
  useEffect(() => {
    if (tienda === undefined) return;
    if (!tienda) { setW({ state: 'off', owned: [] }); return; }
    if (closed) { setW({ state: 'closed', owned: [] }); return; }
    let alive = true;
    api.market().then(
      (m) => { if (alive) setW({ state: 'ok', owned: m.items.flatMap((i) => (i.kind === 'ropa' && i.owned && i.accessoryId ? [i.accessoryId] : [])) }); },
      (e) => {
        if (!alive) return;
        if (!(e instanceof ApiError && e.status === 403)) { setW({ state: 'error', owned: [] }); return; }
        void refreshCycle().then(() => { if (alive) setW({ state: isSectionOpen('tienda') ? 'error' : 'closed', owned: [] }); });
      },
    );
    return () => { alive = false; };
  }, [tienda, closed]);
  return w;
}
/** Nombre corto para el rótulo de cada opción de ropa (entra debajo de una miniatura de 40 px). */
const SHORT: Record<string, string> = { vincha: 'Vincha', anteojos: 'Anteojos' };

/** Hoja "Tu avatar" (patrón global .shov/.shcard): personaje (16 dibujados + Iniciales), color y ROPA, con vista previa.
 *  Radios nativos: flechas para moverse dentro de cada grupo, Tab entre grupos, Esc cierra, Tab queda adentro.
 *  Ropa: las prendas compradas (y la que ya tiene puesta) se eligen; las que no, llevan candado y llevan a la Tienda.
 *  `preset` = prenda ya elegida al abrir (cuando la abre la Tienda). Al irse, el foco vuelve a quien la abrió o, si ya no
 *  se ve, a `backTo` (el avatar de la tarjeta). */
function AvatarPicker({ name, current, preset, onClose, backTo }: {
  name: string; current: AvatarLook; preset?: string | null; onClose: (saved: boolean) => void; backTo: () => HTMLElement | null;
}) {
  useReturnFocus(backTo);
  const go = useNavigate();
  const [variant, setVariant] = useState<number | null>(current ? current.variant : null); // null = iniciales
  const [color, setColor] = useState<string>(current?.color ?? AVATAR_COLORS[0]);
  const [acc, setAcc] = useState<string | null>(preset !== undefined ? preset : current?.accessory ?? null);
  /** El último personaje elegido: con Iniciales, las miniaturas de la ropa se siguen viendo sobre él (apagadas). */
  const [lastV, setLastV] = useState<number>(current?.variant ?? 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const card = useRef<HTMLDivElement>(null);
  const wardrobe = useWardrobe();
  const worn = current?.accessory ?? null;
  /** Se puede elegir: la compró en esta demo o ya la tiene puesta (el look persiste aunque el guardarropas sea RAM). */
  const available = (id: string) => wardrobe.owned.includes(id) || id === worn;
  // apagada o cerrada por horario: sin candados ni links a la Tienda (solo "Nada" y la que tenga puesta)
  const shopOn = wardrobe.state !== 'off' && wardrobe.state !== 'closed';
  const shopClosed = wardrobe.state === 'closed';
  const ropa = ACCESSORIES.filter((a) => shopOn || a.id === worn);
  const locked = shopOn ? ropa.filter((a) => !available(a.id)) : [];
  const draft: AvatarLook = variant === null ? null : { variant, color, accessory: acc };
  const dirty = (draft === null) !== (current === null)
    || (!!draft && !!current && (draft.variant !== current.variant || draft.color !== current.color || (draft.accessory ?? null) !== (current.accessory ?? null)));
  const live = useRef({ busy, onClose });
  useLayoutEffect(() => { live.current = { busy, onClose }; });

  // Foco al abrir: la opción elegida (así las flechas ya recorren el set).
  useEffect(() => { card.current?.querySelector<HTMLInputElement>('input[name="idav-v"]:checked')?.focus(); }, []);
  // Teclado: Esc cierra (salvo mientras guarda) y Tab no se escapa de la hoja.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = card.current;
      if (!c) return;
      if (e.key === 'Escape') { e.preventDefault(); if (!live.current.busy) live.current.onClose(false); return; }
      if (e.key !== 'Tab') return;
      const els = [...c.querySelectorAll<HTMLElement>('button:not(:disabled)')];
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1], at = document.activeElement;
      if (!c.contains(at)) { e.preventDefault(); first.focus(); return; }
      if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && at === first) { e.preventDefault(); last.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const pickVariant = (v: number | null) => { setVariant(v); if (v !== null) setLastV(v); };
  const save = async () => {
    if (busy || !dirty) return;
    setBusy(true); setErr('');
    try { await saveLook(draft); onClose(true); }
    catch { setErr('No se pudo guardar. Probá de nuevo en un ratito.'); setBusy(false); }
  };
  /** Candado → la ropa de la Tienda (la hoja se cierra sin guardar). */
  const toShop = (e: MouseEvent) => { e.preventDefault(); if (busy) return; onClose(false); go('/tienda#ropa'); };
  const wearing = draft?.accessory ? accessoryById(draft.accessory) : undefined;
  const caption = variant === null ? 'Iniciales' : `${avatarVariantName(variant)} · ${COLOR_NAMES[color] ?? ''}${wearing ? ` · ${wearing.name}` : ''}`;
  const pv = variant ?? lastV;
  const veil = useVeil(() => onClose(false), busy);

  return (
    <div className="shov idav-ov" onMouseDown={veil}>
      <div className="shcard idav-sheet" ref={card} role="dialog" aria-modal="true" aria-labelledby="idav-t" aria-describedby="idav-d">
        <div className="idav-top">
          <span className="idav-prev" key={`${variant}-${color}-${acc}`}>
            <Avatar name={name} color={ME_COLOR} look={draft} size={84} style={{ color: ME_INK }} />
          </span>
          <div className="idav-head">
            <h3 className="idav-t" id="idav-t">Tu avatar</h3>
            <p className="idav-d" id="idav-d">Así te ven tus amigos y tu liga.</p>
            <p className="idav-cap" aria-live="polite">{caption}</p>
          </div>
          <button type="button" className="idav-x" aria-label="Cerrar" disabled={busy} onClick={() => onClose(false)}><IcClose /></button>
        </div>

        <fieldset className="idav-set" disabled={busy}>
          <legend className="lbl">Personaje</legend>
          <div className="idav-grid">
            {Array.from({ length: AVATAR_VARIANT_COUNT }, (_, v) => (
              <label key={v} className="idav-opt" title={avatarVariantName(v)}>
                <input type="radio" name="idav-v" value={v} checked={variant === v} onChange={() => pickVariant(v)} />
                <Avatar name={name} color={ME_COLOR} look={{ variant: v, color, accessory: acc }} size={40} />
                <span className="idav-sr">{avatarVariantName(v)}</span>
              </label>
            ))}
            <label className="idav-opt" title="Iniciales (el clásico)">
              <input type="radio" name="idav-v" value="iniciales" checked={variant === null} onChange={() => pickVariant(null)} />
              <Avatar name={name} color={ME_COLOR} size={40} style={{ color: ME_INK }} />
              <span className="idav-sr">Iniciales</span>
            </label>
          </div>
        </fieldset>

        <fieldset className="idav-set" disabled={busy || variant === null}>
          <legend className="lbl">Color{variant === null && <span className="idav-note"> · con iniciales queda tu amarillo</span>}</legend>
          <div className="idav-colors">
            {AVATAR_COLORS.map((c) => (
              <label key={c} className="idav-sw" title={COLOR_NAMES[c]} style={{ background: c }}>
                <input type="radio" name="idav-c" value={c} checked={color === c} onChange={() => setColor(c)} />
                <span className="idav-sr">{COLOR_NAMES[c]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {(shopOn || worn || shopClosed) && (
          <fieldset className="idav-set idav-wear" disabled={busy || variant === null} aria-describedby={locked.length ? 'idav-shop' : undefined}>
            <legend className="lbl">Tu ropa{variant === null && <span className="idav-note"> · la ropa va sobre un personaje</span>}</legend>
            <div className="idav-wgrid">
              <label className="idav-opt idav-wopt" title="Sin ropa">
                <input type="radio" name="idav-a" value="" checked={acc === null} onChange={() => setAcc(null)} />
                <Avatar name={name} color={ME_COLOR} look={{ variant: pv, color }} size={40} />
                <span className="idav-wl">Nada</span>
              </label>
              {ropa.map((a) => available(a.id) ? (
                <label key={a.id} className="idav-opt idav-wopt" title={a.name} data-acc={a.id}>
                  <input type="radio" name="idav-a" value={a.id} checked={acc === a.id} onChange={() => setAcc(a.id)} />
                  <Avatar name={name} color={ME_COLOR} look={{ variant: pv, color, accessory: a.id }} size={40} />
                  <span className="idav-wl">{SHORT[a.id] ?? a.name}</span>
                </label>
              ) : (
                <a key={a.id} className="idav-opt idav-wopt idav-lock" href="/tienda#ropa" data-acc={a.id} title={`${a.name}: conseguila en la Tienda`} onClick={toShop}>
                  <Avatar name={name} color={ME_COLOR} look={{ variant: pv, color, accessory: a.id }} size={40} />
                  <span className="idav-lk" aria-hidden="true">🔒</span>
                  <span className="idav-wl" aria-hidden="true">{SHORT[a.id] ?? a.name}</span>
                  <span className="idav-sr">{a.name}: todavía no la tenés. Conseguila en la Tienda</span>
                </a>
              ))}
            </div>
            {locked.length > 0 && (
              <a className="idav-shop" id="idav-shop" href="/tienda#ropa" onClick={toShop}>🔒 Conseguí más ropa en la Tienda →</a>
            )}
            {wardrobe.state === 'error' && <p className="idav-wnote">No pude ver tu ropa ahora. Probá abrir de nuevo en un ratito.</p>}
            {shopClosed && <p className="idav-wnote idav-wnote--rest" role="status">La Tienda está cerrada a esta hora — tu ropa te espera ✨</p>}
          </fieldset>
        )}

        {err && <p className="idav-err" role="alert">{err}</p>}
        <div className="idav-btns">
          <button type="button" className="idav-btn idav-btn--ghost" disabled={busy} onClick={() => onClose(false)}>Cancelar</button>
          <button type="button" className="idav-btn" disabled={busy || !dirty} aria-busy={busy} onClick={() => void save()}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
