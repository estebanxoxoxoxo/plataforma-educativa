import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../../api';
import type { MtAdminChannel, MtAdminState } from '../../../api/types';
import { YtChannelRow } from '../cards/YtChannelRow';
import { PanelState } from '../components/PanelState';
import { parentCall } from '../lib/adultGate';

/* «YouTube» (porte Smarty W5: la solapa YouTube de Admin → Listas del POC + el tope de Ajustes): el padre suma videos,
   playlists y canales de YouTube a lo que su hijo puede ver, los mantiene (reingestar, completar canales, quitar
   duplicados, tope por entrada) y cura cómo se le presenta cada canal en MyTube. La ingesta corre en el server con la key
   de YouTube del server (server/src/mytube.ts). Todo va con la sesión del padre —desde el 14-oct, la del ADULTO activo,
   implícita (parentCall, como el resto de los paneles; un chico recibe 401)—. */

/** Parte un texto de lote en entradas: una por línea o separadas por ";" (parseBatch del POC). */
function parseBatch(text: string): string[] {
  return text.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);
}

/** explainYtError del POC (la key vive en el server, no en Ajustes). */
function explainYtError(err: string): string {
  if (err.includes('SIN_KEY_YOUTUBE')) return 'necesita API key de YouTube (falta en el servidor)';
  if (err.includes('URL_INVALIDA')) return 'URL no reconocida';
  if (err.includes('YA_EXISTE')) return 'ya está en la lista (no se duplicó)';
  return err.replace(/^Error:\s*/, '').slice(0, 80);
}
const NET = 'no hubo respuesta del servidor';

export function YouTubePanel({ kid }: { kid: string }) {
  const [st, setSt] = useState<MtAdminState | null>(null);
  const [chs, setChs] = useState<MtAdminChannel[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');
  const [fails, setFails] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [reingId, setReingId] = useState<number | null>(null); // entrada que se está reingestando
  const [backfilling, setBackfilling] = useState(false);
  const [dedup, setDedup] = useState(false);
  const [cap, setCap] = useState<string | null>(null);
  const [capMsg, setCapMsg] = useState('');
  const seq = useRef(0);
  const alive = useRef(true);

  /** Relee entradas + canales (nada optimista: lo que se ve es lo que guardó el server). */
  const load = useCallback(async () => {
    const my = ++seq.current;
    try {
      const [s, c] = await Promise.all([parentCall(api.mtAdminState()), parentCall(api.mtAdminChannels())]);
      if (!alive.current || my !== seq.current) return;
      setSt(s); setChs(c.channels); setFailed(false);
      setCap((v) => v ?? String(s.videoCap));
    } catch {
      if (alive.current && my === seq.current) setFailed(true);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; };
  }, [load]);

  // Procesa las URLs de a una (cada una es una ingesta en el server): progreso en vivo + resumen con los fallos
  // detallados por entrada (no corta ante un error).
  const add = async () => {
    const items = parseBatch(input);
    if (!items.length || busy) return;
    setBusy(true); setMsg(''); setFails([]);
    let ok = 0, vids = 0;
    const errs: string[] = [];
    for (let i = 0; i < items.length; i++) {
      setProgress(`Procesando ${i + 1}/${items.length}…`);
      try {
        const r = await parentCall(api.mtAdd(items[i]));
        if (r.ok) { ok++; vids += r.added; } else errs.push(`${items[i].slice(0, 48)} — ${explainYtError(r.error)}`);
      } catch {
        errs.push(`${items[i].slice(0, 48)} — ${NET}`);
      }
    }
    if (!alive.current) return;
    setProgress(''); setBusy(false); setInput('');
    setMsg(ok
      ? `✓ ${ok} agregada(s) · ${vids} video(s) aprobados${errs.length ? ` · ${errs.length} con error` : ''}`
      : (errs.length ? `Ninguna se agregó (${errs.length} con error)` : ''));
    setFails(errs);
    await load();
  };

  // Re-toma el snapshot de una entrada ya cargada (nombre de playlist + descripciones nuevas).
  const reingest = async (id: number) => {
    if (reingId !== null) return;
    setReingId(id); setMsg(''); setFails([]);
    try {
      const r = await parentCall(api.mtReingest(id));
      setMsg(r.ok ? `✓ Reingestada: ${r.title} · ${r.added} video(s)` : `Error al reingestar: ${explainYtError(r.error)}`);
    } catch {
      setMsg(`Error al reingestar: ${NET}`);
    } finally {
      if (alive.current) setReingId(null);
    }
    await load();
  };

  const remove = async (id: number) => {
    await parentCall(api.mtRemove(id)).catch(() => null);
    await load();
  };

  const backfill = async () => {
    if (backfilling) return;
    setBackfilling(true); setMsg(''); setFails([]);
    try {
      const r = await parentCall(api.mtBackfill());
      setMsg(r.ok ? `✓ MyTube actualizado: ${r.completados} video(s) completados · ${r.canales} canal(es).` : `Error al completar canales: ${explainYtError(r.error)}`);
    } catch {
      setMsg(`Error al completar canales: ${NET}`);
    } finally {
      if (alive.current) setBackfilling(false);
    }
    await load();
  };

  const quitarDuplicados = async () => {
    if (dedup) return;
    setDedup(true); setMsg(''); setFails([]);
    try {
      const r = await parentCall(api.mtDedup());
      setMsg(r.ok ? (r.removed ? `✓ Quité ${r.removed} entrada(s) duplicada(s)` : 'No había entradas duplicadas') : `Error: ${explainYtError(r.error)}`);
    } catch {
      setMsg(`Error: ${NET}`);
    } finally {
      if (alive.current) setDedup(false);
    }
    await load();
  };

  const saveCap = async () => {
    setCapMsg('');
    try {
      const r = await parentCall(api.mtSetCap(cap ?? ''));
      setCap(String(r.videoCap));
      setCapMsg(r.videoCap ? `✓ Guardado: hasta ${r.videoCap} videos por entrada.` : '✓ Guardado: sin tope.');
    } catch {
      setCapMsg('No se pudo guardar. Probá de nuevo.');
    }
  };

  const saveDesc = async (channelId: string, desc: string) => {
    const r = await parentCall(api.mtSetChannelDesc(channelId, desc)).catch(() => null);
    return !!r?.ok;
  };

  const locked = reingId !== null;
  return (
    <section className="pz-panel" aria-labelledby="pz-yt-h">
      <header className="pz-panel-head">
        <h3 id="pz-yt-h">YouTube</h3>
        <p>Videos, playlists y canales de YouTube que aprobás para {kid}. Se suman al catálogo aprobado de Innerith y los canales aparecen en su MyTube.</p>
      </header>
      {!st || !chs ? <PanelState failed={failed} onRetry={() => void load()} /> : (
        <>
          <div className="pz-block">
            <h4 className="pz-block-h">Agregar</h4>
            <textarea className="pz-input pz-yt-ta" rows={3} value={input} disabled={busy} aria-label="URLs de YouTube"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void add(); } }}
              placeholder={'Una URL por línea o separadas por ";" (video, playlist o canal @handle)\nhttps://youtu.be/dQw4w9WgXcQ\nhttps://www.youtube.com/@nombrecanal'} />
            <div className="pz-yt-row">
              <button type="button" className="pz-btn" disabled={busy} onClick={() => void add()}>{busy ? '…' : 'Agregar'}</button>
              <span className="pz-yt-hint" role="status">{busy ? progress : 'Una línea o «;» = una URL · ⌘/Ctrl+Enter'}</span>
            </div>
            {msg && <p className="pz-yt-msg" role="status">{msg}</p>}
            {fails.length > 0 && <ul className="pz-yt-fails">{fails.map((f, i) => <li key={i}>{f}</li>)}</ul>}
            <p className="pz-muted pz-yt-snap">
              Modo snapshot: se aprueban los videos ACTUALES de la playlist/canal — los videos futuros no entran solos.
              Total aprobados: <b>{st.total}</b>.
            </p>
          </div>

          <div className="pz-block">
            <h4 className="pz-block-h">Mantenimiento</h4>
            <div className="pz-yt-maint">
              <button type="button" className="pz-btn pz-btn--ghost pz-btn--sm" disabled={backfilling} onClick={() => void backfill()}>
                {backfilling ? 'Completando…' : '↻ Completar canales (MyTube)'}
              </button>
              <span className="pz-yt-hint">Rellena el canal y la duración de los videos que les falte (para encender listas viejas en MyTube). Necesita la API key de YouTube.</span>
              <button type="button" className="pz-btn pz-btn--ghost pz-btn--sm" disabled={dedup} onClick={() => void quitarDuplicados()}
                title="Quita entradas repetidas (mismo canal/playlist/video), conservando la más vieja y sus videos">
                {dedup ? 'Limpiando…' : '⧉ Quitar duplicados'}
              </button>
            </div>
            <div className="pz-field pz-yt-cap">
              <label htmlFor="pz-yt-cap">Tope de videos por canal/lista (0 = sin tope)</label>
              <div className="pz-yt-row">
                <input id="pz-yt-cap" className="pz-input pz-input--num" type="number" min={0} inputMode="numeric" value={cap ?? ''}
                  onChange={(e) => { setCap(e.target.value); setCapMsg(''); }} onKeyDown={(e) => { if (e.key === 'Enter') void saveCap(); }} />
                <button type="button" className="pz-btn pz-btn--sm" onClick={() => void saveCap()}>Guardar</button>
                {capMsg && <span className="pz-yt-ok" role="status">{capMsg}</span>}
              </div>
              <span className="pz-field-help">Cuántos videos importar de cada canal/playlist al agregarlo o reingestarlo. La API de YouTube es gratis (1 unidad de cuota por cada 50 videos); el límite real es el almacenamiento del catálogo. <b>0 = traer todos.</b> Cambiá el valor y reingestá una entrada para aplicarlo.</span>
            </div>
          </div>

          <div className="pz-block">
            <h4 className="pz-block-h">Entradas <span className="pz-block-n">{st.entries.length}</span></h4>
            {st.entries.length === 0 ? (
              <p className="pz-muted">Sin entradas propias todavía. Además del catálogo base, Innerith solo puede mostrar videos que estén en esta lista.</p>
            ) : (
              <div className="pz-table-wrap">
                <table className="pz-table pz-table--yt">
                  <colgroup><col className="pz-c-yt-type" /><col /><col className="pz-c-yt-n" /><col className="pz-c-yt-act" /></colgroup>
                  <thead>
                    <tr><th scope="col">Tipo</th><th scope="col">Entrada</th><th scope="col" className="pz-th-num">Videos</th><th scope="col"><span className="pz-sr">Acciones</span></th></tr>
                  </thead>
                  <tbody>
                    {st.entries.map((e) => (
                      <tr key={e.id}>
                        <td><span className="pz-yt-type">{e.type}</span></td>
                        <td><span className="pz-cell-title">{e.title}</span><span className="pz-cell-sub">{e.url}</span></td>
                        <td className="pz-td-num">{e.videos}</td>
                        <td className="pz-td-act">
                          <button type="button" className="pz-link" disabled={locked} onClick={() => void reingest(e.id)}
                            title="Volver a importar: actualiza el nombre y las descripciones">{reingId === e.id ? '…' : 'Reingestar'}</button>
                          <button type="button" className="pz-link pz-yt-del" disabled={locked} onClick={() => void remove(e.id)}>Eliminar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {chs.length > 0 && (
            <div className="pz-block">
              <h4 className="pz-block-h">Canales de MyTube ({chs.length})</h4>
              <p className="pz-help pz-yt-chhelp">Cómo se le presenta cada canal a {kid} en MyTube. La descripción se generó automática (limpia + resumen IA) al ingerir —la de los canales del catálogo base, la primera vez que {kid} abre el canal o con «Completar canales»—; ajustala como quieras.</p>
              <ul className="pz-yt-chs">
                {chs.map((c) => <YtChannelRow key={c.channelId} c={c} onSave={(d) => saveDesc(c.channelId, d)} />)}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
