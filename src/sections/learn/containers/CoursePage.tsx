import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import { useAsync } from '../../../hooks/useAsync';
import { CourseArt } from '../components/CourseArt';
import { UnitAccordion } from '../components/UnitAccordion';

export function CoursePage() {
  const { id = '' } = useParams();
  const go = useNavigate();
  const { data: c } = useAsync(() => api.course(id), [id]);
  return (
    <section className="view" id="v-course">
      <button className="back" onClick={() => go('/aprender')}>‹ Cursos</button>
      {c && <>
        <div className="chead"><CourseArt c={c} /><div><h2 className="h2">{c.name}</h2><p className="lede">{c.units} unidades · {c.chapters} capítulos</p></div></div>
        <UnitAccordion units={c.unitList} />
      </>}
    </section>
  );
}
