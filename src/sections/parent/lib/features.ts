// Los grandes on-off del padre (Tienda, Ligas, Amigos, Chat) del lado de la UI: singleton de módulo +
// useSyncExternalStore (mismo patrón que shared/audio/bgAudio.ts) sobre api.features(). Lo leen el menú
// (Sidebar), el portón de rutas (FeatureGate) y la Zona de padres. Otras secciones pueden usar
// useFeatures() para esconder lo suyo (p. ej. el ⚡ de Practicar con la Tienda apagada).
// CÓMO SE ENTERA LA CUENTA DEL CHICO DE UN CAMBIO (definido y testeado en el E2E de la tanda 4):
//   1. Misma pestaña: saveFeature() publica la respuesta del server → menú y páginas cambian AL INSTANTE.
//   2. Otras pestañas del mismo navegador: BroadcastChannel → también al instante.
//   3. Otro dispositivo: se vuelve a preguntar al montar, al volver el foco/visibilidad, y al ENTRAR a
//      una ruta apagable; si el dato tiene más de FRESH_MS, esa ruta no se muestra hasta confirmarlo.
//   La verdad está en el server: con la Tienda apagada /api/market* responde 403 (fail-closed).
// FAIL-CLOSED en la UI: mientras no se sabe (null), lo apagable NO se muestra.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { api } from '../../../api';
import type { ParentFeatures } from '../../../api/types';

export type FeatureKey = keyof ParentFeatures;
export const FEATURE_KEYS: FeatureKey[] = ['tienda', 'ligas', 'amigos', 'chat'];

/** Ruta del chico que pertenece a cada funcionalidad (incluye sus subrutas: /tienda?vista=deseos, etc.). */
const ROUTE: Record<FeatureKey, string> = { tienda: '/tienda', ligas: '/ligas', amigos: '/amigos', chat: '/chat' };
/** Un dato más viejo que esto no alcanza para abrir una sección apagable: se confirma con el server. */
const FRESH_MS = 15_000;

export function featureForPath(path: string): FeatureKey | null {
  for (const k of FEATURE_KEYS) if (path === ROUTE[k] || path.startsWith(ROUTE[k] + '/')) return k;
  return null;
}
/** ¿Se muestra lo que vive en `path`? Sin datos todavía (null) lo apagable queda oculto (fail-closed). */
export function featureAllows(f: ParentFeatures | null, path: string): boolean {
  const k = featureForPath(path);
  return !k || f?.[k] === true;
}

const isFeatures = (x: unknown): x is ParentFeatures =>
  !!x && typeof x === 'object' && FEATURE_KEYS.every((k) => typeof (x as Record<string, unknown>)[k] === 'boolean');

/* ---------- store ---------- */
/** `syncedAt` = cuándo se confirmó con el server (lectura o guardado); `failed` = la última lectura falló. */
type Snap = { features: ParentFeatures | null; failed: boolean; syncedAt: number };
let snap: Snap = { features: null, failed: false, syncedAt: 0 };
const listeners = new Set<() => void>();
const emit = (next: Snap) => { snap = next; listeners.forEach((l) => l()); };
const getSnap = () => snap;

let inflight: Promise<void> | null = null;
/** Sube con cada dato MÁS NUEVO que una lectura (guardado del padre, aviso de otra pestaña): una
 *  lectura que salió antes ya no pisa ese dato cuando vuelve. */
let version = 0;
let retry: ReturnType<typeof setTimeout> | null = null;

/** Trae los on-off del server (una sola lectura en vuelo a la vez). Si falla, lo marca y reintenta. */
export function refreshFeatures(): Promise<void> {
  if (inflight) return inflight;
  const v = version;
  inflight = api.features().then(
    (f) => { if (v === version && isFeatures(f)) emit({ features: f, failed: false, syncedAt: Date.now() }); },
    () => {
      if (v !== version) return;
      emit({ ...snap, failed: true });
      if (!retry && listeners.size) retry = setTimeout(() => { retry = null; void refreshFeatures(); }, 4000);
    },
  ).finally(() => { inflight = null; });
  return inflight;
}

function publish(f: ParentFeatures) {
  version++;
  emit({ features: { ...f }, failed: false, syncedAt: Date.now() });
}

/* Otras pestañas del mismo navegador (p. ej. el padre en una y el chico en otra). */
const CHANNEL = 'innerith:parent-features';
let bc: BroadcastChannel | null = null;
function openChannel() {
  if (bc || typeof BroadcastChannel === 'undefined') return;
  bc = new BroadcastChannel(CHANNEL);
  bc.onmessage = (e: MessageEvent) => { if (isFeatures(e.data)) publish(e.data); };
}

const onWake = () => { if (document.visibilityState === 'visible') void refreshFeatures(); };
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (listeners.size === 1) {
    openChannel();
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size) return;
    window.removeEventListener('focus', onWake);
    document.removeEventListener('visibilitychange', onWake);
    bc?.close();
    bc = null;
  };
}

/** Los on-off vigentes y si la última lectura falló. Cada montaje dispara una lectura (deduplicada). */
export function useFeaturesStatus(): { features: ParentFeatures | null; failed: boolean } {
  const s = useSyncExternalStore(subscribe, getSnap, getSnap);
  useEffect(() => { void refreshFeatures(); }, []);
  return s;
}
/** Los on-off vigentes (null = todavía no se sabe: lo apagable no se muestra). */
export const useFeatures = (): ParentFeatures | null => useFeaturesStatus().features;

export type GateState = 'on' | 'off' | 'loading' | 'error';
/** Estado del portón para una ruta del chico. Al ENTRAR a una sección apagable se le vuelve a preguntar
 *  al server; si lo que hay en memoria es viejo (> FRESH_MS), la sección no se muestra hasta tener la
 *  respuesta (así otro dispositivo no ve un instante algo que el padre ya apagó). Dentro de la misma
 *  sección (p. ej. /tienda → /tienda?vista=deseos) no se vuelve a esperar. */
export function useFeatureGate(path: string): GateState {
  const s = useSyncExternalStore(subscribe, getSnap, getSnap);
  const key = featureForPath(path);
  // Al cambiar de sección: si el dato es viejo, hace falta uno confirmado DESPUÉS de esta entrada.
  const [entry, setEntry] = useState<{ key: FeatureKey | null; after: number }>({ key: null, after: 0 });
  if (entry.key !== key) {
    const stale = !s.features || Date.now() - s.syncedAt >= FRESH_MS;
    setEntry({ key, after: key && stale ? Date.now() : 0 });
  }
  useEffect(() => { if (key) void refreshFeatures(); }, [key]);
  if (!key) return 'on';
  const waiting = !s.features || (entry.key === key && s.syncedAt < entry.after);
  if (waiting) return s.failed ? 'error' : 'loading';
  return s.features![key] ? 'on' : 'off';
}

/** El padre prende/apaga: guarda en el server y aplica la respuesta acá y en las otras pestañas. */
export async function saveFeature(key: FeatureKey, on: boolean): Promise<ParentFeatures> {
  const f = await api.setFeature(key, on);
  if (!isFeatures(f)) throw new Error('respuesta inválida');
  publish(f);
  openChannel();
  try { bc?.postMessage(f); } catch { /* sin canal: las otras pestañas se enteran al volver el foco */ }
  return f;
}
