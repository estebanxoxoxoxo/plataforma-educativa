// Topes de volumen que puso la familia, del lado del CHICO (Zona del padre v2; port de settings.maxVolVideo /
// maxVolAmbiente de Smarty). Son TECHOS: el volumen efectivo es min(lo que eligió el chico, tope) y los sliders del
// MiniPlayer no pasan del tope. Los lee shared/audio/bgAudio.ts (lo que suena) y el MiniPlayer (los sliders).
// Singleton de módulo + useSyncExternalStore (mismo patrón que lib/features.ts) sobre GET /api/parent/limits (PÚBLICO:
// no pide la sesión del padre). CÓMO SE ENTERA EL CHICO DE UN CAMBIO:
//   1. Misma pestaña: el panel "Límites" publica la respuesta del server (publishLimits) → baja en el acto.
//   2. Otras pestañas del mismo navegador: BroadcastChannel → también al instante.
//   3. Otro dispositivo: se vuelve a preguntar al cargar, al volver el foco/visibilidad y al abrir el MiniPlayer.
// Sin dato todavía (o si el server no responde) rige el último conocido; al arrancar, 100 = sin tope (el default de
// Smarty): el chico necesita un gesto para que suene algo y para entonces el dato ya llegó.
// U3 · M2: los topes son POR INTEGRANTE. Lo que publica Familia va etiquetado con su integrante y solo rige en una pestaña
// cuyo usuario activo es ese integrante (antes, Familia le ponía los topes del chico al MiniPlayer del propio adulto).
import { useSyncExternalStore } from 'react';
import { actingUserId, api } from '../../../api';
import type { ParentVolume } from '../../../api/types';

const NO_CAP: ParentVolume = { maxMusic: 100, maxNoise: 100 };
const isCap = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 100;
const isVolume = (x: unknown): x is ParentVolume =>
  !!x && typeof x === 'object' && isCap((x as ParentVolume).maxMusic) && isCap((x as ParentVolume).maxNoise);

let caps: ParentVolume = NO_CAP;
const listeners = new Set<() => void>();
function emit(next: ParentVolume) {
  if (next.maxMusic === caps.maxMusic && next.maxNoise === caps.maxNoise) return;
  caps = { maxMusic: next.maxMusic, maxNoise: next.maxNoise };
  listeners.forEach((l) => l());
}
export const getLimits = (): ParentVolume => caps;

let inflight: Promise<void> | null = null;
/** Sube con cada dato MÁS NUEVO que una lectura (guardado del padre, aviso de otra pestaña): una lectura que salió
 *  antes ya no lo pisa cuando vuelve. */
let version = 0;
let retry: ReturnType<typeof setTimeout> | null = null;

/** Trae los topes del server (una sola lectura en vuelo a la vez). Si falla, rige el último conocido y reintenta. */
export function refreshLimits(): Promise<void> {
  if (inflight) return inflight;
  const v = version;
  inflight = api.limits().then(
    (r) => { if (v === version && isVolume(r)) emit(r); },
    () => { if (!retry && listeners.size) retry = setTimeout(() => { retry = null; void refreshLimits(); }, 5000); },
  ).finally(() => { inflight = null; });
  return inflight;
}

/* Otras pestañas del mismo navegador (el padre en una, el chico en otra). */
const CHANNEL = 'innerith:parent-limits';
let bc: BroadcastChannel | null = null;
function openChannel() {
  if (bc || typeof BroadcastChannel === 'undefined') return;
  bc = new BroadcastChannel(CHANNEL);
  bc.onmessage = (e: MessageEvent) => {
    const d = e.data as (ParentVolume & { member?: unknown }) | null;
    if (d && d.member === actingUserId() && isVolume(d)) { version++; emit(d); }
  };
}

const onWake = () => { if (document.visibilityState === 'visible') void refreshLimits(); };
export function subscribeLimits(cb: () => void): () => void {
  listeners.add(cb);
  if (listeners.size === 1) {
    openChannel();
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    void refreshLimits();
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

/** Los topes vigentes (re-renderiza cuando cambian). */
export const useLimits = (): ParentVolume => useSyncExternalStore(subscribeLimits, getLimits, getLimits);

/** El padre cambió los topes de `member` (panel "Límites" o un preset) y el server ya los guardó: rigen ya donde `member`
 *  es el usuario activo —lo que suena baja en el acto—, en esta pestaña y en las otras del navegador. */
export function publishLimits(v: ParentVolume, member: string) {
  if (!isVolume(v)) return;
  if (member === actingUserId()) { version++; emit(v); }
  openChannel();
  try { bc?.postMessage({ member, maxMusic: v.maxMusic, maxNoise: v.maxNoise }); } catch { /* las otras pestañas se enteran al volver el foco */ }
}
