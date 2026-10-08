// Reproductor de AUDIO DE FONDO (música de YouTube en segundo plano). Port de
// smarty-poc/app/src/lib/backgroundAudio.ts: singleton de módulo + useSyncExternalStore; posee un
// iframe OCULTO que monta BgAudioHost (vive en el Layout → la música sobrevive el cambio de sección).
// COLA + ÍNDICE: `queue`+`index` con `video = queue[index]` como campo concreto; un track suelto es
// una cola de 1. Al terminar cada track avanza según `repeat`. Un video en PRIMER PLANO pausa la
// música (duck) y al salir la reanuda — decisión A de REPRODUCCION.md.
// Pendiente (requiere panel del padre): topes parentales de volumen (settings.maxVol* de Smarty).
import { useSyncExternalStore } from 'react';
import { ytCommand, ytSubscribe, parseYtMessage } from '../lib/ytBridge';
import { ambientStart, ambientStop, ambientStopAll, ambientSetVolume, AMBIENTS, type AmbientKey } from './ambientNoise';

/** Lo mínimo que necesita el reproductor (cualquier VideoResult sirve). */
export type BgTrack = { id: string; title: string; img?: string };

export type RepeatMode = 'off' | 'one' | 'all';

export type BgAudioState = {
  video: BgTrack | null; // = queue[index] (campo concreto, no getter)
  queue: BgTrack[];
  index: number;
  playing: boolean;
  volume: number; // 0-100
  repeat: RepeatMode; // off = para al terminar la cola · one = repite el track · all = loopea la cola
  ducked: boolean; // pausada automáticamente por un video en primer plano (no por el chico)
  ambient: Record<AmbientKey, { on: boolean; volume: number }>; // ruidos sintetizados, en paralelo
  currentTime: number; // posición (s) del track, para la barra de seek del MiniPlayer
  duration: number; // duración (s) del track (0 hasta el primer infoDelivery)
  at: number; // Date.now() del último reporte (para interpolar suave entre mensajes)
};

const VOL_KEY = 'innerith.bgVolume';
const REPEAT_KEY = 'innerith.bgRepeat';
const AMB_VOL_KEY = 'innerith.bgAmbientVol';

function initVolume(): number {
  const v = Number(localStorage.getItem(VOL_KEY));
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 60;
}
function initRepeat(): RepeatMode {
  const r = localStorage.getItem(REPEAT_KEY);
  return r === 'off' || r === 'one' || r === 'all' ? r : 'all';
}
function initAmbient(): Record<AmbientKey, { on: boolean; volume: number }> {
  let saved: Record<string, number> = {};
  try { saved = JSON.parse(localStorage.getItem(AMB_VOL_KEY) || '{}'); } catch { /* default */ }
  const out = {} as Record<AmbientKey, { on: boolean; volume: number }>;
  for (const a of AMBIENTS) out[a.key] = { on: false, volume: typeof saved[a.key] === 'number' ? saved[a.key] : 35 };
  return out; // arrancan SIEMPRE en off (Web Audio necesita un gesto)
}
function persistAmbientVol() {
  const v: Record<string, number> = {};
  for (const a of AMBIENTS) v[a.key] = state.ambient[a.key].volume;
  localStorage.setItem(AMB_VOL_KEY, JSON.stringify(v));
}

let state: BgAudioState = {
  video: null, queue: [], index: 0, playing: false,
  volume: initVolume(), repeat: initRepeat(), ducked: false, ambient: initAmbient(),
  currentTime: 0, duration: 0, at: 0,
};
let iframe: HTMLIFrameElement | null = null;
let startAt = 0;
const listeners = new Set<() => void>();

function emit() { state = { ...state }; listeners.forEach((l) => l()); }
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
const snapshot = () => state;

export function useBgAudio(): BgAudioState {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/* ---- enganche del host (BgAudioHost) ---- */

export function setBgIframe(el: HTMLIFrameElement | null) { iframe = el; }
export function bgStartAt() { return startAt; }

/* onLoad del iframe: suscribir al bus + fijar volumen; si el estado dice pausado, pausar el autoplay. */
export function bgOnIframeLoad() {
  ytSubscribe(iframe);
  ytCommand(iframe, 'setVolume', [state.volume]);
  if (!state.playing) ytCommand(iframe, 'pauseVideo');
}

/* Listener GLOBAL de `message` (lo conecta el host). El iframe del player en PRIMER PLANO también
   emite 'ended' al window → filtramos por la FUENTE para que solo el iframe de fondo avance la cola. */
export function bgHandleMessage(e: MessageEvent) {
  if (!iframe || e.source !== iframe.contentWindow) return;
  const m = parseYtMessage(e);
  if (!m) return;
  if (m.state === 'ended') { advanceOnEnded(); return; }
  if (typeof m.currentTime === 'number' || (typeof m.duration === 'number' && m.duration > 0)) {
    state = {
      ...state,
      currentTime: typeof m.currentTime === 'number' ? m.currentTime : state.currentTime,
      duration: typeof m.duration === 'number' && m.duration > 0 ? m.duration : state.duration,
      at: Date.now(),
    };
    emit();
  }
}
function advanceOnEnded() {
  if (state.repeat === 'one' && state.video) { ytCommand(iframe, 'seekTo', [0, true]); ytCommand(iframe, 'playVideo'); state = { ...state, currentTime: 0, at: Date.now() }; emit(); return; }
  if (state.index < state.queue.length - 1) { goToIndex(state.index + 1); return; }
  if (state.repeat === 'all' && state.queue.length) { goToIndex(0); return; }
  state = { ...state, playing: false }; emit();
}
/* Salta al índice i. Si el id destino es el MISMO (cola de 1 en loop), la key del host no cambia →
   no hay re-mount → reiniciar con comandos directos (si no, el iframe queda parado al final). */
function goToIndex(i: number) {
  if (i < 0 || i >= state.queue.length) return;
  const same = state.queue[i].id === state.video?.id;
  startAt = 0;
  state = { ...state, index: i, video: state.queue[i], playing: true, ducked: false, currentTime: 0, duration: same ? state.duration : 0, at: Date.now() };
  if (same) { ytCommand(iframe, 'seekTo', [0, true]); ytCommand(iframe, 'playVideo'); }
  emit();
}

/* ---- API (se dispara desde gestos de usuario → autoplay OK) ---- */

/** Reproduce una COLA como audio de fondo desde startIndex. Un track suelto = playTrack. */
export function playQueue(tracks: BgTrack[], startIndex = 0, fromSeconds = 0) {
  if (!tracks.length) return;
  const index = Math.max(0, Math.min(startIndex, tracks.length - 1));
  startAt = fromSeconds > 1 ? Math.floor(fromSeconds) : 0;
  state = { ...state, queue: tracks, index, video: tracks[index], playing: true, ducked: false, currentTime: startAt, duration: 0, at: Date.now() };
  emit();
}
export function playTrack(track: BgTrack, fromSeconds = 0) { playQueue([track], 0, fromSeconds); }
export function nextTrack() {
  if (state.index < state.queue.length - 1) goToIndex(state.index + 1);
  else if (state.repeat === 'all' && state.queue.length) goToIndex(0);
}
export function prevTrack() {
  if (state.index > 0) goToIndex(state.index - 1);
  else if (state.repeat === 'all' && state.queue.length) goToIndex(state.queue.length - 1);
}
export function pauseMusic() { ytCommand(iframe, 'pauseVideo'); state = { ...state, playing: false, ducked: false }; emit(); }
export function resumeMusic() { ytCommand(iframe, 'playVideo'); state = { ...state, playing: true, ducked: false }; emit(); }
export function restartMusic() { ytCommand(iframe, 'seekTo', [0, true]); ytCommand(iframe, 'playVideo'); state = { ...state, playing: true, ducked: false, currentTime: 0, at: Date.now() }; emit(); }
export function seekMusic(seconds: number) {
  const t = Math.max(0, Math.floor(seconds));
  ytCommand(iframe, 'seekTo', [t, true]);
  state = { ...state, currentTime: t, at: Date.now() }; emit();
}
export function stopMusic() { startAt = 0; state = { ...state, video: null, queue: [], index: 0, playing: false, ducked: false, currentTime: 0, duration: 0 }; emit(); }

export function setMusicVolume(v: number) {
  const vol = Math.max(0, Math.min(100, Math.round(v)));
  ytCommand(iframe, 'setVolume', [vol]);
  localStorage.setItem(VOL_KEY, String(vol));
  state = { ...state, volume: vol }; emit();
}
const REPEAT_CYCLE: RepeatMode[] = ['off', 'all', 'one'];
export function cycleRepeat() {
  const r = REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(state.repeat) + 1) % REPEAT_CYCLE.length];
  localStorage.setItem(REPEAT_KEY, r);
  state = { ...state, repeat: r }; emit();
}

/* ---- Ambientes (ruido sintetizado; en paralelo con la música, no se duckean) ---- */
export function toggleAmbient(key: AmbientKey) {
  const cur = state.ambient[key];
  if (cur.on) ambientStop(key); else ambientStart(key, cur.volume);
  state = { ...state, ambient: { ...state.ambient, [key]: { ...cur, on: !cur.on } } };
  emit();
}
export function setAmbientVolume(key: AmbientKey, v: number) {
  const vol = Math.max(0, Math.min(100, v));
  ambientSetVolume(key, vol);
  state = { ...state, ambient: { ...state.ambient, [key]: { ...state.ambient[key], volume: vol } } };
  persistAmbientVol(); emit();
}
/** Apaga todos los ruidos (viven en un AudioContext de módulo, fuera del árbol de React). */
export function stopAllAmbient() {
  ambientStopAll();
  const next = { ...state.ambient };
  for (const a of AMBIENTS) next[a.key] = { ...next[a.key], on: false };
  state = { ...state, ambient: next }; emit();
}

/* Decisión A: la página de video (primer plano) llama esto al montar/desmontar. */
export function duckForForeground() {
  if (!state.video || !state.playing) return;
  ytCommand(iframe, 'pauseVideo');
  state = { ...state, playing: false, ducked: true }; emit();
}
export function unduck() {
  if (!state.ducked) return;
  ytCommand(iframe, 'playVideo');
  state = { ...state, playing: true, ducked: false }; emit();
}
