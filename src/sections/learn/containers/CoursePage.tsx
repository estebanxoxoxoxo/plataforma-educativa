import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import type { Chapter } from '../../../api/types';
import { useAsync } from '../../../hooks/useAsync';
import { CourseArt } from '../components/CourseArt';
import { UnitAccordion } from '../components/UnitAccordion';

export function CoursePage() {
  const { id = '' } = useParams();
  const go = useNavigate();
  const { data: c, error } = useAsync(() => api.course(id), [id]);

  // El contenido se abre en el lector moderado o el reproductor (/buscar/…) con un "volver" al curso.
  const back = { backTo: `/aprender/${id}`, backLabel: '‹ Volver al curso' };
  const open = (ch: Chapter) => (ch.target.type === 'video'
    ? go(`/buscar/video/${ch.target.id}`, { state: back })
    : go(`/buscar/articulo/${encodeURIComponent(ch.target.url)}`, { state: back }));

  return (
    <section className="view" id="v-course">
      <button className="back" onClick={() => go('/aprender')}>‹ Cursos</button>
      {error && <p className="lede">No pudimos cargar el curso ahora. Probemos de nuevo en un ratito.</p>}
      {!c && !error && <p className="lede cprep">Preparando el curso con contenidos aprobados…</p>}
      {c && <>
        <div className="chead"><CourseArt c={c} /><div><h2 className="h2">{c.name}</h2><p className="lede">{c.units} unidades · {c.chapters} capítulos</p></div></div>
        <UnitAccordion units={c.unitList} onOpen={open} />
      </>}
    </section>
  );
}
