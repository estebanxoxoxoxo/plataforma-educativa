import { IcBook, IcDownSm, IcSpark, IcTrash, IcUpSm } from '../../../shared/components/icons';
import { GEN_TYPES, type DraftModule } from '../lib/routeDraft';
import { parseYtUrl } from '../lib/youtube';
import { IcCrLayers, IcCrPlus, IcCrRepeat, IcCrSpinner } from '../components/CreateIcons';
import { Deck } from '../components/Deck';
import { InventoryPanel, type InventoryHandlers, type InventoryView } from '../components/InventoryPanel';
import { L } from '../../../shared/lib/lang';

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
        <span className="cr-mod-k">{L('Módulo', 'Module')} {n}</span>
        <input className="cr-input cr-emoji" value={m.emoji} onChange={(e) => h.onPatch(m.id, { emoji: e.target.value })} aria-label={L(`Emoji del módulo ${n}`, `Module ${n} emoji`)} />
        <input className="cr-input cr-mod-title" value={m.title} onChange={(e) => h.onPatch(m.id, { title: e.target.value })} aria-label={L(`Título del módulo ${n}`, `Module ${n} title`)} />
        <div className="cr-mod-tools">
          <button type="button" className="cr-ib" onClick={() => h.onMove(m.id, -1)} disabled={index === 0} title={L('Subir', 'Move up')} aria-label={L(`Subir el módulo ${n}`, `Move module ${n} up`)}><IcUpSm aria-hidden="true" /></button>
          <button type="button" className="cr-ib" onClick={() => h.onMove(m.id, 1)} disabled={index === total - 1} title={L('Bajar', 'Move down')} aria-label={L(`Bajar el módulo ${n}`, `Move module ${n} down`)}><IcDownSm aria-hidden="true" /></button>
          <button type="button" className="cr-ib is-danger" onClick={() => h.onDelete(m.id)} title={L('Eliminar módulo', 'Delete module')} aria-label={L(`Eliminar el módulo ${n}`, `Delete module ${n}`)}><IcTrash aria-hidden="true" /></button>
        </div>
      </header>

      <div className="cr-mod-body">
        {/* CONTENIDO (1ª posta · lectura o video) */}
        <section className="cr-blk">
          <h4 className="cr-blk-h cr-blk-h--accent"><IcBook aria-hidden="true" /> {L('Contenido — 1ª posta (artículo o video + comprensión)', 'Content — 1st step (article or video + comprehension)')}</h4>
          <input className="cr-input" value={m.source.url} onChange={(e) => h.onSource(m.id, 'url', e.target.value)}
            placeholder={L('URL de artículo o video de YouTube (o título de Wikipedia)', 'Article or YouTube video URL (or Wikipedia title)')} aria-label={L(`Módulo ${n}: URL del contenido`, `Module ${n}: content URL`)} />
          <input className="cr-input" value={m.source.title} onChange={(e) => h.onSource(m.id, 'title', e.target.value)}
            placeholder={L('Título (los videos lo completan solos al generar)', 'Title (videos fill it in on their own when generating)')} aria-label={L(`Módulo ${n}: título del contenido`, `Module ${n}: content title`)} />
          {isVideo && (
            <div className="cr-badges">
              <span className="cr-badge is-video">{L('🎥 video de YouTube', '🎥 YouTube video')}</span>
              {m.captionKind === 'asr' && <span className="cr-badge is-warn">{L('⚠ subtítulos automáticos — revisá bien los datos', '⚠ auto-generated captions — double-check the facts')}</span>}
              {m.captionKind === 'manual' && <span className="cr-badge-ok">{L('✓ subtítulos del autor', "✓ author's captions")}</span>}
            </div>
          )}

          {/* config de generación por módulo — el TIPO de actividad a generar (uno) + el tamaño */}
          <div className="cr-genrow">
            <span className="cr-genrow-k">{L('Actividad:', 'Activity:')}</span>
            <div className="cr-types" role="group" aria-label={L(`Módulo ${n}: tipo de actividad`, `Module ${n}: activity type`)}>
              {GEN_TYPES.map((t) => {
                const active = m.types.includes(t.id);
                return (
                  <button key={t.id} type="button" disabled={!t.on} className={`cr-type${active ? ' is-on' : ''}`}
                    aria-pressed={t.on ? active : undefined} title={t.on ? undefined : L('próximamente', 'coming soon')}
                    onClick={() => h.onPatch(m.id, { types: [t.id] })}>
                    {t.label}
                  </button>
                );
              })}
            </div>
            <label className="cr-size">{L('tamaño', 'size')}
              <select className="cr-input cr-select cr-select--sm" value={m.size} onChange={(e) => h.onPatch(m.id, { size: e.target.value })}>
                <option value="small">{L('chica', 'small')}</option>
                <option value="auto">{L('auto', 'auto')}</option>
                <option value="large">{L('grande', 'large')}</option>
              </select>
            </label>
          </div>

          <div className="cr-gorow">
            <button type="button" className="cr-btn cr-go" onClick={() => h.onGenerate(m.id)} disabled={m.generating} aria-busy={m.generating}>
              {m.generating ? <IcCrSpinner className="cr-spin" /> : <IcSpark aria-hidden="true" />}
              {m.generating ? L('Generando…', 'Generating…') : m.comprehension ? L('Regenerar módulo', 'Regenerate module') : L('Generar módulo', 'Generate module')}
            </button>
            {m.comprehension && (
              <label className="cr-thr">{L('Aprobar con', 'Pass at')}
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
            <h4 className="cr-blk-h">{L('Preguntas de comprensión (aseguramiento de la lectura)', 'Comprehension questions (to check the reading)')}</h4>
            <Deck posta={m.comprehension}
              onCard={(ci, field, val) => h.onCard(m.id, m.comprehension!.id, ci, field, val)}
              onAddCard={() => h.onAddCard(m.id, m.comprehension!.id)}
              onRemoveCard={(ci) => h.onRemoveCard(m.id, m.comprehension!.id, ci)} />
          </section>
        )}

        {/* PROFUNDIZACIÓN */}
        {(m.comprehension || m.profundizacion.length > 0) && (
          <section className="cr-blk">
            <h4 className="cr-blk-h">{L('Profundización', 'Going deeper')}</h4>
            {m.profundizacion.map((p, pi) => (
              <div key={p.id} className="cr-prof" data-posta={p.id}>
                <div className="cr-prof-head">
                  <input className="cr-input cr-input--sm cr-prof-title" value={p.title} onChange={(e) => h.onPostaTitle(m.id, p.id, e.target.value)} aria-label={L('Título de la posta', 'Step title')} />
                  <button type="button" className="cr-ib" onClick={() => h.onMoveProf(m.id, p.id, -1)} disabled={pi === 0} title={L('Subir', 'Move up')} aria-label={L(`Subir «${p.title}»`, `Move “${p.title}” up`)}><IcUpSm aria-hidden="true" /></button>
                  <button type="button" className="cr-ib" onClick={() => h.onMoveProf(m.id, p.id, 1)} disabled={pi === m.profundizacion.length - 1} title={L('Bajar', 'Move down')} aria-label={L(`Bajar «${p.title}»`, `Move “${p.title}” down`)}><IcDownSm aria-hidden="true" /></button>
                  <button type="button" className="cr-ib is-danger" onClick={() => h.onDeleteProf(m.id, p.id)} title={L('Quitar posta', 'Remove step')} aria-label={L(`Quitar «${p.title}»`, `Remove “${p.title}”`)}><IcTrash aria-hidden="true" /></button>
                </div>
                <Deck posta={p}
                  onCard={(ci, field, val) => h.onCard(m.id, p.id, ci, field, val)}
                  onAddCard={() => h.onAddCard(m.id, p.id)}
                  onRemoveCard={(ci) => h.onRemoveCard(m.id, p.id, ci)} />
              </div>
            ))}
            <button type="button" className="cr-link cr-link--add" onClick={() => h.onAddProf(m.id)}><IcCrPlus /> {L('profundización', 'going deeper')}</button>
          </section>
        )}

        {/* INVENTARIO de facts (solo lectura + curaduría + auditoría): nada se pierde en silencio */}
        <InventoryPanel m={m} view={inv} h={h} />

        {/* REPASO de módulo */}
        <label className="cr-recall">
          <input type="checkbox" className="cr-check" checked={m.recall} onChange={() => h.onToggleRecall(m.id)} />
          <IcCrRepeat className="cr-recall-ic" /> {L('Repaso del módulo al final', 'Module review at the end')}
        </label>
      </div>
    </article>
  );
}
