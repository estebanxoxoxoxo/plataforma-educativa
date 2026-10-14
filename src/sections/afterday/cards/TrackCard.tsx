import type { AfterDayTrack } from '../../../api/types';
import { IcAdMusic, IcAdPlay } from '../components/AdIcons';

/** Tarjeta de un track de After Day: miniatura, título (o "Audio") y botón de play; la que SUENA va resaltada
 *  con la nota musical. Tocarla la reproduce SOLO como audio de fondo (como el POC). «Ver» (extensión Innerith,
 *  pedido 14-oct: pueden ser audios o videos) abre el video contenido en un overlay. Pura. */
export function TrackCard({ track, sounding, onPlay, onWatch }: {
  track: AfterDayTrack; sounding: boolean; onPlay: () => void; onWatch: () => void;
}) {
  return (
    <div className={`ad-card${sounding ? ' is-on' : ''}`}>
      <button type="button" className="ad-main" onClick={onPlay}
        aria-label={`Escuchar ${track.title || 'audio'} de fondo`}>
        <span className="ad-th">
          {track.thumb && <img src={track.thumb} alt="" loading="lazy" />}
          <span className="ad-play" aria-hidden="true">{sounding ? <IcAdMusic /> : <IcAdPlay />}</span>
        </span>
        <span className="ad-t">{track.title || 'Audio'}</span>
      </button>
      <button type="button" className="ad-watch" onClick={onWatch} aria-label={`Ver ${track.title || 'el video'}`}>
        Ver ▸
      </button>
    </div>
  );
}
