import { IcShield, IcShieldBlock } from '../../../shared/components/icons';
import { L } from '../../../shared/lib/lang';

export type ModState = 'none' | 'check' | 'block' | 'error';

// Función y no constante: los textos se resuelven en cada render (L() lee el idioma actual).
const copy = (s: Exclude<ModState, 'none'>): { h: string; p: string } => ({
  check: { h: L('Moderando…', 'Moderating…'), p: L('Estamos revisando que todo el contenido de esta página sea apropiado para vos.', 'We’re checking that everything on this page is right for you.') },
  // Mismo texto si el sitio no está aprobado o si el juez rechazó el contenido (no revelar las listas).
  block: { h: L('Este link no se puede abrir', 'This link can’t be opened'), p: L('Revisamos la página y su contenido no es apropiado para tu edad.', 'We checked the page and its content isn’t right for your age.') },
  // Fail-closed: no se pudo leer o revisar → no se muestra.
  error: { h: L('No pude revisar esta página', 'I couldn’t check this page'), p: L('Ahora mismo no pude leerla para revisarla. Probemos de nuevo en un ratito.', 'I couldn’t read it to check it right now. Let’s try again in a bit.') },
})[s];

/** Overlay de moderación: "Moderando…", "Este link no se puede abrir" o "No pude revisar esta página". */
export function ModerationOverlay({ state, onOk }: { state: ModState; onOk: () => void }) {
  const stopped = state === 'block' || state === 'error';
  const c = copy(state === 'none' ? 'check' : state);
  return (
    <div className={`modov${state !== 'none' ? ' show' : ''}${stopped ? ' block' : ''}`} aria-live="polite">
      <div className="mcard">
        <span className="mic">{stopped ? <IcShieldBlock /> : <IcShield />}</span>
        <h3>{c.h}</h3>
        <p>{c.p}</p>
        <span className="mbar"><i /></span>
        <button className="mok" onClick={onOk}>{L('Entendido', 'Got it')}</button>
      </div>
    </div>
  );
}
