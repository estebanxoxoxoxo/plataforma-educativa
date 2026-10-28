import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import type { MtChannelDetail, MtEntry, MtVideo } from '../../../api/types';
import { ConfirmSheet } from '../../create/components/ConfirmSheet';
import { ChannelHeader } from '../../mytube/components/ChannelHeader';
import { VideoList, VideoListSkeleton } from '../../mytube/components/VideoList';
import { videoPath } from '../../mytube/lib/nav';
import { MtEntryList } from '../components/MtEntryList';
import { PanelState } from '../components/PanelState';
import { parentCall } from '../lib/adultGate';
import { famTo } from '../lib/member';
import { forgetCounts } from '../lib/mtCounts';
import { removeText, useEntryOps } from '../lib/mytubeAdmin';

const FIRST = 40; // como el MyTube del chico: 40…
const MORE = 60; // …y «Ver más» de a 60
const POLL_MS = 1500; // mientras el server enriquece el canal (primera apertura)
const POLL_MAX = 120;

/** Un canal en Familia → MyTube (tanda F2, /familia/mytube/canal/:id): lo que ve la familia —la cabecera y la lista de
 *  videos del MyTube del chico (ChannelHeader sin "Seguir" + VideoList: miniatura, duración, título, "agregado …"; tocar uno
 *  lo abre en el reproductor y «‹ Canal» vuelve acá)— más lo que cura el padre: la DESCRIPCIÓN con la que se le presenta el
 *  canal a la familia (editable; se generó automática al ingerir o al abrirlo por primera vez —limpia + resumen IA—) y las
 *  entradas de la familia que trajeron este canal, con Reingestar / Eliminar (con confirmación). Abrir un canal por primera
 *  vez dispara el enriquecimiento on-demand del server, igual que cuando lo abre el chico. De toda la familia. */
export function FamilyChannelPanel({ member }: { member: string }) {
  const { id = '' } = useParams();
  const go = useNavigate();
  const loc = useLocation();
  const [detail, setDetail] = useState<MtChannelDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [vids, setVids] = useState<MtVideo[] | null>(null);
  const [vTotal, setVTotal] = useState(0);
  const [vFailed, setVFailed] = useState(false);
  const [limit, setLimit] = useState(FIRST);
  const [more, setMore] = useState(false);
  const [entries, setEntries] = useState<MtEntry[] | null>(null);
  const [desc, setDesc] = useState<{ text: string; touched: boolean }>({ text: '', touched: false });
  const [descBusy, setDescBusy] = useState(false);
  const [descSt, setDescSt] = useState<'saved' | 'error' | null>(null);
  const [round, setRound] = useState(0); // sube después de reingestar/eliminar: se relee el canal entero
  const cur = useRef(id);
  cur.current = id;

  useEffect(() => {
    setDetail(null); setFailed(false); setVids(null); setVTotal(0); setVFailed(false); setLimit(FIRST);
    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loadDetail = async (first: boolean) => {
      try {
        const d = await api.mtChannel(id);
        if (cancelled) return;
        setDetail(d);
        if (d.pending && ++polls < POLL_MAX) timer = setTimeout(() => void loadDetail(false), POLL_MS);
      } catch {
        if (cancelled) return;
        if (first) setFailed(true);
        else if (++polls < POLL_MAX) timer = setTimeout(() => void loadDetail(false), POLL_MS);
      }
    };
    void loadDetail(true);
    api.mtChannelVideos(id, 0, FIRST).then(
      (r) => { if (!cancelled) { setVids(r.videos); setVTotal(r.total); } },
      () => { if (!cancelled) setVFailed(true); },
    );
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [id, round]);

  const loadEntries = useCallback(async () => {
    try {
      const s = await parentCall(api.mtAdminState());
      if (cur.current === id) setEntries(s.entries.filter((e) => e.channelId === id));
    } catch {
      if (cur.current === id) setEntries((e) => e ?? []);
    }
  }, [id]);
  useEffect(() => { setEntries(null); void loadEntries(); }, [loadEntries]);
  useEffect(() => { setDesc({ text: '', touched: false }); setDescSt(null); }, [id]);

  // La descripción del editor sigue a la del server mientras el padre no la tocó (p. ej. llega la curada por IA).
  const serverDesc = detail?.channel?.desc ?? '';
  useEffect(() => { setDesc((d) => (d.touched ? d : { text: serverDesc, touched: false })); }, [serverDesc]);

  const ops = useEntryOps(async () => { forgetCounts(); await loadEntries(); setRound((n) => n + 1); });

  const total = detail?.total ?? vTotal;
  const showMore = async () => {
    if (!vids || more) return;
    const next = limit + MORE;
    const want = Math.min(next, total);
    if (vids.length < want) {
      setMore(true);
      try {
        const r = await api.mtChannelVideos(id, vids.length, want - vids.length);
        if (cur.current !== id) return;
        setVids((v) => [...(v ?? []), ...r.videos]);
        setVTotal(r.total);
      } catch {
        return;
      } finally {
        setMore(false);
      }
    }
    setLimit(next);
  };

  const saveDesc = async () => {
    if (descBusy) return;
    setDescBusy(true); setDescSt(null);
    const r = await parentCall(api.mtSetChannelDesc(id, desc.text)).catch(() => null);
    if (cur.current !== id) return;
    setDescBusy(false);
    setDescSt(r?.ok ? 'saved' : 'error');
  };

  const play = (v: MtVideo) => go(videoPath(v.videoId), { state: { backTo: loc.pathname + loc.search, backLabel: '‹ Canal' } });
  const back = famTo('/familia/mytube', member);
  const title = detail?.channel?.title ?? 'Canal';

  return (
    <div className="pz-mt-ch">
      <Link className="back" to={back}>‹ MyTube</Link>
      {failed ? <section className="pz-panel"><PanelState failed onRetry={() => setRound((n) => n + 1)} /></section> : !detail ? <PanelState failed={false} onRetry={() => {}} /> : !detail.channel ? (
        <p className="mt-empty">Este canal ya no tiene videos aprobados en Innerith.</p>
      ) : (
        <>
          <ChannelHeader channel={{ ...detail.channel, desc: undefined }} followed={false} descOpen={false} onToggleDesc={() => {}} />

          <section className="pz-panel" aria-labelledby="pz-mt-ch-h">
            <header className="pz-panel-head">
              <h3 id="pz-mt-ch-h">Cómo lo ve tu familia <span className="pz-mem-fam">Vale para toda la familia</span></h3>
              <p>La descripción que acompaña a «{title}» en el MyTube de cada integrante. Se generó automática (limpia + resumen IA) al ingerir o la primera vez que alguien abrió el canal; ajustala como quieras.</p>
            </header>
            <textarea className="pz-input pz-yt-desc" rows={3} value={desc.text} aria-label={`Descripción de ${title}`}
              placeholder={detail.pending ? 'Preparando la descripción del canal…' : 'Sin descripción'}
              onChange={(e) => { setDesc({ text: e.target.value, touched: true }); setDescSt(null); }} />
            <div className="pz-yt-row">
              <button type="button" className="pz-btn pz-btn--sm" disabled={descBusy} onClick={() => void saveDesc()}>{descBusy ? 'Guardando…' : 'Guardar descripción'}</button>
              {descSt === 'saved' && <span className="pz-yt-ok" role="status">✓ Guardada: es la que ve tu familia.</span>}
              {descSt === 'error' && <span className="pz-yt-err" role="alert">No se pudo guardar. Probá de nuevo.</span>}
            </div>
            {entries && entries.length > 0 && (
              <div className="pz-block">
                <h4 className="pz-block-h">Lo que sumó tu familia de este canal <span className="pz-block-n">{entries.length}</span></h4>
                <MtEntryList entries={entries} reingId={ops.reingId} removing={ops.removing} locked={ops.locked}
                  onReingest={(e) => void ops.reingest(e)} onRemove={ops.ask} />
              </div>
            )}
            {ops.note && <p className={ops.note.err ? 'pz-form-err' : 'pz-yt-msg'} role={ops.note.err ? 'alert' : 'status'}>{ops.note.text}</p>}
          </section>

          <section className="pz-mt-vids" aria-labelledby="pz-mt-v-h">
            <h4 className="pz-block-h" id="pz-mt-v-h">Videos <span className="pz-block-n">{total}</span></h4>
            {vFailed ? <p className="mt-empty">No pude cargar los videos ahora.</p>
              : !vids ? <VideoListSkeleton />
                : total > 0 ? <VideoList videos={vids.slice(0, limit)} remaining={total - limit} busy={more} onMore={() => void showMore()} onPlay={play} />
                  : <p className="mt-empty">Todavía no hay videos aprobados de este canal.</p>}
          </section>
        </>
      )}
      {ops.askDel && <ConfirmSheet text={removeText(ops.askDel)} confirmLabel="Eliminar" danger onAnswer={ops.answer} />}
    </div>
  );
}
