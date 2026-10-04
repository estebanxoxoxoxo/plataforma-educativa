import { IcShield, IcShieldBlock } from '../../../shared/components/icons';

export type ModState = 'none' | 'check' | 'block' | 'error';

const COPY: Record<Exclude<ModState, 'none'>, { h: string; p: string }> = {
  check: { h: 'Moderando…', p: 'Estamos revisando que todo el contenido de esta página sea apropiado para vos.' },
  // Mismo texto si el sitio no está aprobado o si el juez rechazó el contenido (no revelar las listas).
  block: { h: 'Este link no se puede abrir', p: 'Revisamos la página y su contenido no es apropiado para tu edad.' },
  // Fail-closed: no se pudo leer o revisar → no se muestra.
  error: { h: 'No pude revisar esta página', p: 'Ahora mismo no pude leerla para revisarla. Probemos de nuevo en un ratito.' },
};

/** Overlay de moderación: "Moderando…", "Este link no se puede abrir" o "No pude revisar esta página". */
export function ModerationOverlay({ state, onOk }: { state: ModState; onOk: () => void }) {
  const stopped = state === 'block' || state === 'error';
  const c = COPY[state === 'none' ? 'check' : state];
  return (
    <div className={`modov${state !== 'none' ? ' show' : ''}${stopped ? ' block' : ''}`} aria-live="polite">
      <div className="mcard">
        <span className="mic">{stopped ? <IcShieldBlock /> : <IcShield />}</span>
        <h3>{c.h}</h3>
        <p>{c.p}</p>
        <span className="mbar"><i /></span>
        <button className="mok" onClick={onOk}>Entendido</button>
      </div>
    </div>
  );
}
