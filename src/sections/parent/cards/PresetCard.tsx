import { FEATURE_LABEL, FEATURE_ORDER, quoted } from '../lib/format';
import type { PresetView } from '../lib/types';
import { L } from '../../../shared/lib/lang';

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
  const vol = s ? (s.volume.maxMusic >= 100 && s.volume.maxNoise >= 100 ? L('Sin tope de volumen', 'No volume cap')
    : s.volume.maxMusic === s.volume.maxNoise ? L(`Música y ruidos hasta ${s.volume.maxMusic}`, `Music and sounds up to ${s.volume.maxMusic}`)
    : L(`Música hasta ${s.volume.maxMusic} · ruidos hasta ${s.volume.maxNoise}`, `Music up to ${s.volume.maxMusic} · sounds up to ${s.volume.maxNoise}`)) : '';
  return (
    <li className={`pz-preset${applied ? ' is-on' : ''}${confirming ? ' is-confirming' : ''}`} data-preset={p.id}>
      <div className="pz-preset-head">
        <h4 className="pz-preset-name" id={`pz-pr-${p.id}`}>{p.name}</h4>
        {applied && (
          <span className="pz-preset-badge">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l2.9 2.9 6.1-6.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {L('Aplicado', 'Applied')}
          </span>
        )}
      </div>
      <p className="pz-preset-desc">{p.desc}</p>
      {s && (
        <dl className="pz-preset-spec">
          <div>
            <dt>{L('Funcionalidades', 'Features')}</dt>
            <dd className="pz-pfs">
              {FEATURE_ORDER.map((k) => (
                <span key={k} className={`pz-pf${s.features[k] ? ' is-on' : ''}`}>
                  <span aria-hidden="true">{s.features[k] ? '✓' : '✕'}</span> {FEATURE_LABEL[k]}<span className="pz-sr">{s.features[k] ? L(': prendida', ': on') : L(': apagada', ': off')}</span>
                </span>
              ))}
            </dd>
          </div>
          <div>
            <dt>{L('Temas', 'Topics')}</dt>
            <dd>
              {s.topics.black.length === 0 && s.topics.white.length === 0 ? L('Sin temas de la familia', 'No family topics') : (
                <>
                  {s.topics.white.length > 0 && <span className="pz-preset-line">{L('Sugiere', 'Suggests')} {quoted(s.topics.white.map((t) => p.topicLabels?.[t] ?? t))}</span>}
                  {s.topics.black.length > 0 && <span className="pz-preset-line">{L('Fuera:', 'Out:')} {quoted(s.topics.black.map((t) => p.topicLabels?.[t] ?? t))}</span>}
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>{L('Volumen', 'Volume')}</dt>
            <dd>{vol}</dd>
          </div>
        </dl>
      )}
      {confirming ? (
        <div className="pz-preset-confirm" role="group" aria-label={L(`Confirmar ${p.name}`, `Confirm ${p.name}`)}>
          <p className="pz-preset-confirm-t">{L('Al aplicarlo:', 'When you apply it:')}</p>
          <ul>{changes.map((c) => <li key={c}>{c}</li>)}</ul>
          <div className="pz-form-btns">
            <button type="button" className="pz-btn pz-btn--sm" disabled={busy} onClick={onConfirm}>{busy ? L('Aplicando…', 'Applying…') : L('Sí, aplicar', 'Yes, apply')}</button>
            <button type="button" className="pz-btn pz-btn--ghost pz-btn--sm" disabled={busy} onClick={onCancel}>{L('Cancelar', 'Cancel')}</button>
          </div>
        </div>
      ) : (
        <button type="button" className={`pz-btn ${applied ? 'pz-btn--ghost' : ''} pz-btn--sm pz-preset-go`} disabled={applied || busy}
          aria-describedby={`pz-pr-${p.id}`} onClick={onApply}>{applied ? L('Es la configuración actual', 'It’s the current setup') : L('Aplicar', 'Apply')}</button>
      )}
    </li>
  );
}
