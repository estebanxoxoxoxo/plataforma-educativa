// Horarios por sección del lado del CHICO (porte Smarty W7; HORARIOS.md + lib/featureSchedule.ts del POC). El SERVER es la
// verdad: schedules.json + el 403 {error:'horario'} de la API de una sección fuera de su franja (server/src/schedule.ts).
// Acá solo se PINTA: el menú esconde lo cerrado (Sidebar) y la ruta muestra "cerrado" (ScheduleGate, compuesto DENTRO de
// FeatureGate: si el padre APAGÓ la sección gana el apagado; el horario corre solo si está prendida). Vive junto a
// features.ts y limits.ts porque es lo mismo: config del padre que lee la UI del chico por un GET público.
// Singleton de módulo + useSyncExternalStore (el patrón de features.ts / limits.ts; el POC usaba el mismo con su tick).
// LA FRANJA SE EVALÚA CON LA HORA DEL SERVER: cada lectura guarda el delta serverNow − Date.now() (al medio del viaje) y se
// evalúa con Date.now() + delta. Ojo: el día y la hora se leen en la zona horaria del NAVEGADOR (el contrato trae el
// instante, no la zona del server); en el demo es la misma máquina.
// CÓMO SE ENTERA EL CHICO DE UN CAMBIO:
//   1. Misma pestaña: el editor del padre publica la respuesta del server (adoptSchedules) → menú y rutas cambian al toque.
//   2. Otras pestañas del navegador: BroadcastChannel → también al toque.
//   3. Otro dispositivo: el TICK (cada 30 s, el setInterval del POC) vuelve a leer y re-evalúa; también al volver el foco y
//      al ENTRAR a una sección con el dato viejo (> 15 s: la ruta espera la lectura nueva, como useFeatureGate).
// Una ventana que se CIERRA con la sección abierta: el tick la saca del menú y la vista montada pasa a "cerrado" (como el
// store del POC, sin recargar). QUIRK FIEL (informe 03 §6): el audio de fondo que ya sonaba NO se corta — nada acá toca
// bgAudio, ni el server puede.
// FAIL-OPEN, como el POC ("nunca encerramos al niño por un horario mal cargado"): sin dato, con datos inválidos o si la
// lectura falla, abierta. El menú no parpadea al cargar y, si de verdad estaba cerrada, la API ya responde 403.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { api } from '../../../api';
import type { SchedulesResponse, SectionKey } from '../../../api/types';
import { SECTION_KEYS, isOpenAt, nextOpenLabelAt, sectionForPath } from './scheduleRules';

type Schedules = SchedulesResponse['schedules'];
/** `offset` = serverNow − Date.now() · `syncedAt` = cuándo se confirmó con el server · `sig` = qué secciones están abiertas
 *  (la FIRMA del POC: si cambia con el tick, re-render). */
type Snap = { schedules: Schedules | null; offset: number; failed: boolean; syncedAt: number; sig: string };

const TICK_MS = 30_000;
/** Un dato más viejo que esto no alcanza para ENTRAR a una sección con horario: se confirma con el server. */
const FRESH_MS = 15_000;

let snap: Snap = { schedules: null, offset: 0, failed: false, syncedAt: 0, sig: '' };
const listeners = new Set<() => void>();
const emit = (next: Snap) => { snap = next; listeners.forEach((l) => l()); };
const getSnap = () => snap;

/** El reloj del server, según el último delta conocido. */
export const serverDate = (s: Snap = snap) => new Date(Date.now() + s.offset);
const sigOf = (sch: Schedules | null, now: Date) => SECTION_KEYS.map((k) => (!sch || isOpenAt(sch[k], now) ? '1' : '0')).join('');

const isResponse = (x: unknown): x is SchedulesResponse => {
  const r = x as SchedulesResponse | null;
  return !!r && typeof r === 'object' && !!r.schedules && typeof r.schedules === 'object' && !Array.isArray(r.schedules) && typeof r.serverNow === 'number';
};
/** Aplica una respuesta del server. `sentAt`/`gotAt` = el viaje: el delta se toma al medio (mitad de la latencia). */
function adopt(r: SchedulesResponse, sentAt: number, gotAt: number) {
  const offset = r.serverNow - (sentAt + gotAt) / 2;
  emit({ schedules: r.schedules, offset, failed: false, syncedAt: Date.now(), sig: sigOf(r.schedules, new Date(Date.now() + offset)) });
}
/** Re-evalúa con lo que hay (el tick): solo avisa si cambió qué está abierto. */
function reeval() {
  const sig = sigOf(snap.schedules, serverDate());
  if (sig !== snap.sig) emit({ ...snap, sig });
}

let inflight: Promise<void> | null = null;
/** Sube con cada dato MÁS NUEVO que una lectura (guardado del padre, aviso de otra pestaña): una lectura que salió antes
 *  ya no lo pisa cuando vuelve. */
let version = 0;

/** Lee los horarios del server (una sola lectura en vuelo a la vez). Si falla, rige lo último conocido (o abierto). */
export function refreshSchedules(): Promise<void> {
  if (inflight) return inflight;
  const v = version;
  const sentAt = Date.now();
  inflight = api.schedules().then(
    (r) => { if (v === version && isResponse(r)) adopt(r, sentAt, Date.now()); else reeval(); },
    () => { if (v === version) emit({ ...snap, failed: true, sig: sigOf(snap.schedules, serverDate()) }); },
  ).finally(() => { inflight = null; });
  return inflight;
}

/* Otras pestañas del mismo navegador (el padre en una, el chico en otra). */
const CHANNEL = 'innerith:parent-schedules';
let bc: BroadcastChannel | null = null;
function openChannel() {
  if (bc || typeof BroadcastChannel === 'undefined') return;
  bc = new BroadcastChannel(CHANNEL);
  bc.onmessage = (e: MessageEvent) => { if (isResponse(e.data)) { version++; const now = Date.now(); adopt(e.data, now, now); } };
}

/** El padre guardó horarios (el server ya respondió): rigen ya en esta pestaña y en las otras del navegador. */
export function adoptSchedules(r: SchedulesResponse) {
  if (!isResponse(r)) return;
  version++;
  const now = Date.now();
  adopt(r, now, now);
  openChannel();
  try { bc?.postMessage({ schedules: r.schedules, serverNow: r.serverNow }); } catch { /* las otras pestañas se enteran con el tick */ }
}

let timer: ReturnType<typeof setInterval> | null = null;
/** El tick del POC (30 s): vuelve a leer (otro dispositivo) y re-evalúa con la hora del server. Con la pestaña oculta
 *  solo re-evalúa; al volver a verse, lee (onWake). */
function tick() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') { reeval(); return; }
  void refreshSchedules();
}
const onWake = () => { if (document.visibilityState === 'visible') void refreshSchedules(); };
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) {
    openChannel();
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    timer = setInterval(tick, TICK_MS);
    void refreshSchedules();
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

/** Los horarios vigentes (re-renderiza con cada lectura y cuando una franja abre o cierra). */
export const useSchedules = (): Snap => useSyncExternalStore(subscribe, getSnap, getSnap);

/** ¿La sección está abierta AHORA (hora del server)? Sin dato todavía: abierta (fail-open, como el POC). */
export function isSectionOpen(key: SectionKey, s: Snap = snap): boolean {
  return !s.schedules || isOpenAt(s.schedules[key], serverDate(s));
}
/** Para el menú: ¿se muestra lo que vive en `path`? Lo que no es de una sección con horario (el Feed), siempre. */
export function scheduleAllows(s: Snap, path: string): boolean {
  const k = sectionForPath(path);
  return !k || isSectionOpen(k, s);
}

export type ScheduleGateState =
  | { state: 'open' }
  | { state: 'loading' }
  | { state: 'closed'; key: SectionKey; /** "HH:MM" si hoy abre más tarde */ opensAt: string | null };
const OPEN: ScheduleGateState = { state: 'open' };
const LOADING: ScheduleGateState = { state: 'loading' };

/** Estado del portón de horario para una ruta del chico. Al ENTRAR a una sección con horario se le vuelve a preguntar al
 *  server; si lo que hay es viejo (> FRESH_MS) o todavía no hay nada, la sección espera esa respuesta (así otro dispositivo
 *  no ve un instante algo que el padre ya cerró). Si la lectura falla: abierta (el server igual responde 403). */
export function useScheduleGate(path: string): ScheduleGateState {
  const s = useSyncExternalStore(subscribe, getSnap, getSnap);
  const key = sectionForPath(path);
  const [entry, setEntry] = useState<{ key: SectionKey | null; after: number }>({ key: null, after: 0 });
  if (entry.key !== key) {
    const stale = !s.schedules || Date.now() - s.syncedAt >= FRESH_MS;
    setEntry({ key, after: key && stale ? Date.now() : 0 });
  }
  useEffect(() => { if (key) void refreshSchedules(); }, [key]);
  if (!key) return OPEN;
  const waiting = !s.schedules || (entry.key === key && s.syncedAt < entry.after);
  if (waiting) return s.failed ? OPEN : LOADING;
  const now = serverDate(s);
  if (isOpenAt(s.schedules?.[key], now)) return OPEN;
  return { state: 'closed', key, opensAt: nextOpenLabelAt(s.schedules?.[key], now) };
}
