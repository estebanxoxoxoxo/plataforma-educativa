import { IcSpark } from '../../../shared/components/icons';

/** Modal "Generar curso" (aviso único de curso en preparación). */
export function GenerateCourseModal({ open, topic, onClose }: { open: boolean; topic: string; onClose: () => void }) {
  return (
    <div className={`genov${open ? ' show' : ''}`} role="dialog" aria-modal="true">
      <div className="gcard">
        <span className="k"><IcSpark />Generar curso</span>
        <h3>Estamos armando tu curso</h3>
        <div className="gdone">
          <p>El curso <b>{topic}</b> va a estar listo en unos minutos. Lo vas a encontrar en <b>Aprender</b> y en <b>Practicar</b>.</p>
          <button className="gok" onClick={onClose}>Entendido</button>
        </div>
      </div>
    </div>
  );
}
