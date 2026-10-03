import { IcShield, IcShieldBlock } from '../../../shared/components/icons';

/** Overlay de moderación: "Moderando…" (check) o "Este link no se puede abrir" (block). */
export function ModerationOverlay({ state, onOk }: { state: 'none' | 'check' | 'block'; onOk: () => void }) {
  const block = state === 'block';
  return (
    <div className={`modov${state !== 'none' ? ' show' : ''}${block ? ' block' : ''}`} aria-live="polite">
      <div className="mcard">
        <span className="mic">{block ? <IcShieldBlock /> : <IcShield />}</span>
        <h3>{block ? 'Este link no se puede abrir' : 'Moderando…'}</h3>
        <p>{block ? 'Revisamos la página y su contenido no es apropiado para tu edad.' : 'Estamos revisando que todo el contenido de esta página sea apropiado para vos.'}</p>
        <span className="mbar"><i /></span>
        <button className="mok" onClick={onOk}>Entendido</button>
      </div>
    </div>
  );
}
