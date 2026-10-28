import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../api';
import type { AfterDayTrack } from '../../../api/types';
import { PanelState } from '../components/PanelState';
import { parentCall, rejectedReason } from '../lib/adultGate';

/** «Música de After Day» (porte Smarty W6: la solapa "after day" de Admin → Listas del POC, AfterDayTab), al pie de la
 *  sección YouTube de Familia: el padre pega un link de YouTube y, si quiere, un nombre → suena como audio de
 *  fondo en la sección After Day de su hijo (solo audio, nunca a pantalla completa). Sin repetidos, solo videos sueltos;
 *  lista del más nuevo al más viejo con miniatura, nombre o "(sin nombre)", videoId y Quitar. Sin edición, sin reorden y
 *  sin carga múltiple, como el POC. Va con la sesión del adulto activo (parentCall); nada optimista: lo que
 *  se ve es lo que guardó el server (server/src/afterday.ts → music.json).
 *  U3 · M2: es de TODA LA FAMILIA (la misma lista suena en el After Day de cada integrante): no recibe integrante y lo dice. */
export function AfterDayMusicPanel() {
  const [tracks, setTracks] = useState<AfterDayTrack[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
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

  const remove = async (videoId: string) => {
    if (removing) return;
    setRemoving(videoId); setErr(''); setMsg('');
    try { await parentCall(api.parentMusicRemove(videoId)); } catch { /* la relectura muestra lo que quedó */ }
    if (alive.current) setRemoving(null);
    await load();
  };

  return (
    <section className="pz-panel" aria-labelledby="pz-mus-h">
      <header className="pz-panel-head">
        <h3 id="pz-mus-h">Música de After Day <span className="pz-mem-fam">Vale para toda la familia</span></h3>
        <p>Videos de YouTube para que tu familia escuche como <b>audio de fondo</b> en la sección <b>After Day</b> de cada integrante (solo audio, nunca a pantalla completa). Pegá el link y, si querés, un nombre.</p>
      </header>
      <div className="pz-mus-add">
        <input className="pz-input pz-mus-url" value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy}
          placeholder="Link del video de YouTube" aria-label="Link del video de YouTube" />
        <input className="pz-input pz-mus-name" value={name} onChange={(e) => setName(e.target.value)} disabled={busy}
          placeholder="Nombre (opcional)" aria-label="Nombre (opcional)" />
        <button type="button" className="pz-btn" disabled={!url.trim() || busy} onClick={() => void add()}>{busy ? 'Agregando…' : 'Agregar'}</button>
      </div>
      {err && <p className="pz-mus-msg is-err" role="alert">{err}</p>}
      {msg && <p className="pz-mus-msg" role="status">{msg}</p>}
      {!tracks ? <PanelState failed={failed} onRetry={() => void load()} />
        : tracks.length === 0 ? <p className="pz-muted">Todavía no hay audio en After Day.</p>
          : (
            <ul className="pz-mus-list">
              {tracks.map((t) => (
                <li key={t.videoId} className="pz-mus-row">
                  {t.thumb && <img className="pz-mus-th" src={t.thumb} alt="" loading="lazy" />}
                  <span className="pz-mus-txt">
                    <span className="pz-mus-t">{t.title || '(sin nombre)'}</span>
                    <span className="pz-mus-id">{t.videoId}</span>
                  </span>
                  <button type="button" className="pz-link pz-mus-del" disabled={removing !== null} onClick={() => void remove(t.videoId)}>
                    {removing === t.videoId ? '…' : 'Quitar'}
                  </button>
                </li>
              ))}
            </ul>
          )}
    </section>
  );
}
