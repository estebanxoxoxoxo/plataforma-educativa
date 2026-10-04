import type { Chapter } from '../../../api/types';
import { IcArrowRight, IcResLect, IcResVideo } from '../../../shared/components/icons';

/** Capítulo de un curso: UN contenido real. Toda la fila es clickeable y lleva al contenido. */
export function ChapterCard({ n, c, onOpen }: { n: string; c: Chapter; onOpen: (c: Chapter) => void }) {
  const Icon = c.kind === 'video' ? IcResVideo : IcResLect;
  return (
    <button className="chap" onClick={() => onOpen(c)} aria-label={`${c.title} — ${c.label}, de ${c.source}`}>
      <span className="n">{n}</span>
      <span className="ctxt"><b>{c.title}</b><small>{c.source}</small></span>
      <span className={`rc ${c.kind === 'video' ? 'video' : 'lect'}`}><Icon />{c.label}</span>
      <IcArrowRight className="go" />
    </button>
  );
}
