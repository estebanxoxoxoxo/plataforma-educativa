// After Day (porte Smarty W6): del track de la lista al track mínimo que necesita el audio de fondo (trackToVideo del POC).
import type { AfterDayTrack } from '../../../api/types';
import { getBgState, pauseMusic, playTrack, resumeMusic, type BgTrack } from '../../../shared/audio/bgAudio';
import { trackAudio, trackTap } from './trackAudio';

const ytThumb = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

/** Sin nombre, en el MiniPlayer suena como "Música" (la tarjeta dice "Audio"): los dos textos del POC, tal cual. */
export function trackToBg(t: AfterDayTrack): BgTrack {
  return { id: t.videoId, title: t.title || 'Música', img: t.thumb || ytThumb(t.videoId) };
}

/** Tocar una tarjeta (el After Day del chico y Familia → After Day, 29-oct): play/pausa del audio de fondo. Sin el fondo →
 *  playTrack audioOnly (cola de UN track, como el POC: reemplaza lo que sonaba); sonando → pausa; en pausa → sigue. Decide con
 *  el fondo de AHORA (getBgState), no con el del último render. */
export function tapTrack(t: AfterDayTrack) {
  const act = trackTap(trackAudio(getBgState(), t.videoId));
  if (act === 'play') playTrack(trackToBg(t), 0, true);
  else if (act === 'pause') pauseMusic();
  else resumeMusic();
}
