import type { FeedSidebar } from '../../../api/types';
import { IcArrowRight, IcTrophyLine } from '../../../shared/components/icons';
import { MEDAL_INFO, lastWeekLabel } from '../../leagues/lib/cycle';

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Panel auxiliar de la derecha: seguir practicando, tu liga (con la medallita del cierre pasado) y temas para explorar. */
export function FeedAside({ s, onContinue, onLeague, onTopic }: {
  s: FeedSidebar; onContinue: (courseId: string) => void; onLeague: () => void; onTopic: (t: string) => void;
}) {
  const pct = Math.round((s.continue.done / Math.max(1, s.continue.total)) * 100);
  const medal = s.league.medal ? MEDAL_INFO[s.league.medal] : null;
  return (
    <aside className="faside">
      <section className="hcard">
        <h4>Seguí practicando</h4>
        <b className="htitle">{s.continue.title}</b>
        <span className="hbar"><i style={{ width: `${pct}%` }} /></span>
        <span className="hmeta">{s.continue.done} de {s.continue.total} pasos</span>
        <button className="hbtn" onClick={() => onContinue(s.continue.courseId)}>Continuar<IcArrowRight /></button>
      </section>
      <section className="hcard">
        <h4>Tu liga</h4>
        <div className="hleague">
          <span className="hcup"><IcTrophyLine /></span>
          <div>
            <span className="hlname">
              <b className="htitle">{s.league.name}</b>
              {medal && (
                <span className="hmedal" data-medal={s.league.medal} role="img" title={lastWeekLabel(medal.pos)}
                  aria-label={`${medal.name}: ${lastWeekLabel(medal.pos)}`}>{medal.emoji}</span>
              )}
            </span>
            <span className="hmeta">Asignada por tus resultados · <span className="hpos">{s.league.pos}º de {s.league.total}</span></span>
          </div>
        </div>
        <dl className="hranks">
          <div><dt>{s.league.zone.name}</dt><dd>#{s.league.zone.pos.toLocaleString('es-AR')}</dd></div>
          <div><dt>{s.league.country.name}</dt><dd>#{s.league.country.pos.toLocaleString('es-AR')}</dd></div>
        </dl>
        <button className="hbtn ghost" onClick={onLeague}>Ver mi liga<IcArrowRight /></button>
      </section>
      {s.topics.length > 0 && (
        <section className="hcard">
          <h4>Temas para explorar</h4>
          <div className="htopics">
            {s.topics.map((t) => <button key={t} className="htopic" onClick={() => onTopic(t)}>{cap(t)}</button>)}
          </div>
        </section>
      )}
    </aside>
  );
}
