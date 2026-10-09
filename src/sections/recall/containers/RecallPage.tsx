import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api';
import type { Course } from '../../../api/types';
import { useAsync } from '../../../hooks/useAsync';
import { useFeatures } from '../../parent/lib/features';
import { CourseStrengthRow } from '../cards/CourseStrengthRow';
import { RecallHero } from '../components/RecallHero';
import { RecallSkeleton } from '../components/RecallSkeleton';
import { StrengthStrip } from '../components/StrengthStrip';

/** Repasar (home de la sección): "La sesión de hoy" (pendiente / hecha / sin material), cómo vienen las cartas
 *  (flojas, mejorando, firmes + racha) y qué tan firme está cada curso. Todo sale de api.recall(); el arte y el
 *  color de cada curso, del catálogo de cursos (api.courses(), opcional: sin él quedan colores neutros). */
export function RecallPage() {
  const go = useNavigate();
  // Con la Tienda apagada por el padre no se nombra la moneda (⚡): mismo criterio que Practicar.
  const coinOn = useFeatures()?.tienda === true;
  const { data, error, reload } = useAsync(() => api.recall(), []);
  const { data: courses } = useAsync(() => api.courses().catch(() => [] as Course[]), []);
  const looks = useMemo(() => {
    const m = new Map<string, Pick<Course, 'img' | 'bg'>>();
    for (const c of courses ?? []) { m.set(c.id, c); m.set(c.name, c); }
    return m;
  }, [courses]);

  return (
    <section className="view rc-home" id="v-recall">
      <header className="rc-head">
        <h2 className="h2">Repasar</h2>
        <p className="lede">Cartas cortitas con lo que estás afianzando de tus cursos. Un ratito todos los días y lo flojo se pone firme.</p>
      </header>

      {error ? (
        <div className="rc-fail" role="alert">
          <p>No pude traer tus cartas. Probá de nuevo en un ratito.</p>
          <button className="rc-extra" onClick={reload}>Reintentar</button>
        </div>
      ) : !data ? (
        <RecallSkeleton />
      ) : (
        <>
          <RecallHero
            today={data.today} coinOn={coinOn} colorOf={(name) => looks.get(name)?.bg[0]}
            onStart={() => go('/repasar/sesion')} onExtra={() => go('/repasar/sesion?extra=1')}
          />
          {data.total > 0 && <StrengthStrip weak={data.weak} improving={data.improving} firm={data.firm} total={data.total} streak={data.streakDays} />}
          {data.perCourse.length > 0 && (
            <section className="rc-sec" aria-labelledby="rc-sec-t">
              <div className="rc-sechead">
                <h3 id="rc-sec-t">Tus cursos</h3>
                <small>Qué tan firme tenés lo que practicaste en cada uno</small>
              </div>
              <ul className="rc-courses">
                {data.perCourse.map((c, i) => <CourseStrengthRow key={c.courseId} c={c} look={looks.get(c.courseId)} index={i} />)}
              </ul>
            </section>
          )}
        </>
      )}
    </section>
  );
}
