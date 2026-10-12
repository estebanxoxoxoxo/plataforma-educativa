import { useEffect, useState } from 'react';
import type { LearnRoute } from '../lib/learn';
import { nextCoverOnError, routeCover } from '../lib/routeCover';
import { IcChevronRight, IcStar } from '../components/LearnIcons';

/** Tarjeta de una ruta en el mosaico (RouteCard del POC): portada 16:9 (la subida en /crear, o la miniatura del primer
 *  contenido si es un video; si no, el emoji), título, descripción si tiene, barra de progreso y "★ N/M postas".
 *  Estética de Innerith: el patrón de la tarjeta de Aprender (borde, radio, sombra suave, título centrado en el alto de
 *  dos líneas). Pura: el avance llega calculado. */
export function RouteCard({ route, done, total, index, onOpen }: { route: LearnRoute; done: number; total: number; index: number; onOpen: () => void }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  const cover = routeCover(route);
  const [imgSrc, setImgSrc] = useState<string | null>(cover);
  useEffect(() => setImgSrc(cover), [cover]);
  return (
    <button type="button" className="ln-card pop" style={{ animationDelay: `${index * 90}ms` }} onClick={onOpen}>
      {/* PORTADA 16:9 — imagen del 1er contenido (o subida); emoji si no hay. object-cover llena todo. */}
      <span className="ln-card-art">
        {imgSrc
          ? <img src={imgSrc} alt="" loading="lazy" onError={() => setImgSrc((s) => nextCoverOnError(s))} />
          : <span className="ln-card-emoji" aria-hidden="true">{route.emoji}</span>}
      </span>
      <span className="ln-card-meta">
        <span className="ln-card-title"><span>{route.title}</span></span>
        {route.description && <span className="ln-card-desc">{route.description}</span>}
        <span className="ln-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
        <span className="ln-card-foot">
          <IcStar className="ln-star" fill="currentColor" strokeWidth={0} /> {done}/{total} postas
          <IcChevronRight className="ln-go" />
        </span>
      </span>
    </button>
  );
}

/** Lugar de una tarjeta mientras llegan las rutas. */
export const RouteCardSkeleton = () => (
  <span className="ln-card is-sk" aria-hidden="true">
    <span className="ln-card-art" />
    <span className="ln-card-meta"><i /><i /></span>
  </span>
);
