// After Day — play/pausa de la tarjeta y «Ver» que corta el audio (pedido de Esteban, 29-oct: «Una vez que se inicia el audio
// del contenido after day, no lo puedo frenar»). Antes la tarjeta solo sabía REPRODUCIR (tocar la que sonaba la reiniciaba) y
// la única pausa vivía en el MiniPlayer; «Ver» pausaba al abrir pero SIEMPRE reanudaba al cerrar. Puras: las usan la tarjeta
// (TrackCard por props), las dos grillas (el After Day del chico y Familia → After Day) y el visor (AdWatch); tests en
// __tests__/trackAudio.test.ts.
import type { BgAudioState } from '../../../shared/audio/bgAudio';

/** Dónde está un track respecto del audio de fondo: sin el fondo, SONANDO o EN PAUSA. */
export type TrackAudio = 'off' | 'playing' | 'paused';

/** "Tiene el fondo" = es el track cargado en el audio de fondo COMO After Day (audioOnly). El mismo video puesto de fondo desde
 *  otro lado (el «Escuchar de fondo» del reproductor) no cuenta: ese no es un audio de After Day. */
export function trackAudio(bg: Pick<BgAudioState, 'video' | 'playing' | 'audioOnly'>, videoId: string): TrackAudio {
  if (!bg.audioOnly || bg.video?.id !== videoId) return 'off';
  return bg.playing ? 'playing' : 'paused';
}

/** Tocar la tarjeta: sin el fondo → arrancarla de fondo (como el POC); sonando → pausar; en pausa → seguir donde quedó. */
export function trackTap(a: TrackAudio): 'play' | 'pause' | 'resume' {
  return a === 'off' ? 'play' : a === 'playing' ? 'pause' : 'resume';
}

/** El nombre accesible del botón principal de la tarjeta: lo que hace tocarlo. Sin título, "audio" (como hasta ahora). */
export function trackLabel(a: TrackAudio, title?: string): string {
  const x = title || 'audio';
  return a === 'off' ? `Escuchar ${x} de fondo` : a === 'playing' ? `Pausar ${x}` : `Seguir escuchando ${x}`;
}

/** «Ver» al CERRARSE: ¿reanuda el fondo que pausó al abrirse? `pausedId` = el track que sonaba y el visor pausó (null si no
 *  pausó nada); `watchedId` = el que se miró; `now` = el fondo al cerrar.
 *  - Era el MISMO track que se miró → NO (el chico lo pasó a video: queda en pausa y la tarjeta lo muestra en pausa).
 *  - Era OTRO → sí, como siempre (decisión A de REPRODUCCION.md para ese caso), y solo si el fondo sigue siendo ese y sigue en
 *    pausa: si mientras tanto algo lo cambió o ya suena, no se lo pisa. */
export function resumeAfterWatch(pausedId: string | null, watchedId: string, now: Pick<BgAudioState, 'video' | 'playing'>): boolean {
  if (pausedId === null || pausedId === watchedId) return false;
  return now.video?.id === pausedId && !now.playing;
}
