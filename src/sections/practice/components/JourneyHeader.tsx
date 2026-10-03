import { IcArrowLeft, IcGuide } from '../../../shared/components/icons';

export const JourneyHeader = ({ label, title, onBack, onGuide }: { label: string; title: string; onBack: () => void; onGuide: () => void }) => (
  <div className="jhead">
    <div>
      <small><button aria-label="Volver" onClick={onBack}><IcArrowLeft /></button>{label}</small>
      <b>{title}</b>
    </div>
    <button className="guide" onClick={onGuide}><IcGuide />GUÍA</button>
  </div>
);
