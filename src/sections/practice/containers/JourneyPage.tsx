import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import type { Journey, JourneyItem } from '../../../api/types';
import { useAsync, wait } from '../../../hooks/useAsync';
import { MilestoneCard } from '../cards/MilestoneCard';
import { StepCard, type StepState } from '../cards/StepCard';
import { PracticeHeader } from '../components/PracticeHeader';
import { ProgressPanel } from '../components/ProgressPanel';
import { burst } from '../lib/burst';

type Node = Extract<JourneyItem, { kind: 'node' }>;
type Section = { title: string; nodes: Node[] };

/* Agrupa los ítems del recorrido en secciones (cada 'div' abre una). */
function toSections(items: JourneyItem[]): Section[] {
  const out: Section[] = [];
  for (const it of items) {
    if (it.kind === 'div') out.push({ title: it.title, nodes: [] });
    else (out[out.length - 1] ?? (out[0] = { title: '', nodes: [] })).nodes.push(it);
  }
  return out;
}

export function JourneyPage() {
  const { id = '' } = useParams();
  const go = useNavigate();
  const loc = useLocation();
  const completed = (loc.state as { completed?: number } | null)?.completed;
  const { data: j, setData, error } = useAsync(() => api.journey(id), [id]);
  const [shownDone, setShownDone] = useState<number | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const dots = useRef<Record<number, HTMLSpanElement | null>>({});
  const sections = useMemo(() => (j ? toSections(j.items) : []), [j]);

  const scrollToStep = (n: number, smooth: boolean) =>
    dots.current[n]?.closest('li')?.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });

  const pending = useRef<{ n: number; smooth: boolean } | null>(null);
  useLayoutEffect(() => {
    if (pending.current) { scrollToStep(pending.current.n, pending.current.smooth); pending.current = null; }
  }, [shownDone]);

  // Al volver de un ejercicio aprobado: destello en ese paso, se habilita el siguiente y se centra.
  useLayoutEffect(() => {
    if (!j) return;
    if (completed === undefined || completed !== j.done - 1) { pending.current = { n: j.done, smooth: shownDone !== null }; setShownDone(j.done); return; }
    pending.current = { n: completed, smooth: false };
    setShownDone(completed);
    let alive = true;
    (async () => {
      await wait(450); if (!alive) return;
      const dot = dots.current[completed], node = j.items.find((it) => it.kind === 'node' && it.n === completed);
      if (dot && list.current && node?.kind === 'node') burst(list.current, dot, node.type);
      setShownDone(j.done);
      await wait(700); if (!alive) return;
      scrollToStep(j.done, true);
      go('.', { replace: true, state: null }); // que un refresh no repita la animación
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [j]);

  const open = async (n: Node) => {
    if (n.type === 'trophy') { // la insignia no tiene ejercicio: se reclama directo
      const dot = dots.current[n.n];
      const { done } = await api.completeNode(id, n.n);
      if (dot && list.current) burst(list.current, dot, 'trophy');
      setData({ ...(j as Journey), done });
      return;
    }
    go(`/practicar/${id}/ejercicio/${n.n}`);
  };

  // La primera vez que se practica un curso generado, el server arma los ejercicios (puede tardar): se avisa.
  if (!j || shownDone === null) return (
    <section className="view" id="v-journey">
      <button className="back" onClick={() => go('/practicar')}>‹ Practicar</button>
      <p className="lede pjwait">{error ? 'No pude armar la práctica de este curso ahora. Probemos de nuevo en un ratito.' : 'Preparando la práctica con el contenido del curso…'}</p>
    </section>
  );
  const state = (n: number): StepState => (n < shownDone ? 'done' : n === shownDone ? 'current' : 'locked');

  return (
    <section className="view" id="v-journey">
      <div className="pj">
        <div className="pjmain">
          <PracticeHeader j={j} done={shownDone} onBack={() => go('/practicar')} onGuide={() => go(`/aprender/${id}`)} />
          <div className="psections" ref={list}>
            {sections.map((s, si) => {
              const exercises = s.nodes.filter((n) => n.type !== 'trophy');
              const sDone = exercises.filter((n) => n.n < shownDone).length;
              return (
                <section key={si} className="psec">
                  <div className="psechead">
                    <span className="psnum">{si + 1}</span>
                    <div><small>Sección {si + 1}</small><h3>{s.title}</h3></div>
                    <span className="psprog"><b>{sDone}/{exercises.length}</b><i><i style={{ width: `${(sDone / Math.max(1, exercises.length)) * 100}%` }} /></i></span>
                  </div>
                  <ol className="steps">
                    {s.nodes.map((n, k) => n.type === 'trophy'
                      ? <MilestoneCard key={n.n} ref={(el) => { dots.current[n.n] = el; }} badge={n.badge ?? 'Insignia'} xp={n.xp} state={state(n.n)} last={k === s.nodes.length - 1} onClaim={() => open(n)} />
                      : <StepCard key={n.n} ref={(el) => { dots.current[n.n] = el; }} n={n.n} type={n.type} state={state(n.n)} prompt={n.prompt} seconds={n.seconds} xp={n.xp}
                          first={k === 0} last={k === s.nodes.length - 1} onOpen={() => open(n)} />)}
                  </ol>
                </section>
              );
            })}
          </div>
        </div>
        <ProgressPanel j={j} done={shownDone} onOpen={open} />
      </div>
    </section>
  );
}
