import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../api';
import type { AfterDayTrack } from '../../../api/types';
import { playTrack, useBgAudio } from '../../../shared/audio/bgAudio';
import { TrackCard } from '../cards/TrackCard';
import { AdEmpty, AdFail, AdSkeleton } from '../components/AdStates';
import { trackToBg } from '../lib/track';

/** After Day (porte EXACTO de AfterDay.tsx del POC, tanda W6): la lista que curó el padre, para escuchar SOLO como audio
 *  de fondo. Grilla 2/3/4 del más nuevo al más viejo (el orden lo da el server); tocar una tarjeta = playTrack(…, audioOnly)
 *  → cola de UN track en el MiniPlayer (con "repetir todas" se repite ese mismo; tocar otro lo reemplaza; sin "reproducir
 *  todo", como el POC). NUNCA abre el reproductor de video y el MiniPlayer no ofrece "Abrir el video". El audio sobrevive
 *  el cambio de sección (el host vive en el Layout) y también que esta sección se cierre por horario (quirk fiel).
 *  QUIRK FIEL (informe 03 §6): After Day NO filtra palabras bloqueadas — los títulos llegan tal cual del server.
 *  La lista se relee al volver el foco a la pestaña (el useLiveQuery del POC la mantenía viva si el padre sumaba o quitaba). */
export function AfterDayPage() {
  const [tracks, setTracks] = useState<AfterDayTrack[] | null>(null);
  const [failed, setFailed] = useState(false);
  const bg = useBgAudio();
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    try {
      const r = await api.afterDay();
      if (my === seq.current) { setTracks(r.tracks); setFailed(false); }
    } catch {
      if (my === seq.current) setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
    const wake = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      seq.current++; // lo que vuelva después de desmontar ya no cuenta
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [load]);

  return (
    <section className="view ad-view" id="v-afterday">
      <header className="ad-head">
        <h2 className="h2">After Day</h2>
        <p className="lede">Audio para escuchar de fondo mientras hacés otra cosa. Tocá uno y seguí navegando.</p>
      </header>
      {tracks === null ? (failed ? <AdFail onRetry={() => void load()} /> : <AdSkeleton />)
        : tracks.length === 0 ? <AdEmpty />
          : (
            <div className="ad-grid">
              {tracks.map((t) => (
                <TrackCard key={t.videoId} track={t} sounding={bg.video?.id === t.videoId}
                  onPlay={() => playTrack(trackToBg(t), 0, true)} />
              ))}
            </div>
          )}
    </section>
  );
}
