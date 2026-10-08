import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../../../api';
import type { NewMarketItem, Redemption } from '../../../api/types';
import { DeliveryRow } from '../cards/DeliveryRow';
import { RewardRow } from '../cards/RewardRow';
import { PanelState } from '../components/PanelState';
import { RewardForm } from '../components/RewardForm';
import { useFeatures } from '../lib/features';
import { patchFrom } from '../lib/rewardDraft';
import type { ParentDashboard, ParentItemPatch, ParentItemView } from '../lib/types';

type FormState = { mode: 'new' } | { mode: 'edit'; item: ParentItemView } | null;
type Notice = { text: string; err?: boolean; undo?: () => void } | null;

/** Panel "Premios de la Tienda": los canjes de Ian para entregar ("Ya se lo di"), los premios publicados
 *  (publicar, editar, archivar) y los archivados (reactivar). Archivar ≠ borrar: sale de la Tienda del
 *  chico pero queda acá. Todo pasa por la API y después se relee el tablero (nada optimista: lo que se
 *  ve es lo que guardó el server). */
export function RewardsPanel({ kid, dash, failed, reload }: { kid: string; dash: ParentDashboard | null; failed: boolean; reload: () => Promise<void> }) {
  const features = useFeatures();
  const [form, setForm] = useState<FormState>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string[]>([]);
  const [fresh, setFresh] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const alive = useRef(true);
  const freshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; if (freshTimer.current) clearTimeout(freshTimer.current); };
  }, []);
  // Los avisos de éxito se van solos (con "Deshacer", un rato más); los errores quedan hasta la próxima acción.
  useEffect(() => {
    if (!notice || notice.err) return;
    const t = setTimeout(() => setNotice((n) => (n === notice ? null : n)), notice.undo ? 9000 : 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const tiendaOff = features?.tienda === false;
  const items = dash?.items ?? [];
  const live = items.filter((i) => !i.archived).sort((a, b) => a.price - b.price || a.id - b.id);
  const archived = items.filter((i) => i.archived).sort((a, b) => b.id - a.id);
  const reds = dash?.redemptions ?? [];
  const pendingReds = reds.filter((r) => r.status === 'pendiente');
  const ordered = [...pendingReds, ...reds.filter((r) => r.status !== 'pendiente')];

  const flash = (id: number) => {
    setFresh(id);
    if (freshTimer.current) clearTimeout(freshTimer.current);
    freshTimer.current = setTimeout(() => { if (alive.current) setFresh(null); }, 2600);
  };
  /** Corre una acción de fila con su botón deshabilitado; si falla, lo avisa arriba. */
  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy.includes(key)) return;
    setBusy((b) => [...b, key]);
    try { await fn(); }
    catch { if (alive.current) setNotice({ text: 'No se pudo guardar el cambio. Probá de nuevo.', err: true }); }
    finally { if (alive.current) setBusy((b) => b.filter((k) => k !== key)); }
  };

  const openNew = () => { setForm({ mode: 'new' }); setFormError(null); setNotice(null); };
  const openEdit = (item: ParentItemView) => { setForm({ mode: 'edit', item }); setFormError(null); setNotice(null); };
  const closeForm = () => { setForm(null); setFormError(null); };

  const submit = async (v: NewMarketItem) => {
    if (!form || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      if (form.mode === 'new') {
        const it = await api.parentItemAdd(v);
        await reload();
        if (!alive.current) return;
        setForm(null);
        flash(it.id);
        setNotice({ text: tiendaOff ? `Publicado: “${it.title}”. ${kid} lo va a ver cuando prendas la Tienda.` : `Publicado: “${it.title}”. ${kid} ya lo ve en la Tienda.` });
      } else {
        const patch = patchFrom(form.item, v);
        if (Object.keys(patch).length) {
          const r = await api.parentItemUpdate(form.item.id, patch);
          if (!r.ok) { if (alive.current) setFormError('Ese premio ya no existe.'); await reload(); return; }
          await reload();
        }
        if (!alive.current) return;
        setForm(null);
        flash(form.item.id);
        setNotice({ text: `Cambios guardados en “${v.title}”.` });
      }
    } catch (e) {
      if (alive.current) setFormError(e instanceof ApiError && e.status === 400 ? 'El servidor no aceptó esos datos. Revisá los campos.' : 'No se pudo guardar. Revisá la conexión y probá de nuevo.');
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  const restore = (it: ParentItemView) => run(`item:${it.id}`, async () => {
    const reactivate: ParentItemPatch = { archived: false };
    const r = await api.parentItemUpdate(it.id, reactivate);
    await reload();
    if (!alive.current) return;
    if (!r.ok) { setNotice({ text: 'Ese premio ya no existe.', err: true }); return; }
    flash(it.id);
    setNotice({ text: `Reactivado: “${it.title}” vuelve a la Tienda.` });
  });
  const archive = (it: ParentItemView) => run(`item:${it.id}`, async () => {
    if (form?.mode === 'edit' && form.item.id === it.id) closeForm();
    const r = await api.parentItemArchive(it.id);
    await reload();
    if (!alive.current) return;
    if (!r.ok) { setNotice({ text: 'Ese premio ya no existe.', err: true }); return; }
    setNotice({ text: `Archivado: “${it.title}”. ${kid} ya no lo ve en la Tienda.`, undo: () => void restore(it) });
  });
  const deliver = (r: Redemption) => run(`red:${r.id}`, async () => {
    const res = await api.deliverRedemption(r.id);
    await reload();
    if (!alive.current) return;
    setNotice(res.ok ? { text: `Marcado como entregado: “${r.title}”.` } : { text: 'Ese canje ya no existe (la demo se reinició al recargar).', err: true });
  });

  return (
    <section className="pz-panel" aria-labelledby="pz-rw-h">
      <header className="pz-panel-head pz-panel-head--act">
        <div>
          <h3 id="pz-rw-h">Premios de la Tienda</h3>
          <p>Publicá recompensas a la medida de {kid}. Las canjea con las Energy Coins que gana practicando.</p>
        </div>
        {form?.mode !== 'new' && <button type="button" className="pz-btn" onClick={openNew}>Publicar premio</button>}
      </header>

      {tiendaOff && (
        <p className="pz-warn">
          La Tienda está apagada: {kid} no ve estos premios ni puede canjear. Podés prepararlos igual. <Link to="/padres" className="pz-inline">Prenderla</Link>
        </p>
      )}
      <p className={`pz-notice${notice?.err ? ' is-err' : ''}${notice ? '' : ' is-empty'}`} role="status">
        {notice?.text}
        {notice?.undo && <button type="button" className="pz-link" onClick={() => { const u = notice.undo; setNotice(null); u?.(); }}>Deshacer</button>}
      </p>

      {form && (
        <RewardForm key={form.mode === 'edit' ? `e${form.item.id}` : 'new'} item={form.mode === 'edit' ? form.item : undefined}
          kid={kid} busy={saving} error={formError} onSubmit={(v) => void submit(v)} onCancel={closeForm} />
      )}

      {!dash ? <PanelState failed={failed} onRetry={() => void reload()} /> : (
        <>
          <div className="pz-block">
            <h4 className="pz-block-h">
              Canjes de {kid}
              {pendingReds.length > 0 && <span className="pz-block-n is-warn">{pendingReds.length} por entregar</span>}
            </h4>
            {ordered.length === 0 ? (
              <p className="pz-muted">Todavía no canjeó nada. Cuando canjee un premio, aparece acá hasta que se lo des.</p>
            ) : (
              <ul className="pz-dls">
                {ordered.map((r) => <DeliveryRow key={r.id} r={r} busy={busy.includes(`red:${r.id}`)} onDeliver={() => void deliver(r)} />)}
              </ul>
            )}
          </div>

          <div className="pz-block">
            <h4 className="pz-block-h">Publicados <span className="pz-block-n">{live.length}</span></h4>
            {!dash.items ? (
              <p className="pz-muted">No pude leer la lista de premios.</p>
            ) : live.length === 0 ? (
              <p className="pz-muted">No hay premios publicados. {kid} ve la Tienda vacía.</p>
            ) : (
              <RewardTable rows={live} busy={busy} fresh={fresh} onEdit={openEdit} onArchive={(it) => void archive(it)} onRestore={(it) => void restore(it)} />
            )}
          </div>

          {archived.length > 0 && (
            <div className="pz-block">
              <h4 className="pz-block-h">Archivados <span className="pz-block-n">{archived.length}</span></h4>
              <p className="pz-help">No aparecen en la Tienda. Podés reactivarlos cuando quieras.</p>
              <RewardTable rows={archived} busy={busy} fresh={fresh} onEdit={openEdit} onArchive={(it) => void archive(it)} onRestore={(it) => void restore(it)} />
            </div>
          )}
        </>
      )}
    </section>
  );
}

function RewardTable({ rows, busy, fresh, onEdit, onArchive, onRestore }: {
  rows: ParentItemView[]; busy: string[]; fresh: number | null;
  onEdit: (it: ParentItemView) => void; onArchive: (it: ParentItemView) => void; onRestore: (it: ParentItemView) => void;
}) {
  return (
    <div className="pz-table-wrap">
      <table className="pz-table pz-table--items">
        {/* anchos fijos: "Publicados" y "Archivados" quedan con las columnas alineadas */}
        <colgroup><col className="pz-c-emo" /><col /><col className="pz-c-price" /><col className="pz-c-stock" /><col className="pz-c-state" /><col className="pz-c-act" /></colgroup>
        <thead>
          <tr><th scope="col" colSpan={2}>Premio</th><th scope="col" className="pz-th-num">Precio</th><th scope="col">Stock</th><th scope="col">Estado</th><th scope="col"><span className="pz-sr">Acciones</span></th></tr>
        </thead>
        <tbody>
          {rows.map((it) => (
            <RewardRow key={it.id} it={it} busy={busy.includes(`item:${it.id}`)} fresh={fresh === it.id}
              onEdit={() => onEdit(it)} onArchive={() => onArchive(it)} onRestore={() => onRestore(it)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
