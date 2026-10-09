import { FEATURE_LABEL, FEATURE_ORDER, quoted } from '../lib/format';
import type { PresetView } from '../lib/types';

/** Tarjeta de un preset: qué es, qué deja prendido/apagado, temas y topes, y "Aplicar" con confirmación (aplicar
 *  reemplaza la configuración: `changes` = lo que cambiaría, en palabras). Pura. */
export function PresetCard({ p, applied, confirming, busy, changes, onApply, onConfirm, onCancel }: {
  p: PresetView;
  applied: boolean;
  confirming: boolean;
  busy: boolean;
  changes: string[];
  onApply: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const s = p.spec;
  const vol = s ? (s.volume.maxMusic >= 100 && s.volume.maxNoise >= 100 ? 'Sin tope de volumen'
    : s.volume.maxMusic === s.volume.maxNoise ? `Música y ruidos hasta ${s.volume.maxMusic}`
    : `Música hasta ${s.volume.maxMusic} · ruidos hasta ${s.volume.maxNoise}`) : '';
  return (
    <li className={`pz-preset${applied ? ' is-on' : ''}${confirming ? ' is-confirming' : ''}`} data-preset={p.id}>
      <div className="pz-preset-head">
        <h4 className="pz-preset-name" id={`pz-pr-${p.id}`}>{p.name}</h4>
        {applied && (
          <span className="pz-preset-badge">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l2.9 2.9 6.1-6.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Aplicado
          </span>
        )}
      </div>
      <p className="pz-preset-desc">{p.desc}</p>
      {s && (
        <dl className="pz-preset-spec">
          <div>
            <dt>Funcionalidades</dt>
            <dd className="pz-pfs">
              {FEATURE_ORDER.map((k) => (
                <span key={k} className={`pz-pf${s.features[k] ? ' is-on' : ''}`}>
                  <span aria-hidden="true">{s.features[k] ? '✓' : '✕'}</span> {FEATURE_LABEL[k]}<span className="pz-sr">{s.features[k] ? ': prendida' : ': apagada'}</span>
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt>Temas</dt>
            <dd>
              {s.topics.black.length === 0 && s.topics.white.length === 0 ? 'Sin temas de la familia' : (
                <>
                  {s.topics.white.length > 0 && <span className="pz-preset-line">Sugiere {quoted(s.topics.white)}</span>}
                  {s.topics.black.length > 0 && <span className="pz-preset-line">Fuera: {quoted(s.topics.black)}</span>}
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>Volumen</dt>
            <dd>{vol}</dd>
          </div>
        </dl>
      )}
      {confirming ? (
        <div className="pz-preset-confirm" role="group" aria-label={`Confirmar ${p.name}`}>
          <p className="pz-preset-confirm-t">Al aplicarlo:</p>
          <ul>{changes.map((c) => <li key={c}>{c}</li>)}</ul>
          <div className="pz-form-btns">
            <button type="button" className="pz-btn pz-btn--sm" disabled={busy} onClick={onConfirm}>{busy ? 'Aplicando…' : 'Sí, aplicar'}</button>
            <button type="button" className="pz-btn pz-btn--ghost pz-btn--sm" disabled={busy} onClick={onCancel}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button type="button" className={`pz-btn ${applied ? 'pz-btn--ghost' : ''} pz-btn--sm pz-preset-go`} disabled={applied || busy}
          aria-describedby={`pz-pr-${p.id}`} onClick={onApply}>{applied ? 'Es la configuración actual' : 'Aplicar'}</button>
      )}
    </li>
  );
}
