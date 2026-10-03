import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../../api';
import type { Journey } from '../../../api/types';
import { useAsync, wait } from '../../../hooks/useAsync';
import { JourneyNode } from '../cards/JourneyNode';
import { JourneyDivider } from '../components/JourneyDivider';
import { JourneyHeader } from '../components/JourneyHeader';
import { burst } from '../lib/burst';
import { layoutJourney } from '../lib/journey';

export function JourneyPage() {
  const { id = '' } = useParams();
  const go = useNavigate();
  const loc = useLocation();
  const completed = (loc.state as { completed?: number } | null)?.completed;
  const { data: j, setData } = useAsync(() => api.journey(id), [id]);
  const [shownDone, setShownDone] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const nodes = useRef<Record<number, HTMLButtonElement | null>>({});
  const layout = useMemo(() => (j ? layoutJourney(j.items) : null), [j]);

  const scrollToNode = (n: number, smooth: boolean) => {
    const el = nodes.current[n], sc = scroller.current;
    if (el && sc) sc.scrollTo({ top: Math.max(0, el.offsetTop - sc.clientHeight * 0.755), behavior: smooth ? 'smooth' : 'auto' });
  };

  // scroll pendiente: se aplica cuando los nodos ya están en el DOM
  const pending = useRef<{ n: number; smooth: boolean } | null>(null);
  useLayoutEffect(() => {
    if (pending.current) { scrollToNode(pending.current.n, pending.current.smooth); pending.current = null; }
  }, [shownDone]);

  // Al volver de un ejercicio aprobado: explosión en ese nodo, se desbloquea el siguiente y baja el camino.
  useLayoutEffect(() => {
    if (!j) return;
    const first = shownDone === null;
    if (completed === undefined || completed !== j.done - 1) { pending.current = { n: j.done, smooth: !first }; setShownDone(j.done); return; }
    pending.current = { n: completed, smooth: false };
    setShownDone(completed);
    let alive = true;
    (async () => {
      await wait(600); if (!alive) return;
      const node = nodes.current[completed], type = j.items.find((it) => it.kind === 'node' && it.n === completed);
      if (node && track.current && type?.kind === 'node') burst(track.current, node, type.type);
      setShownDone(j.done);
      await wait(900); if (!alive) return;
      scrollToNode(j.done, true);
      go('.', { replace: true, state: null }); // que un refresh no repita la animación
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [j]);

  const openNode = async (n: number, type: string) => {
    if (type === 'trophy') { // el hito no tiene ejercicio: se cobra directo
      const node = nodes.current[n];
      const { done } = await api.completeNode(id, n);
      if (node && track.current) burst(track.current, node, 'trophy');
      setData({ ...(j as Journey), done });
      return;
    }
    go(`/practicar/${id}/ejercicio/${n}`);
  };

  return (
    <section className="view" id="v-journey">
      <div className="jarea">
        <div className="jscroll" ref={scroller}>
          {j && layout && shownDone !== null && (
            <div className="jtrack" ref={track} style={{ height: layout.height }}>
              {layout.placed.map((p, i) => p.kind === 'div'
                ? <JourneyDivider key={`d${i}`} title={p.title} y={p.y} />
                : <JourneyNode key={p.n} ref={(el) => { nodes.current[p.n] = el; }} type={p.type} x={p.x!} y={p.y}
                  state={p.n < shownDone ? 'done' : p.n === shownDone ? 'current' : 'locked'} onClick={() => openNode(p.n, p.type)} />)}
            </div>
          )}
        </div>
        <div className="jfade" />
        <JourneyHeader label={j?.unitLabel ?? ''} title={j?.title ?? ''} onBack={() => go('/practicar')} onGuide={() => go(`/aprender/${id}`)} />
      </div>
    </section>
  );
}
