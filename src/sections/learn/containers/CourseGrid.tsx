import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import { useAsync } from '../../../hooks/useAsync';
import { IcNavCreate } from '../../../shared/components/icons';
import { CourseCard } from '../cards/CourseCard';
import { CourseCardSkeleton } from '../cards/CourseCardSkeleton';

/** Grilla de cursos. La usan Aprender y Practicar (con barra de avance). */
export function CourseGrid({ practice }: { practice?: boolean }) {
  const { data } = useAsync(() => api.courses(), []);
  const go = useNavigate();
  return (
    <section className="view" id={practice ? 'v-practice' : 'v-learn'}>
      <div className="lp-head">
        <h2 className="h2">{practice ? 'Practicar' : 'Aprender'}</h2>
        {/* Crear vive DENTRO de Aprender (pedido 12-oct): botón a la altura del título, va a /crear */}
        {!practice && (
          <button className="lp-create" onClick={() => go('/crear')}>
            <IcNavCreate />Crear
          </button>
        )}
      </div>
      <p className="lede">{practice ? 'Elegí un curso y seguí tu camino.' : 'Elegí un curso para estudiar.'}</p>
      <div className="cgrid">
        {data
          ? data.map((c, i) => <CourseCard key={c.id} c={c} index={i} practice={practice} onOpen={() => go(`/${practice ? 'practicar' : 'aprender'}/${c.id}`)} />)
          : Array.from({ length: 6 }, (_, i) => <CourseCardSkeleton key={i} />)}
      </div>
    </section>
  );
}
