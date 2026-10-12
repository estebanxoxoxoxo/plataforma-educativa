import type { Course } from '../../../api/types';
import { IcSpark } from '../../../shared/components/icons';
import { CourseArt } from '../components/CourseArt';

export function CourseCard({ c, practice, index, onOpen }: { c: Course; practice?: boolean; index: number; onOpen: () => void }) {
  return (
    <button className="course pop" style={{ animationDelay: `${index * 90}ms` }} onClick={onOpen}>
      <CourseArt c={c} />
      {c.isNew && <span className="newb"><IcSpark />Añadido recientemente</span>}
      <div className="meta">
        {/* El span interno lleva el clamp de 2 líneas; el h3 centra verticalmente los títulos de UNA línea
            en ese mismo alto (pedido 12-oct), así "N unidades" queda alineado entre cards vecinas. */}
        <h3><span>{c.name}</span></h3>
        {practice
          ? <><div className="pbar"><i style={{ width: `${c.progress}%` }} /></div><small>{c.progress}% completado</small></>
          : <small>{c.units} unidades</small>}
      </div>
    </button>
  );
}
