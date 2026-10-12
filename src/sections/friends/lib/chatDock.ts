// Dock de mensajería estilo LinkedIn (pedido de Esteban, tanda D): el estado de las ventanas de chat, del lado de la UI.
// Singleton de módulo + useSyncExternalStore (patrón de sections/parent/lib/features.ts). Vive en RAM: recargar = dock
// cerrado, solo la barra «Mensajes» minimizada (coherente con el demo, que vuelve al seed en cada carga de página).
//   QUÉ GUARDA: las ventanas abiertas EN ORDEN DE APERTURA (la más nueva al final = pegada a la barra; la fila crece hacia
//   la izquierda), si cada una está minimizada, sus no leídos (solo cuentan los que llegan con la ventana minimizada; el
//   server no trackea leídos) y si la lista de conversaciones está desplegada.
//   QUÉ NO GUARDA: el hilo. Lo trae y lo sondea cada ventana mientras exista, abierta o minimizada (containers/ChatDock).
//   Una conversación sin ventana no se sondea: no hay badge para ella (no son 7 pollers).
// AMIGOS YA NO ES SECCIÓN (tanda F2, 12-oct): los amigos VIVEN acá. Además de las ventanas, el store sabe:
//   - `friendsRev`: sube cuando cambió el grafo social (se aceptó/rechazó una solicitud en la zona pinneada del Feed, en
//     Buscar → Personas o en la campana, o llegó un amigo nuevo): el dock, el Feed y Personas vuelven a pedir lo suyo.
//   - `awaiting`: las solicitudes que Ian MANDÓ ("Quiero contactarlo") y todavía no se aceptaron. Mientras haya alguna, el
//     dock sondea la lista de amigos; cuando el chico aparece, entra su ventana MINIMIZADA (su saludo llega como no leído:
//     badge) sin robarle el foco a lo que Ian está haciendo (chatArrived).
// EL LUGAR: el dock mide su ancho disponible (setDockWidth) y en CADA cambio se reparte (fit, abajo):
//   1. si no entran, se minimizan las expandidas MÁS VIEJAS (por último uso; nunca la recién abierta/restaurada);
//   2. las barras minimizadas se encogen con elipsis hasta DOCK.minMin (eso lo hace el CSS: flex-shrink);
//   3. si ni así entran, las minimizadas más viejas se OCULTAN —no se cierran: siguen vivas, sondean y vuelven solas al
//      haber lugar— y la barra «Mensajes» lo avisa con un «+N». Nunca hay scroll horizontal de página.
import { useSyncExternalStore } from 'react';

/** Medidas del dock en px. Son LA fuente: el dock las pasa al CSS como variables (--fdk-*), así el reparto que se
 *  calcula acá y lo que dibuja friends.css no se pueden desalinear. */
export const DOCK = {
  /** Hueco parejo entre todas las piezas de la fila. */
  gap: 10,
  /** Barra «Mensajes» (minimizada o desplegada: mismo ancho). */
  bar: 280,
  /** Ventana expandida. */
  win: 328,
  /** Ventana expandida en pantallas muy angostas (el único caso en que se achica). */
  winMin: 260,
  /** Ventana minimizada: ancho preferido y el mínimo al que se encoge con elipsis. */
  minPref: 220,
  minMin: 120,
} as const;

export type DockWin = {
  id: string;
  /** Minimizada: en la fila queda solo su barra. */
  min: boolean;
  /** Mensajes que llegaron con la ventana minimizada (se limpia al restaurarla). */
  unread: number;
  /** Último uso (abrir/reabrir/restaurar): decide qué ventana es "la más vieja" al repartir el lugar. */
  act: number;
};
export type DockSnap = {
  /** En orden de apertura: la última es la más nueva (la pegada a la barra). */
  wins: DockWin[];
  /** Ids de las minimizadas que hoy no entran en la fila (paso 3 del reparto). */
  hidden: string[];
  /** Lista de conversaciones desplegada. */
  listOpen: boolean;
  /** Pedido de foco al campo de una ventana (abrir, reabrir o restaurar): `n` cambia con cada pedido. */
  focus: { id: string; n: number } | null;
  /** Ancho disponible medido (0 = todavía no se midió: no se reparte). */
  width: number;
  /** Sube cuando cambió el grafo social (amigos o solicitudes): el dock, el Feed y Personas vuelven a pedir lo suyo. */
  friendsRev: number;
  /** Ids de los chicos a los que Ian les mandó una solicitud y todavía no la aceptaron (el dock los espera). */
  awaiting: string[];
};

/* ---------- reparto del lugar (puro) ---------- */
/** Ancho de la fila con `exp` ventanas expandidas y `min` minimizadas al mínimo, más la barra y los huecos. */
const rowWidth = (exp: number, min: number) => exp * DOCK.win + min * DOCK.minMin + DOCK.bar + (exp + min) * DOCK.gap;

/** Pasos 1 y 3 del reparto (ver arriba). Solo MINIMIZA (nunca expande sola una ventana), así que es idempotente. */
export function fitDock(wins: DockWin[], width: number): { wins: DockWin[]; hidden: string[] } {
  if (!(width > 0) || !wins.length) return { wins, hidden: [] };
  // La recién abierta/restaurada no se toca (si ni ella entra, el CSS la angosta hasta DOCK.winMin).
  const keep = wins.reduce((a, w) => (w.act > a.act ? w : a)).id;
  const lru = [...wins].sort((a, b) => a.act - b.act);
  let out = wins;
  let exp = wins.filter((w) => !w.min).length;
  let min = wins.length - exp;
  for (const w of lru) {
    if (rowWidth(exp, min) <= width) break;
    if (w.min || w.id === keep) continue;
    out = out.map((x) => (x.id === w.id ? { ...x, min: true } : x));
    exp--; min++;
  }
  const hidden: string[] = [];
  for (const w of lru) {
    if (rowWidth(exp, min) <= width) break;
    if (!out.find((x) => x.id === w.id)?.min) continue;
    hidden.push(w.id);
    min--;
  }
  return { wins: out, hidden };
}

/* ---------- store ---------- */
let snap: DockSnap = { wins: [], hidden: [], listOpen: false, focus: null, width: 0, friendsRev: 0, awaiting: [] };
const listeners = new Set<() => void>();
let clock = 0;
function emit(next: DockSnap) {
  const f = fitDock(next.wins, next.width);
  snap = { ...next, wins: f.wins, hidden: f.hidden };
  listeners.forEach((l) => l());
}
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const getSnap = () => snap;

/** El estado del dock (re-renderiza con cada cambio). */
export const useChatDock = (): DockSnap => useSyncExternalStore(subscribe, getSnap, getSnap);

/** Abre la conversación con un amigo. Si ya tiene ventana NO la duplica: la restaura (si estaba minimizada u oculta),
 *  le limpia los no leídos y le lleva el foco, sin moverla de su lugar en la fila. Si es nueva, entra pegada a la barra. */
export function openChat(id: string) {
  const t = ++clock;
  const has = snap.wins.some((w) => w.id === id);
  const wins = has
    ? snap.wins.map((w) => (w.id === id ? { ...w, min: false, unread: 0, act: t } : w))
    : [...snap.wins, { id, min: false, unread: 0, act: t }];
  emit({ ...snap, wins, focus: { id, n: t } });
}

/** Minimiza una ventana: en la fila queda su barra (con su cerrar); tocarla la restaura (openChat). */
export function minimizeChat(id: string) {
  if (!snap.wins.some((w) => w.id === id && !w.min)) return;
  emit({ ...snap, wins: snap.wins.map((w) => (w.id === id ? { ...w, min: true } : w)) });
}

/** Cierra una ventana: sale de la fila (que se compacta) y deja de sondearse. */
export function closeChat(id: string) {
  if (!snap.wins.some((w) => w.id === id)) return;
  emit({ ...snap, wins: snap.wins.filter((w) => w.id !== id), focus: snap.focus?.id === id ? null : snap.focus });
}

/** Despliega / pliega la lista de conversaciones de la barra «Mensajes». */
export function setChatListOpen(open: boolean) {
  if (snap.listOpen !== open) emit({ ...snap, listOpen: open });
}
export const toggleChatList = () => setChatListOpen(!snap.listOpen);

/** Llegaron `n` mensajes nuevos a una conversación: suman al badge SOLO si su ventana está minimizada. */
export function bumpUnread(id: string, n: number) {
  if (n <= 0 || !snap.wins.some((w) => w.id === id && w.min)) return;
  emit({ ...snap, wins: snap.wins.map((w) => (w.id === id ? { ...w, unread: w.unread + n } : w)) });
}

/** El dock midió su ancho disponible (al montar y con cada cambio de tamaño). 0 = oculto: se ignora. */
export function setDockWidth(px: number) {
  const w = Math.floor(px);
  if (w > 0 && w !== snap.width) emit({ ...snap, width: w });
}

/** Cambió el grafo social (Ian aceptó o rechazó una solicitud en la zona pinneada del Feed, en Buscar → Personas o en la
 *  campana; un regalo le cambió la ropa a un amigo): el dock vuelve a pedir la lista y los demás que escuchan friendsRev,
 *  lo suyo. */
export function chatFriendsChanged() {
  emit({ ...snap, friendsRev: snap.friendsRev + 1 });
}

/** Ian le mandó una solicitud a alguien ("Quiero contactarlo"): el dock lo espera hasta que la acepte. */
export function chatAwait(id: string) {
  if (!snap.awaiting.includes(id)) emit({ ...snap, awaiting: [...snap.awaiting, id] });
}

/** Ese chico aceptó la solicitud de Ian (el dock lo vio aparecer en la lista): deja de esperarse, el grafo cambió
 *  (friendsRev) y su conversación entra a la fila MINIMIZADA, la más nueva: su saludo llega por el sondeo de la ventana
 *  y suma al badge. Sin foco: no interrumpe lo que Ian está haciendo. Si ya tenía ventana, no se toca. */
export function chatArrived(id: string) {
  // Su "último uso" queda apenas debajo de la ventana que Ian está usando: si falta lugar, la que se cuida es la de Ian
  // (fitDock nunca minimiza la más reciente) y la recién llegada es la última minimizada en ocultarse.
  const top = snap.wins.reduce((m, w) => Math.max(m, w.act), 0);
  const act = snap.wins.length ? top - 0.5 : ++clock;
  const wins = snap.wins.some((w) => w.id === id) ? snap.wins : [...snap.wins, { id, min: true, unread: 0, act }];
  emit({ ...snap, wins, awaiting: snap.awaiting.filter((x) => x !== id), friendsRev: snap.friendsRev + 1 });
}

/** Amigos apagado por la familia: se cierra todo (al volver a prenderlo, el dock arranca de cero, minimizado). */
export function resetChatDock() {
  if (!snap.wins.length && !snap.listOpen && !snap.focus && !snap.awaiting.length) return;
  emit({ ...snap, wins: [], listOpen: false, focus: null, awaiting: [] });
}
