import { useState } from 'react';
import type { CourseDetail, ResourceKind } from '../../../api/types';
import { IcChev } from '../../../shared/components/icons';
import { ResourceChip } from './ResourceChip';

/** Acordeón de unidades → capítulos → recursos. Una unidad abierta a la vez. */
export function UnitAccordion({ units, onResource }: { units: CourseDetail['unitList']; onResource?: (u: number, c: number, kind: ResourceKind) => void }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="units">
      {units.map((u, i) => (
        <div key={i} className={`unit${i === open ? ' open' : ''}`}>
          <button className="uhead" aria-expanded={i === open} onClick={() => setOpen(i === open ? -1 : i)}>
            <span className="unum">{i + 1}</span>{u.title}<span className="cnt">{u.chapters.length} capítulos</span><IcChev className="chev" />
          </button>
          <div className="ubody">
            {u.chapters.map((c, j) => (
              <div key={j} className="chap">
                <span className="n">{i + 1}.{j + 1}</span><b>{c.title}</b>
                <span className="res">{c.resources.map((r) => <ResourceChip key={r.kind} kind={r.kind} label={r.label} onOpen={() => onResource?.(i, j, r.kind)} />)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
