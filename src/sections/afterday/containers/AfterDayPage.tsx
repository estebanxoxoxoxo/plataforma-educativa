import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../api';
import type { AfterDayTrack } from '../../../api/types';
import { useBgAudio } from '../../../shared/audio/bgAudio';
import { TrackCard } from '../cards/TrackCard';
import { AdEmpty, AdFail, AdSkeleton } from '../components/AdStates';
import { AdWatch } from '../components/AdWatch';
import { tapTrack } from '../lib/track';
import { trackAudio } from '../lib/trackAudio';

/** After Day (porte EXACTO de AfterDay.tsx del POC, tanda W6): la lista que curó el padre, para escuchar SOLO como audio
 *  de fondo. Grilla 2/3/4 del más nuevo al más viejo (el orden lo da el server); tocar una tarjeta = playTrack(…, audioOnly)
 *  → cola de UN track en el MiniPlayer (con "repetir todas" se repite ese mismo; tocar otro lo reemplaza; sin "reproducir
 *  todo", como el POC). Desvío del 29-oct (pedido de Esteban: «no lo puedo frenar»): tocar la que tiene el fondo la PAUSA y
 *  tocarla en pausa la sigue (tapTrack; antes la reiniciaba y la única pausa era la del MiniPlayer). El reproductor de video
 *  no se abre: «Ver» es el visor contenido (AdWatch) y el MiniPlayer no ofrece "Abrir el video". El audio sobrevive
 *  el cambio de sección (el host vive en el Layout) y también que esta sección se cierre por horario (quirk fiel).
 *  QUIRK FIEL (informe 03 §6): After Day NO filtra palabras bloqueadas — los títulos llegan tal cual del server.
 *  La lista se relee al volver el foco a la pestaña (el useLiveQuery del POC la mantenía viva si el padre sumaba o quitaba). */
export function AfterDayPage() {
  const [tracks, setTracks] = useState<AfterDayTrack[] | null>(null);
  const [failed, setFailed] = useState(false);
  // «Ver» (extensión Innerith 14-oct): el track que se está MIRANDO en el overlay contenido.
  const [watch, setWatch] = useState<AfterDayTrack | null>(null);
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
        {/* Texto de Esteban, 29-oct (reemplaza al heredado del POC solo-audio). */}
        <p className="lede">Contenido para ver o escuchar después del día.</p>
      </header>
      {tracks === null ? (failed ? <AdFail onRetry={() => void load()} /> : <AdSkeleton />)
        : tracks.length === 0 ? <AdEmpty />
          : (
            <div className="ad-grid">
              {tracks.map((t) => (
                <TrackCard key={t.videoId} track={t} audio={trackAudio(bg, t.videoId)}
                  onPlay={() => tapTrack(t)} onWatch={() => setWatch(t)} />
              ))}
            </div>
          )}
      {watch && <AdWatch track={watch} onClose={() => setWatch(null)} />}
    </section>
  );
}
