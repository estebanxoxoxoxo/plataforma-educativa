import { IcBook, IcDownSm, IcSpark, IcTrash, IcUpSm } from '../../../shared/components/icons';
import { GEN_TYPES, type DraftModule } from '../lib/routeDraft';
import { parseYtUrl } from '../lib/youtube';
import { IcCrLayers, IcCrPlus, IcCrRepeat, IcCrSpinner } from '../components/CreateIcons';
import { Deck } from '../components/Deck';
import { InventoryPanel, type InventoryHandlers, type InventoryView } from '../components/InventoryPanel';

export interface ModuleHandlers {
  onPatch: (mid: string, p: Partial<DraftModule>) => void;
  onMove: (mid: string, dir: number) => void;
  onDelete: (mid: string) => void;
  onSource: (mid: string, field: 'url' | 'title', val: string) => void;
  onThreshold: (mid: string, pct: string) => void;
  onToggleRecall: (mid: string) => void;
  onGenerate: (mid: string) => void;
  onPostaTitle: (mid: string, postaId: string, t: string) => void;
  onCard: (mid: string, postaId: string, ci: number, field: 'front' | 'back', val: string) => void;
  onAddCard: (mid: string, postaId: string) => void;
  onRemoveCard: (mid: string, postaId: string, ci: number) => void;
  onAddProf: (mid: string) => void;
  onDeleteProf: (mid: string, pid: string) => void;
  onMoveProf: (mid: string, pid: string, dir: number) => void;
}

/** Un módulo de la ruta (renderModule del POC): UN contenido (artículo de Wikipedia por título, o video de YouTube por URL)
 *  → "Generar" arma la 1ª posta (lectura/video + comprensión, aprobada por umbral) + las de profundización + el inventario.
 *  Después: tarjetas a mano (la opción múltiple es solo lectura), profundización manual, curaduría/auditoría en el
 *  inventario y el repaso opcional al final. Borrar un módulo no pide confirmación (POC). Pura. */
export function ModuleCard({ m, index, total, h, inv }: {
  m: DraftModule;
  index: number;
  total: number;
  h: ModuleHandlers & InventoryHandlers;
  inv: InventoryView;
}) {
  const isVideo = parseYtUrl(m.source.url)?.type === 'video' || m.source.kind === 'video';
  const n = index + 1;
  return (
    <article className="cr-mod" data-module={m.id}>
      <header className="cr-mod-head">
        <IcCrLayers className="cr-mod-ic" />
        <span className="cr-mod-k">Módulo {n}</span>
        <input className="cr-input cr-emoji" value={m.emoji} onChange={(e) => h.onPatch(m.id, { emoji: e.target.value })} aria-label={`Emoji del módulo ${n}`} />
        <input className="cr-input cr-mod-title" value={m.title} onChange={(e) => h.onPatch(m.id, { title: e.target.value })} aria-label={`Título del módulo ${n}`} />
        <div className="cr-mod-tools">
          <button type="button" className="cr-ib" onClick={() => h.onMove(m.id, -1)} disabled={index === 0} title="Subir" aria-label={`Subir el módulo ${n}`}><IcUpSm aria-hidden="true" /></button>
          <button type="button" className="cr-ib" onClick={() => h.onMove(m.id, 1)} disabled={index === total - 1} title="Bajar" aria-label={`Bajar el módulo ${n}`}><IcDownSm aria-hidden="true" /></button>
          <button type="button" className="cr-ib is-danger" onClick={() => h.onDelete(m.id)} title="Eliminar módulo" aria-label={`Eliminar el módulo ${n}`}><IcTrash aria-hidden="true" /></button>
        </div>
      </header>

      <div className="cr-mod-body">
        {/* CONTENIDO (1ª posta · lectura o video) */}
        <section className="cr-blk">
          <h4 className="cr-blk-h cr-blk-h--accent"><IcBook aria-hidden="true" /> Contenido — 1ª posta (artículo o video + comprensión)</h4>
          <input className="cr-input" value={m.source.url} onChange={(e) => h.onSource(m.id, 'url', e.target.value)}
            placeholder="URL de artículo o video de YouTube (o título de Wikipedia)" aria-label={`Módulo ${n}: URL del contenido`} />
          <input className="cr-input" value={m.source.title} onChange={(e) => h.onSource(m.id, 'title', e.target.value)}
            placeholder="Título (los videos lo completan solos al generar)" aria-label={`Módulo ${n}: título del contenido`} />
          {isVideo && (
            <div className="cr-badges">
              <span className="cr-badge is-video">🎥 video de YouTube</span>
              {m.captionKind === 'asr' && <span className="cr-badge is-warn">⚠ subtítulos automáticos — revisá bien los datos</span>}
              {m.captionKind === 'manual' && <span className="cr-badge-ok">✓ subtítulos del autor</span>}
            </div>
          )}

          {/* config de generación por módulo — el TIPO de actividad a generar (uno) + el tamaño */}
          <div className="cr-genrow">
            <span className="cr-genrow-k">Actividad:</span>
            <div className="cr-types" role="group" aria-label={`Módulo ${n}: tipo de actividad`}>
              {GEN_TYPES.map((t) => {
                const active = m.types.includes(t.id);
                return (
                  <button key={t.id} type="button" disabled={!t.on} className={`cr-type${active ? ' is-on' : ''}`}
                    aria-pressed={t.on ? active : undefined} title={t.on ? undefined : 'próximamente'}
                    onClick={() => h.onPatch(m.id, { types: [t.id] })}>
                    {t.label}
                  </button>
                );
              })}
            </div>
            <label className="cr-size">tamaño
              <select className="cr-input cr-select cr-select--sm" value={m.size} onChange={(e) => h.onPatch(m.id, { size: e.target.value })}>
                <option value="small">chica</option>
                <option value="auto">auto</option>
                <option value="large">grande</option>
              </select>
            </label>
          </div>

          <div className="cr-gorow">
            <button type="button" className="cr-btn cr-go" onClick={() => h.onGenerate(m.id)} disabled={m.generating} aria-busy={m.generating}>
              {m.generating ? <IcCrSpinner className="cr-spin" /> : <IcSpark aria-hidden="true" />}
              {m.generating ? 'Generando…' : m.comprehension ? 'Regenerar módulo' : 'Generar módulo'}
            </button>
            {m.comprehension && (
              <label className="cr-thr">Aprobar con
                <input type="number" min={0} max={100} className="cr-input cr-num cr-num--sm" value={Math.round(m.passThreshold * 100)}
                  onChange={(e) => h.onThreshold(m.id, e.target.value)} /> %
              </label>
            )}
          </div>
          {m.error && <p className="cr-err" role="alert">{m.error}</p>}
        </section>

        {/* COMPRENSIÓN (preguntas de la lectura) */}
        {m.comprehension && (
          <section className="cr-blk">
            <h4 className="cr-blk-h">Preguntas de comprensión (aseguramiento de la lectura)</h4>
            <Deck posta={m.comprehension}
              onCard={(ci, field, val) => h.onCard(m.id, m.comprehension!.id, ci, field, val)}
              onAddCard={() => h.onAddCard(m.id, m.comprehension!.id)}
              onRemoveCard={(ci) => h.onRemoveCard(m.id, m.comprehension!.id, ci)} />
          </section>
        )}

        {/* PROFUNDIZACIÓN */}
        {(m.comprehension || m.profundizacion.length > 0) && (
          <section className="cr-blk">
            <h4 className="cr-blk-h">Profundización</h4>
            {m.profundizacion.map((p, pi) => (
              <div key={p.id} className="cr-prof" data-posta={p.id}>
                <div className="cr-prof-head">
                  <input className="cr-input cr-input--sm cr-prof-title" value={p.title} onChange={(e) => h.onPostaTitle(m.id, p.id, e.target.value)} aria-label="Título de la posta" />
                  <button type="button" className="cr-ib" onClick={() => h.onMoveProf(m.id, p.id, -1)} disabled={pi === 0} title="Subir" aria-label={`Subir «${p.title}»`}><IcUpSm aria-hidden="true" /></button>
                  <button type="button" className="cr-ib" onClick={() => h.onMoveProf(m.id, p.id, 1)} disabled={pi === m.profundizacion.length - 1} title="Bajar" aria-label={`Bajar «${p.title}»`}><IcDownSm aria-hidden="true" /></button>
                  <button type="button" className="cr-ib is-danger" onClick={() => h.onDeleteProf(m.id, p.id)} title="Quitar posta" aria-label={`Quitar «${p.title}»`}><IcTrash aria-hidden="true" /></button>
                </div>
                <Deck posta={p}
                  onCard={(ci, field, val) => h.onCard(m.id, p.id, ci, field, val)}
                  onAddCard={() => h.onAddCard(m.id, p.id)}
                  onRemoveCard={(ci) => h.onRemoveCard(m.id, p.id, ci)} />
              </div>
            ))}
            <button type="button" className="cr-link cr-link--add" onClick={() => h.onAddProf(m.id)}><IcCrPlus /> profundización</button>
          </section>
        )}

        {/* INVENTARIO de facts (solo lectura + curaduría + auditoría): nada se pierde en silencio */}
        <InventoryPanel m={m} view={inv} h={h} />

        {/* REPASO de módulo */}
        <label className="cr-recall">
          <input type="checkbox" className="cr-check" checked={m.recall} onChange={() => h.onToggleRecall(m.id)} />
          <IcCrRepeat className="cr-recall-ic" /> Repaso del módulo al final
        </label>
      </div>
    </article>
  );
}
