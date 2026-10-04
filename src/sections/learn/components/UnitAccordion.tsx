import { useState } from 'react';
import type { Chapter, CourseDetail } from '../../../api/types';
import { IcChev } from '../../../shared/components/icons';
import { ChapterCard } from '../cards/ChapterCard';

/** Acordeón de unidades → capítulos (un contenido real cada uno). Una unidad abierta a la vez. */
export function UnitAccordion({ units, onOpen }: { units: CourseDetail['unitList']; onOpen: (c: Chapter) => void }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="units">
      {units.map((u, i) => (
        <div key={i} className={`unit${i === open ? ' open' : ''}`}>
          <button className="uhead" aria-expanded={i === open} onClick={() => setOpen(i === open ? -1 : i)}>
            <span className="unum">{i + 1}</span>{u.title}<span className="cnt">{u.chapters.length} capítulos</span><IcChev className="chev" />
          </button>
          <div className="ubody">
            {u.chapters.map((c, j) => <ChapterCard key={j} n={`${i + 1}.${j + 1}`} c={c} onOpen={onOpen} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
