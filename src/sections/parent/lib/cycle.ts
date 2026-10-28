// CICLO DEL DÍA del lado del CHICO (tanda F2, 28-oct; docs/USUARIOS.md §11). Reemplaza al store de los "Horarios por sección"
// (lib/schedules.ts, porte W7) con el MISMO mecanismo y las reglas COMPARTIDAS con el server (src/shared/lib/cycleRules.ts:
// el mismo código evalúa el 403 en el server y el menú acá). El SERVER es la verdad: schedules.json v3 + el 403
// {error:'horario', section, opensAt} de la API de una sección no disponible (server/src/schedule.ts). Acá solo se PINTA: el
// menú esconde lo cerrado (Sidebar) y la ruta muestra "descansando" (ScheduleGate, compuesto DENTRO de FeatureGate: si el
// padre APAGÓ la sección gana el apagado).
// Lee `cycle` + `demoRange` + `serverNow` + `tz` de GET /api/schedules (el campo viejo `schedules`, compat de F1, se retiró).
// Singleton de módulo + useSyncExternalStore (el patrón de features.ts / limits.ts).
// SE EVALÚA CON LA HORA DEL SERVER: cada lectura guarda el delta serverNow − Date.now() (al medio del viaje) y se evalúa con
// Date.now() + delta, en la ZONA HORARIA DE LA FAMILIA (`tz` de la respuesta; sin zona, la del navegador —en el demo, la
// misma máquina que el server—). Con OVERRIDE DE DEMO (`demoRange`, el selector "Ciclo (demo)" del Sidebar) se evalúa "como si
// el reloj estuviera en ese rango" (la misma regla del server) y no hay "se abre a las…".
// CÓMO SE ENTERA EL CHICO DE UN CAMBIO:
//   1. Misma pestaña: Familia → Ciclo del día o el selector de demo publican la respuesta del server (adoptCycle) → menú y
//      rutas cambian al toque, SIN recargar.
//   2. Otras pestañas del navegador: BroadcastChannel → también al toque.
//   3. Otro dispositivo: el TICK (cada 30 s) vuelve a leer y re-evalúa; también al volver el foco y al ENTRAR a una sección
//      con el dato viejo (> 15 s: la ruta espera la lectura nueva).
// Un rango que TERMINA con la sección abierta: el tick la saca del menú y la vista montada pasa a "descansando" (sin
// recargar). QUIRK FIEL (W7): el audio de fondo que ya sonaba NO se corta.
// FAIL-OPEN ("nunca encerramos al chico por un horario mal cargado"): sin dato, con datos inválidos o si la lectura falla,
// disponible. El menú no parpadea al cargar y, si de verdad estaba cerrada, la API ya responde 403.
// POR INTEGRANTE (U3): la respuesta dice de quién es (`member`). Lo que publica Familia (o el selector de demo con el adulto
// eligiendo a un integrante) se adopta solo donde ESE integrante es el usuario activo; además avisa a los oyentes por
// integrante (onMemberCycle: el selector de demo del adulto y el editor de Familia). La zona (adoptFamilyTz) la adoptan
// TODAS las pestañas, también la del adulto (el reloj de su barra superior la usa).
import { useEffect, useState, useSyncExternalStore } from 'react';
import { actingUserId, api } from '../../../api';
import type { CycleRange, CycleResponse, SchedulesResponse, SectionKey } from '../../../api/types';
import { SECTION_KEYS, minuteOfDay, opensAtToday, sectionAvailableAt } from '../../../shared/lib/cycleRules';
import { sectionForPath } from './cycleSections';

/** Lo que dice el server del ciclo de UN integrante (una SchedulesResponse o una CycleResponse, normalizadas). */
export type MemberCycle = { member: string | null; ranges: CycleRange[]; demoRange: string | null; serverNow: number; tz: string | null };

/** `ranges` null = todavía sin dato (todo disponible: fail-open) · `offset` = serverNow − Date.now() · `syncedAt` = cuándo se
 *  confirmó con el server · `sig` = qué secciones están disponibles (si cambia con el tick, re-render). */
type Snap = {
  ranges: CycleRange[] | null; demoRange: string | null; member: string | null;
  /** zona IANA de la familia (null = la local) */ tz: string | null;
  offset: number; failed: boolean; syncedAt: number; sig: string;
};

const TICK_MS = 30_000;
/** Un dato más viejo que esto no alcanza para ENTRAR a una sección del ciclo: se confirma con el server. */
const FRESH_MS = 15_000;

let snap: Snap = { ranges: null, demoRange: null, member: null, tz: null, offset: 0, failed: false, syncedAt: 0, sig: '' };
const listeners = new Set<() => void>();
const emit = (next: Snap) => { snap = next; listeners.forEach((l) => l()); };
const getSnap = () => snap;

/** El reloj del server, según el último delta conocido. */
export const serverDate = (s: Snap = snap) => new Date(Date.now() + s.offset);
/** El minuto del día del server en la zona de la familia. */
const minuteNow = (s: Snap = snap) => minuteOfDay(serverDate(s), s.tz);
const sigOf = (ranges: CycleRange[] | null, demo: string | null, cur: number) =>
  SECTION_KEYS.map((k) => (!ranges || sectionAvailableAt(ranges, k, cur, demo) ? '1' : '0')).join('');

/** Normaliza una respuesta del server (GET /api/schedules, POST /api/demo/cycle o GET/POST /api/parent/cycle); null si no
 *  tiene la forma (fail-open: no se adopta). */
export function toMemberCycle(x: unknown): MemberCycle | null {
  const r = x as Partial<SchedulesResponse & CycleResponse> | null;
  if (!r || typeof r !== 'object' || typeof r.serverNow !== 'number' || !r.cycle || !Array.isArray(r.cycle.ranges)) return null;
  return {
    member: typeof r.member === 'string' && r.member ? r.member : null,
    ranges: r.cycle.ranges,
    demoRange: typeof r.demoRange === 'string' && r.demoRange ? r.demoRange : null,
    serverNow: r.serverNow,
    tz: typeof r.tz === 'string' && r.tz ? r.tz : null,
  };
}

/** Aplica el ciclo del usuario activo. `sentAt`/`gotAt` = el viaje: el delta se toma al medio (mitad de la latencia). */
function adopt(c: MemberCycle, sentAt: number, gotAt: number) {
  const offset = c.serverNow - (sentAt + gotAt) / 2;
  const next: Snap = { ranges: c.ranges, demoRange: c.demoRange, member: c.member, tz: c.tz, offset, failed: false, syncedAt: Date.now(), sig: '' };
  emit({ ...next, sig: sigOf(next.ranges, next.demoRange, minuteNow(next)) });
}
/** Re-evalúa con lo que hay (el tick): solo avisa si cambió qué está disponible. */
function reeval() {
  const sig = sigOf(snap.ranges, snap.demoRange, minuteNow());
  if (sig !== snap.sig) emit({ ...snap, sig });
}

let inflight: Promise<void> | null = null;
/** Sube con cada dato MÁS NUEVO que una lectura (guardado del padre, selector de demo, aviso de otra pestaña): una lectura
 *  que salió antes ya no lo pisa cuando vuelve. */
let version = 0;

/** Lee el ciclo del server (una sola lectura en vuelo a la vez). Si falla, rige lo último conocido (o disponible). */
export function refreshCycle(): Promise<void> {
  if (inflight) return inflight;
  const v = version;
  const sentAt = Date.now();
  inflight = api.schedules().then(
    (r) => { const c = toMemberCycle(r); if (v === version && c) adopt(c, sentAt, Date.now()); else reeval(); },
    () => { if (v === version) emit({ ...snap, failed: true, sig: sigOf(snap.ranges, snap.demoRange, minuteNow()) }); },
  ).finally(() => { inflight = null; });
  return inflight;
}

/* Oyentes POR INTEGRANTE (misma pestaña y, vía BroadcastChannel, las otras): el selector de demo del adulto (el ciclo del
   integrante que está mirando en Familia) y el editor de Familia → Ciclo del día (el "en la demo, X está en…"). */
const memberListeners = new Set<(c: MemberCycle) => void>();
/** Avisa cada ciclo que el server confirmó para algún integrante (guardado del padre o selector de demo). */
export function onMemberCycle(cb: (c: MemberCycle) => void): () => void {
  memberListeners.add(cb);
  return () => { memberListeners.delete(cb); };
}
const tellMembers = (c: MemberCycle) => memberListeners.forEach((l) => l(c));

/* Otras pestañas del mismo navegador (el padre en una, el chico en otra). */
const CHANNEL = 'innerith:cycle';
type Msg = { kind: 'cycle'; cycle: MemberCycle } | { kind: 'tz'; tz: string | null };
let bc: BroadcastChannel | null = null;
function openChannel() {
  if (bc || typeof BroadcastChannel === 'undefined') return;
  bc = new BroadcastChannel(CHANNEL);
  bc.onmessage = (e: MessageEvent) => {
    const d = e.data as Msg | null;
    if (d?.kind === 'tz') { applyTz(d.tz); return; }
    const w = d?.kind === 'cycle' ? d.cycle : null;
    const c = w && typeof w === 'object' ? toMemberCycle({ cycle: { ranges: w.ranges }, member: w.member, demoRange: w.demoRange, serverNow: w.serverNow, tz: w.tz }) : null;
    if (!c) return;
    if (c.member && c.member === actingUserId()) { version++; const now = Date.now(); adopt(c, now, now); }
    tellMembers(c);
  };
}

/** El server confirmó un ciclo de un integrante (el padre lo guardó en Familia, o alguien eligió un rango en el selector de
 *  demo): rige YA donde ese integrante es el usuario activo —en esta pestaña y en las otras del navegador— y les avisa a los
 *  oyentes por integrante. Una respuesta sin la forma esperada no se adopta (fail-open). */
export function adoptCycle(r: SchedulesResponse | CycleResponse) {
  const c = toMemberCycle(r);
  if (!c) return;
  if (c.member && c.member === actingUserId()) {
    version++;
    const now = Date.now();
    adopt(c, now, now);
  }
  tellMembers(c);
  openChannel();
  try { bc?.postMessage({ kind: 'cycle', cycle: c } satisfies Msg); } catch { /* las otras pestañas se enteran con el tick */ }
}

/** La zona de la familia cambió: re-evalúa con ella (una lectura que salió antes ya no la pisa). */
function applyTz(raw: unknown) {
  const tz = typeof raw === 'string' && raw ? raw : null;
  version++;
  const next = { ...snap, tz };
  emit({ ...next, sig: sigOf(next.ranges, next.demoRange, minuteNow(next)) });
}
/** El padre guardó la ZONA HORARIA DE LA FAMILIA: rige ya en esta pestaña (también la del adulto: el reloj de la barra
 *  superior) y en las otras del navegador, sea quien sea su usuario activo. */
export function adoptFamilyTz(tz: string | null) {
  applyTz(tz);
  openChannel();
  try { bc?.postMessage({ kind: 'tz', tz } satisfies Msg); } catch { /* las otras pestañas se enteran con el tick */ }
}

let timer: ReturnType<typeof setInterval> | null = null;
/** El tick (30 s): vuelve a leer (otro dispositivo) y re-evalúa con la hora del server. Con la pestaña oculta solo
 *  re-evalúa; al volver a verse, lee (onWake). */
function tick() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') { reeval(); return; }
  void refreshCycle();
}
const onWake = () => { if (document.visibilityState === 'visible') void refreshCycle(); };
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) {
    openChannel();
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    timer = setInterval(tick, TICK_MS);
    void refreshCycle();
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size) return;
    window.removeEventListener('focus', onWake);
    document.removeEventListener('visibilitychange', onWake);
    if (timer) { clearInterval(timer); timer = null; }
    bc?.close();
    bc = null;
  };
}

/** El ciclo vigente del usuario activo (re-renderiza con cada lectura y cuando una sección abre o cierra). También lo leen
 *  el reloj de la barra superior, el Feed, el Calendario y Mentores, por la hora del server y la zona de la familia. */
export const useCycle = (): Snap => useSyncExternalStore(subscribe, getSnap, getSnap);

/** ¿La sección está disponible AHORA (hora del server, con el override de demo si hay)? Sin dato todavía: disponible. */
export function isSectionOpen(key: SectionKey, s: Snap = snap): boolean {
  return !s.ranges || sectionAvailableAt(s.ranges, key, minuteNow(s), s.demoRange);
}
/** Para el menú: ¿se muestra lo que vive en `path`? Lo que no es de una sección del ciclo (el Feed), siempre. */
export function cycleAllows(s: Snap, path: string): boolean {
  const k = sectionForPath(path);
  return !k || isSectionOpen(k, s);
}

/** El ciclo de UN integrante como lo ve el ADULTO (GET /api/schedules?member=<id>): lo usa el selector de demo del Sidebar
 *  cuando el adulto está en Familia mirando a ese integrante. Se relee al cambiar de integrante y al volver el foco, y toma
 *  al toque lo que el server confirme para él (onMemberCycle: un guardado de Familia o el propio selector). `member` null =
 *  no pide nada. No toca el store del usuario activo (al adulto no lo gatea el ciclo). */
export function useMemberCycle(member: string | null): { cycle: MemberCycle | null; failed: boolean } {
  const [state, setState] = useState<{ of: string | null; cycle: MemberCycle | null; failed: boolean }>({ of: null, cycle: null, failed: false });
  useEffect(() => {
    if (!member) return;
    let alive = true;
    let seq = 0;
    const load = () => {
      const my = ++seq;
      api.schedules(member).then(
        (r) => { const c = toMemberCycle(r); if (alive && my === seq) setState(c && c.member === member ? { of: member, cycle: c, failed: false } : { of: member, cycle: null, failed: true }); },
        () => { if (alive && my === seq) setState((s) => ({ of: member, cycle: s.of === member ? s.cycle : null, failed: true })); },
      );
    };
    load();
    const off = onMemberCycle((c) => { if (alive && c.member === member) { seq++; setState({ of: member, cycle: c, failed: false }); } });
    const wake = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => { alive = false; off(); window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake); };
  }, [member]);
  return state.of === member ? { cycle: state.cycle, failed: state.failed } : { cycle: null, failed: false };
}

export type CycleGateState =
  | { state: 'open' }
  | { state: 'loading' }
  | { state: 'closed'; key: SectionKey; /** "HH:MM" si hoy abre más tarde (null con override de demo) */ opensAt: string | null };
const OPEN: CycleGateState = { state: 'open' };
const LOADING: CycleGateState = { state: 'loading' };

/** Estado del portón del ciclo para una ruta del chico. Al ENTRAR a una sección del ciclo se le vuelve a preguntar al
 *  server; si lo que hay es viejo (> FRESH_MS) o todavía no hay nada, la sección espera esa respuesta (así otro dispositivo
 *  no ve un instante algo que el padre ya cerró). Si la lectura falla: disponible (el server igual responde 403). */
export function useCycleGate(path: string): CycleGateState {
  const s = useSyncExternalStore(subscribe, getSnap, getSnap);
  const key = sectionForPath(path);
  const [entry, setEntry] = useState<{ key: SectionKey | null; after: number }>({ key: null, after: 0 });
  if (entry.key !== key) {
    const stale = !s.ranges || Date.now() - s.syncedAt >= FRESH_MS;
    setEntry({ key, after: key && stale ? Date.now() : 0 });
  }
  useEffect(() => { if (key) void refreshCycle(); }, [key]);
  if (!key) return OPEN;
  const waiting = !s.ranges || (entry.key === key && s.syncedAt < entry.after);
  if (waiting) return s.failed ? OPEN : LOADING;
  const cur = minuteNow(s);
  if (sectionAvailableAt(s.ranges, key, cur, s.demoRange)) return OPEN;
  return { state: 'closed', key, opensAt: opensAtToday(s.ranges, key, cur, s.demoRange) };
}
