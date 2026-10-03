import type { Course } from '../../../api/types';
import { imgSrc } from '../../../shared/lib/img';

/** Miniatura del curso: degradé de color + foto. */
export const CourseArt = ({ c }: { c: Pick<Course, 'bg' | 'img'> }) => (
  <span className="art" style={{ background: `linear-gradient(135deg,${c.bg[0]},${c.bg[1]})` }}>
    <img className="ph-img" src={imgSrc(c.img)} alt="" />
  </span>
);
