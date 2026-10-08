import type { Journey } from '../../../api/types';
import { IcBook } from '../../../shared/components/icons';
import { imgSrc } from '../../../shared/lib/img';
import { TYPES } from '../lib/exerciseTypes';

/** Encabezado del recorrido: curso, unidad, guía de estudio y una barra con un segmento por paso. */
export function PracticeHeader({ j, done, onBack, onGuide }: { j: Journey; done: number; onBack: () => void; onGuide: () => void }) {
  const nodes = j.items.filter((it) => it.kind === 'node');
  const xp = nodes.filter((it) => it.kind === 'node' && it.n < done).reduce((s, it) => s + (it.kind === 'node' ? it.xp : 0), 0);
  return (
    <header className="phead">
      <button className="back" onClick={onBack}>‹ Practicar</button>
      <div className="phrow">
        <span className="phart" style={{ background: `linear-gradient(135deg,${j.courseBg[0]},${j.courseBg[1]})` }}>
          <img src={imgSrc(j.courseImg)} alt="" />
        </span>
        <div className="phtxt">
          <small>{j.courseName} · {j.unitLabel}</small>
          <h2 className="h2">{j.title}</h2>
        </div>
        <button className="guidebtn" onClick={onGuide}><IcBook />Guía de estudio</button>
      </div>
      <div className="segs" role="progressbar" aria-valuemin={0} aria-valuemax={nodes.length} aria-valuenow={Math.min(done, nodes.length)}>
        {nodes.map((it) => it.kind === 'node' && (
          <span key={it.n} className={`seg ${it.n < done ? 'done' : it.n === done ? 'cur' : ''}`} style={{ ['--c' as string]: TYPES[it.type].c }} />
        ))}
      </div>
      <p className="pstat"><b>{Math.min(done, nodes.length)} de {nodes.length}</b> pasos completados · <b>{xp} XP</b> ganados en esta unidad</p>
    </header>
  );
}
