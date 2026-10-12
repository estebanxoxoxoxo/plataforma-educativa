// After Day (porte Smarty W6): del track de la lista al track mínimo que necesita el audio de fondo (trackToVideo del POC).
import type { AfterDayTrack } from '../../../api/types';
import type { BgTrack } from '../../../shared/audio/bgAudio';

const ytThumb = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

/** Sin nombre, en el MiniPlayer suena como "Música" (la tarjeta dice "Audio"): los dos textos del POC, tal cual. */
export function trackToBg(t: AfterDayTrack): BgTrack {
  return { id: t.videoId, title: t.title || 'Música', img: t.thumb || ytThumb(t.videoId) };
}
