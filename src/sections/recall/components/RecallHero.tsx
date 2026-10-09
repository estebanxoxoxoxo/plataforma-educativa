import { Link } from 'react-router-dom';
import type { RecallSummary } from '../../../api/types';
import { IcArrowRight, IcCheck } from '../../../shared/components/icons';
import { minutesFor, plural } from '../lib/levels';

type Today = RecallSummary['today'];

/** Mazo dibujado (decorativo): tres cartas apiladas; la de adelante muestra "?" o, con la sesión hecha, el tilde. */
const Deck = ({ done }: { done: boolean }) => (
  <div className={`rc-deck${done ? ' rc-deck--done' : ''}`} aria-hidden="true">
    <span className="rc-deck-c rc-deck-c1" />
    <span className="rc-deck-c rc-deck-c2" />
    <span className="rc-deck-c rc-deck-c3">
      {done ? <b className="rc-deck-ok"><IcCheck /></b> : <b className="rc-deck-q">?</b>}
      <i /><i />
    </span>
  </div>
);

/** "La sesión de hoy": pendiente (cuántas cartas, de qué cursos, Empezar) · hecha (mensaje + Sesión extra) ·
 *  sin material (invitación a Practicar). Puro: el contenedor pasa los datos y las acciones. */
export function RecallHero({ today, coinOn, colorOf, onStart, onExtra }: {
  today: Today; coinOn: boolean;
  /** Color de cada curso (por nombre) para los chips; sin dato, uno neutro */ colorOf: (course: string) => string | undefined;
  onStart: () => void; onExtra: () => void;
}) {
  if (today.state === 'sin-material') {
    return (
      <section className="rc-hero rc-hero--empty" aria-labelledby="rc-hero-t">
        <div className="rc-hero-main">
          <span className="rc-kicker">La sesión de hoy</span>
          <h3 className="rc-hero-title" id="rc-hero-t">Todavía no hay cartas para repasar</h3>
          <p className="rc-hero-sub">Cuando practiques en Practicar, los datos que vayas aprendiendo aparecen acá para que los repases un ratito cada día.</p>
          <div className="rc-hero-act">
            <Link className="rc-start" to="/practicar">Ir a Practicar<IcArrowRight /></Link>
          </div>
        </div>
        <Deck done={false} />
      </section>
    );
  }

  const chips = (
    <ul className="rc-chips" aria-label="Cursos de la sesión">
      {today.courses.map((c) => (
        <li key={c} className="rc-chip"><i aria-hidden="true" style={{ background: colorOf(c) ?? '#9AA5C4' }} />{c}</li>
      ))}
    </ul>
  );

  if (today.state === 'hecha') {
    return (
      <section className="rc-hero rc-hero--done" aria-labelledby="rc-hero-t">
        <div className="rc-hero-main">
          <span className="rc-kicker">La sesión de hoy <span className="rc-done-tag"><IcCheck />Hecha</span></span>
          <h3 className="rc-hero-title" id="rc-hero-t">¡Listo por hoy!</h3>
          <p className="rc-hero-sub">
            Repasaste {plural(today.cards, 'carta', 'cartas')}{today.courses.length > 1 ? ` de ${today.courses.length} cursos` : ''}. Mañana te espera otra tanda con lo que más te cuesta.
          </p>
          {chips}
          <div className="rc-hero-act">
            <button className="rc-extra" onClick={onExtra}>Sesión extra<IcArrowRight /></button>
            <span className="rc-hero-note">Para practicar de más: {coinOn ? 'no suma ⚡' : 'no suma puntos'}</span>
          </div>
        </div>
        <Deck done />
      </section>
    );
  }

  return (
    <section className="rc-hero" aria-labelledby="rc-hero-t">
      <div className="rc-hero-main">
        <span className="rc-kicker">La sesión de hoy</span>
        <h3 className="rc-hero-title" id="rc-hero-t"><b>{today.cards}</b> {today.cards === 1 ? 'carta' : 'cartas'} para repasar</h3>
        <p className="rc-hero-sub">
          Lo que más te está costando{today.courses.length > 1 ? `, mezclado de ${today.courses.length} cursos` : ''}. {minutesFor(today.cards)}.
        </p>
        {chips}
        <div className="rc-hero-act">
          <button className="rc-start" onClick={onStart}>Empezar<IcArrowRight /></button>
          {coinOn && <span className="rc-hero-note">Cada carta bien: <b>+5 ⚡</b></span>}
        </div>
      </div>
      <Deck done={false} />
    </section>
  );
}
