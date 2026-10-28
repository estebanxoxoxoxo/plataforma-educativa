import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../api';
import type { AfterDayTrack } from '../../../api/types';
import { playTrack, useBgAudio } from '../../../shared/audio/bgAudio';
import { TrackCard } from '../../afterday/cards/TrackCard';
import { AdSkeleton } from '../../afterday/components/AdStates';
import { AdWatch } from '../../afterday/components/AdWatch';
import { trackToBg } from '../../afterday/lib/track';
import { PanelState } from '../components/PanelState';
import { parentCall, rejectedReason } from '../lib/adultGate';

/** «After Day» de Familia (tanda F2, 28-oct: solapa PROPIA; antes era la "Música de After Day" al pie de YouTube — porte
 *  Smarty W6, la AfterDayTab del POC). Arriba, el agregar: un link de YouTube y, si quiere, un nombre (sin repetidos, solo
 *  videos sueltos, de a uno, como el POC). Abajo, la MISMA grilla que ve el chico en /afterday (sections/afterday: la
 *  TrackCard con miniatura y título, del más nuevo al más viejo; tocarla la escucha de fondo y «Ver» abre el video
 *  contenido, también para el adulto) con «Quitar» en cada tarjeta. Nada optimista: lo que se ve es lo que guardó el server
 *  (server/src/afterday.ts → music.json). Va con la sesión del adulto activo (parentCall).
 *  Es de TODA LA FAMILIA (la misma lista suena en el After Day de cada integrante): no recibe integrante y lo dice. */
export function FamilyAfterDayPanel() {
  const [tracks, setTracks] = useState<AfterDayTrack[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [watch, setWatch] = useState<AfterDayTrack | null>(null);
  const bg = useBgAudio();
  const alive = useRef(true);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    try {
      const r = await parentCall(api.parentMusic());
      if (alive.current && my === seq.current) { setTracks(r.tracks); setFailed(false); }
    } catch {
      if (alive.current && my === seq.current) setFailed(true);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; };
  }, [load]);

  const add = async () => {
    if (!url.trim() || busy) return;
    setErr(''); setMsg(''); setBusy(true);
    try {
      const r = await parentCall(api.parentMusicAdd(url, name));
      if (!alive.current) return;
      if (r.ok) { setUrl(''); setName(''); setMsg(`✓ Agregado: ${r.track.title || r.track.videoId}`); }
      else setErr(r.error);
    } catch (e) {
      if (alive.current) setErr(rejectedReason(e) ?? 'No hubo respuesta del servidor. Probá de nuevo.');
    } finally {
      if (alive.current) setBusy(false);
    }
    await load();
  };

  const remove = async (t: AfterDayTrack) => {
    if (removing) return;
    setRemoving(t.videoId); setErr(''); setMsg('');
    try {
      const r = await parentCall(api.parentMusicRemove(t.videoId));
      if (alive.current) { if (r.ok) setMsg(`✓ Quitado: ${t.title || t.videoId}`); else setErr('No se pudo quitar. Probá de nuevo.'); }
    } catch {
      if (alive.current) setErr('No se pudo quitar. Probá de nuevo.');
    }
    if (alive.current) setRemoving(null);
    await load();
  };

  return (
    <>
      <section className="pz-panel" aria-labelledby="pz-ad-h">
        <header className="pz-panel-head">
          <h3 id="pz-ad-h">After Day <span className="pz-mem-fam">Vale para toda la familia</span></h3>
          <p>Videos de YouTube para que tu familia escuche como <b>audio de fondo</b> en la sección <b>After Day</b> de cada integrante (o los mire con «Ver»). Pegá el link y, si querés, un nombre. Abajo, la lista como la ve tu familia.</p>
        </header>
        <div className="pz-mus-add">
          <input className="pz-input pz-mus-url" value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy}
            onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
            placeholder="Link del video de YouTube" aria-label="Link del video de YouTube" />
          <input className="pz-input pz-mus-name" value={name} onChange={(e) => setName(e.target.value)} disabled={busy}
            onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
            placeholder="Nombre (opcional)" aria-label="Nombre (opcional)" />
          <button type="button" className="pz-btn" disabled={!url.trim() || busy} onClick={() => void add()}>{busy ? 'Agregando…' : 'Agregar'}</button>
        </div>
        {err && <p className="pz-mus-msg is-err" role="alert">{err}</p>}
        {msg && <p className="pz-mus-msg" role="status">{msg}</p>}
      </section>

      <section className="pz-ad-sec" aria-labelledby="pz-ad-list-h">
        <h4 className="pz-block-h" id="pz-ad-list-h">En el After Day de tu familia {tracks && <span className="pz-block-n">{tracks.length}</span>}</h4>
        {tracks === null ? (failed ? <PanelState failed onRetry={() => void load()} /> : <AdSkeleton />)
          : tracks.length === 0 ? <p className="pz-muted">Todavía no hay audio en After Day. Lo que agregues arriba aparece acá y en el After Day de cada integrante.</p>
            : (
              <div className="ad-grid">
                {tracks.map((t) => (
                  <TrackCard key={t.videoId} track={t} sounding={bg.video?.id === t.videoId}
                    onPlay={() => playTrack(trackToBg(t), 0, true)} onWatch={() => setWatch(t)}
                    corner={(
                      <button type="button" className="pz-ad-x" disabled={removing !== null} onClick={() => void remove(t)}
                        aria-label={`Quitar ${t.title || 'este audio'} de After Day`}>{removing === t.videoId ? 'Quitando…' : 'Quitar'}</button>
                    )} />
                ))}
              </div>
            )}
      </section>
      {watch && <AdWatch track={watch} onClose={() => setWatch(null)} />}
    </>
  );
}
