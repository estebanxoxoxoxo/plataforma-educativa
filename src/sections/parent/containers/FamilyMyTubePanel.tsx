import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import type { MtAdminChannel, MtAdminState, MtEntry } from '../../../api/types';
import { IcDots } from '../../../shared/components/icons';
import { ConfirmSheet } from '../../create/components/ConfirmSheet';
import { ChannelCard } from '../../mytube/cards/ChannelCard';
import { MtEntriesSheet } from '../components/MtEntriesSheet';
import { PanelState } from '../components/PanelState';
import { parentCall } from '../lib/adultGate';
import { famTo } from '../lib/member';
import { forgetCounts, useChannelCounts, wantCount } from '../lib/mtCounts';
import { NET, channelMatches, explainYtError, groupChannels, parseBatch, removeText, useEntryOps } from '../lib/mytubeAdmin';
import { L } from '../../../shared/lib/lang';

/** La vista de un canal dentro de Familia → MyTube (conserva `?m=` con famTo). */
export const familyChannelPath = (id: string) => `/familia/mytube/canal/${encodeURIComponent(id)}`;

/* «MyTube» de Familia (tanda F2, 28-oct; la ex solapa «YouTube» del porte Smarty W5 — /familia/youtube redirige acá).
   Pedido del dueño: "el listado tiene que ser el MISMO tipo de grilla que ve el chico, con una forma de agregar". Arriba, el
   AGREGAR por URL (video, playlist o canal; el lote con progreso del POC). Abajo, la grilla de canales con la MISMA tarjeta
   del MyTube del chico (sections/mytube/cards/ChannelCard: avatar, título, "N videos"): primero lo que SUMÓ la familia (con su
   menú ⋮: Reingestar / Eliminar con confirmación) y después el catálogo de Smarty, con un "Buscar un canal". Tocar una
   tarjeta abre el canal (FamilyChannelPanel: sus videos como los ve el chico + la descripción editable). El mantenimiento
   general (Completar canales, Quitar duplicados, tope por entrada) queda al pie, plegado. La ingesta corre en el server con
   la key de YouTube del server (server/src/mytube.ts). Todo con la sesión del adulto activo (parentCall).
   Es de TODA LA FAMILIA (lo aprobado vale para cada integrante): `member` solo viaja en los links (?m=). */
export function FamilyMyTubePanel({ member }: { member: string }) {
  const go = useNavigate();
  const [st, setSt] = useState<MtAdminState | null>(null);
  const [chs, setChs] = useState<MtAdminChannel[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');
  const [fails, setFails] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [menu, setMenu] = useState<string | null>(null); // la tarjeta con el ⋮ abierto (channelId, u `entry:<id>`)
  const [q, setQ] = useState('');
  const [backfilling, setBackfilling] = useState(false);
  const [dedup, setDedup] = useState(false);
  const [maintMsg, setMaintMsg] = useState('');
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
  /** Cambió el catálogo de la familia: los "N videos" se vuelven a contar y se relee. */
  const changed = useCallback(async () => { forgetCounts(); await load(); }, [load]);
  const ops = useEntryOps(changed);

  // Procesa las URLs de a una (cada una es una ingesta en el server): progreso en vivo + resumen con los fallos detallados
  // por entrada (no corta ante un error).
  const add = async () => {
    const items = parseBatch(input);
    if (!items.length || busy) return;
    setBusy(true); setMsg(''); setFails([]); ops.clearNote();
    let ok = 0, vids = 0;
    const errs: string[] = [];
    for (let i = 0; i < items.length; i++) {
      setProgress(L(`Procesando ${i + 1}/${items.length}…`, `Processing ${i + 1}/${items.length}…`));
      try {
        const r = await parentCall(api.mtAdd(items[i]));
        if (r.ok) { ok++; vids += r.added; } else errs.push(`${items[i].slice(0, 48)} — ${explainYtError(r.error)}`);
      } catch {
        errs.push(`${items[i].slice(0, 48)} — ${NET()}`);
      }
    }
    if (!alive.current) return;
    setProgress(''); setBusy(false); setInput('');
    setMsg(ok
      ? L(`✓ ${ok} agregada(s) · ${vids} video(s) aprobados${errs.length ? ` · ${errs.length} con error` : ''}`, `✓ ${ok} added · ${vids} video(s) approved${errs.length ? ` · ${errs.length} with errors` : ''}`)
      : (errs.length ? L(`Ninguna se agregó (${errs.length} con error)`, `None were added (${errs.length} with errors)`) : ''));
    setFails(errs);
    await changed();
  };

  const backfill = async () => {
    if (backfilling) return;
    setBackfilling(true); setMaintMsg('');
    try {
      const r = await parentCall(api.mtBackfill());
      setMaintMsg(r.ok ? L(`✓ Mis videos actualizado: ${r.completados} video(s) completados · ${r.canales} canal(es).`, `✓ My videos updated: ${r.completados} video(s) completed · ${r.canales} channel(s).`) : L(`Error al completar canales: ${explainYtError(r.error)}`, `Couldn’t complete channels: ${explainYtError(r.error)}`));
    } catch {
      setMaintMsg(L(`Error al completar canales: ${NET()}`, `Couldn’t complete channels: ${NET()}`));
    } finally {
      if (alive.current) setBackfilling(false);
    }
    await changed();
  };

  const quitarDuplicados = async () => {
    if (dedup) return;
    setDedup(true); setMaintMsg('');
    try {
      const r = await parentCall(api.mtDedup());
      setMaintMsg(r.ok ? (r.removed ? L(`✓ Quité ${r.removed} entrada(s) duplicada(s)`, `✓ Removed ${r.removed} duplicate entr${r.removed === 1 ? 'y' : 'ies'}`) : L('No había entradas duplicadas', 'There were no duplicate entries')) : `Error: ${explainYtError(r.error)}`);
    } catch {
      setMaintMsg(`Error: ${NET()}`);
    } finally {
      if (alive.current) setDedup(false);
    }
    await changed();
  };

  const saveCap = async () => {
    setCapMsg('');
    try {
      const r = await parentCall(api.mtSetCap(cap ?? ''));
      setCap(String(r.videoCap));
      setCapMsg(r.videoCap ? L(`✓ Guardado: hasta ${r.videoCap} videos por entrada.`, `✓ Saved: up to ${r.videoCap} videos per entry.`) : L('✓ Guardado: sin tope.', '✓ Saved: no cap.'));
    } catch {
      setCapMsg(L('No se pudo guardar. Probá de nuevo.', 'Couldn’t save. Try again.'));
    }
  };

  const groups = useMemo(() => (st && chs ? groupChannels(st.entries, chs) : null), [st, chs]);
  const counts = useChannelCounts();
  const open = (id: string) => go(famTo(familyChannelPath(id), member));

  // El ⋮ abierto: las entradas de ese canal (o la entrada suelta, sin canal conocido).
  const sheet = useMemo(() => {
    if (!menu || !groups) return null;
    if (menu.startsWith('entry:')) {
      const e = groups.orphans.find((x) => `entry:${x.id}` === menu);
      return e ? { title: e.title, entries: [e] } : null;
    }
    const f = groups.family.find((x) => x.channel.channelId === menu);
    return f ? { title: f.channel.title, entries: f.entries } : null;
  }, [menu, groups]);

  const familyShown = groups?.family.filter((f) => channelMatches(f.channel, q)) ?? [];
  const orphansShown = groups?.orphans.filter((e) => channelMatches({ title: e.title }, q)) ?? [];
  const catalogShown = groups?.catalog.filter((c) => channelMatches(c, q)) ?? [];
  const famCount = (groups?.family.length ?? 0) + (groups?.orphans.length ?? 0);

  return (
    <>
      <section className="pz-panel" aria-labelledby="pz-mt-h">
        <header className="pz-panel-head">
          <h3 id="pz-mt-h">{L('Mis videos', 'My videos')} <span className="pz-mem-fam">{L('Vale para toda la familia', 'For the whole family')}</span></h3>
          <p>{L('Videos, playlists y canales de YouTube que aprobás para tu familia. Se suman al catálogo aprobado de Smarty y cada integrante los puede seguir en Mis videos. Abajo, los canales como los ve tu familia.', 'YouTube videos, playlists and channels you approve for your family. They join Smarty’s approved catalog and every member can follow them in My videos. Below, the channels as your family sees them.')}</p>
        </header>
        <div className="pz-block">
          <h4 className="pz-block-h">{L('Agregar', 'Add')}</h4>
          <textarea className="pz-input pz-yt-ta" rows={3} value={input} disabled={busy} aria-label={L('URLs de YouTube', 'YouTube URLs')}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void add(); } }}
            placeholder={L('Una URL por línea o separadas por ";" (video, playlist o canal @handle)\nhttps://youtu.be/dQw4w9WgXcQ\nhttps://www.youtube.com/@nombrecanal', 'One URL per line or separated by ";" (video, playlist or channel @handle)\nhttps://youtu.be/dQw4w9WgXcQ\nhttps://www.youtube.com/@channelname')} />
          <div className="pz-yt-row">
            <button type="button" className="pz-btn" disabled={busy || !input.trim()} onClick={() => void add()}>{busy ? '…' : L('Agregar', 'Add')}</button>
            <span className="pz-yt-hint" role="status">{busy ? progress : L('Una línea o «;» = una URL · ⌘/Ctrl+Enter', 'One line or “;” = one URL · ⌘/Ctrl+Enter')}</span>
          </div>
          {msg && <p className="pz-yt-msg" role="status">{msg}</p>}
          {fails.length > 0 && <ul className="pz-yt-fails">{fails.map((f, i) => <li key={i}>{f}</li>)}</ul>}
          <p className="pz-muted pz-yt-snap">
            {L('Modo snapshot: se aprueban los videos ACTUALES de la playlist/canal — los videos futuros no entran solos.', 'Snapshot mode: the CURRENT videos of the playlist/channel are approved; future videos aren’t added automatically.')}
            {st && <> {L('Total aprobados:', 'Total approved:')} <b>{st.total}</b>.</>}
          </p>
        </div>
      </section>

      {!groups ? <section className="pz-panel"><PanelState failed={failed} onRetry={() => void load()} /></section> : (
        <>
          <div className="pz-mt-bar">
            <h3 className="pz-mt-bar-t">{L('Canales', 'Channels')} <span className="pz-block-n">{groups.family.length + groups.catalog.length}</span></h3>
            <input className="pz-input pz-mt-q" type="search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={L('Buscar un canal', 'Search for a channel')} aria-label={L('Buscar un canal por nombre o @handle', 'Search for a channel by name or @handle')} />
          </div>

          <section className="pz-mt-sec" aria-labelledby="pz-mt-fam-h">
            <h4 className="pz-block-h" id="pz-mt-fam-h">{L('Sumados por tu familia', 'Added by your family')} <span className="pz-block-n">{famCount}</span></h4>
            {ops.note && (ops.note.err
              ? <p className="pz-form-err" role="alert">{ops.note.text}</p>
              : <p className="pz-yt-msg" role="status">{ops.note.text}</p>)}
            {famCount === 0 ? (
              <p className="pz-muted">{L('Todavía no sumaste nada. Además del catálogo de Smarty, tu familia solo puede ver en Mis videos lo que agregues arriba.', 'You haven’t added anything yet. Besides Smarty’s catalog, your family can only see in My videos what you add above.')}</p>
            ) : familyShown.length + orphansShown.length === 0 ? (
              <p className="pz-muted">{L(`Ningún canal sumado coincide con «${q.trim()}».`, `No added channel matches “${q.trim()}”.`)}</p>
            ) : (
              <div className="mt-chgrid">
                {familyShown.map(({ channel: c, entries }) => (
                  <ChannelTile key={c.channelId} id={c.channelId} title={c.title} thumb={c.thumb} count={counts.get(c.channelId)}
                    onOpen={() => open(c.channelId)} menuLabel={L(`Opciones de ${c.title} (${entries.length} ${entries.length === 1 ? 'entrada' : 'entradas'})`, `Options for ${c.title} (${entries.length} ${entries.length === 1 ? 'entry' : 'entries'})`)}
                    onMenu={() => { ops.clearNote(); setMenu(c.channelId); }} />
                ))}
                {orphansShown.map((e) => (
                  <ChannelTile key={`entry:${e.id}`} id={null} title={e.title} count={e.videos}
                    onOpen={() => { ops.clearNote(); setMenu(`entry:${e.id}`); }} menuLabel={L(`Opciones de ${e.title}`, `Options for ${e.title}`)}
                    onMenu={() => { ops.clearNote(); setMenu(`entry:${e.id}`); }} />
                ))}
              </div>
            )}
          </section>

          <section className="pz-mt-sec" aria-labelledby="pz-mt-cat-h">
            <h4 className="pz-block-h" id="pz-mt-cat-h">{L('Del catálogo de Smarty', 'From Smarty’s catalog')} <span className="pz-block-n">{groups.catalog.length}</span></h4>
            <p className="pz-help pz-mt-help">{L('Los canales aprobados de fábrica. Tocá uno para ver sus videos y ajustar cómo se le presenta a tu familia.', 'The built-in approved channels. Tap one to see its videos and adjust how it’s presented to your family.')}</p>
            {catalogShown.length === 0 ? <p className="pz-muted">{q.trim() ? L(`Ningún canal del catálogo coincide con «${q.trim()}».`, `No catalog channel matches “${q.trim()}”.`) : L('No hay canales en el catálogo.', 'There are no channels in the catalog.')}</p> : (
              <div className="mt-chgrid">
                {catalogShown.map((c) => (
                  <ChannelTile key={c.channelId} id={c.channelId} title={c.title} thumb={c.thumb} count={counts.get(c.channelId)} onOpen={() => open(c.channelId)} />
                ))}
              </div>
            )}
          </section>

          <details className="pz-panel pz-mt-maint">
            <summary className="pz-mt-maint-s">{L('Mantenimiento', 'Maintenance')}</summary>
            <div className="pz-yt-maint">
              <button type="button" className="pz-btn pz-btn--ghost pz-btn--sm" disabled={backfilling} onClick={() => void backfill()}>
                {backfilling ? L('Completando…', 'Completing…') : L('↻ Completar canales (Mis videos)', '↻ Complete channels (My videos)')}
              </button>
              <span className="pz-yt-hint">{L('Rellena el canal y la duración de los videos que les falte (para encender listas viejas en Mis videos). Necesita la API key de YouTube.', 'Fills in the channel and duration of videos missing them (to turn on old lists in My videos). Needs the YouTube API key.')}</span>
              <button type="button" className="pz-btn pz-btn--ghost pz-btn--sm" disabled={dedup} onClick={() => void quitarDuplicados()}
                title={L('Quita entradas repetidas (mismo canal/playlist/video), conservando la más vieja y sus videos', 'Removes repeated entries (same channel/playlist/video), keeping the oldest one and its videos')}>
                {dedup ? L('Limpiando…', 'Cleaning up…') : L('⧉ Quitar duplicados', '⧉ Remove duplicates')}
              </button>
            </div>
            {maintMsg && <p className="pz-yt-msg" role="status">{maintMsg}</p>}
            <div className="pz-field pz-yt-cap">
              <label htmlFor="pz-yt-cap">{L('Tope de videos por canal/lista (0 = sin tope)', 'Video cap per channel/list (0 = no cap)')}</label>
              <div className="pz-yt-row">
                <input id="pz-yt-cap" className="pz-input pz-input--num" type="number" min={0} inputMode="numeric" value={cap ?? ''}
                  onChange={(e) => { setCap(e.target.value); setCapMsg(''); }} onKeyDown={(e) => { if (e.key === 'Enter') void saveCap(); }} />
                <button type="button" className="pz-btn pz-btn--sm" onClick={() => void saveCap()}>{L('Guardar', 'Save')}</button>
                {capMsg && <span className="pz-yt-ok" role="status">{capMsg}</span>}
              </div>
              <span className="pz-field-help">{L('Cuántos videos importar de cada canal/playlist al agregarlo o reingestarlo. La API de YouTube es gratis (1 unidad de cuota por cada 50 videos); el límite real es el almacenamiento del catálogo.', 'How many videos to import from each channel/playlist when adding or re-importing it. The YouTube API is free (1 quota unit per 50 videos); the real limit is the catalog’s storage.')} <b>{L('0 = traer todos.', '0 = bring them all.')}</b> {L('Cambiá el valor y reingestá una entrada para aplicarlo.', 'Change the value and re-import an entry to apply it.')}</span>
            </div>
          </details>
        </>
      )}

      {sheet && !ops.askDel && (
        <MtEntriesSheet title={sheet.title} entries={sheet.entries} note={ops.note} reingId={ops.reingId} removing={ops.removing} locked={ops.locked}
          onReingest={(e) => void ops.reingest(e)} onRemove={(e: MtEntry) => { setMenu(null); ops.ask(e); }} onClose={() => setMenu(null)} />
      )}
      {ops.askDel && <ConfirmSheet text={removeText(ops.askDel)} confirmLabel={L('Eliminar', 'Remove')} danger onAnswer={ops.answer} />}
    </>
  );
}

/** Una tarjeta de la grilla: la ChannelCard del chico + (si es algo que sumó la familia) el ⋮ de mantenimiento. Pide su
 *  "N videos" cuando está en pantalla (lib/mtCounts.ts). `id` null = una entrada suelta sin canal: su número ya se sabe. */
function ChannelTile({ id, title, thumb, count, onOpen, onMenu, menuLabel }: {
  id: string | null; title: string; thumb?: string; count: number | undefined;
  onOpen: () => void; onMenu?: () => void; menuLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !id) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const io = new IntersectionObserver((es) => setVisible(es.some((e) => e.isIntersecting)), { rootMargin: '160px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [id]);
  useEffect(() => { if (id && visible && count === undefined) wantCount(id); }, [id, visible, count]);
  return (
    <div className={`pz-mt-tile${onMenu ? ' has-menu' : ''}`} ref={ref}>
      <ChannelCard c={{ channelId: id ?? title, title, thumb, videos: count ?? 0 }} counting={count === undefined} onOpen={onOpen} />
      {onMenu && <button type="button" className="pz-mt-dots" aria-label={menuLabel} title={L('Reingestar o eliminar', 'Re-import or remove')} onClick={onMenu}><IcDots /></button>}
    </div>
  );
}
