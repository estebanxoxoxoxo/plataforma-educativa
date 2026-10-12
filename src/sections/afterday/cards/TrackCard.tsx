import type { AfterDayTrack } from '../../../api/types';
import { IcAdMusic, IcAdPlay } from '../components/AdIcons';

/** Tarjeta de un audio de After Day (la del POC): miniatura, título (o "Audio") y botón de play; la que SUENA va resaltada
 *  con la nota musical. Tocarla la reproduce SOLO como audio de fondo (lo decide el container). Pura. */
export function TrackCard({ track, sounding, onPlay }: { track: AfterDayTrack; sounding: boolean; onPlay: () => void }) {
  return (
    <button type="button" className={`ad-card${sounding ? ' is-on' : ''}`} onClick={onPlay}
      aria-label={`Escuchar ${track.title || 'audio'} de fondo`}>
      <span className="ad-th">
        {track.thumb && <img src={track.thumb} alt="" loading="lazy" />}
        <span className="ad-play" aria-hidden="true">{sounding ? <IcAdMusic /> : <IcAdPlay />}</span>
      </span>
      <span className="ad-t">{track.title || 'Audio'}</span>
    </button>
  );
}
