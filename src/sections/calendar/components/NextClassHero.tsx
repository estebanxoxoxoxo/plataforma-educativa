import type { CSSProperties } from 'react';
import { IcClock } from '../../../shared/components/icons';
import type { Hero } from '../lib/calendar';

/** "Tu próxima clase" (o "Ahora mismo" si está pasando): el emoji de la materia sobre el color del profe, el título de
 *  la clase, cuándo es y cuánto falta, y una hoja de almanaque con la fecha (decorativa: repite lo que dice el texto).
 *  Pura. */
export function NextClassHero({ hero }: { hero: Hero }) {
  const e = hero.event;
  return (
    <section className={`cal-hero${hero.live ? ' is-live' : ''}`} aria-labelledby="cal-hero-t" data-event={e.id}>
      <span className="cal-hero-emo" style={{ '--c': e.color } as CSSProperties} aria-hidden="true">{e.emoji}</span>
      <div className="cal-hero-main">
        <span className="cal-kicker">{hero.live && <i className="cal-live" aria-hidden="true" />}{hero.kicker}</span>
        <h3 className="cal-hero-title" id="cal-hero-t">{e.title}</h3>
        <p className="cal-hero-when">{hero.when}</p>
        <span className="cal-chip"><IcClock />{hero.countdown}</span>
      </div>
      <div className="cal-leaf" aria-hidden="true">
        <span className="cal-leaf-m">{hero.leaf.month}</span>
        <span className="cal-leaf-d">{hero.leaf.day}</span>
        <span className="cal-leaf-w">{hero.leaf.weekday}</span>
      </div>
    </section>
  );
}
