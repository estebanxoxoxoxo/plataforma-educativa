import { IcCheck, IcX } from '../../../shared/components/icons';

export const ExerciseFooter = ({ result, title, detail, label, enabled, onClick }: {
  result?: 'good' | 'bad'; title?: string; detail?: string; label: string; enabled: boolean; onClick: () => void;
}) => (
  <div className={`exfoot${result ? ` ${result}` : ''}`}>
    <div className="msg"><span className="ic">{result === 'bad' ? <IcX /> : <IcCheck />}</span><div><b>{title}</b><span>{detail}</span></div></div>
    <button className={`btn${enabled ? ' on' : ''}`} disabled={!enabled && !result} onClick={onClick}>{label}</button>
  </div>
);
