import type { Course, RecallCourseState } from '../../../api/types';
import { CourseArt } from '../../learn/components/CourseArt';
import { LevelBadge } from '../components/LevelBadge';
import { levelOf } from '../lib/levels';

/** Fila de un curso: arte, nombre, cuántas cartas quedan por reforzar y la fuerza media en una barra. */
export function CourseStrengthRow({ c, look, index }: { c: RecallCourseState; look?: Pick<Course, 'img' | 'bg'>; index: number }) {
  const lv = levelOf(c.avg);
  return (
    <li className="rc-row" style={{ animationDelay: `${index * 60}ms` }}>
      <span className="rc-row-art">
        {look ? <CourseArt c={look} /> : <span className="rc-row-ini" aria-hidden="true">{c.name[0]}</span>}
      </span>
      <div className="rc-row-txt">
        <b>{c.name}</b>
        <small>{c.weak === 0 ? '¡Todo firme!' : `${c.weak} por reforzar`} · {c.total === 1 ? '1 dato' : `${c.total} datos`}</small>
      </div>
      <div className="rc-row-meter">
        <span className={`rc-meter rc-meter--${lv}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={c.avg} aria-label={`Qué tan firme está ${c.name}`}>
          <i style={{ width: `${c.avg}%` }} />
        </span>
        <small>{c.avg}%</small>
      </div>
      <LevelBadge level={lv} />
    </li>
  );
}
