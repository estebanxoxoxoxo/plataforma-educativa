import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Moderated } from '../../../api/types';
import { Skeleton } from '../../../shared/components/Skeleton';

type Kind = 'page' | 'img' | 'vid';
const SKEL_COUNT: Record<Kind, number> = { page: 5, img: 18, vid: 10 };
const REVEAL_GAP: Record<Kind, number> = { page: 260, img: 110, vid: 170 };
/** Lista moderada con la secuencia del prototipo:
 *  cargando → esqueletos → se marcan "Filtrado" → desaparecen (FLIP) → se revelan los aptos. */
export function ModeratedResults<T extends { id: string }>({ kind, items, animate, render }: {
  kind: Kind; items: Moderated<T>[] | null; animate: boolean; render: (item: T, i: number) => ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [flagged, setFlagged] = useState(0);
  const [vanish, setVanish] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const rects = useRef<Map<string, DOMRect> | null>(null);

  const blockedIdx = items ? items.map((it, i) => (it.blocked ? i : -1)).filter((i) => i >= 0) : [];
  const okCount = items ? items.length - blockedIdx.length : 0;

  useEffect(() => {
    setFlagged(0); setVanish(false); setRemoved(false); setRevealed(0);
    if (!items) return;
    if (!animate) return;
    let alive = true;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      if (blockedIdx.length) {
        await sleep(700);
        for (let k = 1; k <= blockedIdx.length && alive; k++) { setFlagged(k); await sleep(330); }
        await sleep(800); if (!alive) return;
        setVanish(true); await sleep(380); if (!alive) return;
        // FLIP: guardar posiciones antes de sacar los filtrados
        rects.current = new Map([...box.current!.querySelectorAll<HTMLElement>('[data-key]')].map((el) => [el.dataset.key!, el.getBoundingClientRect()]));
        setRemoved(true); await sleep(1020);
      } else {
        setRemoved(true);
      }
      for (let k = 1; k <= okCount && alive; k++) { setRevealed(k); await sleep(REVEAL_GAP[kind]); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, animate]);

  useLayoutEffect(() => {
    const before = rects.current;
    if (!removed || !before || !box.current) return;
    rects.current = null;
    for (const el of box.current.querySelectorAll<HTMLElement>('[data-key]')) {
      const f = before.get(el.dataset.key!); if (!f) continue;
      const l = el.getBoundingClientRect();
      const scale = l.width / (el.offsetWidth || 1); // compensa el modo stage escalado
      const dx = (f.left - l.left) / scale, dy = (f.top - l.top) / scale;
      if (dx || dy) el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }, [removed]);

  const instant = !!items && !animate; // resultados ya listos (otra solapa / caché): sin animación
  const isRemoved = instant || removed;
  const nRevealed = instant ? okCount : revealed;
  const cls = `results ${kind}s`;
  if (!items) {
    return <div className={cls} ref={box}>{Array.from({ length: SKEL_COUNT[kind] }, (_, i) => (
      <div key={i} className="it sk pop" style={{ animationDelay: `${i * 50}ms` }}><Skeleton /></div>
    ))}</div>;
  }
  let okIdx = -1;
  return (
    <div className={cls} ref={box}>
      {items.map((it, i) => {
        if (it.blocked) {
          if (isRemoved) return null;
          const fl = blockedIdx.indexOf(i) < flagged;
          return <div key={it.id} data-key={it.id} className={`it sk${fl ? ' flagged' : ''}${vanish ? ' vanish' : ''}`}><Skeleton /></div>;
        }
        okIdx++;
        const show = okIdx < nRevealed;
        return show
          ? <div key={it.id} data-key={it.id} className="it in">{render(it as T, okIdx)}</div>
          : <div key={it.id} data-key={it.id} className="it sk"><Skeleton /></div>;
      })}
    </div>
  );
}
