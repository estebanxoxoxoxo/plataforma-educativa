import type { ReactNode } from 'react';
import type { AfterDayTrack } from '../../../api/types';
import { IcAdMusic } from '../components/AdIcons';
import { trackLabel, type TrackAudio } from '../lib/trackAudio';

/** Tarjeta de un track de After Day: miniatura, título (o "Audio") y el disco de play/pausa encima. Tocarla la escucha SOLO
 *  como audio de fondo (como el POC) y, desde el 29-oct (pedido de Esteban: «no lo puedo frenar»), es un PLAY/PAUSA: `audio`
 *  dice dónde está respecto del fondo (lib/trackAudio). El disco lleva SIEMPRE la nota musical (pedido de Esteban: es la
 *  marca de la modalidad solo-audio) — EN COLOR quieta si no suena, en color sobre violeta con el aro latiendo si suena, y
 *  EN BLANCO Y NEGRO en pausa (el estado lo pintan las clases; el qué-hace-tocarla lo dice el aria-label)—; la que tiene el
 *  fondo va resaltada (.is-on), sonando o en pausa (.is-paused). Qué hace el toque lo decide quien
 *  la usa (tapTrack de lib/track). «Ver» (extensión Innerith, pedido 14-oct: pueden ser audios o videos) abre el video
 *  contenido en un overlay. Pura.
 *  La reusa Familia → After Day (tanda F2: la MISMA grilla que ve el chico): `corner` = una acción más arriba a la derecha,
 *  sobre la miniatura (ahí, «Quitar»). El After Day del chico no la pasa. */
export function TrackCard({ track, audio, onPlay, onWatch, corner }: {
  track: AfterDayTrack; audio: TrackAudio; onPlay: () => void; onWatch: () => void; corner?: ReactNode;
}) {
  return (
    <div className={`ad-card${audio !== 'off' ? ' is-on' : ''}${audio === 'paused' ? ' is-paused' : ''}`}>
      <button type="button" className="ad-main" onClick={onPlay} aria-label={trackLabel(audio, track.title)}>
        <span className="ad-th">
          {track.thumb && <img src={track.thumb} alt="" loading="lazy" />}
          <span className="ad-play" aria-hidden="true"><IcAdMusic /></span>
        </span>
        <span className="ad-t">{track.title || 'Audio'}</span>
      </button>
      <button type="button" className="ad-watch" onClick={onWatch} aria-label={`Ver ${track.title || 'el video'}`}>
        Ver ▸
      </button>
      {corner && <span className="ad-corner">{corner}</span>}
    </div>
  );
}
