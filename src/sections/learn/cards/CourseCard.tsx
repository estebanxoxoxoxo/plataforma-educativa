import type { Course } from '../../../api/types';
import { IcSpark } from '../../../shared/components/icons';
import { CourseArt } from '../components/CourseArt';

export function CourseCard({ c, practice, index, onOpen }: { c: Course; practice?: boolean; index: number; onOpen: () => void }) {
  return (
    <button className="course pop" style={{ animationDelay: `${index * 90}ms` }} onClick={onOpen}>
      <CourseArt c={c} />
      {c.isNew && <span className="newb"><IcSpark />Añadido recientemente</span>}
      <div className="meta">
        <h3>{c.name}</h3>
        {practice
          ? <><div className="pbar"><i style={{ width: `${c.progress}%` }} /></div><small>{c.progress}% completado</small></>
          : <small>{c.units} unidades</small>}
      </div>
    </button>
  );
}
