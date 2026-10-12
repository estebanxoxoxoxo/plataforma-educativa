import { IcSearchG, IcUpSm, IcDownSm, IcSpark } from '../../../shared/components/icons';
import { isRisky, type ConceptInv, type DraftModule, type FactInv } from '../lib/routeDraft';
import { IcCrListChecks, IcCrSpinner } from './CreateIcons';

/* Inventario de facts de un módulo (renderInventory del POC): TODO lo que route-lab extrajo + qué entró y qué no. Los facts
   no se editan ni se borran (POC): se tildan conceptos (cuáles se vuelven posta) y datos (cuáles se evalúan) y "Aplicar
   selección" re-emite la profundización (route-lab /emit, NO re-extrae). La lupa audita un dato contra fuentes (los
   riesgosos —numéricos o de fidelidad < 0.9— en ámbar) y "Auditar N riesgosos" los audita en lote. La certeza es
   fidelidad a la fuente (proxy), no verdad. Pura: los tildes y la auditoría los resuelve el contenedor. */

const KIND_LABEL: Record<string, string> = { numeric: '#', property: 'prop', definition: 'def', relation: 'rel' };
/** certeza-PROXY (no mide verdad): numérico primero, quoteScore < 0.92 después. */
const certClass = (f: FactInv) => (f.kind === 'numeric' ? 'is-num' : f.quoteScore < 0.92 ? 'is-low' : 'is-hi');
const verdictMark = (s: string) => (s === 'confirmado' ? '✓' : s === 'contradicho' ? '✗' : s === 'parcial' ? '≈' : '?');
const agreeMark = (a: string) => (a === 'si' ? '✓' : a === 'no' ? '✗' : a === 'parcial' ? '≈' : '·');
const agreeLabel = (a: string) => (a === 'si' ? 'coincide' : a === 'no' ? 'no coincide' : a === 'parcial' ? 'coincide en parte' : 'sin relación clara');

export interface InventoryHandlers {
  onToggleInv: (mid: string) => void;
  onOverride: (key: string, val: boolean) => void;
  onApply: (m: DraftModule) => void;
  onAuditOne: (m: DraftModule, f: FactInv) => void;
  onAuditModule: (m: DraftModule) => void;
  onToggleAudit: (fid: string) => void;
}
export interface InventoryView {
  open: boolean;
  /** tildes de curaduría: `${mid}:c:${cid}` / `${mid}:f:${fid}` → tildado; ausente = el valor del inventario */
  curOverride: Record<string, boolean>;
  /** este módulo está aplicando la selección */
  applying: boolean;
  /** fact en auditoría en TODA la vista (una a la vez) */
  auditingFact: string | null;
  openAudit: Set<string>;
  /** lote de auditoría en curso en ESTE módulo */
  batch: { done: number; total: number } | null;
  /** hay un lote en curso en cualquier módulo */
  batchActive: boolean;
}

export function InventoryPanel({ m, view, h }: { m: DraftModule; view: InventoryView; h: InventoryHandlers }) {
  const inv = m.inventory;
  if (!inv) return null;
  const { open, curOverride, applying: busy, auditingFact, openAudit, batch, batchActive } = view;
  const conceptChecked = (c: ConceptInv) => curOverride[`${m.id}:c:${c.id}`] ?? c.proposedAsPosta;
  const factChecked = (f: FactInv) => curOverride[`${m.id}:f:${f.id}`] ?? f.selected;
  const enPosta = inv.facts.filter((f) => f.selected).length;
  const fuera = inv.facts.length - enPosta;
  const dirty =
    inv.concepts.some((c) => conceptChecked(c) !== c.proposedAsPosta) ||
    inv.facts.some((f) => factChecked(f) !== f.selected);
  const riskyN = inv.facts.filter((f) => isRisky(f) && !f.audit).length;
  const panelId = `cr-inv-${m.id}`;

  return (
    <div className="cr-inv">
      <button type="button" className="cr-inv-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => h.onToggleInv(m.id)}>
        <IcCrListChecks className="cr-inv-ic" />
        <span>
          Inventario — {inv.facts.length} datos extraídos · {enPosta} en postas{fuera ? ` · ${fuera} fuera` : ''}
          {inv.integrityDropped.length ? ` · ${inv.integrityDropped.length} sin verificar` : ''}
        </span>
        {dirty && <span className="cr-dirty">• cambios sin aplicar</span>}
        {open ? <IcUpSm className="cr-inv-chev" aria-hidden="true" /> : <IcDownSm className="cr-inv-chev" aria-hidden="true" />}
      </button>

      {open && (
        <div className="cr-inv-body" id={panelId}>
          <div className="cr-inv-top">
            <p className="cr-inv-help">
              Tildá qué conceptos se vuelven posta y qué datos se evalúan. «Aplicar» re-genera la profundización (no re-extrae).
              La <IcSearchG className="cr-inline-ic" aria-label="lupa" role="img" /> verifica un dato contra fuentes (los <span className="cr-risky-t">riesgosos</span> conviene
              auditarlos). La certeza es fidelidad a la fuente, no verdad.
            </p>
            <button type="button" className="cr-btn cr-btn--ghost cr-btn--sm" onClick={() => h.onAuditModule(m)} disabled={batchActive || auditingFact !== null || !riskyN}>
              {batch ? <IcCrSpinner className="cr-spin" /> : <IcSearchG aria-hidden="true" />}
              {batch ? `Auditando ${batch.done}/${batch.total}…` : `Auditar ${riskyN} riesgoso${riskyN === 1 ? '' : 's'}`}
            </button>
          </div>

          {inv.concepts.map((c) => {
            const isPosta = conceptChecked(c);
            const cfacts = inv.facts.filter((f) => f.concept === c.id);
            const nEval = cfacts.filter((f) => factChecked(f)).length;
            return (
              <div key={c.id} className="cr-con">
                <label className="cr-con-head">
                  <input type="checkbox" className="cr-check" checked={isPosta} onChange={(e) => h.onOverride(`${m.id}:c:${c.id}`, e.target.checked)} />
                  <span className="cr-con-label">{c.label}</span>
                  <span className="cr-con-n">{c.factCount} datos</span>
                  {c.corroborated && <span className="cr-con-corr" title="Aparece en ≥2 fuentes">✓ 2+ fuentes</span>}
                  {isPosta
                    ? <span className={`cr-pill ${nEval >= 2 ? 'is-ok' : 'is-bad'}`}>posta · {nEval} eval{nEval < 2 ? ' (necesita ≥2)' : ''}</span>
                    : c.dropReason && <span className="cr-pill is-warn">descartado: {c.dropReason}</span>}
                </label>
                <ul className="cr-facts">
                  {cfacts.map((f, fi) => {
                    const on = factChecked(f);
                    const auditing = auditingFact === f.id;
                    const a = f.audit;
                    return (
                      // fi: defensa por si un fact-id se repite (rutas viejas pre-fix de unicidad), como el POC
                      <li key={`${f.id}-${fi}`} className="cr-fact">
                        <div className="cr-fact-row">
                          <input type="checkbox" className="cr-check" checked={on} disabled={!isPosta} onChange={(e) => h.onOverride(`${m.id}:f:${f.id}`, e.target.checked)}
                            aria-label={`Evaluar: ${f.front}`} />
                          <span className={`cr-cert ${certClass(f)}`} title={`fidelidad a la fuente ${f.quoteScore} · tipo ${f.kind} (NO mide verdad)`}>
                            {KIND_LABEL[f.kind] ?? f.kind} {f.quoteScore}
                          </span>
                          <span className={`cr-fact-t${on && isPosta ? '' : ' is-off'}`}>{f.front} → {f.back}</span>
                          {auditing
                            ? <IcCrSpinner className="cr-spin cr-fact-spin" aria-label="Auditando…" role="img" />
                            : a
                              ? <button type="button" className={`cr-verdict is-${a.status}`} onClick={() => h.onToggleAudit(f.id)} title="Ver auditoría" aria-expanded={openAudit.has(f.id)}>
                                  {verdictMark(a.status)} {a.status}
                                </button>
                              : <button type="button" className={`cr-ib cr-audit-btn${isRisky(f) ? ' is-risky' : ''}`} onClick={() => h.onAuditOne(m, f)} disabled={batchActive}
                                  title={isRisky(f) ? 'Conviene auditar (dato numérico o de baja fidelidad)' : 'Auditar contra fuentes'}
                                  aria-label={`Auditar: ${f.front}`}>
                                  <IcSearchG aria-hidden="true" />
                                </button>}
                        </div>
                        {a && openAudit.has(f.id) && (
                          <div className="cr-audit">
                            <p className="cr-audit-sum">{a.summary}</p>
                            {a.correction && <p className="cr-audit-fix">Corrección (según fuentes): <b>{a.correction}</b></p>}
                            <p className="cr-audit-meta">Confianza {Math.round(a.confidence * 100)}% · {a.model}</p>
                            {a.sources.length > 0 && (
                              <ul className="cr-audit-srcs">
                                {a.sources.map((s, si) => (
                                  <li key={si}>
                                    <a className="cr-audit-src" href={s.url} target="_blank" rel="noreferrer">
                                      <span className={`cr-agree is-${s.agrees}`} title={agreeLabel(s.agrees)}>{agreeMark(s.agrees)}</span>
                                      <span className="cr-audit-src-t">{s.title}{s.snippet ? <span className="cr-audit-snip"> — {s.snippet.slice(0, 90)}</span> : null}</span>
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <button type="button" className="cr-link cr-link--quiet" onClick={() => h.onAuditOne(m, f)} disabled={auditing || batchActive}>↻ re-auditar</button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          {inv.integrityDropped.length > 0 && (
            <div className="cr-dropped">
              <p className="cr-dropped-h">Descartados por no verificar en la fuente (anti-alucinación, no se rescatan):</p>
              {inv.integrityDropped.map((d, i) => (
                <p key={d.id ?? i} className="cr-dropped-i">· {d.reason}{d.quote ? ` — “${d.quote.slice(0, 60)}”` : ''}</p>
              ))}
            </div>
          )}

          <div className="cr-apply">
            <button type="button" className="cr-btn cr-btn--sm" onClick={() => h.onApply(m)} disabled={busy || !dirty}>
              {busy ? <IcCrSpinner className="cr-spin" /> : <IcSpark aria-hidden="true" />}
              {busy ? 'Aplicando…' : 'Aplicar selección (re-genera preguntas)'}
            </button>
            {dirty && !busy && <span className="cr-dirty">hay cambios sin aplicar</span>}
          </div>
        </div>
      )}
    </div>
  );
}
